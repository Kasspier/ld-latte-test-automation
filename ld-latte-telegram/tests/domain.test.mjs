import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeUpdate,buildResponse} from '../src/domain.mjs';
import {processUpdate,validatePlan,readOffset,saveOffset} from '../src/relay.mjs';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const rows=n=>Array.from({length:n},(_,i)=>({id:`00000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`,name:`Услуга ${i+1}`,active:true}));
const message=(text='/start',update_id=1)=>({update_id,message:{chat:{id:42,type:'private'},from:{id:42},text}});
const context={action:'start',chatId:42};
for(const count of [2,5,9])test(`${count} active services produce ${count} dynamic buttons`,()=>{
 const plan=buildResponse(context,rows(count));assert.equal(plan.actions.flatMap(a=>a.body.reply_markup.inline_keyboard).length,count);
 assert.equal(plan.actions[0].body.reply_markup.inline_keyboard[0][0].callback_data,'svc:'+rows(1)[0].id);
});
test('zero and inactive services have a friendly message and no keyboard',()=>{
 for(const services of [[],rows(2).map(r=>({...r,active:false}))]) {
  const body=buildResponse(context,services).actions[0].body;assert.match(body.text,/активных услуг нет/);assert.equal(body.reply_markup,undefined);
 }
});
test('large catalog includes all services in several messages',()=>{
 const plan=buildResponse(context,rows(109));assert.equal(plan.actions.length,3);assert.equal(plan.actions.flatMap(a=>a.body.reply_markup.inline_keyboard).length,109);
});
test('selection uses stable ID and current name instead of button label or position',()=>{
 const services=rows(5);services[3].name='Новое имя <CRM> & отчёт';
 const body=buildResponse({action:'select',chatId:42,serviceId:services[3].id},services).actions[0].body;
 assert.equal(body.text,'Вы выбрали: Новое имя <CRM> & отчёт');assert.equal(body.parse_mode,undefined);
});
test('old buttons for deleted or disabled services ask to refresh',()=>{
 const selected={action:'select',chatId:42,serviceId:rows(1)[0].id};
 assert.match(buildResponse(selected,[]).actions[0].body.text,/больше недоступна/);
 assert.match(buildResponse(selected,rows(1).map(r=>({...r,active:false}))).actions[0].body.text,/больше недоступна/);
});
test('start, deep link and correct bot mention accepted; other bot mention ignored',()=>{
 for(const text of ['/start',' /start ','/start source','/start@Demo_Bot'])assert.equal(normalizeUpdate({update:message(text),bot_username:'demo_bot'}).action,'start');
 assert.equal(normalizeUpdate({update:message('/start@OtherBot'),bot_username:'demo_bot'}).action,'ignore');
 assert.equal(normalizeUpdate({update:message('/starter')}).action,'help');
});
test('group chats and forged sender identity are ignored',()=>{
 const group=message();group.message.chat.type='group';assert.equal(normalizeUpdate({update:group}).action,'ignore');
 const forged=message();forged.message.from.id=88;assert.equal(normalizeUpdate({update:forged}).action,'ignore');
 assert.equal(normalizeUpdate({update:{}}).action,'ignore');
});
test('malformed callback data cannot become a SQL fragment',()=>{
 const update=message();update.callback_query={id:'q',from:{id:42},message:update.message,data:"svc:' OR true --"};
 const result=normalizeUpdate({update});assert.equal(result.action,'invalid_callback');assert.equal(result.serviceId,'');
});
test('transport forbids arbitrary Telegram methods and different recipients',()=>{
 assert.throws(()=>validatePlan({actions:[{method:'deleteMessage',body:{chat_id:42,text:'x'}}]},42));
 assert.throws(()=>validatePlan({actions:[{method:'sendMessage',body:{chat_id:88,text:'x'}}]},42));
 assert.throws(()=>validatePlan({actions:[{method:'sendMessage',body:{chat_id:42,text:'x',reply_markup:{inline_keyboard:[[{text:'x',callback_data:'я'.repeat(40)}]]}}}]},42));
});
test('callback is acknowledged before workflow and generated reply is delivered',async()=>{
 const update=message();update.callback_query={id:'q1',from:{id:42},message:update.message,data:'svc:'+rows(1)[0].id};
 const order=[];
 await processUpdate(update,{username:'demo_bot',allowedIds:new Set(),callTelegram:async(method,body)=>{order.push(method);if(method==='sendMessage')assert.equal(body.text,'Вы выбрали: Услуга 1');},callWorkflow:async envelope=>{order.push('workflow');return buildResponse(normalizeUpdate(envelope),rows(1));}});
 assert.deepEqual(order,['answerCallbackQuery','workflow','sendMessage']);
});
test('allowlist prevents workflow execution for other users',async()=>{
 await processUpdate(message(),{username:'demo_bot',allowedIds:new Set(['99']),callTelegram:()=>assert.fail(),callWorkflow:()=>assert.fail()});
});
test('polling offset is persisted and loaded across restarts',async()=>{
 const folder=await mkdtemp(join(tmpdir(),'latte-relay-'));const file=join(folder,'offset.json');
 try {assert.equal(await readOffset(file),0);await saveOffset(file,101);assert.equal(await readOffset(file),101);} finally {await rm(folder,{recursive:true,force:true});}
});

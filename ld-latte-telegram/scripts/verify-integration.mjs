import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {db,sqlString as q} from './catalog.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const env=Object.fromEntries(readFileSync(`${root}/.env`,'utf8').split(/\r?\n/).filter(l=>/^[A-Z_]+=/.test(l)).map(l=>{const i=l.indexOf('=');return[l.slice(0,i),l.slice(i+1)]}));
const url='http://127.0.0.1:5678/webhook/ld-latte-menu';
let updateId=1_000_000;
const chat={id:424242,type:'private'};
const message=text=>({update_id:updateId++,message:{chat,from:{id:chat.id},text}});
const callback=data=>({update_id:updateId++,callback_query:{id:`fixture-${updateId}`,from:{id:chat.id},message:{chat,from:{id:123,is_bot:true}},data}});
async function call(update,secret=env.RELAY_SECRET) {
 const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',...(secret?{'X-Latte-Secret':secret}:{})},body:JSON.stringify({update,bot_username:'latte_demo_bot'}),signal:AbortSignal.timeout(75_000)});
 if(!response.ok)throw new Error(`Workflow HTTP ${response.status}`);
 const plan=await response.json();assert.ok(Array.isArray(plan.actions),'Workflow must return action array');return plan;
}
const buttons=plan=>plan.actions.flatMap(a=>a.body.reply_markup?.inline_keyboard.flat()??[]);
const report={date:new Date().toISOString(),engine:'real n8n + PostgreSQL; synthetic Telegram updates; no Telegram delivery',cases:[],menus:{}};
async function check(name,fn) {
 await fn();report.cases.push({name,passed:true});console.log('PASS '+name);
}
const snapshot=db("SELECT coalesce(jsonb_agg(to_jsonb(s)),'[]') FROM catalog.services s;",{json:true});
const temporaryId=randomUUID();
try {
 for(const count of [2,5,9,0])await check(`dynamic menu: ${count} active services`,async()=>{
  db(`UPDATE catalog.services SET active = id IN (SELECT id FROM catalog.services ORDER BY sort_order,id LIMIT ${count});`);
  const plan=await call(message('/start'));const menu=buttons(plan);
  assert.equal(menu.length,count);assert.equal(new Set(menu.map(b=>b.callback_data)).size,count);
  for(const button of menu){assert.match(button.callback_data,/^svc:[\da-f-]{36}$/);assert.ok(Buffer.byteLength(button.callback_data)<=64);}
  if(!count)assert.match(plan.actions[0].body.text,/активных услуг нет/);
  report.menus[count]=plan;
 });
 db('UPDATE catalog.services SET active=true;');
 await check('different buttons return their corresponding current service name',async()=>{
  const services=db("SELECT jsonb_agg(to_jsonb(s)) FROM catalog.services s;",{json:true});
  for(const service of [services[0],services[4],services[8]]) {
   const plan=await call(callback('svc:'+service.id));assert.equal(plan.actions[0].body.text,'Вы выбрали: '+service.name);
  }
 });
 await check('rename affects next start and an already-issued button',async()=>{
  const selected=snapshot[0];const newName="Отчёт O'Brien <CRM> — обновлено";
  const original=await call(message('/start'));assert.ok(buttons(original).some(b=>b.callback_data==='svc:'+selected.id));
  db(`UPDATE catalog.services SET name=${q(newName)} WHERE id=${q(selected.id)}::uuid;`);
  assert.equal(buttons(await call(message('/start'))).find(b=>b.callback_data==='svc:'+selected.id).text,newName);
  assert.equal((await call(callback('svc:'+selected.id))).actions[0].body.text,'Вы выбрали: '+newName);
 });
 await check('adding a row adds a button without editing workflow',async()=>{
  db(`INSERT INTO catalog.services(id,name,active,sort_order) VALUES (${q(temporaryId)}::uuid,'Новая тестовая услуга',true,100);`);
  const menu=buttons(await call(message('/start')));assert.equal(menu.length,10);assert.ok(menu.some(b=>b.callback_data==='svc:'+temporaryId));
 });
 await check('disabled row vanishes and an old button reports unavailability',async()=>{
  db(`UPDATE catalog.services SET active=false WHERE id=${q(temporaryId)}::uuid;`);
  assert.equal(buttons(await call(message('/start'))).length,9);
  assert.match((await call(callback('svc:'+temporaryId))).actions[0].body.text,/больше недоступна/);
 });
 await check('deleted row vanishes and an old button is safe',async()=>{
  db(`UPDATE catalog.services SET active=true WHERE id=${q(temporaryId)}::uuid;`);assert.equal(buttons(await call(message('/start'))).length,10);
  db(`DELETE FROM catalog.services WHERE id=${q(temporaryId)}::uuid;`);
  assert.equal(buttons(await call(message('/start'))).length,9);
  assert.match((await call(callback('svc:'+temporaryId))).actions[0].body.text,/больше недоступна/);
 });
 await check('malformed callback does not inject SQL',async()=>{
  const plan=await call(callback("svc:' OR true; DROP TABLE catalog.services; --"));
  assert.match(plan.actions[0].body.text,/Не удалось определить/);assert.equal(Number(db('SELECT count(*) FROM catalog.services;')),snapshot.length);
 });
 await check('webhook refuses missing and wrong shared secrets',async()=>{
  for(const secret of ['', 'wrong-secret']) {
   const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',...(secret?{'X-Latte-Secret':secret}:{})},body:JSON.stringify({update:message('/start')})});
   assert.ok([401,403].includes(response.status),`Unexpected auth status ${response.status}`);
  }
 });
 await check('workflow database role is read-only',async()=>{
  assert.equal(Number(db('SELECT count(*) FROM catalog.services;',{reader:true})),snapshot.length);
  assert.throws(()=>db('UPDATE catalog.services SET active=false;',{reader:true}),/permission denied/);
 });
 report.passed=true;
} catch(error) {
 report.passed=false;report.error=error.message;console.error(error.message);process.exitCode=1;
} finally {
 // Only the dedicated task's synthetic catalog is touched; restore its prior state.
 db(`DELETE FROM catalog.services WHERE id=${q(temporaryId)}::uuid;`);
 for(const row of snapshot)db(`UPDATE catalog.services SET name=${q(row.name)},active=${row.active},sort_order=${row.sort_order} WHERE id=${q(row.id)}::uuid;`);
 mkdirSync(`${root}/output`,{recursive:true});writeFileSync(`${root}/output/integration-report.json`,JSON.stringify(report,null,2)+'\n');
 console.log(`Result: ${report.cases.length} scenarios passed; catalog restored. Telegram delivery is not included.`);
}

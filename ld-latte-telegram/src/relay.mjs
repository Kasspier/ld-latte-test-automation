import {readFile,writeFile,rename,mkdir} from 'node:fs/promises';
import {dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import {normalizeUpdate} from './domain.mjs';

export function validatePlan(plan, chatId) {
  if (!Array.isArray(plan?.actions)) throw new Error('Invalid workflow response');
  for (const action of plan.actions) {
    const body=action?.body;
    if (action.method!=='sendMessage' || body?.chat_id!==chatId || typeof body.text!=='string' || !body.text.length || body.text.length>4096) {
      throw new Error('Unsafe workflow action');
    }
    if (body.reply_markup) {
      const keyboard=body.reply_markup.inline_keyboard;
      if (!Array.isArray(keyboard)) throw new Error('Invalid keyboard');
      for (const row of keyboard) {
        if (!Array.isArray(row) || !row.length) throw new Error('Invalid keyboard row');
        for (const button of row) {
          if (typeof button.text!=='string' || !button.text.trim() || typeof button.callback_data!=='string' || Buffer.byteLength(button.callback_data)>64) {
            throw new Error('Invalid keyboard button');
          }
        }
      }
    }
  }
  return plan.actions;
}

export async function processUpdate(update,{username,allowedIds,callTelegram,callWorkflow}) {
  const envelope={update,bot_username:username};
  const context=normalizeUpdate(envelope);
  if (context.action==='ignore' || (allowedIds.size && !allowedIds.has(String(context.chatId)))) return;
  if (update.callback_query?.id) {
    // Acknowledge promptly, before waiting for n8n/database. No menu logic here.
    await callTelegram('answerCallbackQuery',{callback_query_id:update.callback_query.id}).catch(()=>{});
  }
  const plan=await callWorkflow(envelope);
  for (const action of validatePlan(plan,context.chatId)) await callTelegram(action.method,action.body);
}

export async function saveOffset(file,offset) {
  await mkdir(dirname(file),{recursive:true});
  await writeFile(`${file}.tmp`,JSON.stringify({offset})+'\n',{mode:0o600});
  await rename(`${file}.tmp`,file);
}

export async function readOffset(file) {
  try {
    const {offset}=JSON.parse(await readFile(file,'utf8'));
    if (!Number.isSafeInteger(offset) || offset<0) throw new Error('Invalid saved offset');
    return offset;
  } catch(error) {
    if (error.code==='ENOENT') return 0;
    throw new Error('Cannot read polling state; fix state file before starting');
  }
}

async function main() {
  const token=process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) {
    console.log('Telegram token is empty. Fill TELEGRAM_BOT_TOKEN in .env and recreate telegram-relay.');
    setInterval(()=>{},60_000);
    return;
  }
  if (!/^\d+:[A-Za-z0-9_-]+$/.test(token)) throw new Error('Invalid Telegram token format');
  const n8nUrl=process.env.N8N_URL;
  const secret=process.env.RELAY_SECRET;
  if (!n8nUrl || !secret) throw new Error('N8N_URL and RELAY_SECRET are required');
  const stateFile=process.env.STATE_FILE || './runtime/offset.json';
  const allowedIds=new Set((process.env.ALLOWED_USER_IDS || '').split(',').map(x=>x.trim()).filter(Boolean));
  const callTelegram=async(method,body={})=>{
    let response;
    try {
      response=await fetch(`https://api.telegram.org/bot${token}/${method}`,{
        method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(40_000)
      });
    } catch {throw new Error(`Telegram ${method}: network unavailable`);}
    const result=await response.json();
    if (!response.ok || !result.ok) {
      // Telegram descriptions/URLs are deliberately not logged: they may contain data.
      throw new Error(`Telegram ${method}: API error ${result.error_code || response.status}`);
    }
    return result.result;
  };
  const callWorkflow=async(envelope)=>{
    let response;
    try {
      response=await fetch(n8nUrl,{method:'POST',headers:{'Content-Type':'application/json','X-Latte-Secret':secret},body:JSON.stringify(envelope),signal:AbortSignal.timeout(70_000)});
    } catch {throw new Error('n8n network unavailable');}
    if (!response.ok) throw new Error(`n8n HTTP ${response.status}`);
    return response.json();
  };
  let offset=await readOffset(stateFile);
  let identity;
  for (;;) {
    try {
      if (!identity) {
        identity=await callTelegram('getMe');
        const webhook=await callTelegram('getWebhookInfo');
        if (webhook.url) {
          identity=null;
          throw new Error('Existing Telegram webhook detected. Use a separate test bot or remove its webhook deliberately.');
        }
        console.log(`Telegram relay connected as @${identity.username}; private chats only.`);
      }
      const updates=await callTelegram('getUpdates',{offset,timeout:25,allowed_updates:['message','callback_query']});
      for (const update of updates) {
        if (!Number.isSafeInteger(update.update_id) || update.update_id<offset) continue;
        await processUpdate(update,{username:identity.username,allowedIds,callTelegram,callWorkflow});
        offset=update.update_id+1;
        await saveOffset(stateFile,offset);
      }
    } catch(error) {
      console.error(error.message);
      await delay(5000);
    }
  }
}

if (process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  main().catch(error=>{console.error(error.message);process.exitCode=1;});
}

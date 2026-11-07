import {readFileSync, mkdirSync, writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const functions = readFileSync(`${root}/src/domain.mjs`, 'utf8').replaceAll('export function ', 'function ');
const node = (id, name, type, typeVersion, position, parameters, extra = {}) => ({id,name,type,typeVersion,position,parameters,...extra});
const nodes = [
  node('input','Telegram update','n8n-nodes-base.webhook',2,[0,0],{
    httpMethod:'POST',path:'ld-latte-menu',authentication:'headerAuth',responseMode:'responseNode',options:{}
  },{webhookId:'5f577145-f5f1-4686-90fb-fcc5ac197e09',credentials:{httpHeaderAuth:{id:'latteRelayHeader',name:'LD LATTE relay header'}}}),
  node('normalize','Normalize update','n8n-nodes-base.code',2,[240,0],{
    jsCode: functions+'\nreturn [{json:normalizeUpdate($input.first().json.body)}];'
  }),
  node('catalog','Read current services','n8n-nodes-base.postgres',2.8,[480,0],{
    operation:'executeQuery',query:`SELECT coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name, 'active', active) ORDER BY sort_order, id), '[]'::jsonb) AS services
FROM catalog.services
WHERE active = true AND ($1::text = 'start' OR id::text = $2::text);`,
    options:{queryReplacement:'={{ [$json.action, $json.serviceId || ""] }}'}
  },{credentials:{postgres:{id:'latteCatalogRead',name:'LD LATTE catalog read only'}}}),
  node('response','Build dynamic response','n8n-nodes-base.code',2,[720,0],{
    jsCode:functions+'\nreturn [{json:buildResponse($("Normalize update").first().json,$input.first().json.services)}];'
  }),
  node('respond','Return Telegram requests','n8n-nodes-base.respondToWebhook',1.4,[960,0],{
    respondWith:'json',responseBody:'={{ $json }}',options:{responseCode:200}
  }),
  node('note','How it works','n8n-nodes-base.stickyNote',1,[180,-300],{
    width:780,height:220,content:'## LD LATTE · динамическое меню\nЛокальный relay получает Telegram updates через getUpdates и передаёт их сюда с секретным заголовком.\nКаждый /start и каждый callback заново читают PostgreSQL. Code собирает тело sendMessage и inline_keyboard из строк БД. Relay отправляет готовые запросы в Telegram.\nДобавление, удаление, переименование и active меняются только в таблице.\nЭкспорт не содержит токенов и паролей. Credentials привязываются при импорте.'
  })
];
const names=nodes.slice(0,5).map(n=>n.name);
const connections=Object.fromEntries(names.slice(0,-1).map((name,i)=>[name,{main:[[{node:names[i+1],type:'main',index:0}]]}]));
const workflow={id:'ldLatteDynamicMenu',name:'LD LATTE — dynamic Telegram services',active:false,nodes,connections,settings:{executionOrder:'v1',saveDataSuccessExecution:'none',saveDataErrorExecution:'none',saveManualExecutions:false,executionTimeout:60},pinData:{},versionId:'c597deee-11aa-4fdf-aac2-2c6a5f19a4c1',tags:[]};
mkdirSync(`${root}/workflow`,{recursive:true});
writeFileSync(`${root}/workflow/LD-LATTE-menu.json`,JSON.stringify(workflow,null,2)+'\n');
console.log('Generated secret-free workflow: workflow/LD-LATTE-menu.json');

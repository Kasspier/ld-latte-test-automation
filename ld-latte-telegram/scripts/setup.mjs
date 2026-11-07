import {existsSync,readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import './generate-workflow.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const file=`${root}/.env`;
const text=existsSync(file)?readFileSync(file,'utf8'):readFileSync(`${root}/.env.example`,'utf8');
const values=Object.fromEntries(text.split(/\r?\n/).filter(l=>/^[A-Z_]+=/.test(l)).map(l=>{const at=l.indexOf('=');return [l.slice(0,at),l.slice(at+1)]}));
for(const key of ['POSTGRES_PASSWORD','BOT_DB_PASSWORD','N8N_ENCRYPTION_KEY','RELAY_SECRET']) values[key] ||= randomBytes(32).toString('hex');
writeFileSync(file,Object.entries(values).map(([k,v])=>`${k}=${v}`).join('\n')+'\n');
mkdirSync(`${root}/.private`,{recursive:true});
const credentials=[
 {id:'latteCatalogRead',name:'LD LATTE catalog read only',type:'postgres',data:{host:'postgres',port:5432,database:'latte_catalog',user:'latte_reader',password:values.BOT_DB_PASSWORD,ssl:'disable',allowUnauthorizedCerts:false}},
 {id:'latteRelayHeader',name:'LD LATTE relay header',type:'httpHeaderAuth',data:{name:'X-Latte-Secret',value:values.RELAY_SECRET}}
];
writeFileSync(`${root}/.private/credentials.local.json`,JSON.stringify(credentials,null,2)+'\n');
console.log('Local secrets prepared. Put the BotFather token in TELEGRAM_BOT_TOKEN in .env. No secret values were printed.');

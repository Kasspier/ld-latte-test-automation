import {spawnSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const cwd=fileURLToPath(new URL('../',import.meta.url));
export const sqlString=value=>`'${String(value).replaceAll("'","''")}'`;
export function db(sql,{json=false,reader=false}={}) {
  const result=spawnSync('docker',['compose','exec','-T','postgres','psql','-U',reader?'latte_reader':'latte_admin','-d','latte_catalog','-v','ON_ERROR_STOP=1','-A','-t','-c',sql],{cwd,encoding:'utf8'});
  if(result.status!==0) throw new Error(result.stderr || 'Database command failed');
  return json?JSON.parse(result.stdout.trim()):result.stdout.trim();
}
const id=value=>{
 if(!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(value||''))throw new Error('Provide a UUID service ID');
 return sqlString(value)+'::uuid';
};
const name=value=>{
 if(!value?.trim()||value.trim().length>200)throw new Error('Name must contain 1–200 characters');
 return sqlString(value.trim());
};
if (process.argv[1]===fileURLToPath(import.meta.url)) {
 const [command,...args]=process.argv.slice(2);
 try {
  if(command==='list')console.log(db('SELECT id,name,active,sort_order FROM catalog.services ORDER BY sort_order,id;'));
  else if(command==='count') {
   const count=Number(args[0]);if(![0,2,5,9].includes(count))throw new Error('Demo count must be 0, 2, 5 or 9');
   console.log(db(`UPDATE catalog.services SET active = id IN (SELECT id FROM catalog.services ORDER BY sort_order,id LIMIT ${count});`));
  } else if(command==='add') {
   const uuid=randomUUID();console.log(db(`INSERT INTO catalog.services(id,name,active,sort_order) VALUES (${id(uuid)},${name(args.join(' '))},true,(SELECT coalesce(max(sort_order),0)+1 FROM catalog.services)) RETURNING id,name;`));
  } else if(command==='rename')console.log(db(`UPDATE catalog.services SET name=${name(args.slice(1).join(' '))} WHERE id=${id(args[0])} RETURNING id,name;`));
  else if(command==='disable'||command==='enable')console.log(db(`UPDATE catalog.services SET active=${command==='enable'} WHERE id=${id(args[0])} RETURNING id,name,active;`));
  else if(command==='delete')console.log(db(`DELETE FROM catalog.services WHERE id=${id(args[0])} RETURNING id,name;`));
  else throw new Error('Commands: list | count 0/2/5/9 | add NAME | rename UUID NAME | enable UUID | disable UUID | delete UUID');
 }catch(error){console.error(error.message);process.exitCode=1;}
}

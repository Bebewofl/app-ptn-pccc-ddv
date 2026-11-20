import {createHash} from 'node:crypto';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
assert.equal(process.env.FIREBASE_DATABASE_EMULATOR_HOST,'127.0.0.1:9007');
assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST,'127.0.0.1:9097');
const mode=process.argv[2],path='pilot-evidence/spark-fingerprint.json';
const response=await fetch('http://127.0.0.1:9007/hubLite.json?ns=demo-hub-spark-default-rtdb',{headers:{Authorization:'Bearer owner'}});assert(response.ok);
const db=await response.json();const u=await fetch('http://127.0.0.1:9097/emulator/v1/projects/demo-hub-spark/accounts',{headers:{Authorization:'Bearer owner'}});
let users;
if(u.ok){const found=await u.json();users=found.users;}
if(!Array.isArray(users)){
 const exported=await fetch('http://127.0.0.1:9097/identitytoolkit.googleapis.com/v1/projects/demo-hub-spark/accounts:batchGet?maxResults=1000',{headers:{Authorization:'Bearer owner'}});assert(exported.ok);users=(await exported.json()).users;
}
assert(users.length>0);const keys=Object.keys,entries=Object.entries;
function sorted(x){if(Array.isArray(x))return x.map(sorted);if(x&&typeof x==='object')return Object.fromEntries(entries(x).sort(([a],[b])=>a.localeCompare(b)).map(([k,val])=>[k,sorted(val)]));return x;}
const stableUsers=users.map(a=>({id:a.localId,disabled:a.disabled===true,providers:(a.providerUserInfo||[]).map(p=>p.providerId).sort()})).sort((a,b)=>a.id.localeCompare(b.id));
const result={profiles:keys(db.profiles).length,cases:keys(db.cases).length,events:Object.values(db.cases).reduce((n,c)=>n+keys(c.events).length,0),files:Object.values(db.files||{}).reduce((n,f)=>n+keys(f).length,0),users:users.length,digest:createHash('sha256').update(JSON.stringify(sorted({db,users:stableUsers}))).digest('hex')};
if(mode==='save')await fs.writeFile(path,JSON.stringify(result)+'\n');else{assert.equal(mode,'verify');assert.deepEqual(result,JSON.parse(await fs.readFile(path,'utf8')));}
console.log('SPARK_RESTORE',mode,JSON.stringify(result));

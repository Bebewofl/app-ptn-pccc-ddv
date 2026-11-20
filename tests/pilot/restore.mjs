import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
const require=createRequire(new URL('../../functions-lite/index.js',import.meta.url));
const {initializeApp,deleteApp}=require('firebase-admin/app'),{getAuth}=require('firebase-admin/auth'),{getFirestore}=require('firebase-admin/firestore'),{getStorage}=require('firebase-admin/storage');
if(process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8087'||process.env.FIREBASE_AUTH_EMULATOR_HOST!=='127.0.0.1:9097'||process.env.FIREBASE_STORAGE_EMULATOR_HOST!=='127.0.0.1:9197')throw Error('Requires three local emulators');
const app=initializeApp({projectId:'demo-hub-lite',storageBucket:'demo-hub-lite.appspot.com'});
const db=getFirestore(app),auth=getAuth(app),bucket=getStorage(app).bucket();
const [mode,file]=process.argv.slice(2);
if(!['save','verify'].includes(mode)||!file)throw Error('Expected save|verify and fingerprint path.');
function canonical(o){if(o?.toMillis)return o.toMillis();if(Array.isArray(o))return o.map(canonical);if(o&&typeof o==='object')return Object.fromEntries(Object.keys(o).sort().map(k=>[k,canonical(o[k])]));return o;}
const rows=[];
async function walk(collection){for(const d of (await collection.get()).docs){rows.push([d.ref.path,canonical(d.data())]);for(const child of await d.ref.listCollections())await walk(child);}}
for(const name of ['hub_v3_cases','hub_v3_members','hub_v3_access_events','hub_v3_directory'])await walk(db.collection(name));
const users=(await auth.listUsers(1000)).users.map(u=>[u.uid,u.disabled]).sort();
const objects=[];for(const object of (await bucket.getFiles({prefix:'hub-v3/'}))[0]){const [bytes]=await object.download();objects.push([object.name,createHash('sha256').update(bytes).digest('hex')]);}
if(!rows.length||!objects.length||!users.length)throw Error('Backup fixture is incomplete.');
const digest=createHash('sha256').update(JSON.stringify([rows.sort((a,b)=>a[0].localeCompare(b[0])),users,objects.sort()])).digest('hex');
const manifest={documents:rows.length,users:users.length,objects:objects.length,digest};
if(mode==='save')await fs.writeFile(file,JSON.stringify(manifest));
else if(JSON.stringify(manifest)!==await fs.readFile(file,'utf8'))throw Error('Restored fingerprint differs.');
console.log(mode.toUpperCase(),JSON.stringify(manifest));await deleteApp(app);

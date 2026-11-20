import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
const require=createRequire(new URL('../functions-lite/index.js',import.meta.url));
const {initializeApp,deleteApp}=require('firebase-admin/app');
const {getAuth}=require('firebase-admin/auth'),{getFirestore}=require('firebase-admin/firestore');
const projectId='demo-hub-lite';
if(process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8087'||process.env.FIREBASE_AUTH_EMULATOR_HOST!=='127.0.0.1:9097')throw Error('Requires isolated demo emulators');
const app=initializeApp({projectId}),db=getFirestore(app),auth=getAuth(app);
const {provision}=require('./fixtures.cjs');
await provision(db,auth,'demo-');
for(const uid of ['demo-operator','demo-pending']){try{await auth.getUser(uid);}catch(e){if(e.code!=='auth/user-not-found')throw e;await auth.createUser({uid});}}
await db.collection('hub_v3_pilot_access').doc('demo-operator').set({active:true,roles:['demo-ptn','demo-pkt']});
await deleteApp(app);
console.log('Dữ liệu vai trò giả lập đã sẵn sàng.');
if(process.env.HUB_LITE_SEED_ONLY!=='1'){
  if(process.platform==='win32')spawn('cmd',['/d','/c','start','','http://127.0.0.1:5017/'],{detached:true,stdio:'ignore'}).unref();
  await new Promise(()=>{setInterval(()=>{},60000);});
}

// Provision only synthetic identities in the verified HUB Test database. Run with workload identity.
import {createRequire} from 'node:module';
const require=createRequire(new URL('../functions-lite/index.js',import.meta.url));
const {initializeApp,deleteApp}=require('firebase-admin/app'),{getFirestore,FieldValue}=require('firebase-admin/firestore'),{getAuth}=require('firebase-admin/auth');
const {provision,profiles}=require('./fixtures.cjs');
const {uid}=require('./domain');
const args=process.argv.slice(2),projectId='hub-ptn-test';
if(args[0]!==projectId || !['--check','--apply'].includes(args[1]) || Object.keys(process.env).some(k=>k.endsWith('EMULATOR_HOST')))throw Error('Use the isolated HUB Test project with --check or --apply');
const operator=args[2]?uid(args[2]):null,app=initializeApp({projectId}),db=getFirestore(app,'hub-v3-lite'),auth=getAuth(app);
try{
  if(operator){const u=await auth.getUser(operator);if(u.disabled||!u.providerData.some(p=>p.providerId==='google.com'))throw Error('Operator must be an approved active Google Test identity');}
  const set=Object.keys(profiles).map(k=>'pilot-'+k);
  const existing=await db.getAll(...set.map(id=>db.collection('hub_v3_members').doc(id)));
  console.log('Synthetic roles present: '+existing.filter(d=>d.exists).length+'/'+set.length);
  if(args[1]==='--apply'){
    await provision(db,auth,'pilot-');
    if(operator){
      const ref=db.collection('hub_v3_pilot_access').doc(operator);
      await db.runTransaction(async tx=>{const snap=await tx.get(ref);if(snap.exists)throw Error('Operator already configured; existing grants preserved');
        tx.create(ref,{active:true,roles:set.filter(x=>x!=='pilot-accounts'),createdAt:FieldValue.serverTimestamp(),purpose:'Nghiệm thu HUB-01.01 trên dữ liệu giả lập'});});
    }
  }
}finally{await deleteApp(app);}

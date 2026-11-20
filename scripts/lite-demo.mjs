import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
const require=createRequire(new URL('../functions-lite/index.js',import.meta.url));
const {initializeApp,deleteApp}=require('firebase-admin/app');
const {getAuth}=require('firebase-admin/auth'),{getFirestore}=require('firebase-admin/firestore');
const {directory}=require('./accounts');
const projectId='demo-hub-lite';
if(process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8087'||process.env.FIREBASE_AUTH_EMULATOR_HOST!=='127.0.0.1:9097')throw Error('Requires isolated demo emulators');
const app=initializeApp({projectId}),db=getFirestore(app),auth=getAuth(app);
const profiles={
 director:['Giám đốc','BGĐ',['ptn','pkt','qlcl','office','sampling'],['management']],
 ptn:['Trưởng phòng Thử nghiệm','PTN',['lead','pkt','qlcl','office','sampling','director'],['testing']],
 pkt:['Trưởng phòng Kỹ thuật','PKT',['engineer','ptn','qlcl','office','director'],['equipment']],
 engineer:['Kỹ sư trực','PKT',['pkt','ptn','director'],[]],
 qlcl:['Trưởng phòng QLCL','QLCL',['ptn','pkt','office','sampling','director'],['quality']],
 office:['Phụ trách HCNS','HCNS',['ptn','qlcl','sampling'],['records']],
 sampling:['Phụ trách Lấy mẫu','Lấy mẫu',['ptn','qlcl','office'],['records']],
 lead:['Trưởng nhóm','PTN',['ptn'],[]], staff:['Thử nghiệm viên','PTN',['lead'],[]],
 admin:['Quản trị kỹ thuật','CNTT',[],[]],accounts:['Quản trị tài khoản','HCNS',[],[]],viewer:['Người chỉ xem','BGĐ',[],[]]
};
const unitList=[...new Set(Object.values(profiles).map(p=>p[1]))];
for(const [key,[title,unit,routes,scopes]] of Object.entries(profiles)){
  const uid='demo-'+key;
  try{await auth.getUser(uid);}catch(e){if(e.code!=='auth/user-not-found')throw e;await auth.createUser({uid,displayName:title});}
  const ref=db.collection('hub_v3_members').doc(uid);
  if((await ref.get()).exists)continue;
  const business=!['admin','accounts','viewer'].includes(key);
  const mgr=key==='accounts',reviewer={engineer:'pkt',staff:'ptn',lead:'ptn'}[key]||key;
  const m={active:true,name:title,title,unit,group:'',rev:1,canReport:business,canHandle:business&&key!=='staff',
    canClose:business&&!['staff','lead','engineer'].includes(key),mayPause:['ptn','pkt','lead','engineer'].includes(key),
    canDecide:scopes.length>0,scopes,delegation:null,overview:['director','viewer'].includes(key),technical:key==='admin',
    manageAccounts:mgr,manageUnits:mgr?unitList:[],grantScopes:mgr?['testing','equipment','management','quality','records']:[],
    unitLead:business&&!['staff','lead','engineer'].includes(key),routes:routes.map(x=>'demo-'+x),
    emergencyRoutes:['staff','lead'].includes(key)?['demo-pkt','demo-ptn','demo-director']:[],reviewerUid:business?'demo-'+reviewer:''};
  const batch=db.batch();batch.create(ref,m);batch.set(db.collection('hub_v3_directory').doc(uid),directory(m));await batch.commit();
}
await deleteApp(app);
console.log('Dữ liệu vai trò giả lập đã sẵn sàng.');
if(process.env.HUB_LITE_SEED_ONLY!=='1'){
  if(process.platform==='win32')spawn('cmd',['/d','/c','start','','http://127.0.0.1:5017/'],{detached:true,stdio:'ignore'}).unref();
  await new Promise(()=>{setInterval(()=>{},60000);});
}

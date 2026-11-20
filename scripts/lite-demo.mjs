import {initializeTestEnvironment} from '@firebase/rules-unit-testing';
import {doc,writeBatch} from 'firebase/firestore';
import {spawn} from 'node:child_process';
import readline from 'node:readline/promises';
const projectId='demo-hub-lite';
if(process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8087'||process.env.FIREBASE_AUTH_EMULATOR_HOST!=='127.0.0.1:9097')throw Error('Refusing any non-local target');
const profiles={
 director:{name:'Giám đốc (test)',title:'Giám đốc',unit:'BGD',group:'',canHandle:true,canReport:true,canClose:true,canDecide:true,overview:true,routes:['ptn','pkt','qlcl','office'],reviewer:'director'},
 ptn:{name:'Trưởng phòng PTN (test)',title:'Trưởng phòng',unit:'PTN',group:'',canHandle:true,canReport:true,canClose:true,canDecide:true,routes:['director','pkt','qlcl','office','lead'],reviewer:'ptn'},
 lead:{name:'Trưởng nhóm (test)',title:'Trưởng nhóm',unit:'PTN',group:'KN',canHandle:true,canReport:true,routes:['ptn'],emergencyRoutes:['director','pkt'],reviewer:'ptn'},
 staff:{name:'TNV (test)',title:'Thử nghiệm viên',unit:'PTN',group:'KN',canReport:true,routes:['lead'],emergencyRoutes:['ptn','director','pkt'],reviewer:'ptn'},
 pkt:{name:'Trưởng phòng Kỹ thuật (test)',title:'Trưởng phòng',unit:'PKT',group:'',canHandle:true,canReport:true,canClose:true,canDecide:true,routes:['ptn','director','qlcl','office'],reviewer:'pkt'},
 qlcl:{name:'Trưởng phòng QLCL (test)',title:'Trưởng phòng',unit:'QLCL',group:'',canHandle:true,canReport:true,canClose:true,canDecide:true,routes:['ptn','pkt','director','office'],reviewer:'qlcl'},
 office:{name:'HCNS / Kho (test)',title:'Phụ trách',unit:'HCNS',group:'',canHandle:true,canReport:true,canClose:true,routes:['ptn','pkt','qlcl','director'],reviewer:'office'},
 admin:{name:'Quản trị kỹ thuật (test)',title:'Quản trị kỹ thuật',unit:'IT',group:'',routes:[],reviewer:''}
};
const ids={};for(const k of Object.keys(profiles)){
 const payload={email:k+'@demo.invalid',password:'HUB-demo-only-2026!',returnSecureToken:true};
 let response=await fetch('http://127.0.0.1:9097/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
 let data=await response.json();if(!response.ok)throw Error('Auth emulator seed: '+JSON.stringify(data.error));
 ids[k]=data.localId;
}
const env=await initializeTestEnvironment({projectId,firestore:{host:'127.0.0.1',port:8087}});
try{await env.withSecurityRulesDisabled(async ctx=>{const d=ctx.firestore(),batch=writeBatch(d);for(const [k,p] of Object.entries(profiles)){
 const m={active:true,name:p.name,title:p.title,unit:p.unit,group:p.group,canHandle:!!p.canHandle,canReport:!!p.canReport,canClose:!!p.canClose,canDecide:!!p.canDecide,overview:!!p.overview,routes:p.routes.map(x=>ids[x]),emergencyRoutes:(p.emergencyRoutes||[]).map(x=>ids[x]),reviewerUid:ids[p.reviewer]||''};
 batch.set(doc(d,'hub_v3_members',ids[k]),m);
 batch.set(doc(d,'hub_v3_directory',ids[k]),{active:true,name:m.name,title:m.title,unit:m.unit,canHandle:m.canHandle,canDecide:m.canDecide});
}await batch.commit()})}finally{await env.cleanup()}
console.log('Demo ready: http://127.0.0.1:5017/ — fake accounts only. Keep this window open; Ctrl+C stops.');
if(process.env.HUB_LITE_SEED_ONLY==='1')process.exit(0);
if(process.platform==='win32')spawn('cmd',['/d','/c','start','','http://127.0.0.1:5017/'],{stdio:'ignore',detached:true}).unref();
await new Promise(()=>{setInterval(()=>{},60000)});

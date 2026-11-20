import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {sparkProfiles,roleIds} from '../../scripts/spark-profiles.mjs';
import {sparkApi,restDb} from '../../src/lite/spark.js';
const endpoint='http://127.0.0.1:9007',ns='demo-hub-spark-default-rtdb';
if(process.env.FIREBASE_DATABASE_EMULATOR_HOST!=='127.0.0.1:9007'||process.env.FIREBASE_AUTH_EMULATOR_HOST!=='127.0.0.1:9097')throw Error('Local emulators required');
const admin=async(method,path='',payload)=>{
 const url=endpoint+'/hubLite'+(path?'/'+path:'')+'.json?ns='+ns;
 const res=await fetch(url,{method,headers:{Authorization:'Bearer owner','Content-Type':'application/json'},body:payload===undefined?undefined:JSON.stringify(payload)});
 if(!res.ok)throw Error('Backend fixture '+res.status+' '+await res.text());return res.json();
};
const actors={};let passes=0;
async function check(name,fn){await fn();passes++;console.log('SPARK_PASS',name);}
async function login(name,roles){
 const res=await fetch('http://127.0.0.1:9097/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({returnSecureToken:true})});
 const u=await res.json();assert(u.idToken);
 const au={currentUser:{uid:u.localId,getIdToken:async()=>u.idToken}},db=restDb(endpoint,au,ns),api=sparkApi(db,au);
 if(roles.length)await admin('PUT','grants/'+u.localId,Object.fromEntries(roles.map(k=>['pilot-'+k,true])));
 const r='pilot-'+name;actors[name]={db,api:(key,input={},role=r)=>api(key,input,role),uid:u.localId,r,token:u.idToken};
 if(roles.length)await actors[name].api('session');return actors[name];
}
let code;
const act=async(who,action,extra={})=>{
 const {issue}=await who.api('detail',{code});await who.api('action',{code,rev:issue.rev,requestId:randomUUID(),action,note:'Nội dung thử nghiệm',...extra});
};
await admin('PUT','profiles',sparkProfiles());
for(const name of ['ptn','pkt','qlcl','engineer','director','admin','accounts','viewer','office','lead','staff'])await login(name,[name]);
const {ptn,pkt,qlcl,engineer,director,admin:tech,accounts,viewer,office,lead,staff}=actors;
const create=async(who,target,extra={})=>who.api('create',{requestId:randomUUID(),target:'pilot-'+target,title:'Sự cố thực nghiệm',body:'Chỉ dùng số liệu tổng hợp.',...extra});
await check('S01 Đăng nhập, danh bạ, cách ly tài khoản',async()=>{
 await ptn.api('workspace');await assert.rejects((await login('outside',[])).api('session'));
 await assert.rejects(ptn.db.patch({['selected/'+ptn.uid]:'pilot-director'}));
 await assert.rejects(ptn.db.patch({['grants/'+ptn.uid+'/pilot-director']:true}));
});
await check('S02 Ba trường, gửi lại và tuyến khẩn',async()=>{
 const key=randomUUID();code=(await create(ptn,'pkt',{requestId:key,restricted:true})).code;
 assert.equal((await create(ptn,'pkt',{requestId:key,restricted:true})).code,code);
 await assert.rejects(create(staff,'pkt'));await create(staff,'pkt',{severity:'Khẩn cấp'});
});
await check('S03 Đọc theo phạm vi và đường dẫn',async()=>{
 assert.equal((await pkt.api('workspace')).cases.length,2);assert.equal((await ptn.api('detail',{code})).events.length,1);
 for(const p of [qlcl,tech,director,viewer])await assert.rejects(p.api('detail',{code}));
 await assert.rejects(ptn.db.get('cases'));await assert.rejects(tech.db.get('files/'+code));
});
await check('S04 Nhận việc, phối hợp và phân công nội bộ',async()=>{
 await act(pkt,'accept',{note:''});await act(pkt,'invite',{target:'pilot-qlcl'});await act(qlcl,'collaborate');
 assert.equal((await pkt.api('detail',{code})).issue.ownerUid,'pilot-pkt');
 await assert.rejects(act(pkt,'assign',{target:'pilot-qlcl'}));await act(pkt,'assign',{target:'pilot-engineer'});await act(engineer,'accept');
});
await check('S05 Bổ sung, xử lý, quyết định đúng chuyên môn',async()=>{
 await act(engineer,'supplement');await act(ptn,'supply');await act(engineer,'decision_request',{target:'pilot-pkt',scope:'equipment',purpose:'general'});
 await assert.rejects(act(director,'approve',{basis:'Căn cứ'}));await act(pkt,'approve',{basis:'Biên bản thử giả lập'});
 await act(engineer,'pause',{basis:'Phát hiện hiện tượng giả lập'});await assert.rejects(act(engineer,'report_done'));
 await act(engineer,'decision_request',{target:'pilot-pkt',scope:'equipment',purpose:'resume'});
 await act(pkt,'approve',{basis:'Đã kiểm tra theo thẩm quyền'});assert.equal((await engineer.api('detail',{code})).issue.flags.paused,false);
});
await check('S06 Lưu, đọc ảnh có kiểm tra nội dung; người ngoài bị từ chối',async()=>{
 const bytes='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a8h8AAAAASUVORK5CYII=',requestId=randomUUID();
 const file={code,requestId,name:'mau.png',data:bytes};await ptn.api('file-add',file);await ptn.api('file-add',file);
 assert.equal((await ptn.api('detail',{code})).files.length,1);
 const output=await pkt.api('file-read',{code,fileId:requestId});assert.equal(output.type,'image/png');
 await assert.rejects(tech.api('file-read',{code,fileId:requestId}));
 await assert.rejects(ptn.api('file-add',{...file,requestId:randomUUID(),data:btoa('wrong')}));
});
await check('S07 Kết luận, khóa ghi, mở lại có lý do',async()=>{
 await act(engineer,'report_done');await assert.rejects(act(engineer,'close'));await act(ptn,'close',{note:'Đã xác nhận kết luận'});
 assert.equal((await ptn.api('detail',{code})).issue.conclusion,'Đã xác nhận kết luận');
 await assert.rejects(act(ptn,'reopen',{note:''}));await act(ptn,'reopen',{note:'Phát sinh mới'});
 await assert.rejects(ptn.db.patch({['cases/'+code+'/source/title']:'Đổi nội dung gốc'}));
 const state=await ptn.db.get('cases/'+code);
 await assert.rejects(ptn.db.patch({['cases/'+code+'/events/'+state.head.event]:null}));
 await assert.rejects(ptn.db.patch({['cases/'+code+'/readers/pilot-office']:true}));
});
await check('S08 Phiên bản, gửi đồng thời, mốc đã đọc',async()=>{
 const a=(await engineer.api('detail',{code})).issue;
 const r=await Promise.allSettled([1,2].map(x=>engineer.api('action',{code,requestId:randomUUID(),rev:a.rev,action:'respond',note:'Ghi kết quả '+x})));
 assert.equal(r.filter(x=>x.status==='fulfilled').length,1);const rev=a.rev+1;
 await engineer.api('seen',{code,rev});assert.equal((await engineer.api('workspace')).seen[code],rev);
 await assert.rejects(engineer.api('seen',{code,rev:rev+8}));
});
await check('S09 Quản trị danh tính tổng hợp, audit và tạm khóa',async()=>{
 const before=await accounts.api('accounts-list');const p=before.profiles.find(p=>p.id==='pilot-engineer');
 await accounts.api('accounts-save',{...p,uid:p.id,reason:'Điều chỉnh thử nghiệm',requestId:randomUUID(),active:false});
 await assert.rejects(engineer.api('workspace'));const after=await accounts.api('accounts-list');
 assert.equal(after.events[0].before.active,true);assert.equal(after.events[0].after.active,false);
 await assert.rejects(ptn.api('accounts-list'));await assert.rejects(accounts.db.patch({'profiles/pilot-accounts/manageAccounts':false}));
 await act(ptn,'handover',{target:'pilot-pkt'});assert.equal((await pkt.api('detail',{code})).issue.ownerUid,'pilot-pkt');
});
await check('S10 Vai trò được ủy nhiệm giữ UID thật trong audit',async()=>{
 const tester=await login('operator',['ptn','pkt']);
 assert.equal((await tester.api('workspace',{},'pilot-ptn')).member.name,'Trưởng phòng Thử nghiệm');
 await tester.api('action',{code,rev:(await pkt.api('detail',{code})).issue.rev,action:'accept',requestId:randomUUID(),note:''},'pilot-pkt');
 assert.equal((await pkt.api('detail',{code})).events.at(-1).principalUid,tester.uid);
 await assert.rejects(tester.api('workspace',{},'pilot-director'));
});
console.log('SPARK_TOTAL',passes);

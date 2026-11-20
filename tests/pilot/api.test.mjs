import {test,before} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
const base=process.env.HUB_TEST_URL||'http://127.0.0.1:5017';
if(!/^http:\/\/127\.0\.0\.1:501[78]$/.test(base)||process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8087')throw Error('Local-only pilot suite');
const tokens=new Map();
async function call(path,role,data={},status=200){
  const headers={'Content-Type':'application/json'};
  if(role)headers.Authorization='Bearer '+tokens.get(role);
  const r=await fetch(base+'/api/'+path,{method:'POST',headers,body:JSON.stringify(data)});
  if(path==='file-read'&&status===200){assert.equal(r.status,status);return Buffer.from(await r.arrayBuffer());}
  const resp=await r.text();assert.equal(r.status,status,resp.slice(0,300));return JSON.parse(resp);
}
const demoUid=k=>'demo-'+k;
const create=(user='ptn',target='pkt',extras={})=>call('create',user,{requestId:randomUUID(),title:'Kiểm tra phối hợp',body:'Nội dung giả lập',target:demoUid(target),domain:'equipment',...extras});
const detail=(role,code)=>call('detail',role,{code});
async function change(role,code,action,extra={},status=200){
  const {issue}=await detail(role,code);return call('action',role,{code,action,requestId:randomUUID(),rev:issue.rev,note:'Ghi nhận thử nghiệm',...extra},status);
}
const pdf=Buffer.from('%PDF-1.4\n% synthetic pilot file\n%%EOF\n');
before(async()=>{
  for(const role of ['ptn','pkt','qlcl','director','office','sampling','engineer','staff','lead','viewer','admin','accounts']){
    const {token}=await call('demo-login',null,{role});
    const u=await fetch('http://127.0.0.1:9097/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=demo-key',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,returnSecureToken:true})});
    const d=await u.json();assert.ok(d.idToken);tokens.set(role,d.idToken);
  }
});
test('A01 · PTN đến PKT, phân công, báo kết quả, PTN đóng và mở lại',async()=>{
  const {code}=await create();await change('pkt',code,'accept');await change('pkt',code,'assign',{target:demoUid('engineer')});await change('engineer',code,'accept');await change('engineer',code,'respond');await change('engineer',code,'report_done');await change('ptn',code,'close',{note:'Xác nhận kết quả kiểm tra'});
  let d=await detail('ptn',code);assert.equal(d.issue.status,'Đã đóng');assert.equal(d.issue.confirmedBy.uid,demoUid('ptn'));assert.equal(d.events.at(-1).before.status,'Chờ xác nhận');await change('engineer',code,'respond',{},403);
  await change('ptn',code,'reopen');d=await detail('ptn',code);assert.equal(d.events.length,d.issue.rev);assert.equal(d.issue.ownerUid,demoUid('engineer'));
});
test('A02 · QLCL yêu cầu và nhận bổ sung hồ sơ',async()=>{const {code}=await create('ptn','qlcl',{domain:'quality'});await change('qlcl',code,'accept');await change('qlcl',code,'supplement');await change('ptn',code,'supply');assert.equal((await detail('qlcl',code)).issue.nextUid,demoUid('qlcl'));});
test('A03 · QLCL chủ động gửi Lấy mẫu, HCNS trả lời phối hợp',async()=>{const {code}=await create('qlcl','sampling',{invite:demoUid('office'),domain:'records'});await change('office',code,'collaborate');await change('sampling',code,'accept');assert.equal((await detail('qlcl',code)).issue.ownerUid,demoUid('sampling'));});
test('A04 · Giám đốc yêu cầu phối hợp nhiều bộ phận, từng phản hồi giữ đúng chủ trì',async()=>{const {code}=await create('director','ptn',{invite:demoUid('office')});await change('ptn',code,'accept');await change('ptn',code,'invite',{target:demoUid('qlcl')});await change('qlcl',code,'collaborate');await change('office',code,'collaborate');const d=await detail('director',code);assert.equal(d.issue.collaborators.length,2);assert.equal(d.issue.ownerUid,demoUid('ptn'));});
test('A05 · Khẩn, quá hạn, tạm dừng và cho tiếp tục có căn cứ',async()=>{const {code}=await create('staff','pkt',{severity:'Khẩn cấp',flags:{safety:true,verifyImpact:true},deadline:Date.now()-60000});await change('pkt',code,'accept');await change('pkt',code,'pause',{},400);await change('pkt',code,'pause',{basis:'Biên bản thử giả lập'});await change('pkt',code,'report_done',{},403);await change('pkt',code,'resume',{basis:'Xác nhận kỹ thuật giả lập'});const d=(await detail('pkt',code)).issue;assert.equal(d.flags.paused,false);assert.ok(d.deadline<Date.now());assert.equal(d.status,'Đang xử lý');});
test('A06 · Trả sai tuyến trước tiếp nhận, giữ căn cứ và người nhận',async()=>{const {code}=await create('qlcl','pkt');await change('pkt',code,'route',{target:demoUid('ptn')});const d=await detail('ptn',code);assert.equal(d.issue.status,'Chờ tiếp nhận');assert.equal(d.events.at(-1).before.ownerUid,demoUid('pkt'));assert.equal(d.events.at(-1).target.uid,demoUid('ptn'));});
test('A07 · Thẩm quyền kỹ thuật và hành chính',async()=>{const {code}=await create('ptn','pkt');await change('pkt',code,'accept');await change('pkt',code,'propose');await change('pkt',code,'decision_request',{scope:'equipment',target:demoUid('director')},403);await change('pkt',code,'decision_request',{scope:'management',target:demoUid('director')});await change('director',code,'approve',{},400);await change('director',code,'approve',{basis:'Quyết định quản lý giả lập'});assert.equal((await detail('ptn',code)).issue.nextUid,demoUid('pkt'));});
test('B01 · Hồ sơ hạn chế và đường dẫn trực tiếp',async()=>{const {code}=await create('ptn','pkt',{restricted:true});for(const role of ['qlcl','admin','director','viewer'])await call('detail',role,{code},404);await call('detail',null,{code},401);const d=await call('workspace','director');assert.ok(!d.cases.some(c=>c.code===code));});
test('B02 · TNV, quản trị kỹ thuật, danh tính người ghi',async()=>{await call('create','admin',{requestId:randomUUID(),target:demoUid('ptn'),title:'A',body:'B'},403);await call('create','staff',{requestId:randomUUID(),target:demoUid('director'),title:'A',body:'B'},403);await call('create','ptn',{requestId:randomUUID(),target:demoUid('pkt'),title:'A',body:'B',reporterUid:demoUid('director')},403);const {code}=await create('staff','lead');await change('staff',code,'approve',{basis:'X'},403);await change('lead',code,'accept',{actorUid:demoUid('ptn')},403);});
test('B03 · Firestore direct client cannot write case, alter permissions or edit/delete audit',async()=>{const {code}=await create();const root='http://127.0.0.1:8087/v1/projects/demo-hub-lite/databases/(default)/documents/';const event=(await detail('ptn',code)).issue.lastEvent;for(const [method,path] of [['GET','hub_v3_cases/'+code],['PATCH','hub_v3_members/demo-lead'],['PATCH','hub_v3_cases/'+code+'/events/'+event],['DELETE','hub_v3_cases/'+code+'/events/'+event]]){const r=await fetch(root+path,{method,headers:{Authorization:'Bearer '+tokens.get('lead'),'Content-Type':'application/json'},body:method==='PATCH'?'{"fields":{}}':undefined});assert.equal(r.status,403);}});
test('B04 · Tệp riêng tư, kiểm tra loại và tải lặp',async()=>{const {code}=await create('ptn','pkt',{restricted:true}),requestId=randomUUID(), f={code,requestId,name:'bien-ban.pdf',data:pdf.toString('base64')};await call('file-add','ptn',{...f,name:'tep.html'},400);await call('file-add','ptn',f);await call('file-add','ptn',f);assert.deepEqual(await call('file-read','pkt',{code,fileId:requestId}),pdf);await call('file-read','qlcl',{code,fileId:requestId},404);const d=await detail('ptn',code);assert.equal(d.files.length,1);assert.equal(d.events.filter(e=>e.action==='attach').length,1);
  const path=encodeURIComponent('hub-v3/'+code+'/'+requestId),url='http://127.0.0.1:9197/v0/b/demo-hub-lite.appspot.com/o/'+path+'?alt=media';assert.ok([401,403].includes((await fetch(url)).status));});
test('C01 · Gửi lặp và hai người xử lý phiên bản cũ',async()=>{const key=randomUUID(),args={requestId:key};const a=await Promise.all([create('ptn','pkt',args),create('ptn','pkt',args)]);assert.equal(a[0].code,a[1].code);const code=a[0].code;await change('pkt',code,'accept');const rev=(await detail('ptn',code)).issue.rev;const send=()=>fetch(base+'/api/action',{method:'POST',headers:{Authorization:'Bearer '+tokens.get('pkt'),'Content-Type':'application/json'},body:JSON.stringify({code,action:'respond',requestId:randomUUID(),rev,note:'Cập nhật đồng thời'})});const rs=await Promise.all([send(),send()]);assert.deepEqual(rs.map(r=>r.status).sort(),[200,409]);const d=await detail('ptn',code);assert.equal(d.events.length,3);});
test('C02 · Thông báo chưa đọc, đọc lại không hạ mốc',async()=>{const {code}=await create();await change('pkt',code,'accept');await call('seen','ptn',{code,rev:2});await call('seen','ptn',{code,rev:1});assert.equal((await call('workspace','ptn')).seen[code],2);});
test('B05 · Quản trị tài khoản, ủy quyền, thu hồi phiên đang mở, lưu lịch sử',async()=>{const list=await call('accounts-list','accounts');const p=list.profiles.find(p=>p.uid===demoUid('engineer'));await call('accounts-list','lead',{},403);await call('accounts-save','accounts',{...p,uid:demoUid('accounts'),reason:'Tự cấp',requestId:randomUUID()},403);
  const save=async(profile,patch)=>{await call('accounts-save','accounts',{...profile,...patch,reason:'Phiếu thực nghiệm',requestId:randomUUID()});return (await call('accounts-list','accounts')).profiles.find(x=>x.uid===profile.uid);};
  let modified=await save(p,{delegation:{from:demoUid('pkt'),scope:'equipment',until:Date.now()+3600000}});
  try{const {code}=await create('ptn','pkt');await change('pkt',code,'accept');await change('pkt',code,'decision_request',{scope:'equipment',target:demoUid('engineer')});await change('engineer',code,'approve',{basis:'Theo ủy quyền'});modified=await save(modified,{active:false,delegation:null});await call('workspace','engineer',{},403);}
  finally{await save(modified,{active:true,delegation:p.delegation});}
  const audit=(await call('accounts-list','accounts')).events;assert.ok(audit.some(e=>e.target===p.uid&&e.before.active&&!e.after.active));
});

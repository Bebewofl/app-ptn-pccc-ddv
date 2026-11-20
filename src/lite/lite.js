import {$,el,opt,button,choices,field,extra,date,late,nextAction,pages,statuses,statusLabel,priorities,scopes,flags,labels,normalize,safeMessage,notice,downloadBlob} from './ui.js';
import {reportForm,actionForm,chooseFiles} from './forms.js';
import {adminPage} from './admin.js';
const state={member:null,dir:[],cases:[],seen:{},page:'mine',metric:'',opened:null};
let spark=null,sparkLocal=false;
let auth,pilotRole='',local=false,epoch=0,view=0,seq=0,refreshing=null,previewUrls=[],detailRev=0,formOpen=false;
const ctx={state,modal,api,refresh,open:openIssue,files:sendFiles,view:()=>view,error:e=>notice(e.message)};
const name=id=>state.dir.find(d=>d.id===id)?.name||id||'Đã kết thúc';
function resetDialog(){view++;for(const u of previewUrls)URL.revokeObjectURL(u);previewUrls=[];$('modalMsg').textContent='';$('modalBody').replaceChildren();formOpen=false;}
function modal(title){resetDialog();$('modalTitle').textContent=title;if(!$('modal').open)$('modal').showModal();return $('modalBody');}
function caseUrl(code){const url=new URL(location.href);if(code)url.searchParams.set('case',code);else url.searchParams.delete('case');history.replaceState(null,'',url);}
function closeModal(remove=true){resetDialog();state.opened=null;detailRev=0;if($('modal').open)$('modal').close();if(remove)caseUrl(null);}
function reset(){pilotRole='';$('pilotLabel').hidden=true;epoch++;seq++;refreshing=null;closeModal(false);Object.assign(state,{member:null,dir:[],cases:[],seen:{},page:'mine',metric:''});$('workspace').hidden=true;
  $('list').replaceChildren();$('metrics').replaceChildren();$('identity').textContent='';$('message').textContent='';$('search').value='';$('status').value='';$('severity').value='';}
async function api(route,body={}){
  const me=auth.currentUser,session=epoch;
  if(!me)throw Error('Cần đăng nhập.');
  if(spark){const result=await spark(route,body,pilotRole);if(session!==epoch)throw Error('Phiên đăng nhập đã thay đổi.');return result;}
  const token=await me.getIdToken();if(session!==epoch)throw Error('Phiên đăng nhập đã thay đổi.');
  let res;
  try{res=await fetch('/api/'+route,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token,...(pilotRole?{'X-Hub-Pilot-Role':pilotRole}:{})},cache:'no-store',body:JSON.stringify(body)});}
  catch{throw Error('Mất kết nối. Có thể thử lại khi có mạng.');}
  if(session!==epoch)throw Error('Phiên đăng nhập đã thay đổi.');
  if(!res.ok){const msg=await res.json().catch(()=>({}));const err=Error(msg.error||'Dịch vụ chưa sẵn sàng.');err.status=res.status;throw err;}
  return route==='file-read'?res.blob():res.json();
}
const metrics=[
 ['open','Đang mở',c=>c.status!=='Đã đóng'],['new','Cần tiếp nhận',c=>c.status==='Chờ tiếp nhận'],
 ['work','Đang xử lý',c=>c.status==='Đang xử lý'],['wait','Chờ phản hồi hoặc quyết định',c=>['Chờ bổ sung','Chờ quyết định','Chờ xác nhận'].includes(c.status)],
 ['late','Quá hạn',late],['urgent','Khẩn cấp',c=>c.severity==='Khẩn cấp'&&c.status!=='Đã đóng'],['closed','Đã hoàn thành',c=>c.status==='Đã đóng']
];
function inbox(){return state.cases.filter(c=>c.involved&&(c.actorUid!==state.member.uid&&(state.seen[c.code]||0)<c.rev ||
  c.nextUid===state.member.uid && (late(c)||(c.deadline>Date.now()&&c.deadline-Date.now()<86400000))));}
function render(){
  const m=state.member;if(!m)return;
  $('identity').textContent=m.name+' · '+m.unit;$('heading').textContent=pages[state.page];$('report').hidden=!m.canReport;$('admin').hidden=!m.manageAccounts;
  const n=inbox().length;$('notices').textContent='Thông báo'+(n?' ('+n+')':'');
  document.querySelectorAll('nav button').forEach(b=>b.setAttribute('aria-current',b.dataset.page===state.page?'page':'false'));
  const metricBox=$('metrics');metricBox.replaceChildren();let rows=state.cases.slice();
  $('filters').hidden=!['all','history'].includes(state.page);
  if(state.page==='overview'){
    for(const [key,title,f] of metrics){const b=button('',()=>{state.metric=state.metric===key?'':key;render();});b.className='metric';b.setAttribute('aria-pressed',String(state.metric===key));b.append(el('b',rows.filter(f).length),el('span',title));metricBox.append(b);}
    if(state.metric)rows=rows.filter(metrics.find(v=>v[0]===state.metric)[2]);
  }
  if(state.page==='mine')rows=rows.filter(c=>c.status!=='Đã đóng'&&(c.nextUid===m.uid || c.collaborators?.includes(m.uid)&&(c.coordinationReplies?.[m.uid]||0)<(c.inviteRevisions?.[m.uid]||1)));
  if(state.page==='history')rows=rows.filter(c=>c.status==='Đã đóng'||!!c.conclusion);
  if(!$('filters').hidden){const q=normalize($('search').value);rows=rows.filter(c=>(!q||normalize([c.code,c.title,c.body,c.sourceUnit,c.ownerUnit,c.ownerName,name(c.nextUid),c.reference,c.conclusion,c.result].join(' ')).includes(q))
    &&(!$('status').value||$('status').value===c.status)&&(!$('severity').value||$('severity').value===c.severity||($('severity').value==='Bình thường'&&c.severity==='Thông thường')));}
  display($('list'),rows);
}
function display(root,rows){root.replaceChildren();if(!rows.length){root.append(el('p','Chưa có vấn đề trong phạm vi đang xem.','empty'));return;}
  for(const c of rows.sort((a,b)=>b.updatedAt-a.updatedAt)){
    const item=el('article',null,'item'),left=el('div');const tag=el('span',statusLabel(c.status),'tag');left.append(el('div',c.code+' · '+date(c.createdAt),'meta'),el('h3',c.title),tag,el('span',c.severity+(late(c)?' · Quá hạn':''),late(c)||c.severity==='Khẩn cấp'?'priority warn':'priority'),
      el('div','Báo cáo: '+c.sourceUnit+' · Chủ trì: '+(c.ownerUnit||'')+' · '+(c.ownerName||name(c.ownerUid)),'meta'),
      el('div',c.status==='Đã đóng'?'Đã có kết luận':(c.collaborators?.includes(state.member.uid)&&c.nextUid!==state.member.uid?'Phối hợp phản hồi · ':'')+nextAction(c)+' · '+name(c.nextUid),'next'));
    item.append(left,button('Mở vấn đề',()=>openIssue(c.code).catch(ctx.error)));root.append(item);
  }
}
async function refresh(){
  if(!auth?.currentUser)return;
  const session=epoch,request=++seq;
  const p=api('workspace').then(d=>{
    if(session!==epoch||request!==seq)return;
    Object.assign(state,{member:d.member,dir:d.directory,cases:d.cases,seen:d.seen});$('workspace').hidden=false;$('login').hidden=true;render();
    if(state.opened){const c=state.cases.find(i=>i.code===state.opened);
      if(!c){closeModal();notice('Hồ sơ nằm ngoài phạm vi quyền hiện tại.');}
      else if(!formOpen && detailRev && c.rev!==detailRev)openIssue(c.code).catch(ctx.error);}
  }).catch(err=>{if(session===epoch && [401,403].includes(err.status)){
      const userId=auth.currentUser?.uid;reset();$('login').hidden=false;$('message').textContent=err.message+(userId?' Mã tài khoản (UID): '+userId:'');
      if(auth.currentUser){const b=button('Đăng xuất',()=>auth.signOut());$('message').append(document.createTextNode(' '),b);}
    }else if(session===epoch)throw err;});
  refreshing=p;try{await p;}finally{if(refreshing===p)refreshing=null;}
}
async function openIssue(code){
  if(!state.member)return;
  const box=modal('Chi tiết vấn đề'),token=view;state.opened=code;detailRev=0;box.append(el('p','Đang tải hồ sơ…'));
  try{
    const {issue:c,events,files}=await api('detail',{code});if(view!==token)return;
    detailRev=c.rev;caseUrl(code);box.replaceChildren();$('modalTitle').textContent=c.title;
    box.append(el('div',c.code+' · '+statusLabel(c.status)+' · '+c.severity,'tag'),el('p',c.body,'detailText'),
      el('p','Người báo cáo: '+c.reporterName+' · '+c.sourceUnit+' · '+date(c.createdAt),'meta'),
      el('p','Chủ trì: '+(c.ownerName||name(c.ownerUid))+' · '+(c.ownerUnit||'')),
      el('p','Bước tiếp theo: '+nextAction(c)+(c.nextUid?' · '+name(c.nextUid):'')));
    if(c.collaborators?.length)box.append(el('p','Phối hợp: '+c.collaborators.map(name).join(', ')));
    if(c.deadline||c.reference)box.append(el('p',(c.deadline?'Hạn phản hồi: '+date(c.deadline)+' · ':'')+(c.reference||''),'meta'));
    const flagText=Object.entries(c.flags||{}).filter(([,v])=>v).map(([k])=>flags[k]);if(flagText.length)box.append(el('p',flagText.join(' · '),'priority'));
    if((c.flags?.safety||c.severity==='Khẩn cấp')&&c.status!=='Đã đóng')box.append(el('p',safeMessage,'warning'));
    if(c.result)box.append(el('p','Kết quả: '+c.result,'event'));if(c.conclusion)box.append(el('p','Kết luận đã ghi: '+c.conclusion+(c.confirmedBy?' · '+c.confirmedBy.name:''),'event'));
    const actions=el('div',null,'actionbar');for(const k of c.actions){const b=button(labels[k],async()=>{try{b.disabled=true;await actionForm(ctx,c,k);if(k!=='accept')formOpen=true;}catch(e){ctx.error(e);}finally{b.disabled=false;}},['accept','close','report_done'].includes(k));actions.append(b);}
    box.append(actions);
    const fs=extra(box,'Tệp đính kèm ('+files.filter(f=>f.state==='ready').length+')');
    for(const f of files){const line=el('div',null,'file');line.append(el('span',f.name+' · '+f.uploaderName+' · '+date(f.at||f.startedAt)));
      if(f.state==='ready')line.append(button(f.type.startsWith('image/')||f.type==='application/pdf'?'Xem tệp':'Tải tệp',async()=>{try{
        const blob=await api('file-read',{code,fileId:f.id});if(token!==view)return;
        if(f.type.startsWith('image/')||f.type==='application/pdf'){
          const url=URL.createObjectURL(blob);previewUrls.push(url);
          const node=el(f.type.startsWith('image/')?'img':'iframe');node.src=url;node.className='preview';node.title=f.name;if(node.tagName==='IMG')node.alt=f.name;else node.setAttribute('sandbox','');
          line.append(node,button('Tải xuống',()=>downloadBlob(blob,f.name)));
        }else downloadBlob(blob,f.name);
      }catch(e){ctx.error(e);}}));else line.append(el('small','Chờ hoàn tất. Chọn lại đúng tệp để thử lại.'));
      fs.append(line);}
    if(c.status!=='Đã đóng' && (c.ownerUid===state.member.uid||c.reporterUid===state.member.uid||c.nextUid===state.member.uid||c.collaborators?.includes(state.member.uid))){
      const f=el('form');fs.append(f);const inp=chooseFiles(f), ids=new Map(files.filter(x=>x.state==='pending').map(x=>[x.name+'_'+x.sha256,x.id]));f.append(button('Lưu tệp',async()=>{if(!inp.files.length)return;
        try{await sendFiles(code,inp.files,ids);await openIssue(code);notice('Đã lưu tệp.');}catch(e){ctx.error(e);}}));}
    box.append(button('Sao chép mã và liên kết',async()=>{try{await navigator.clipboard.writeText('HUB-HFI '+code+' '+location.href);notice('Đã sao chép mã và liên kết.');}catch{notice('Có thể sao chép địa chỉ trên thanh trình duyệt.');}}),el('h3','Lịch sử và kết luận'));
    for(const e of events){const line=el('div',null,'event');line.append(el('strong',labels[e.action]||e.action),el('small',date(e.at)+' · '+(e.actor?.name||name(e.actorUid))+(e.actor?.unit?' · '+e.actor.unit:'')));
      if(e.before&&e.before.status!==e.after?.status)line.append(el('div',statusLabel(e.before.status)+' → '+statusLabel(e.after.status)));
      if(e.target)line.append(el('div','Bên nhận: '+e.target.name+' · '+e.target.unit));if(e.note)line.append(el('div',e.note));if(e.basis)line.append(el('div','Căn cứ: '+e.basis));box.append(line);}
    await api('seen',{code,rev:c.rev});if(token===view){state.seen[code]=c.rev;render();}
  }catch(e){if(token===view){box.replaceChildren(el('p',e.message,'warning'));detailRev=0;}}
}
async function sendFiles(code,list,ids){
  for(const f of list){if(f.size>5*1024*1024)throw Error('Tệp vượt quá 5 MB: '+f.name);
    const digest=await crypto.subtle.digest('SHA-256',await f.arrayBuffer());
    const k=f.name+'_'+Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('');if(!ids.has(k))ids.set(k,crypto.randomUUID());
    const data=await new Promise((resolve,reject)=>{const r=new FileReader();r.onerror=()=>reject(Error('Chưa đọc được tệp '+f.name));r.onload=()=>resolve(r.result.split(',')[1]);r.readAsDataURL(f);});
    await api('file-add',{code,requestId:ids.get(k),name:f.name,data});}
}
function loginMethods(){
  const box=$('methods');box.replaceChildren();
  if(local&&!sparkLocal){const s=field(box,'Vai trò thực nghiệm','select','demoAccount');for(const [k,l] of Object.entries({ptn:'Trưởng phòng Thử nghiệm',pkt:'Trưởng phòng Kỹ thuật',engineer:'Kỹ sư trực',qlcl:'Trưởng phòng QLCL',director:'Giám đốc',office:'HCNS',sampling:'Lấy mẫu',warehouse:'Kho',lead:'Trưởng nhóm',staff:'Thử nghiệm viên',admin:'Quản trị kỹ thuật',accounts:'Quản trị tài khoản',viewer:'Người chỉ xem',operator:'Người nghiệm thu đa vai'}))opt(s,k,l);
    box.append(button('Đăng nhập thử nghiệm',async()=>{try{const r=await fetch('/api/demo-login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({role:s.value})});const d=await r.json();if(!r.ok)throw Error(d.error);await auth.signInWithCustomToken(d.token);}catch(e){ctx.error(e);}},true));
  }else{box.append(button('Đăng nhập bằng Google',()=>auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()).catch(()=>notice('Chưa đăng nhập được bằng Google. Kiểm tra tài khoản hoặc thử lại.')),true));}
}
async function start(){
  const build=await (await fetch('/build-info.json',{cache:'no-store'})).json(),host=location.hostname;
  local=build.mode==='emulator'&&['127.0.0.1','localhost'].includes(host)&&build.projectId==='demo-hub-lite';
  sparkLocal=build.mode==='spark-emulator'&&['127.0.0.1','localhost'].includes(host)&&build.projectId==='demo-hub-spark';
  const cloud=['test','spark'].includes(build.mode)&&/^hub-ptn-test--hub-v3-lite-[a-z0-9-]+\.(web\.app|firebaseapp\.com)$/.test(host)&&location.protocol==='https:'&&build.projectId==='hub-ptn-test';
  if(!local&&!cloud&&!sparkLocal)throw Error('Địa chỉ này chưa được cấu hình cho HUB thực nghiệm.');
  const cfg=(local||sparkLocal)?{projectId:build.projectId,apiKey:'demo-key',authDomain:build.projectId+'.firebaseapp.com'}:await(await fetch('/__/firebase/init.json',{cache:'no-store'})).json();
  if(cfg.projectId!==build.projectId||(!local&&!sparkLocal&&cfg.authDomain!=='hub-ptn-test.firebaseapp.com'))throw Error('Cấu hình đăng nhập không thuộc môi trường Test.');
  firebase.initializeApp(cfg);auth=firebase.auth();if(local||sparkLocal)auth.useEmulator('http://127.0.0.1:9097',{disableWarnings:true});
  if(build.mode==='spark'||sparkLocal){const {sparkApi,restDb}=await import('./spark.js');spark=sparkApi(restDb(sparkLocal?'http://127.0.0.1:9007':'https://hub-ptn-test-default-rtdb.asia-southeast1.firebasedatabase.app',auth,sparkLocal?'demo-hub-spark-default-rtdb':''),auth);}
  $('env').textContent=(local||sparkLocal?'Thực nghiệm nội bộ trên máy':'Firebase Test trực tuyến')+(spark?' · V3.0 LITE · Spark':' · V3.0 LITE · Candidate 02');loginMethods();
  auth.onAuthStateChanged(async u=>{reset();$('login').hidden=!!u;if(!u){loginMethods();return;}try{const who=await api('session');if(auth.currentUser?.uid!==u.uid)return;
      if(who.roles.length){choices($('pilotRole'),who.roles.map(r=>[r.uid,r.unit+' · '+r.name]));pilotRole=who.roles.find(r=>r.uid==='pilot-ptn')?.uid||who.roles[0].uid;$('pilotRole').value=pilotRole;$('pilotLabel').hidden=false;}
      await refresh();const code=new URL(location.href).searchParams.get('case');if(code&&state.member)await openIssue(code);}catch(e){if(u&&auth.currentUser?.uid===u.uid){$('login').hidden=false;const b=button('Đăng xuất',()=>auth.signOut());$('methods').replaceChildren(b);}ctx.error(e);}});
}
$('closeModal').onclick=()=>closeModal();$('modal').addEventListener('cancel',e=>{e.preventDefault();closeModal();});
$('pilotRole').onchange=async()=>{const selection=$('pilotRole').value;epoch++;seq++;closeModal();state.member=null;state.cases=[];state.seen={};$('list').replaceChildren();$('metrics').replaceChildren();$('workspace').hidden=true;state.page='mine';pilotRole=selection;try{await refresh();}catch(e){ctx.error(e);}};
$('signOut').onclick=()=>{caseUrl(null);auth.signOut();};
$('report').onclick=()=>{state.opened=null;caseUrl(null);reportForm(ctx);formOpen=true;};$('admin').onclick=()=>{closeModal();adminPage(ctx).catch(ctx.error);};
$('notices').onclick=()=>{closeModal();const box=modal('Thông báo');display(box,inbox());};
for(const b of document.querySelectorAll('nav button'))b.onclick=()=>{state.page=b.dataset.page;state.metric='';render();};
choices($('status'),statuses.map(s=>[s,statusLabel(s)]),'Tất cả');choices($('severity'),priorities.map(s=>[s,s]),'Tất cả');
for(const n of document.querySelectorAll('#filters input,#filters select'))n.oninput=render;
const tick=()=>{if(state.member&&!document.hidden&&!refreshing)refresh().catch(ctx.error);};
setInterval(tick,15000);window.addEventListener('focus',tick);window.addEventListener('online',tick);
start().catch(e=>{$('env').textContent='Chưa kết nối được HUB';notice(e.message);});

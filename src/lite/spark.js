// The application sends one atomic RTDB update per event. Server rules authorize the case,
// the audit event, the reader list and any attachment before the change becomes visible.
const states={new:'Chờ tiếp nhận',work:'Đang xử lý',more:'Chờ bổ sung',decision:'Chờ quyết định',done:'Chờ xác nhận',closed:'Đã đóng'};
const flagNames=['safety','quality','temporary','verifyImpact','needResume'];
const flags=input=>Object.fromEntries(flagNames.map(key=>[key,input?.[key]===true]));
const keys=map=>Object.keys(map||{}).filter(k=>map[k]===true);
const time={'.sv':'timestamp'};
const safeId=id=>typeof id==='string' && /^[A-Za-z0-9_-]{1,128}$/.test(id);
function ensure(ok,message,status=400){if(!ok){const e=Error(message);e.status=status;throw e;}}
function short(value,limit,required=false){ensure(value==null||typeof value==='string','Giá trị nhập không hợp lệ.');const result=(value||'').trim();ensure(result.length<=limit&&(!required||!!result),'Kiểm tra nội dung và độ dài.');return result;}
function digest(bytes){return crypto.subtle.digest('SHA-256',bytes).then(buf=>[...new Uint8Array(buf)].map(n=>n.toString(16).padStart(2,'0')).join(''));}
const caseCode=async(id,key)=>'VM3-'+(await digest(new TextEncoder().encode(id+'/'+key))).slice(0,16).toUpperCase();
const checkCode=value=>ensure(/^VM3-[A-Z0-9]{16}$/.test(value),'Mã hồ sơ không hợp lệ.');
const checkEvent=value=>ensure(/^[a-f0-9-]{36}$/.test(value),'Mã lần gửi không hợp lệ.');
const fileTypes={png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',pdf:'application/pdf',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'};
function inspectFile(name,b64){
 const ext=name.split('.').pop().toLowerCase(),type=fileTypes[ext];
 ensure(type && !/[/\\\x00-\x1F]/.test(name) && b64.length<=6990508,'Kiểm tra tên, loại và giới hạn 5 MB của tệp.');
 const plain=atob(b64),bytes=Uint8Array.from(plain,c=>c.charCodeAt(0));
 ensure(bytes.length>0&&bytes.length<=5242880,'Dung lượng tệp không hợp lệ.');
 const signs={png:b64.startsWith('iVBORw0KGgo'),pdf:plain.startsWith('%PDF-'),jpg:b64.startsWith('/9j/'),jpeg:b64.startsWith('/9j/'),webp:plain.startsWith('RIFF')&&plain.slice(8,12)==='WEBP',docx:plain.startsWith('PK')&&plain.includes('word/')&&plain.includes('[Content_Types].xml'),xlsx:plain.startsWith('PK')&&plain.includes('xl/')&&plain.includes('[Content_Types].xml')};
 ensure(signs[ext],'Nội dung tệp không khớp định dạng đã chọn.');return {type,bytes};
}
const profilesToRows=profiles=>Object.entries(profiles||{}).map(([id,p])=>({...p,id,uid:id,routes:keys(p.routes),emergencyRoutes:keys(p.emergencyRoutes),scopes:keys(p.scopes),manageUnits:keys(p.manageUnits),grantScopes:keys(p.grantScopes)}));
function authority(m,scope,people){return m?.active && (m.scopes.includes(scope)|| (m.delegation?.scope===scope && m.delegation.until>Date.now() && people[m.delegation.from]?.active && people[m.delegation.from].scopes.includes(scope)));}
function actions(c,m,people){
 const s=c.state,own=c.owner===m.id&&m.canHandle,next=c.next===m.id,review=c.reviewer===m.id&&m.canClose,a=[];
 if(s==='closed')return review?['reopen']:[];
 if(s==='new'&&own&&next)a.push('accept','route');
 if(s==='work'&&own&&next){a.push('respond','assign','route','invite','supplement','propose','decision_request','flags');if(!c.paused&&!c.needResume)a.push('report_done');if(!c.paused&&m.mayPause)a.push('pause');if((c.paused||c.needResume)&&authority(m,c.pauseScope,people))a.push('resume');}
 if(c.collaborators?.[m.id]&&!own&&m.canHandle)a.push('collaborate');
 if(s==='more'&&next)a.push('supply');if(s==='decision'&&next&&authority(m,c.scope,people))a.push('approve','reject');
 if(s==='done'&&next&&review)a.push('close','continue');
 const peer=people[c.next];if((review||m.canCoordinate)&&(!peer?.active || (s==='done'&&!peer.canClose)||(s==='decision'&&!authority(peer,c.scope,people))||(['new','work'].includes(s)&&!peer.canHandle)))a.push('handover');return a;
}
function summarize(code,row,m,people){
 const s=row.source,h=row.head,evs=Object.values(row.events||{}).sort((a,b)=>a.rev-b.rev);
 let latestFlags=s.flags,result='',conclusion='',confirmedBy=null;const invites=s.invite?{[s.invite]:1}:{},replies={},files=[];
 const events=evs.map((e,i)=>{
   if(e.kind==='flags')latestFlags=e.flags;
   if(e.kind==='report_done')result=e.note;
   if(e.kind==='close'){conclusion=e.note;confirmedBy={name:e.name,unit:e.unit};}
   if(e.kind==='invite')invites[e.target]=e.rev;if(e.kind==='collaborate')replies[e.actor]=e.rev;
   if(e.kind==='attach')files.push({id:e.id,type:e.fileType,name:e.note,sha256:e.fileHash,size:e.fileSize,state:'ready',uploaderName:e.name,at:e.at});
   return {action:e.kind,rev:e.rev,note:e.note,basis:e.basis,principalUid:e.principal,actorUid:e.actor,actor:{name:e.name,unit:e.unit},at:e.at,before:i?{status:states[evs[i-1].state]}:null,after:{status:states[e.state]},target:e.target?{name:e.targetName,unit:e.targetUnit}:null};
 });
 return {events,files,issue:{code,title:s.title,body:s.body,severity:s.severity,domain:s.domain,deadline:s.deadline,restricted:s.restricted,reference:[s.yctn,s.model,s.customer,s.station].filter(Boolean).join(' · '),reporterUid:s.reporter,reporterName:s.name,sourceUnit:s.unit,createdAt:s.at,rev:h.rev,updatedAt:h.at,actorUid:h.actor,status:states[h.state],ownerUid:h.owner,ownerName:people[h.owner]?.name||h.owner,ownerUnit:people[h.owner]?.unit||'',nextUid:h.next,reviewerUid:h.reviewer,collaborators:keys(row.collaborators),inviteRevisions:invites,coordinationReplies:replies,flags:{...latestFlags,paused:h.paused,needResume:h.needResume},pauseScope:h.pauseScope,conclusion,confirmedBy,result,involved:!!row.readers?.[m.id],actions:actions({...h,collaborators:row.collaborators},m,people)}};
}
function updateHead(old,source,m,input){
 const h={...old,rev:old.rev+1,event:input.requestId,actor:m.id,at:time,kind:input.action,target:input.target||''};
 const target=h.target;
 switch(h.kind){
  case 'accept':h.state='work';break;
  case 'assign':case 'route':h.state='new';h.owner=target;h.next=target;break;
  case 'supplement':h.state='more';h.next=source.reporter;break;
  case 'decision_request':h.state='decision';h.next=target;h.scope=input.scope;h.purpose=input.purpose||'general';break;
  case 'approve':if(h.purpose==='resume')h.needResume=h.paused=false;
  // All final decision outcomes return the case to its owner.
  case 'reject':case 'supply':case 'continue':case 'reopen':h.state='work';h.next=h.owner;break;
  case 'pause':h.paused=h.needResume=true;h.pauseScope=['equipment','testing'].includes(source.domain)?source.domain:input.pauseScope;break;
  case 'resume':h.paused=h.needResume=false;break;
  case 'flags':h.needResume=h.needResume||input.flags?.needResume===true;break;
  case 'report_done':h.state='done';h.next=h.reviewer;break;
  case 'close':h.state='closed';h.next='';break;
  case 'handover':h.next=target;if(h.state==='done')h.reviewer=target;else if(['work','new'].includes(h.state)){h.owner=target;h.state='new';}break;
 }
 return h;
}
function event(head,m,people,input){
 return {...head,id:head.event,name:m.name,unit:m.unit,title:m.title,note:short(input.note,4000),basis:short(input.basis,1000),flags:flags(input.flags),targetName:people[head.target]?.name||'',targetUnit:people[head.target]?.unit||'',fileType:input.file?.type||'',fileSize:input.file?.size||0,fileHash:input.file?.sha256||''};
}
export function restDb(endpoint,auth,namespace=''){
 const local=endpoint==='http://127.0.0.1:9007'&&namespace==='demo-hub-spark-default-rtdb';
 ensure(local||endpoint==='https://hub-ptn-test-default-rtdb.asia-southeast1.firebasedatabase.app','Sai địa chỉ Firebase Test.');
 async function request(path,body,query){
  const user=auth.currentUser;ensure(user,'Cần đăng nhập.',401);
  const url=new URL('/hubLite'+(path?'/'+path:'')+'.json',endpoint);
  if(local)url.searchParams.set('ns',namespace);url.searchParams.set('auth',await user.getIdToken());
  for(const [k,v] of Object.entries(query||{}))url.searchParams.set(k,JSON.stringify(v));
  let response;try{response=await fetch(url,{method:body===undefined?'GET':'PATCH',cache:'no-store',referrerPolicy:'no-referrer',headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});}catch{throw Error('Mất kết nối. Có thể thử lại khi có mạng.');}
  if(!response.ok){const e=Error(response.status===401||response.status===403?'Ngoài phạm vi quyền hiện tại, hoặc hồ sơ vừa được cập nhật.':'Dữ liệu chưa được lưu. Thử lại sau.');e.status=response.status===401?403:response.status;throw e;}
  return response.json();
 }
 return {get:(p,q)=>request(p,undefined,q),patch:changes=>request('',changes)};
}
export function sparkApi(db,auth){
 let rows=[],people={},selected='',previousUser='';
 async function openSession(){
  const id=auth.currentUser.uid;if(previousUser!==id){selected='';previousUser=id;}
  const gr=await db.get('grants/'+id);ensure(gr,'Tài khoản chưa được cấp vai trò thực nghiệm. Mã tài khoản (UID): '+id,403);
  const available=await db.get('profiles');rows=profilesToRows(available);people=Object.fromEntries(rows.map(p=>[p.id,p]));
  const roles=keys(gr).filter(k=>people[k]?.active).map(k=>({uid:k,name:people[k].name,unit:people[k].unit}));
  ensure(roles.length,'Tài khoản chưa có vai trò đang hoạt động.',403);return {roles};
 }
 async function readCase(code){checkCode(code);const d=await db.get('cases/'+code);ensure(d?.head,'Hồ sơ không tồn tại hoặc ngoài phạm vi tài khoản.',404);return d;}
 return async function request(route,input={},role=''){
  if(route==='session')return openSession();
  const id=auth.currentUser.uid;ensure(id===previousUser&&safeId(role),'Cần chọn vai trò được cấp.',403);
  if(selected!==role){await db.patch({['selected/'+id]:role});selected=role;}
  const raw=await db.get('profiles');rows=profilesToRows(raw);people=Object.fromEntries(rows.map(p=>[p.id,p]));const m=people[role];ensure(m?.active,'Vai trò đã bị tạm khóa.',403);
  if(route==='workspace'){
   const requests=[db.get('cases',{orderBy:'readers/'+role,equalTo:true}),db.get('seen/'+role)];if(m.overview)requests.push(db.get('cases',{orderBy:'source/restricted',equalTo:false}));
   const [mine,seen,shared]=await Promise.all(requests);
   const cases=Object.entries({...mine,...shared}).map(([code,row])=>summarize(code,row,m,people).issue);
   return {member:m,directory:rows,seen:seen||{},cases};
  }
  if(route==='accounts-list'||route==='accounts-save')return sparkAccounts(route,db,m,input,people,id,raw);
  if(route==='detail')return summarize(input.code,await readCase(input.code),m,people);
  if(route==='seen'){checkCode(input.code);await db.patch({['seen/'+role+'/'+input.code]:input.rev});return {ok:true};}
  if(route==='file-read'){checkCode(input.code);checkEvent(input.fileId);const f=await db.get('files/'+input.code+'/'+input.fileId);ensure(f,'Tệp không tồn tại.',404);const {type,bytes}=inspectFile(f.name,f.bytes);ensure(await digest(bytes)===f.sha256&&bytes.length===f.size&&f.type===type,'Tệp chưa đối soát được.',409);return new Blob([bytes],{type});}
  const key=input.requestId;checkEvent(key);const code=route==='create'?await caseCode(role,key):input.code;checkCode(code);
  if(input.target)ensure(safeId(input.target),'Đầu mối không hợp lệ.');
  const p='cases/'+code+'/',changes={};let h,s,row;
  if(route==='create'){
    const entitlement=people[input.target];ensure(entitlement,'Chọn người nhận.');
    const f=flags(input.flags),domain=input.domain||(entitlement.scopes.length===1?entitlement.scopes[0]:'management');
    s={reporter:role,name:m.name,unit:m.unit,titleAtReport:m.title,at:time,target:input.target,invite:input.invite||'',title:short(input.title,160,true),body:short(input.body,4000,true),severity:input.severity||'Bình thường',domain,restricted:!!input.restricted,deadline:input.deadline||0,flags:f};
    for(const field of ['yctn','model','customer','station'])s[field]=short(input.references?.[field],160);
    h={state:'new',owner:s.target,next:s.target,reviewer:m.reviewerUid,rev:1,event:key,actor:role,principal:id,at:time,kind:'create',target:s.target,scope:'',purpose:'general',pauseScope:['testing','equipment'].includes(domain)?domain:'testing',paused:false,needResume:f.needResume};
    changes[p+'source']=s;for(const k of new Set([role,h.owner,h.reviewer,s.invite].filter(Boolean)))changes[p+'readers/'+k]=true;if(s.invite)changes[p+'collaborators/'+s.invite]=true;
  }else{
   ensure(route==='action'||route==='file-add','Đường dẫn không hợp lệ.');row=await readCase(code);const oldEvent=row.events?.[key];s=row.source;
   if(route==='file-add'){
    const name=short(input.name,150,true),{type,bytes}=inspectFile(name,input.data),sha256=await digest(bytes);
    input={...input,action:'attach',note:name,file:{name,type,size:bytes.length,sha256,uploader:role,bytes:input.data,at:time},rev:row.head.rev};
    changes['files/'+code+'/'+key]=input.file;
   }
   if(oldEvent){ensure(oldEvent.actor===role&&oldEvent.principal===id&&oldEvent.kind===input.action&&(!input.file||oldEvent.fileHash===input.file.sha256&&oldEvent.note===input.note),'Lần gửi đã được sử dụng.',409);return {code,rev:oldEvent.rev,id:key};}
   ensure(input.rev===row.head.rev,'Hồ sơ vừa cập nhật. Mở lại trước khi thao tác.',409);
   h=updateHead(row.head,s,m,input);h.principal=id;
   if(input.target&&['route','assign','invite','decision_request','handover'].includes(h.kind)&&!row.readers[input.target])changes[p+'readers/'+input.target]=true;
   if(h.kind==='invite')changes[p+'collaborators/'+input.target]=true;
  }
  changes[p+'head']=h;const entry=event(h,m,people,input);delete entry.event;changes[p+'events/'+key]=entry;
  try{await db.patch(changes);}catch(e){
   if(route==='create'&&e.status===403){const old=await db.get('cases/'+code).catch(()=>null);const first=old?.events?.[key];if(first?.kind==='create'&&first.actor===role&&first.principal===id)return {code};}
   throw e;
  }
  return {code,rev:h.rev,id:key};
 };
}
async function sparkAccounts(route,db,m,input,people,principal,raw){
 ensure(m.manageAccounts,'Ngoài phạm vi quản trị.',403);
 if(route==='accounts-list'){const logs=await db.get('accessEvents');return {profiles:Object.values(people).filter(p=>m.manageUnits.includes(p.unit)),events:Object.values(logs||{}).filter(e=>m.manageUnits.includes(e.after.unit)).sort((a,b)=>b.at-a.at)};}
 const key=input.requestId,id=input.uid;checkEvent(key);ensure(safeId(id)&&Object.hasOwn(people,id),'Chọn một danh tính thử nghiệm đã được chuẩn bị.');const prior=raw[id];
 ensure(id!==m.id && !prior.technical && !prior.manageAccounts && m.manageUnits.includes(prior.unit),'Ngoài phạm vi quản trị.',403);
 const before=people[id],row={...prior,rev:prior.rev+1,updatedBy:m.id,principal,event:key,reason:short(input.reason,500,true)};
 ensure(input.rev===prior.rev,'Danh bạ vừa cập nhật. Mở lại trước khi lưu.',409);
 for(const k of ['active','canReport','canHandle','canClose','mayPause','unitLead'])row[k]=!!input[k];
 for(const k of ['name','title','unit','reviewerUid'])row[k]=short(input[k],100,k!=='reviewerUid');
 const map=a=>Object.fromEntries((a||[]).map(k=>[k,true]));
 for(const k of ['routes','emergencyRoutes','scopes'])row[k]=map(input[k]);row.delegation=input.delegation||null;
 const core=['active','canReport','canHandle','canClose','mayPause','unitLead','overview','canCoordinate','technical','manageAccounts','group','name','title','unit','rev','reviewerUid','routes','emergencyRoutes','scopes','delegation'];
 const snapshot=profile=>Object.fromEntries(core.filter(k=>profile[k]!=null).map(k=>[k,profile[k]]));
 await db.patch({['profiles/'+id]:row,['accessEvents/'+key]:{actor:{uid:m.id,name:m.name},principal,at:time,reason:row.reason,target:id,before:snapshot(prior),after:snapshot(row)}});
 return {ok:true};
}

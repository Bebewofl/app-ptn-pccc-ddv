(() => {
'use strict';

const TASK_VERSION='2.2.8';
const TASK_STATUS={
  NEW:'Chưa xác nhận',
  DOING:'Đang thực hiện',
  REVIEW:'Chờ Trưởng phòng xác nhận',
  DONE:'Hoàn thành'
};
const TASK_LEADS=Object.freeze([
  {email:'dowait17@gmail.com',name:'Lê Đức Độ',group:'3TR',label:'Trưởng nhóm 3T-R'},
  {email:'phanngoctuyen28022003@gmail.com',name:'Phan Ngọc Tuyến',group:'KN',label:'Trưởng nhóm K-N'},
  {email:'tuyent0319@gmail.com',name:'Trần Thị Tuyền',group:'KN',label:'Phụ trách ca đêm K-N'},
  {email:'nguyenanhtu7121941@gmail.com',name:'Nguyễn Anh Tú',group:'ATAS',label:'Trưởng nhóm ATAS'}
]);

let hubTasks=[];
let unsubscribeTasks=null;
let listenerIdentity='';

const norm=v=>String(v||'').trim().toLowerCase();
const me=()=>norm(currentUser?.email);
const isHead=()=>R().type==='head';
const isLead=()=>R().type==='lead';
const isTaskUser=()=>isHead()||isLead()||R().type==='bod';
const tsText=v=>typeof fmtTs==='function'?fmtTs(v):(v||'—');

function taskGroupLabel(g){return g==='3TR'?'Nhóm 3T-R':g==='KN'?'Nhóm K-N':g==='ATAS'?'Nhóm ATAS':g||'—'}
function isClosed(t){return t.status===TASK_STATUS.DONE}
function deadlineMs(t){
  const raw=t.deadlineLocal||'';
  if(!raw)return 0;
  const n=Date.parse(raw);
  return Number.isFinite(n)?n:0;
}
function overdue(t){
  const d=deadlineMs(t);
  return !!d && !isClosed(t) && Date.now()>d;
}
function mine(t){
  if(isHead()||R().type==='bod')return true;
  return isLead() && norm(t.assigneeEmail)===me();
}
function attentionTasks(){
  const seen=new Map();
  for(const t of hubTasks){
    if(!mine(t)||isClosed(t))continue;
    if(isLead() && t.status===TASK_STATUS.NEW)seen.set(t.id,t);
    if(isHead() && t.status===TASK_STATUS.REVIEW)seen.set(t.id,t);
    if(overdue(t))seen.set(t.id,t);
  }
  return [...seen.values()];
}
function openTaskCount(){return hubTasks.filter(t=>mine(t)&&!isClosed(t)).length}
function sortTasks(list){
  return list.slice().sort((a,b)=>{
    const oa=overdue(a)?1:0, ob=overdue(b)?1:0;
    if(oa!==ob)return ob-oa;
    const ta=a.updatedAt?.toMillis?.()||a.createdAt?.toMillis?.()||0;
    const tb=b.updatedAt?.toMillis?.()||b.createdAt?.toMillis?.()||0;
    return tb-ta;
  });
}
function taskBadge(t){
  if(overdue(t))return '<span class="badge red">Quá hạn</span>';
  if(t.status===TASK_STATUS.NEW)return '<span class="badge orange">Chưa xác nhận</span>';
  if(t.status===TASK_STATUS.DOING)return '<span class="badge blue">Đang thực hiện</span>';
  if(t.status===TASK_STATUS.REVIEW)return '<span class="badge orange">Chờ xác nhận</span>';
  return '<span class="badge green">Hoàn thành</span>';
}
function dueText(t){
  if(!t.deadlineLocal)return 'Chưa đặt';
  try{return new Date(t.deadlineLocal).toLocaleString('vi-VN')}catch{return t.deadlineLocal}
}
function priorityBadge(p){
  const c=p==='Khẩn'?'red':p==='Cao'?'orange':'';
  return '<span class="badge '+c+'">'+escapeHtml(p||'Bình thường')+'</span>';
}

function queryForCurrentUser(){
  if(!currentUser||!currentAccess||!isTaskUser())return null;
  let q=db.collection('hub_tasks');
  if(isLead())q=q.where('assigneeEmail','==',me());
  return q;
}
function stopRealtime(){
  if(unsubscribeTasks){unsubscribeTasks();unsubscribeTasks=null}
  listenerIdentity='';
  hubTasks=[];
}
function startRealtime(){
  const ident=currentUser&&currentAccess?me()+'|'+R().type:'';
  if(!ident){stopRealtime();return}
  if(listenerIdentity===ident&&unsubscribeTasks)return;
  stopRealtime();
  const q=queryForCurrentUser();
  if(!q)return;
  listenerIdentity=ident;
  unsubscribeTasks=q.onSnapshot(snap=>{
    hubTasks=sortTasks(snap.docs.map(d=>({id:d.id,...d.data()})));
    updateNotificationBadge();
    const active=document.querySelector('.nav button.active')?.dataset.page||'desk';
    if(['desk','tasks','commonRoom'].includes(active))nav(active);
  },err=>{
    console.error('Task realtime:',err);
    alert('Không đồng bộ được công việc được giao: '+(err.message||err));
  });
}

async function nextCode(){
  const ref=db.collection('hub_meta').doc('task_counters');
  let code='';
  await db.runTransaction(async tx=>{
    const snap=await tx.get(ref);
    const n=(snap.exists&&Number(snap.data().taskCounter))||0;
    const next=n+1;
    tx.set(ref,{taskCounter:next,updatedAt:FV.serverTimestamp()},{merge:true});
    code='CV-'+String(next).padStart(3,'0');
  });
  return code;
}
async function event(taskId,action,detail=''){
  await db.collection('hub_task_events').add({
    taskId,action,detail,
    actorUid:currentUser.uid,
    actorEmail:me(),
    actorName:currentUser.displayName||currentAccess?.name||R().label,
    actorRole:R().label,
    createdAt:FV.serverTimestamp(),
    schemaVersion:TASK_VERSION
  });
}
async function eventsHtml(taskId){
  try{
    const snap=await db.collection('hub_task_events').where('taskId','==',taskId).get();
    const list=snap.docs.map(d=>d.data()).sort((a,b)=>(a.createdAt?.toMillis?.()||0)-(b.createdAt?.toMillis?.()||0));
    return list.length?list.map(x=>'<div>'+escapeHtml(tsText(x.createdAt))+' — <b>'+escapeHtml(x.actorName||x.actorRole)+'</b>: '+escapeHtml(x.action)+(x.detail?' — '+escapeHtml(x.detail):'')+'</div>').join(''):'<div>Chưa có lịch sử.</div>';
  }catch(e){return '<div>Chưa tải được lịch sử: '+escapeHtml(e.message||e)+'</div>'}
}

function openCreate(){
  if(!isHead())return alert('Chỉ Trưởng phòng PTN được giao việc tổng.');
  document.getElementById('drawerSmall').textContent='GIAO VIỆC';
  document.getElementById('drawerTitle').textContent='Giao việc cho đầu mối PTN';
  document.getElementById('drawerBody').innerHTML=`
    <div class="field"><label>Người chịu trách nhiệm</label><select id="tAssignee">${TASK_LEADS.map((x,i)=>'<option value="'+i+'">'+escapeHtml(x.name)+' · '+escapeHtml(x.label)+'</option>').join('')}</select></div>
    <div class="field"><label>Tiêu đề công việc</label><input id="tTitle" placeholder="Ngắn gọn, rõ đầu việc"></div>
    <div class="field"><label>Nội dung / yêu cầu đầu ra</label><textarea id="tDescription" placeholder="Nêu việc cần làm và kết quả cần báo cáo"></textarea></div>
    <div class="formgrid">
      <div class="field"><label>Mức độ</label><select id="tPriority"><option>Bình thường</option><option>Cao</option><option>Khẩn</option></select></div>
      <div class="field"><label>Hạn hoàn thành</label><input id="tDeadline" type="datetime-local"></div>
    </div>
    <div class="field"><label>Liên kết VM (nếu có)</label><input id="tLinkedCase" placeholder="Ví dụ VM-005"></div>
    <div class="notice">Người nhận phải xác nhận đã nhận việc và phải có báo cáo trước khi gửi hoàn thành.</div>`;
  document.getElementById('drawerFoot').innerHTML='<button class="btn" onclick="closeDrawer()">Hủy</button><button class="btn primary" onclick="HUB_TASKS.create()">Giao việc</button>';
  openDrawer();
}
async function create(){
  if(!isHead())return;
  const lead=TASK_LEADS[Number(document.getElementById('tAssignee')?.value||0)];
  const title=document.getElementById('tTitle')?.value.trim();
  const description=document.getElementById('tDescription')?.value.trim();
  if(!title||!description)return alert('Cần nhập tiêu đề và nội dung công việc.');
  try{
    const code=await nextCode();
    const data={
      code,title,description,
      priority:document.getElementById('tPriority')?.value||'Bình thường',
      deadlineLocal:document.getElementById('tDeadline')?.value||'',
      linkedCaseId:(document.getElementById('tLinkedCase')?.value||'').trim().toUpperCase(),
      assigneeEmail:lead.email,assigneeName:lead.name,assigneeRole:lead.label,assigneeGroup:lead.group,
      assignedByUid:currentUser.uid,assignedByEmail:me(),assignedByName:currentUser.displayName||currentAccess?.name||R().label,
      status:TASK_STATUS.NEW,progressNote:'',reportText:'',decisionNote:'',
      createdAt:FV.serverTimestamp(),updatedAt:FV.serverTimestamp(),updatedByEmail:me(),schemaVersion:TASK_VERSION
    };
    await db.collection('hub_tasks').doc(code).set(data);
    await event(code,'Giao việc',lead.name+' · '+taskGroupLabel(lead.group));
    closeDrawer();
    alert('Đã giao '+code+' cho '+lead.name+'.');
  }catch(e){alert('Không giao được việc: '+e.message)}
}
async function acknowledge(id){
  const t=hubTasks.find(x=>x.id===id);
  if(!t||!isLead()||norm(t.assigneeEmail)!==me()||t.status!==TASK_STATUS.NEW)return;
  try{
    await db.collection('hub_tasks').doc(id).update({status:TASK_STATUS.DOING,acknowledgedAt:FV.serverTimestamp(),updatedAt:FV.serverTimestamp(),updatedByEmail:me()});
    await event(id,'Đã nhận việc','Bắt đầu thực hiện');
  }catch(e){alert('Không xác nhận được: '+e.message)}
}
function openProgress(id){
  const t=hubTasks.find(x=>x.id===id);if(!t)return;
  document.getElementById('drawerSmall').textContent='CẬP NHẬT TIẾN ĐỘ';
  document.getElementById('drawerTitle').textContent=id+' — '+t.title;
  document.getElementById('drawerBody').innerHTML='<div class="field"><label>Nội dung cập nhật</label><textarea id="taskProgressText" placeholder="Đã làm gì, đang chờ gì, có vướng mắc gì...">'+escapeHtml(t.progressNote||'')+'</textarea></div>';
  document.getElementById('drawerFoot').innerHTML='<button class="btn" onclick="closeDrawer()">Hủy</button><button class="btn primary" onclick="HUB_TASKS.saveProgress(\''+id+'\')">Lưu cập nhật</button>';
  openDrawer();
}
async function saveProgress(id){
  const text=(document.getElementById('taskProgressText')?.value||'').trim();
  if(!text)return alert('Cần nhập nội dung cập nhật.');
  try{
    await db.collection('hub_tasks').doc(id).update({progressNote:text,progressUpdatedAt:FV.serverTimestamp(),updatedAt:FV.serverTimestamp(),updatedByEmail:me()});
    await event(id,'Cập nhật tiến độ',text);
    closeDrawer();
  }catch(e){alert('Không lưu được cập nhật: '+e.message)}
}
function openReport(id){
  const t=hubTasks.find(x=>x.id===id);if(!t)return;
  document.getElementById('drawerSmall').textContent='BÁO CÁO KẾT QUẢ';
  document.getElementById('drawerTitle').textContent=id+' — '+t.title;
  document.getElementById('drawerBody').innerHTML='<div class="field"><label>Kết quả thực hiện</label><textarea id="taskReportText" placeholder="Bắt buộc nêu kết quả, tồn tại và đề xuất nếu có"></textarea></div>';
  document.getElementById('drawerFoot').innerHTML='<button class="btn" onclick="closeDrawer()">Hủy</button><button class="btn primary" onclick="HUB_TASKS.submitReport(\''+id+'\')">Gửi Trưởng phòng xác nhận</button>';
  openDrawer();
}
async function submitReport(id){
  const text=(document.getElementById('taskReportText')?.value||'').trim();
  if(!text)return alert('Phải có báo cáo kết quả trước khi gửi hoàn thành.');
  try{
    await db.collection('hub_tasks').doc(id).update({reportText:text,status:TASK_STATUS.REVIEW,reportedAt:FV.serverTimestamp(),updatedAt:FV.serverTimestamp(),updatedByEmail:me()});
    await event(id,'Gửi báo cáo kết quả',text);
    closeDrawer();
  }catch(e){alert('Không gửi được báo cáo: '+e.message)}
}
async function confirmDone(id){
  if(!isHead())return;
  const t=hubTasks.find(x=>x.id===id);if(!t||t.status!==TASK_STATUS.REVIEW)return;
  if(!confirm('Xác nhận '+id+' đã hoàn thành?'))return;
  try{
    await db.collection('hub_tasks').doc(id).update({status:TASK_STATUS.DONE,confirmedAt:FV.serverTimestamp(),decisionNote:'Đã xác nhận hoàn thành',updatedAt:FV.serverTimestamp(),updatedByEmail:me()});
    await event(id,'Trưởng phòng xác nhận hoàn thành','');
    closeDrawer();
  }catch(e){alert('Không xác nhận được: '+e.message)}
}
function requestSupplement(id){
  if(!isHead())return;
  const note=prompt('Nội dung yêu cầu bổ sung:','');
  if(!note?.trim())return;
  db.collection('hub_tasks').doc(id).update({status:TASK_STATUS.DOING,decisionNote:note.trim(),updatedAt:FV.serverTimestamp(),updatedByEmail:me()})
    .then(()=>event(id,'Yêu cầu bổ sung',note.trim()))
    .then(()=>closeDrawer())
    .catch(e=>alert('Không gửi được yêu cầu bổ sung: '+e.message));
}

async function openDetail(id){
  const t=hubTasks.find(x=>x.id===id);if(!t)return;
  document.getElementById('drawerSmall').textContent='CÔNG VIỆC ĐƯỢC GIAO';
  document.getElementById('drawerTitle').textContent=id+' — '+t.title;
  const canLead=isLead()&&norm(t.assigneeEmail)===me();
  let actions='';
  if(canLead&&t.status===TASK_STATUS.NEW)actions='<button class="btn primary" onclick="HUB_TASKS.acknowledge(\''+id+'\')">Đã nhận việc</button>';
  if(canLead&&t.status===TASK_STATUS.DOING)actions='<button class="btn" onclick="HUB_TASKS.openProgress(\''+id+'\')">Cập nhật tiến độ</button><button class="btn primary" onclick="HUB_TASKS.openReport(\''+id+'\')">Báo cáo kết quả</button>';
  if(isHead()&&t.status===TASK_STATUS.REVIEW)actions='<button class="btn" onclick="HUB_TASKS.requestSupplement(\''+id+'\')">Yêu cầu bổ sung</button><button class="btn primary" onclick="HUB_TASKS.confirmDone(\''+id+'\')">Xác nhận hoàn thành</button>';
  document.getElementById('drawerBody').innerHTML=`
    <div class="task-detail-grid">
      <div><span class="meta">Người nhận</span><b>${escapeHtml(t.assigneeName||t.assigneeEmail)}</b></div>
      <div><span class="meta">Nhóm</span><b>${escapeHtml(taskGroupLabel(t.assigneeGroup))}</b></div>
      <div><span class="meta">Trạng thái</span>${taskBadge(t)}</div>
      <div><span class="meta">Hạn</span><b>${escapeHtml(dueText(t))}</b></div>
    </div>
    <div class="task-block"><b>Yêu cầu công việc</b><div>${escapeHtml(t.description||'')}</div></div>
    ${t.linkedCaseId?'<div class="task-block"><b>Liên kết</b><div>'+escapeHtml(t.linkedCaseId)+'</div></div>':''}
    ${t.progressNote?'<div class="task-block"><b>Cập nhật gần nhất</b><div>'+escapeHtml(t.progressNote)+'</div></div>':''}
    ${t.reportText?'<div class="task-block report"><b>Báo cáo kết quả</b><div>'+escapeHtml(t.reportText)+'</div></div>':''}
    ${t.decisionNote?'<div class="task-block"><b>Ý kiến Trưởng phòng</b><div>'+escapeHtml(t.decisionNote)+'</div></div>':''}
    <div class="task-block"><b>Lịch sử / Audit</b><div id="taskAuditBox" class="auditline"><div>Đang tải...</div></div></div>`;
  document.getElementById('drawerFoot').innerHTML=actions+'<button class="btn" onclick="closeDrawer()">Đóng</button>';
  openDrawer();
  document.getElementById('taskAuditBox').innerHTML=await eventsHtml(id);
}

function taskRow(t){
  return '<div class="task-row '+(overdue(t)?'task-overdue':'')+'" onclick="HUB_TASKS.openDetail(\''+t.id+'\')">'+
    '<div><b>'+escapeHtml(t.id)+'</b><div class="meta">'+priorityBadge(t.priority)+'</div></div>'+
    '<div><b>'+escapeHtml(t.title)+'</b><div class="meta">'+escapeHtml(t.assigneeName||'')+' · '+escapeHtml(taskGroupLabel(t.assigneeGroup))+'</div></div>'+
    '<div>'+escapeHtml(dueText(t))+'</div>'+
    '<div>'+taskBadge(t)+'</div></div>';
}
function commonPanel(){
  if(!isTaskUser())return '';
  const list=sortTasks(hubTasks).slice(0,12);
  return '<div class="panel task-v228-panel"><div class="ph"><h3>GIAO VIỆC / THEO DÕI</h3>'+(isHead()?'<button class="btn primary" onclick="HUB_TASKS.openCreate()">+ Giao việc</button>':'')+'</div>'+
    '<div class="task-row task-head"><div>Mã</div><div>Nội dung / đầu mối</div><div>Hạn</div><div>Trạng thái</div></div>'+
    (list.length?list.map(taskRow).join(''):'<div class="item"><div class="meta">Chưa có công việc được giao.</div></div>')+'</div>';
}
function myTasksHtml(){
  if(!isTaskUser())return head('Việc của tôi','Không có phạm vi giao việc quản lý.');
  const list=sortTasks(hubTasks.filter(mine));
  const unack=list.filter(t=>t.status===TASK_STATUS.NEW).length;
  const doing=list.filter(t=>t.status===TASK_STATUS.DOING).length;
  const review=list.filter(t=>t.status===TASK_STATUS.REVIEW).length;
  const late=list.filter(overdue).length;
  return head('Việc của tôi','Công việc được giao có xác nhận tiếp nhận, cập nhật và báo cáo kết quả.',
    isHead()?'<button class="btn primary" onclick="HUB_TASKS.openCreate()">+ Giao việc</button>':'')+
    '<div class="cards task-metrics"><div class="card metric"><div class="lab">Chưa xác nhận</div><div class="num">'+unack+'</div></div>'+
    '<div class="card metric"><div class="lab">Đang thực hiện</div><div class="num">'+doing+'</div></div>'+
    '<div class="card metric"><div class="lab">Chờ xác nhận</div><div class="num">'+review+'</div></div>'+
    '<div class="card metric"><div class="lab">Quá hạn</div><div class="num">'+late+'</div></div></div>'+
    commonPanel();
}
function deskAlert(){
  const att=attentionTasks();
  if(!att.length)return '';
  const late=att.filter(overdue).length;
  const label=isHead()?'công việc cần Trưởng phòng xử lý':'công việc cần bạn xác nhận/cập nhật';
  return '<div class="task-alert"><b>Bạn có '+att.length+' '+label+'.</b>'+(late?' <span class="badge red">'+late+' quá hạn</span>':'')+' <button class="btn" onclick="nav(\'tasks\')">Mở Việc của tôi</button></div>';
}
function cleanupCommonRoomLegacy(){
  document.querySelectorAll('#content .panel').forEach(p=>{
    const txt=p.textContent||'';
    if(txt.includes('LUỒNG GIAO VIỆC TỔNG')||txt.includes('VIỆC TỔNG ĐANG THEO DÕI'))p.style.display='none';
  });
}

const baseRenderTasks=renderTasks;
renderTasks=function(){
  if(!isTaskUser())return baseRenderTasks();
  const cases=casesNeedMyAction();
  const vm='<div class="panel"><div class="ph"><h3>VẤN ĐỀ / VƯỚNG MẮC CẦN XỬ LÝ</h3></div><div class="list">'+
    (cases.length?cases.map(c=>'<div class="item"><div class="title">'+escapeHtml(c.id)+' — '+escapeHtml(c.title)+'</div><div class="meta">'+escapeHtml(c.currentDesk)+' • '+escapeHtml(c.status)+' • Hạn: '+escapeHtml(c.deadline||'—')+'</div><div style="margin-top:8px"><button class="btn" onclick="openCaseDetail(\''+c.id+'\')">Mở VM</button></div></div>').join(''):'<div class="item"><div class="meta">Không có VM cần xử lý.</div></div>')+'</div></div>';
  return myTasksHtml()+vm;
};

const baseRenderDesk=renderDesk;
renderDesk=function(){
  const html=baseRenderDesk();
  const alert=deskAlert();
  return alert?html.replace('<div class="cards">',alert+'<div class="cards">'):html;
};

const baseRenderCommonRoom=renderCommonRoom;
renderCommonRoom=function(){
  let html=baseRenderCommonRoom();
  html=html.replace(/onclick="alert\([^"]*Giao việc tổng[^"]*\)"/g,'onclick="HUB_TASKS.openCreate()"');
  setTimeout(cleanupCommonRoomLegacy,0);
  return commonPanel()+html;
};

const baseUpdateNotificationBadge=updateNotificationBadge;
updateNotificationBadge=function(){
  const el=document.getElementById('notificationCount');
  if(!el)return;
  const caseCount=typeof notificationCases==='function'?notificationCases().length:0;
  const n=caseCount+attentionTasks().length;
  el.textContent=String(n);
  el.style.display=n>0?'inline-flex':'none';
};

setInterval(()=>{
  if(currentUser&&currentAccess&&isTaskUser())startRealtime();
  else if(!currentUser&&unsubscribeTasks)stopRealtime();
},500);

window.HUB_TASKS=Object.freeze({
  openCreate,create,acknowledge,openProgress,saveProgress,openReport,submitReport,confirmDone,requestSupplement,openDetail,
  status:TASK_STATUS,get tasks(){return hubTasks.slice()}
});
})();

(() => {
'use strict';

const PTN_ROSTER = Object.freeze([
  {employeeId:'NS-001',name:'Dương Đức Vượng',group:'MANAGEMENT',title:'Trưởng phòng',status:'Đang làm việc',companyEmail:'bebewofl@gmail.com',loginEmail:'bebewofl@gmail.com'},
  {employeeId:'NS-002',name:'Lê Đức Độ',group:'3TR',title:'KTV Trưởng',status:'Đang làm việc',companyEmail:'dowait17@gmail.com',loginEmail:'dowait17@gmail.com'},
  {employeeId:'NS-003',name:'Dương Lý Bình',group:'KN',title:'KTV',status:'Đang làm việc',companyEmail:'binhduong04.dev@gmail.com',loginEmail:'binhduong04.dev@gmail.com'},
  {employeeId:'NS-004',name:'Trần Thị Tuyền',group:'KN',title:'KTV Trưởng',status:'Đang làm việc',companyEmail:'Tuyent0319@gmail.com',loginEmail:'tuyent0319@gmail.com'},
  {employeeId:'NS-005',name:'Phan Ngọc Tuyến',group:'KN',title:'KTV Trưởng',status:'Đang làm việc',companyEmail:'phanngoctuyen28022003@gmail.com',loginEmail:'phanngoctuyen28022003@gmail.com'},
  {employeeId:'NS-006',name:'Phạm Xuân Vinh',group:'ATAS',title:'KTV',status:'Đã nghỉ việc',companyEmail:'phamxuanvinh1b2@gmail.com',loginEmail:'phamxuanvinh1b2@gmail.com'},
  {employeeId:'NS-007',name:'Trần Đức Vượng',group:'3TR',title:'KTV',status:'Đang làm việc',companyEmail:'vuong06042004@gmail.com',loginEmail:'vuong06042004@gmail.com'},
  {employeeId:'NS-008',name:'Mai Tiến Đạt',group:'ATAS',title:'KTV',status:'Đang làm việc',companyEmail:'tdat52314@gmail.com',loginEmail:'tdat52314@gmail.com'},
  {employeeId:'NS-009',name:'Phạm Duy Hiển',group:'KN',title:'KTV',status:'Đang làm việc',companyEmail:'phamduyhien2701206@gmail.com',loginEmail:'phamduyhien2701206@gmail.com'},
  {employeeId:'NS-010',name:'Mai Công Tuấn',group:'3TR',title:'KTV',status:'Đang làm việc',companyEmail:'maicongtuan829@gmail.com',loginEmail:'maicongtuan829@gmail.com'},
  {employeeId:'NS-011',name:'Vi Văn Thái',group:'KN',title:'KTV',status:'Đang làm việc',companyEmail:'vivanthai230604@gmail.com',loginEmail:'vivanthai230604@gmail.com'},
  {employeeId:'NS-013',name:'Bùi Phạm Tuấn Vũ',group:'KN',title:'KTV',status:'Đang làm việc',companyEmail:'Phamductuan16091956@gmail.com',loginEmail:'phamductuan16091956@gmail.com'},
  {employeeId:'NS-014',name:'Cung Anh Minh',group:'ATAS',title:'KTV',status:'Đang làm việc',companyEmail:'anhminhcung@gmail.com',loginEmail:'anhminhcung@gmail.com'},
  {employeeId:'NS-015',name:'Nguyễn Đức Tạo',group:'3TR',title:'KTV',status:'Hết hợp đồng',companyEmail:'khoaitaychien2k5@gmail.com',loginEmail:'khoaitaychien2k5@gmail.com'},
  {employeeId:'NS-016',name:'Nguyễn Anh Tú',group:'ATAS',title:'KTV Trưởng',status:'Đang làm việc',companyEmail:'nguyenanhtu479xt@gmail.com',loginEmail:'nguyenanhtu7121941@gmail.com'}
]);

const GROUP_NAMES = Object.freeze({'3TR':'Nhóm 3T-R','KN':'Nhóm K-N','ATAS':'Nhóm ATAS'});
const KTV_ROLE = Object.freeze({'3TR':'ktv3tr','KN':'ktvkn','ATAS':'ktvatas'});
const LEAD_EMAILS = new Set(['dowait17@gmail.com','phanngoctuyen28022003@gmail.com','tuyent0319@gmail.com','nguyenanhtu7121941@gmail.com']);
const activeRoster = () => PTN_ROSTER.filter(x=>x.status==='Đang làm việc');
const emailOf = x => String(x||'').trim().toLowerCase();
const personByEmail = email => PTN_ROSTER.find(x=>emailOf(x.loginEmail)===emailOf(email)||emailOf(x.companyEmail)===emailOf(email));
const isHead = () => R().type==='head';
const isLead = () => R().type==='lead';
const leadGroups = () => Array.isArray(R().groups)?R().groups:[];
const canManageGroup = group => isHead() || (isLead() && leadGroups().includes(group));
const isKtvCandidate = p => p && p.status==='Đang làm việc' && p.title==='KTV' && ['3TR','KN','ATAS'].includes(p.group);

const baseCanSpace = window.canSpace;
window.canSpace = function(space){
  if(currentAccess?.owner===true)return true;
  if(Array.isArray(currentAccess?.spaces))return currentAccess.spaces.includes(space);
  return typeof baseCanSpace==='function' ? baseCanSpace(space) : false;
};

async function auditAccess(action,detail,targetEmail=''){
  try{
    await db.collection('hub_audit_logs').add({
      action,detail,targetEmail:emailOf(targetEmail),
      actorUid:currentUser.uid,actorEmail:emailKey(currentUser.email),
      actorName:currentUser.displayName||currentAccess?.name||R().label,
      actorRole:R().label,createdAt:FV.serverTimestamp(),schemaVersion:'2.2.7'
    });
  }catch(e){console.info('Access audit pending:',e?.code||e?.message||e)}
}

function memberAccessDoc(p){
  return {
    email:emailOf(p.loginEmail),name:p.name,employeeId:p.employeeId,
    role:KTV_ROLE[p.group],groups:[p.group],spaces:['ptn','common'],unitCodes:['PTN'],permissions:[],
    active:true,department:'PTN',personnelTitle:'KTV',accessModelVersion:'2.2.7',
    grantedByEmail:emailKey(currentUser.email),grantedByRole:R().label,
    createdAt:FV.serverTimestamp(),updatedAt:FV.serverTimestamp(),updatedByEmail:emailKey(currentUser.email)
  };
}

window.openGroupMembers = async function(group){
  if(!canManageGroup(group))return alert('Bạn chỉ được quản lý thành viên thuộc nhóm mình.');
  const members=activeRoster().filter(x=>x.group===group);
  const states=[];
  for(const p of members){
    let access=null;
    try{
      const snap=await db.collection('hub_access').doc(emailOf(p.loginEmail)).get();
      access=snap.exists?snap.data():null;
    }catch(e){
      if(!LEAD_EMAILS.has(emailOf(p.loginEmail)))console.info('Access read:',p.loginEmail,e?.code||e?.message||e);
    }
    states.push({p,access});
  }
  document.getElementById('drawerSmall').textContent='THÀNH VIÊN '+GROUP_NAMES[group].toUpperCase();
  document.getElementById('drawerTitle').textContent='Quyền truy cập nhóm';
  document.getElementById('drawerBody').innerHTML=`
    <div class="notice">Trưởng nhóm chỉ cấp quyền cho <b>nhân sự đang làm việc thuộc ${escapeHtml(GROUP_NAMES[group])}</b>. Quyền mặc định: không gian nhóm + Khu vực chung Công ty. Phòng chung PTN cần Trưởng phòng xác nhận.</div>
    <div class="list">${states.map(({p,access})=>{
      const leader=LEAD_EMAILS.has(emailOf(p.loginEmail));
      const active=leader || access?.active===true;
      const commonRoom=leader || (Array.isArray(access?.spaces)&&access.spaces.includes('commonRoom'));
      let buttons='';
      if(!leader && isKtvCandidate(p)){
        buttons+=active
          ? `<button class="btn" onclick="setGroupMemberActive('${group}','${emailOf(p.loginEmail)}',false)">Thu hồi quyền</button>`
          : `<button class="btn primary" onclick="grantGroupMember('${group}','${emailOf(p.loginEmail)}')">Cấp quyền</button>`;
        if(active && !commonRoom)buttons+=` <button class="btn" onclick="requestCommonRoom('${group}','${emailOf(p.loginEmail)}')">Mời Phòng chung PTN</button>`;
      }
      return `<div class="item"><div class="title">${escapeHtml(p.name)} <span class="badge ${active?'green':''}">${leader?'Trưởng nhóm':active?'Đã có quyền':'Chưa cấp'}</span></div><div class="meta">${escapeHtml(p.employeeId)} • ${escapeHtml(p.title)} • ${escapeHtml(p.companyEmail)}${commonRoom?' • Phòng chung PTN':''}</div><div style="margin-top:8px">${buttons}</div></div>`;
    }).join('')}</div>`;
  document.getElementById('drawerFoot').innerHTML='<button class="btn" onclick="closeDrawer()">Đóng</button>';
  openDrawer();
};

window.grantGroupMember = async function(group,email){
  const p=personByEmail(email);
  if(!canManageGroup(group)||!p||p.group!==group||!isKtvCandidate(p))return alert('Không thể cấp quyền cho nhân sự này.');
  try{
    const ref=db.collection('hub_access').doc(emailOf(p.loginEmail));
    const snap=await ref.get();
    if(snap.exists){
      const a=snap.data();
      if(a.role!==KTV_ROLE[group]||!(a.groups||[]).includes(group))return alert('Tài khoản đã có cấu hình khác. Trưởng phòng cần kiểm tra.');
      await ref.update({active:true,updatedAt:FV.serverTimestamp(),updatedByEmail:emailKey(currentUser.email)});
    }else{
      await ref.set(memberAccessDoc(p));
    }
    await auditAccess('GROUP_ACCESS_GRANTED',`${GROUP_NAMES[group]} · ${p.name}`,p.loginEmail);
    alert('Đã cấp quyền cho '+p.name+'.');
    openGroupMembers(group);
  }catch(e){alert('Không cấp được quyền: '+e.message)}
};

window.setGroupMemberActive = async function(group,email,active){
  const p=personByEmail(email);
  if(!canManageGroup(group)||!p||p.group!==group||!isKtvCandidate(p))return alert('Không có quyền thao tác nhân sự này.');
  try{
    await db.collection('hub_access').doc(emailOf(p.loginEmail)).update({active:!!active,updatedAt:FV.serverTimestamp(),updatedByEmail:emailKey(currentUser.email)});
    await auditAccess(active?'GROUP_ACCESS_RESTORED':'GROUP_ACCESS_REVOKED',`${GROUP_NAMES[group]} · ${p.name}`,p.loginEmail);
    openGroupMembers(group);
  }catch(e){alert('Không cập nhật được quyền: '+e.message)}
};

window.requestCommonRoom = async function(group,email){
  const p=personByEmail(email);
  if(!isLead()||!leadGroups().includes(group)||!p||p.group!==group||!isKtvCandidate(p))return alert('Chỉ Trưởng nhóm của chính nhóm đó được gửi lời mời.');
  try{
    const access=await db.collection('hub_access').doc(emailOf(p.loginEmail)).get();
    if(!access.exists||access.data().active!==true)return alert('Cần cấp quyền nhóm cho nhân sự trước.');
    if((access.data().spaces||[]).includes('commonRoom'))return alert('Nhân sự đã có quyền Phòng chung PTN.');
    await db.collection('hub_common_room_requests').add({
      targetEmail:emailOf(p.loginEmail),targetName:p.name,employeeId:p.employeeId,groupCode:group,
      requestedByUid:currentUser.uid,requestedByEmail:emailKey(currentUser.email),requestedByName:currentUser.displayName||currentAccess?.name||R().label,
      requestedByRole:R().label,status:'pending',createdAt:FV.serverTimestamp(),schemaVersion:'2.2.7'
    });
    await auditAccess('COMMON_ROOM_REQUESTED',`${GROUP_NAMES[group]} · ${p.name}`,p.loginEmail);
    alert('Đã gửi Trưởng phòng xác nhận quyền Phòng chung PTN.');
    openGroupMembers(group);
  }catch(e){alert('Không gửi được lời mời: '+e.message)}
};

async function loadCommonRoomRequests(){
  const box=document.getElementById('v227CommonRoomRequests');
  if(!box)return;
  try{
    let snap;
    if(isHead())snap=await db.collection('hub_common_room_requests').get();
    else if(isLead()&&leadGroups().length)snap=await db.collection('hub_common_room_requests').where('groupCode','==',leadGroups()[0]).get();
    else {box.innerHTML='';return}
    const rows=snap.docs.map(d=>({id:d.id,...d.data()})).filter(x=>x.status==='pending');
    if(!rows.length){box.innerHTML='<div class="panel"><div class="list"><div class="item"><div class="meta">Không có lời mời Phòng chung PTN đang chờ.</div></div></div></div>';return}
    box.innerHTML=`<div class="panel"><div class="ph"><h3>LỜI MỜI PHÒNG CHUNG PTN</h3><span class="badge orange">${rows.length} chờ xác nhận</span></div><div class="list">${rows.map(x=>`<div class="item"><div class="title">${escapeHtml(x.targetName||x.targetEmail)}</div><div class="meta">${escapeHtml(GROUP_NAMES[x.groupCode]||x.groupCode)} • Mời bởi ${escapeHtml(x.requestedByName||x.requestedByEmail)}</div>${isHead()?`<div style="margin-top:8px"><button class="btn primary" onclick="decideCommonRoom('${x.id}',true)">Xác nhận</button> <button class="btn" onclick="decideCommonRoom('${x.id}',false)">Từ chối</button></div>`:''}</div>`).join('')}</div></div>`;
  }catch(e){box.innerHTML='<div class="notice">Không tải được lời mời: '+escapeHtml(e.message)+'</div>'}
}

window.decideCommonRoom = async function(requestId,approve){
  if(!isHead())return alert('Chỉ Trưởng phòng PTN được xác nhận.');
  try{
    const reqRef=db.collection('hub_common_room_requests').doc(requestId);
    const reqSnap=await reqRef.get();
    if(!reqSnap.exists)return alert('Lời mời không còn tồn tại.');
    const req=reqSnap.data();
    if(req.status!=='pending')return alert('Lời mời đã được xử lý.');
    if(approve){
      const accessRef=db.collection('hub_access').doc(emailOf(req.targetEmail));
      const accessSnap=await accessRef.get();
      if(!accessSnap.exists||accessSnap.data().active!==true)return alert('Nhân sự chưa có quyền nhóm đang hoạt động.');
      const spaces=[...new Set([...(accessSnap.data().spaces||[]),'ptn','common','commonRoom'])];
      await accessRef.update({spaces,updatedAt:FV.serverTimestamp(),updatedByEmail:emailKey(currentUser.email)});
    }
    await reqRef.update({status:approve?'approved':'rejected',decidedAt:FV.serverTimestamp(),decidedByEmail:emailKey(currentUser.email),decisionNote:approve?'Trưởng phòng xác nhận':'Trưởng phòng từ chối'});
    await auditAccess(approve?'COMMON_ROOM_APPROVED':'COMMON_ROOM_REJECTED',`${req.targetName||req.targetEmail}`,req.targetEmail);
    loadCommonRoomRequests();
  }catch(e){alert('Không xử lý được lời mời: '+e.message)}
};

window.openGroup=function(id){
  const names=GROUP_NAMES;
  if(!R().groups.includes(id)){alert('Không có quyền truy cập nhóm này.');return}
  document.getElementById('content').innerHTML=head(names[id],`Không gian làm việc của ${names[id]}.`,
    canManageGroup(id)?`<button class="btn" onclick="openGroupMembers('${id}')">Thành viên</button> <button class="btn primary">+ Giao việc nhóm</button>`:'')+`
    <div class="panel"><div class="ph"><h3>CÔNG VIỆC NHÓM</h3></div><div class="list">
      <div class="item"><div class="title">Công việc đang thực hiện</div><div class="meta">Người phụ trách • deadline • trạng thái</div></div>
      <div class="item"><div class="title">Vướng mắc cần xử lý</div><div class="meta">Có thể đưa lên Trưởng phòng nếu vượt thẩm quyền</div></div>
    </div></div>`;
};

const baseRenderCommonRoom=window.renderCommonRoom;
window.renderCommonRoom=function(){
  const html=baseRenderCommonRoom();
  if(html && (isHead()||isLead())){
    setTimeout(loadCommonRoomRequests,0);
    return html+'<div id="v227CommonRoomRequests"></div>';
  }
  return html;
};

window.openInvite=function(){
  const group=isLead()?leadGroups()[0]:'';
  const candidates=activeRoster().filter(p=>isKtvCandidate(p)&&(isHead()||p.group===group));
  document.getElementById('drawerSmall').textContent='PHÒNG CHUNG PTN';
  document.getElementById('drawerTitle').textContent=isHead()?'Cấp quyền Phòng chung':'Mời Trưởng phòng xác nhận';
  document.getElementById('drawerBody').innerHTML=`
    <div class="field"><label>Nhân sự PTN</label><select id="inviteRosterPerson">${candidates.map(p=>`<option value="${emailOf(p.loginEmail)}">${escapeHtml(p.name)} · ${escapeHtml(GROUP_NAMES[p.group])}</option>`).join('')}</select></div>
    <div class="field"><label>Lý do / nội dung mời</label><textarea id="inviteReason" placeholder="Nêu ngắn gọn nội dung cần tham gia"></textarea></div>
    <div class="notice">Trưởng nhóm gửi lời mời; quyền chỉ có hiệu lực sau khi Trưởng phòng xác nhận.</div>`;
  document.getElementById('drawerFoot').innerHTML='<button class="btn" onclick="closeDrawer()">Hủy</button><button class="btn primary" onclick="sendInvite()">'+(isHead()?'Cấp quyền':'Gửi Trưởng phòng')+'</button>';
  openDrawer();
};

window.sendInvite=async function(){
  const email=emailOf(document.getElementById('inviteRosterPerson')?.value);
  const p=personByEmail(email);if(!p)return alert('Chưa chọn nhân sự.');
  if(isHead()){
    try{
      const ref=db.collection('hub_access').doc(email);
      const snap=await ref.get();
      if(!snap.exists||snap.data().active!==true)return alert('Cần cấp quyền nhóm cho nhân sự trước.');
      const spaces=[...new Set([...(snap.data().spaces||[]),'ptn','common','commonRoom'])];
      await ref.update({spaces,updatedAt:FV.serverTimestamp(),updatedByEmail:emailKey(currentUser.email)});
      await auditAccess('COMMON_ROOM_DIRECT_GRANTED',p.name,email);
      closeDrawer();alert('Đã cấp quyền Phòng chung PTN cho '+p.name+'.');
    }catch(e){alert('Không cấp được quyền: '+e.message)}
    return;
  }
  await requestCommonRoom(p.group,email);
  closeDrawer();
};

function mealCandidates(){
  if(isHead())return activeRoster();
  if(isLead())return activeRoster().filter(x=>leadGroups().includes(x.group));
  const me=personByEmail(currentUser?.email);
  return me&&me.status==='Đang làm việc'?[me]:[];
}

const baseCanManageMealDepartment=window.canManageMealDepartment;
window.canManageMealDepartment=function(){
  if(['head','lead','ktv'].includes(R().type) && accessUnits().includes('PTN'))return false;
  return typeof baseCanManageMealDepartment==='function'?baseCanManageMealDepartment():false;
};

const baseRenderMealForm=window.renderMealForm;
window.renderMealForm=function(mode){
  if(mode!=='personal' || !['head','lead','ktv'].includes(R().type) || !accessUnits().includes('PTN')){
    return baseRenderMealForm(mode);
  }
  if(typeof activateMealTab==='function')activateMealTab('personal');
  const el=document.getElementById('mealForm');if(!el)return;
  const date=localDateISO();
  const people=mealCandidates();
  el.innerHTML=`
    <div class="notice"><b>PTN báo cơm theo từng người.</b> Danh sách lấy từ danh sách nhân sự đang làm việc; không nhập tên tự do.</div>
    <div id="ptnMealExisting"></div>
    <div class="field"><label>Ngày</label><input id="mealPtnDate" type="date" value="${date}" onchange="checkPtnMealExisting()"></div>
    <div class="field"><label>Nhân sự PTN</label><select id="mealPtnEmployee" onchange="checkPtnMealExisting()">${people.map(p=>`<option value="${p.employeeId}">${escapeHtml(p.name)} · ${escapeHtml(p.employeeId)} · ${escapeHtml(GROUP_NAMES[p.group]||'Quản lý PTN')}</option>`).join('')}</select></div>
    <div class="field"><label>Đăng ký</label><select id="mealPtnChoice"><option value="Có ăn">Có ăn</option><option value="Không ăn">Không ăn</option></select></div>
    <div class="field"><label>Ghi chú</label><input id="mealPtnNote" placeholder="Ví dụ: ăn chay... (nếu có)"></div>
    <button class="btn primary" onclick="saveMealPtnRoster()">Lưu đăng ký cá nhân</button>`;
  setTimeout(checkPtnMealExisting,0);
};

window.checkPtnMealExisting=async function(){
  const box=document.getElementById('ptnMealExisting');if(!box)return;
  const date=document.getElementById('mealPtnDate')?.value;
  const employeeId=document.getElementById('mealPtnEmployee')?.value;
  if(!date||!employeeId){box.innerHTML='';return}
  try{
    const snap=await db.collection('hub_meal_reports').doc(date+'_'+employeeId).get();
    box.innerHTML=snap.exists?`<div class="notice">Đã có đăng ký: <b>${escapeHtml(snap.data().choice||'')}</b>. Lưu lại sẽ cập nhật bản ghi này.</div>`:'';
  }catch(e){box.innerHTML=''}
};

window.saveMealPtnRoster=async function(){
  const date=document.getElementById('mealPtnDate')?.value;
  const employeeId=document.getElementById('mealPtnEmployee')?.value;
  const choice=document.getElementById('mealPtnChoice')?.value;
  const note=String(document.getElementById('mealPtnNote')?.value||'').trim();
  const p=PTN_ROSTER.find(x=>x.employeeId===employeeId&&x.status==='Đang làm việc');
  if(!date||!p)return alert('Cần chọn ngày và nhân sự.');
  if(!(isHead()||(isLead()&&leadGroups().includes(p.group))||emailOf(currentUser.email)===emailOf(p.loginEmail)))return alert('Bạn không được báo cơm cho nhân sự này.');
  const id=date+'_'+p.employeeId;
  const reporterEmail=emailKey(currentUser.email);
  const reporterName=currentUser.displayName||currentAccess?.name||currentUser.email;
  try{
    await db.collection('hub_meal_reports').doc(id).set({
      reportType:'personal',date,unitCode:'PTN',unitLabel:'Phòng Thử nghiệm (PTN)',parentGroup:'PTN',choice,note,
      employeeId:p.employeeId,employeeName:p.name,employeeGroup:p.group,employeeEmail:emailOf(p.loginEmail),
      userUid:currentUser.uid,userEmail:reporterEmail,userName:reporterName,role:R().label,updatedAt:FV.serverTimestamp(),schemaVersion:'2.2.7'
    },{merge:true});
    await db.collection('hub_meal_public_status').doc(id).set({
      date,unitCode:'PTN',choice,employeeId:p.employeeId,employeeName:p.name,employeeGroup:p.group,employeeEmail:emailOf(p.loginEmail),
      userUid:currentUser.uid,userEmail:reporterEmail,updatedAt:FV.serverTimestamp()
    },{merge:true});
    await auditAccess('PTN_MEAL_REGISTERED',`${p.name} · ${choice}`,p.loginEmail);
    closeDrawer();
    if(typeof loadMealCompactSummary==='function')loadMealCompactSummary();
  }catch(e){alert('Không lưu được đăng ký cơm: '+e.message)}
};

window.HUB_V227 = Object.freeze({roster:PTN_ROSTER,openGroupMembers,loadCommonRoomRequests});
})();

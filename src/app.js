const st={role:'head', invitedGuests:[], pendingInvites:[]};

const roles={
 head:{label:'Trưởng phòng PTN',type:'head',groups:['3TR','KN','ATAS'],spaces:['ptn','rnd','office','quality','bod','common','commonRoom']},
 lead3tr:{label:'Trưởng nhóm 3T-R',type:'lead',groups:['3TR'],spaces:['ptn','rnd','office','common','commonRoom']},
 leadkn:{label:'Trưởng nhóm K-N',type:'lead',groups:['KN'],spaces:['ptn','rnd','office','common','commonRoom'],primaryLead:true},
 leadknnight:{label:'Phụ trách ca đêm K-N',type:'lead',groups:['KN'],spaces:['ptn','rnd','office','common','commonRoom'],primaryLead:false},
 leadatas:{label:'Trưởng nhóm ATAS',type:'lead',groups:['ATAS'],spaces:['ptn','rnd','office','common','commonRoom']},
 ktv3tr:{label:'KTV nhóm 3T-R',type:'ktv',groups:['3TR'],spaces:['ptn','office','common']},
 ktvkn:{label:'KTV nhóm K-N',type:'ktv',groups:['KN'],spaces:['ptn','office','common']},
 ktvatas:{label:'KTV nhóm ATAS',type:'ktv',groups:['ATAS'],spaces:['ptn','office','common']},
 rnd:{label:'R&D',type:'rnd',groups:[],spaces:['rnd','common']},
 office:{label:'Khối Văn phòng',type:'office',groups:[],spaces:['office','common']},
 hr:{label:'Khối Văn phòng',type:'office',groups:[],spaces:['office','common']},
 quality:{label:'Bộ phận Quản lý chất lượng',type:'quality',groups:[],spaces:['quality','common']},
 bod:{label:'Ban Giám đốc',type:'bod',groups:['3TR','KN','ATAS'],spaces:['ptn','rnd','office','quality','bod','common','commonRoom']},
 testeng:{label:'Kỹ sư thử nghiệm',type:'testeng',groups:['3TR','KN','ATAS'],spaces:['ptn','rnd','quality','common','commonRoom']},
 coord:{label:'Quản lý điều phối',type:'coord',groups:['3TR','KN','ATAS'],spaces:['ptn','office','quality','common','commonRoom']}
};


const OWNER_EMAIL='bebewofl@gmail.com';

const OFFICIAL_PILOT_ACCESS={
 'dowait17@gmail.com':{
   email:'dowait17@gmail.com',name:'Lê Đức Độ',employeeId:'NS-002',
   role:'lead3tr',groups:['3TR'],spaces:['ptn','rnd','office','common','commonRoom'],unitCodes:['PTN'],permissions:['meal.unit.manage','meal.guest.create'],
   active:true,personnelTitle:'Trưởng nhóm 3T-R'
 },
 'phanngoctuyen28022003@gmail.com':{
   email:'phanngoctuyen28022003@gmail.com',name:'Phan Ngọc Tuyến',employeeId:'NS-005',
   role:'leadkn',groups:['KN'],spaces:['ptn','rnd','office','common','commonRoom'],unitCodes:['PTN'],permissions:['meal.unit.manage','meal.guest.create'],
   active:true,personnelTitle:'Trưởng nhóm K-N / Đầu mối chính'
 },
 'tuyent0319@gmail.com':{
   email:'tuyent0319@gmail.com',name:'Trần Thị Tuyền',employeeId:'NS-004',
   role:'leadknnight',groups:['KN'],spaces:['ptn','rnd','office','common','commonRoom'],unitCodes:['PTN'],permissions:['meal.unit.manage','meal.guest.create'],
   active:true,personnelTitle:'Phụ trách ca đêm K-N'
 },
 'nguyenanhtu7121941@gmail.com':{
   email:'nguyenanhtu7121941@gmail.com',name:'Nguyễn Anh Tú',employeeId:'NS-016',
   role:'leadatas',groups:['ATAS'],spaces:['ptn','rnd','office','common','commonRoom'],unitCodes:['PTN'],permissions:['meal.unit.manage','meal.guest.create'],
   active:true,personnelTitle:'Trưởng nhóm ATAS'
 }
};
function officialPilotAccess(email){
 return OFFICIAL_PILOT_ACCESS[emailKey(email)] || null;
}


const INITIAL_PILOT_MANAGEMENT=[
 {employeeId:'NS-002',name:'Lê Đức Độ',email:'dowait17@gmail.com',role:'lead3tr',group:'3TR',personnelTitle:'Trưởng nhóm 3T-R'},
 {employeeId:'NS-005',name:'Phan Ngọc Tuyến',email:'phanngoctuyen28022003@gmail.com',role:'leadkn',group:'KN',personnelTitle:'Trưởng nhóm K-N / Đầu mối chính'},
 {employeeId:'NS-004',name:'Trần Thị Tuyền',email:'tuyent0319@gmail.com',role:'leadknnight',group:'KN',personnelTitle:'Phụ trách ca đêm K-N'},
 {employeeId:'NS-016',name:'Nguyễn Anh Tú',email:'nguyenanhtu7121941@gmail.com',role:'leadatas',group:'ATAS',personnelTitle:'Trưởng nhóm ATAS'}
];

const db=firebase.firestore();
const auth=firebase.auth();
const FV=firebase.firestore.FieldValue;

let currentUser=null;
let currentAccess=null;
let hubCases=[];
let hubPins=[];
let unsubscribeCases=null;
let unsubscribePins=null;

function nowText(){return new Date().toLocaleString('vi-VN')}
function fmtTs(v){
  try{
    if(v && typeof v.toDate==='function') return v.toDate().toLocaleString('vi-VN');
    if(v instanceof Date) return v.toLocaleString('vi-VN');
    return v || '—';
  }catch(e){return '—'}
}
function emailKey(email){return String(email||'').trim().toLowerCase()}
function isOwnerEmail(email){return emailKey(email)===OWNER_EMAIL}

const MEAL_UNITS=[
 {code:'PTN',label:'Phòng Thử nghiệm (PTN)',short:'PTN',parent:'PTN'},
 {code:'RD',label:'R&D',short:'R&D',parent:'R&D'},
 {code:'HCNS',label:'HCNS / Hành chính',short:'HCNS',parent:'Khối Văn phòng'},
 {code:'KT',label:'Kế toán',short:'Kế toán',parent:'Khối Văn phòng'},
 {code:'KHO',label:'Bộ phận Lấy mẫu - Kho',short:'Lấy mẫu-Kho',parent:'Khối Văn phòng'},
 {code:'BGD',label:'Ban Giám đốc',short:'Ban Giám đốc',parent:'Ban Giám đốc'},
 {code:'QLCL',label:'Bộ phận Quản lý chất lượng',short:'QLCL',parent:'Bộ phận QLCL'}
];
function mealUnit(code){return MEAL_UNITS.find(x=>x.code===code)||MEAL_UNITS[0]}
function mealUnitOptions(selected='PTN'){
 return MEAL_UNITS.map(x=>`<option value="${x.code}" ${x.code===selected?'selected':''}>${escapeHtml(x.label)}</option>`).join('');
}
function roleDefaultUnits(role){
 if(['head','lead3tr','leadkn','leadknnight','leadatas','ktv3tr','ktvkn','ktvatas','testeng','coord'].includes(role))return ['PTN'];
 if(role==='rnd')return ['RD'];
 if(role==='quality')return ['QLCL'];
 if(role==='bod')return ['BGD'];
 return [];
}
function roleDefaultPermissions(role){
 const p=[];
 if(['head','lead3tr','leadkn','leadknnight','leadatas','coord'].includes(role))p.push('meal.unit.manage');
 if(['head','lead3tr','leadkn','leadknnight','leadatas','coord','office','quality','bod'].includes(role))p.push('meal.guest.create');
 if(role==='head')p.push('access.manage','case.route','common.publish');
 return p;
}
function accessUnits(){
 const a=currentAccess||{};
 const units=Array.isArray(a.unitCodes)&&a.unitCodes.length?a.unitCodes:roleDefaultUnits(a.role||st.role);
 return [...new Set(units.filter(code=>MEAL_UNITS.some(x=>x.code===code)))];
}
function hasPermission(code){
 const p=currentAccess?.permissions||[];
 return currentAccess?.owner===true || p.includes('*') || p.includes(code);
}
function mealUnitOptionsAllowed(selected){
 const allowed=(currentAccess?.owner===true||R().type==='head')?MEAL_UNITS.map(x=>x.code):accessUnits();
 const list=MEAL_UNITS.filter(x=>allowed.includes(x.code));
 const sel=list.some(x=>x.code===selected)?selected:(list[0]?.code||'PTN');
 return list.map(x=>`<option value="${x.code}" ${x.code===sel?'selected':''}>${escapeHtml(x.label)}</option>`).join('');
}
function canUseMealUnit(code){
 return currentAccess?.owner===true || R().type==='head' || accessUnits().includes(code);
}
function canManageMealDepartment(){
 return currentAccess?.owner===true || hasPermission('meal.unit.manage');
}
function canCreateGuestMeal(){
 return currentAccess?.owner===true || hasPermission('meal.guest.create');
}
function unitDepartment(code){
 const u=mealUnit(code);
 return u.parent||u.label;
}

function deskForUnit(code){
 const map={
  PTN:'PTN',
  RD:'R&D',
  HCNS:'Khối Văn phòng / HCNS',
  KT:'Khối Văn phòng / Kế toán',
  KHO:'Khối Văn phòng / Lấy mẫu - Kho',
  QLCL:'Quản lý chất lượng',
  BGD:'Ban Giám đốc'
 };
 return map[code]||'';
}
function caseUnitCode(c){
 if(c?.currentUnitCode && MEAL_UNITS.some(x=>x.code===c.currentUnitCode))return c.currentUnitCode;
 const d=String(c?.currentDesk||'');
 if(d==='R&D')return 'RD';
 if(d==='Khối Văn phòng / HCNS')return 'HCNS';
 if(d==='Khối Văn phòng / Kế toán')return 'KT';
 if(d==='Khối Văn phòng / Lấy mẫu - Kho')return 'KHO';
 if(d==='Quản lý chất lượng')return 'QLCL';
 if(d==='Ban Giám đốc')return 'BGD';
 return 'PTN';
}
function caseMatchesAssignedUnit(c){
 return accessUnits().includes(caseUnitCode(c));
}

function defaultMealUnitCode(){
 const units=accessUnits();
 if(units.length)return units[0];
 if(R().type==='rnd')return 'RD';
 if(R().type==='office')return 'HCNS';
 if(R().type==='bod')return 'BGD';
 if(R().type==='quality')return 'QLCL';
 return 'PTN';
}
function goPortal(){
 // Cổng mở HUB ở tab riêng. Ưu tiên đóng tab HUB để quay lại
 // đúng menu Cổng đang đăng nhập, không tải lại màn đăng nhập.
 const q=new URLSearchParams(location.search);
 const fromPortal=q.get('fromPortal')==='1';

 if(fromPortal){
   try{
     window.close();
     // Nếu Chrome cho phép đóng tab, đoạn fallback dưới sẽ không chạy.
     setTimeout(()=>{
       if(!window.closed) fallbackPortalMenu();
     },250);
     return;
   }catch(e){}
 }
 fallbackPortalMenu();
}
function fallbackPortalMenu(){
 let url='https://ptn-hfi-portal.firebaseapp.com/?returnFromHub=1';
 try{
   const raw=new URLSearchParams(location.search).get('portalUrl');
   if(raw){
     const u=new URL(raw);
     if(['ptn-hfi-portal.firebaseapp.com','ptn-hfi-portal.web.app'].includes(u.hostname)){
       u.searchParams.set('returnFromHub','1');
       url=u.toString();
     }
   }
 }catch(e){}
 location.replace(url);
}

function statusBadgeClass(s){
 if(s==='Đã xử lý'||s==='Đóng')return 'green';
 if(String(s||'').includes('Chờ'))return 'orange';
 if(s==='Đang xử lý'||s==='Đã tiếp nhận')return 'blue';
 return '';
}
function groupCanSee(c){
 if(!currentAccess)return false;
 if(HUB_INTERDEPT.isRndHead())return true;
 if(R().type==='head'||R().type==='bod'||R().type==='coord'||R().type==='testeng')return true;
 if(R().type==='lead'||R().type==='ktv')return R().groups.includes(c.sourceGroup);
 if(['rnd','office','quality'].includes(R().type))return caseMatchesAssignedUnit(c);
 return false;
}

function visibleCases(){return hubCases.filter(groupCanSee)}

function canSeePrivateHandling(c){
 if(!c)return false;
 if(['head','bod','coord','testeng'].includes(R().type))return true;
 if(['rnd','office','quality'].includes(R().type))return caseMatchesAssignedUnit(c);
 return false;
}
function isSourceGroupFollower(c){
 return (R().type==='lead'||R().type==='ktv') && (R().groups||[]).includes(c.sourceGroup);
}

function openCases(){return visibleCases().filter(x=>!['Đã xử lý','Đóng'].includes(x.status))}
function casesWaiting(){return openCases().filter(x=>String(x.status||'').startsWith('Chờ'))}
function highCases(){return openCases().filter(x=>x.severity==='Cao')}
function notificationCases(){
 return openCases().filter(c=>c.severity==='Cao'||String(c.status||'').startsWith('Chờ'));
}
function updateNotificationBadge(){
 const el=document.getElementById('notificationCount');
 if(!el)return;
 const n=notificationCases().length;
 el.textContent=String(n);
 el.style.display=n>0?'inline-flex':'none';
}
function casesNeedMyAction(){
 const list=openCases();
 if(R().type==='head') return list.filter(x=>['PTN','Trưởng phòng PTN'].includes(x.currentDesk) || x.status==='Chờ Trưởng phòng');
 if(R().type==='lead') return list.filter(x=>R().groups.includes(x.sourceGroup) && ['Mới','Đã tiếp nhận'].includes(x.status));
 if(['rnd','office','quality'].includes(R().type)) return list.filter(caseMatchesAssignedUnit);
 if(R().type==='bod') return list.filter(x=>x.currentDesk==='Ban Giám đốc');
 return list.filter(x=>R().groups.includes(x.sourceGroup));
}
function pinCases(){
 const ids=new Set(hubPins.map(p=>p.caseId));
 return visibleCases().filter(c=>ids.has(c.id));
}


async function signInGoogle(){
 const msg=document.getElementById('authMessage');
 try{
  if(msg){msg.style.display='block';msg.textContent='Đang mở đăng nhập Google...'}
  const provider=new firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({prompt:'select_account'});
  await auth.signInWithPopup(provider);
 }catch(e){
  if(msg){
   msg.style.display='block';
   msg.innerHTML='<b>Chưa đăng nhập được.</b><br>'+escapeHtml(e.message||String(e));
  }
 }
}
async function signOutHub(){
 if(unsubscribeCases)unsubscribeCases();
 if(unsubscribePins)unsubscribePins();
 await auth.signOut();
 location.reload();
}
function escapeHtml(s){
 return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
async function loadAccessForUser(user){
 const email=emailKey(user.email);
 if(isOwnerEmail(email)){
   return {
     role:'head',
     groups:['3TR','KN','ATAS'],
     spaces:['ptn','rnd','office','quality','bod','common','commonRoom'],
     unitCodes:['PTN'],
     permissions:['*'],
     active:true,owner:true,
     name:'Dương Đức Vượng',employeeId:'NS-001',
     department:'PTN',personnelTitle:'Trưởng phòng PTN'
   };
 }

 // V1.4.2: 4 đầu mối Pilot được nhận quyền trực tiếp theo email định danh chuẩn.
 // Không phụ thuộc việc client có đọc được hub_access hay không.
 const canonical=officialPilotAccess(email);
 if(canonical)return {...canonical,canonicalPilot:true};

 try{
   const snap=await db.collection('hub_access').doc(email).get();
   if(!snap.exists)return null;
   const d=snap.data();
   if(d.active===false)return null;
   return d;
 }catch(e){
   console.error('loadAccessForUser',email,e);
   return null;
 }
}

async function ensureInitialPilotAccess(){
 if(!currentUser || !isOwnerEmail(currentUser.email))return;

 // V1.4.1: sửa cơ cấu quản lý Pilot đã gán sai ở V1.4.
 // Chạy idempotent: mỗi lần owner đăng nhập sẽ đối chiếu 4 đầu mối này về đúng cơ cấu.
 const batch=db.batch();

 for(const p of INITIAL_PILOT_MANAGEMENT){
   const key=emailKey(p.email);
   const ref=db.collection('hub_access').doc(key);
   batch.set(ref,{
     email:key,
     name:p.name,
     employeeId:p.employeeId,
     department:'PTN',
     personnelTitle:p.personnelTitle,
     role:p.role,
     groups:[p.group],
     spaces:roleSpaces(p.role),
     unitCodes:['PTN'],
     permissions:roleDefaultPermissions(p.role),
     active:true,
     structureSource:'PTN_STRUCTURE_CONFIRMED_2026-08-26',
     identitySource:'PTN_IDENTITY_MASTER_2026-08-26',
     updatedAt:FV.serverTimestamp(),
     updatedBy:emailKey(currentUser.email)
   },{merge:true});
 }

 // Ghi dấu migration để audit cấu hình.
 const migrationRef=db.collection('hub_meta').doc('personnel_structure_v141');
 batch.set(migrationRef,{
   version:'1.4.1',
   applied:true,
   appliedAt:FV.serverTimestamp(),
   appliedBy:emailKey(currentUser.email),
   note:'Correct ATAS lead to Nguyen Anh Tu; Tran Thi Tuyen = KN night-shift responsible; Phan Ngoc Tuyen remains primary KN lead.'
 },{merge:true});

 await batch.commit();
}

function setRoleFromAccess(access){
 const roleKey=access.role||'ktv3tr';
 st.role=roles[roleKey]?roleKey:'ktv3tr';
 const roleEl=document.getElementById('cloudRole');
 const userEl=document.getElementById('cloudUser');
 if(roleEl)roleEl.textContent=R().label;
 if(userEl)userEl.textContent=currentUser?.displayName||currentUser?.email||'Người dùng';
}
function caseQueryForRole(){
 let q=db.collection('hub_cases');
 if(HUB_INTERDEPT.isRndHead())return q;

 // Firestore Rules không tự lọc document không có quyền.
 // Query của client phải khớp DATA SCOPE của role ngay từ đầu.
 if(R().type==='lead'||R().type==='ktv'){
   const gs=R().groups||[];
   if(gs.length===1) return q.where('sourceGroup','==',gs[0]);
   if(gs.length>1) return q.where('sourceGroup','in',gs.slice(0,10));
   return null;
 }
 if(['rnd','office','quality'].includes(R().type)){
   const units=accessUnits();
   const desks=[...new Set(units.map(deskForUnit).filter(Boolean))];
   if(desks.length===1)return q.where('currentDesk','==',desks[0]);
   if(desks.length>1)return q.where('currentDesk','in',desks.slice(0,10));
   return null;
 }

 // Trưởng phòng / BGD / Quản lý điều phối / Kỹ sư thử nghiệm:
 // Rules cho phép xem toàn phạm vi tương ứng.
 return q;
}
function startRealtimeCases(){
 if(unsubscribeCases)unsubscribeCases();

 const q=caseQueryForRole();
 if(!q){
   hubCases=[];
   updateNotificationBadge();
   nav(document.querySelector('.nav button.active')?.dataset.page||'desk');
   return;
 }

 unsubscribeCases=q.onSnapshot(
   snap=>{
     hubCases=snap.docs
       .map(d=>({id:d.id,...d.data()}))
       .sort((a,b)=>{
         const ta=a.updatedAt?.toMillis?.()||0;
         const tb=b.updatedAt?.toMillis?.()||0;
         return tb-ta;
       });
     updateNotificationBadge();
     const active=document.querySelector('.nav button.active')?.dataset.page||'desk';
     nav(active);
   },
   err=>{
     console.error('Firestore realtime cases:',err);
     const details=`${err.code||''} ${err.message||err}`.trim();
     alert('Không đồng bộ được Firestore theo phạm vi quyền ('+R().label+'). '+details);
   }
 );
}
function startRealtimePins(){
 if(unsubscribePins)unsubscribePins();
 unsubscribePins=db.collection('hub_pins').where('userUid','==',currentUser.uid).onSnapshot(
  snap=>{
    hubPins=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>{
      const ta=a.createdAt?.toMillis?.()||0, tb=b.createdAt?.toMillis?.()||0;
      return tb-ta;
    });
    const active=document.querySelector('.nav button.active')?.dataset.page||'desk';
    nav(active);
  },
  err=>console.error('Pins:',err)
 );
}
auth.onAuthStateChanged(async user=>{
 const gate=document.getElementById('authGate');
 const msg=document.getElementById('authMessage');
 if(!user){
   if(unsubscribeCases)unsubscribeCases();
   if(unsubscribePins)unsubscribePins();
   unsubscribeCases=null;unsubscribePins=null;
   HUB_CHAT.reset();HUB_INTERDEPT.reset();
   currentUser=null;currentAccess=null;hubCases=[];hubPins=[];
   document.getElementById('content').innerHTML='';
   document.getElementById('drawerBody').innerHTML='';
   closeDrawer();
   if(gate)gate.style.display='flex';
   return;
 }
 currentUser=user;
 try{
   if(isOwnerEmail(user.email)) await ensureInitialPilotAccess();
   currentAccess=await loadAccessForUser(user);
   if(!currentAccess){
     if(msg){
       msg.style.display='block';
       const actual=emailKey(user.email);
       msg.innerHTML='<b>Tài khoản chưa được nhận diện quyền HUB-PTN.</b><br>Email Google đang đăng nhập: <b>'+escapeHtml(actual)+'</b><br><br>Nếu đây là tài khoản của Trưởng nhóm/KTV đã được cấp, hãy gửi đúng dòng email này cho Trưởng phòng để đối chiếu email định danh.';
     }
     await auth.signOut();
     return;
   }
   setRoleFromAccess(currentAccess);
   applyMenu();
   if(gate)gate.style.display='none';
   startRealtimeCases();
   startRealtimePins();
   restoreLocalReminders();
   nav('desk');
 }catch(e){
   if(msg){msg.style.display='block';msg.textContent='Lỗi kiểm tra quyền: '+e.message}
 }
});

async function getNextCaseCode(){
 const ref=db.collection('hub_meta').doc('counters');
 let code='';
 await db.runTransaction(async tx=>{
   const snap=await tx.get(ref);
   const n=(snap.exists && Number(snap.data().caseCounter))||0;
   const next=n+1;
   tx.set(ref,{caseCounter:next,updatedAt:FV.serverTimestamp()},{merge:true});
   code='VM-'+String(next).padStart(3,'0');
 });
 return code;
}
async function writeCaseEvent(caseId,action,detail=''){
 await db.collection('hub_case_events').add({
   caseId,action,detail,
   actorUid:currentUser.uid,
   actorEmail:emailKey(currentUser.email),
   actorName:currentUser.displayName||currentUser.email,
   actorRole:R().label,
   visibility:'public',
   createdAt:FV.serverTimestamp()
 });
}
async function loadCaseEvents(caseId){
 const box=document.getElementById('caseAuditBox');
 if(!box)return;
 try{
  const snap=await db.collection('hub_case_events').where('caseId','==',caseId).get();
  box.innerHTML=snap.empty?'<div>Chưa có lịch sử.</div>':snap.docs.slice().sort((a,b)=>(a.data().createdAt?.toMillis?.()||0)-(b.data().createdAt?.toMillis?.()||0)).map(d=>{
    const x=d.data();
    return '<div>'+escapeHtml(fmtTs(x.createdAt))+' — '+escapeHtml(x.actorName||x.actorRole||'Người dùng')+': '+escapeHtml(x.action)+(x.detail?' — '+escapeHtml(x.detail):'')+'</div>';
  }).join('');
 }catch(e){
  box.innerHTML='<div>Chưa tải được audit: '+escapeHtml(e.message)+'</div>';
 }
}

function openCreateCase(){
 document.getElementById('drawerSmall').textContent='BÁO CÁO VẤN ĐỀ / VƯỚNG MẮC';
 document.getElementById('drawerTitle').textContent='Tạo bản ghi xử lý';
 const defaultGroup=(R().groups&&R().groups[0])||'3TR';
 document.getElementById('drawerBody').innerHTML=`
  <div class="notice"><b>Mục tiêu:</b> vấn đề có mã, người/cấp phụ trách, nơi đang xử lý, trạng thái và lịch sử. Không để vấn đề chỉ tồn tại trong Tele/chat.</div>
  <div class="field"><label>Tiêu đề vấn đề</label><input id="cTitle" placeholder="Mô tả ngắn, rõ vấn đề"></div>
  <div class="formgrid">
   <div class="field"><label>Nhóm phát hiện</label><select id="cGroup"><option value="3TR">Nhóm 3T-R</option><option value="KN">Nhóm K-N</option><option value="ATAS">Nhóm ATAS</option></select></div>
   <div class="field"><label>Phân loại</label><select id="cCategory"><option>Kỹ thuật</option><option>Tiến độ</option><option>Trạm / Máy móc</option><option>Thiết bị / Dụng cụ</option><option>Mẫu / Hồ sơ</option><option>Quy trình</option><option>Con người / Nhân sự</option><option>An toàn</option><option>Khác</option></select></div>
   <div class="field"><label>Mức độ</label><select id="cSeverity"><option>Trung bình</option><option>Cao</option><option>Thấp</option></select></div>
   <div class="field"><label>Hạn cần phản hồi</label><input id="cDeadline" placeholder="Ví dụ: 26/08/2026 15:00"></div>
  </div>
  <div class="field"><label>Nội dung tóm tắt được phép hiển thị cho PTN liên quan</label><textarea id="cSummary" placeholder="Nêu tình trạng, việc đã làm và điều đang chờ..."></textarea></div>
 `;
 HUB_INTERDEPT.appendCreateAttachments();
 document.getElementById('cGroup').value=defaultGroup;
 document.getElementById('drawerFoot').innerHTML='<button class="btn" onclick="closeDrawer()">Hủy</button><button class="btn primary" onclick="createCase()">Tạo bản ghi</button>';
 openDrawer();
}
async function createCase(){
 const title=document.getElementById('cTitle').value.trim(); if(!title){alert('Cần nhập tiêu đề.');return}
 try{
  const attachmentData=await HUB_INTERDEPT.prepareCreateAttachments();
  const code=await getNextCaseCode();
  const c={
   title,
   category:document.getElementById('cCategory').value,
   severity:document.getElementById('cSeverity').value,
   sourceGroup:document.getElementById('cGroup').value,
   sourceSpace:'ptn',
   sourceUnitCode:'PTN',
   reportedBy:R().label,
   reportedByEmail:emailKey(currentUser.email),
   createdByUid:currentUser.uid,
   status:R().type==='ktv'?'Mới':'Đã tiếp nhận',
   currentDesk:R().type==='ktv'?'Trưởng nhóm':'PTN',
   currentSpace:'ptn',
   currentUnitCode:'PTN',
   schemaVersion:'2.0',
   deadline:document.getElementById('cDeadline').value.trim()||'Chưa đặt',
   summary:document.getElementById('cSummary').value.trim()||'Chưa có tóm tắt.',
   confidential:'',
   createdAt:FV.serverTimestamp(),updatedAt:FV.serverTimestamp(),
   updatedByEmail:emailKey(currentUser.email)
  };
  await db.collection('hub_cases').doc(code).set(c);
  try{await writeCaseEvent(code,'Tạo bản ghi','Nhóm '+c.sourceGroup)}catch(e){alert('VM '+code+' đã tạo nhưng chưa lưu được audit. Vui lòng báo quản trị viên.')}
  try{await HUB_INTERDEPT.saveCreateAttachments(code,attachmentData)}catch(e){alert('VM '+code+' đã tạo nhưng tệp đính kèm chưa lưu được: '+e.message)}
  closeDrawer();
  return code;
 }catch(e){alert('Không tạo được bản ghi: '+e.message)}
}

async function loadPrivateHandling(caseId){
 const box=document.getElementById('privateHandlingBox');
 if(!box)return;
 const c=hubCases.find(x=>x.id===caseId);
 if(!canSeePrivateHandling(c)){
   box.className='private-zone locked';
   box.innerHTML='<b>Chi tiết xử lý nội bộ được giới hạn theo quyền.</b><div class="meta" style="margin-top:5px">Bạn vẫn theo dõi được báo cáo gốc, trạng thái, nơi đang xử lý, hạn và các mốc xử lý công khai.</div>';
   return;
 }
 box.className='private-zone';
 try{
   let query=db.collection('hub_cases').doc(caseId).collection('private_notes');
   if(!['head','bod','coord','testeng'].includes(R().type))query=query.where('unitCode','==',caseUnitCode({currentDesk:c.currentDesk}));
   const snap=await query.get();
   const notes=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>{
     const ta=a.createdAt?.toMillis?.()||0, tb=b.createdAt?.toMillis?.()||0;
     return ta-tb;
   });
   box.innerHTML=(notes.length?notes.map(n=>`<div class="private-note"><b>${escapeHtml(n.authorName||n.authorRole||'Người xử lý')}</b><div class="meta">${escapeHtml(fmtTs(n.createdAt))}</div><div style="margin-top:5px">${escapeHtml(n.text||'')}</div></div>`).join(''):'<div class="meta">Chưa có ghi chú xử lý nội bộ.</div>')+
     `<div style="margin-top:10px"><button class="btn" onclick="openAddPrivateNote('${caseId}')">+ Ghi chú xử lý nội bộ</button></div>`;
 }catch(e){
   box.innerHTML='<div>Không tải được phần xử lý nội bộ: '+escapeHtml(e.message)+'</div>';
 }
}
function openAddPrivateNote(caseId){
 const c=hubCases.find(x=>x.id===caseId); if(!canSeePrivateHandling(c))return;
 const text=prompt('Ghi chú xử lý nội bộ (chỉ người/cấp đủ quyền xem):');
 if(!text||!text.trim())return;
 addPrivateNote(caseId,text.trim());
}
async function addPrivateNote(caseId,text){
 const c=hubCases.find(x=>x.id===caseId);if(!canSeePrivateHandling(c))return;
 try{
   await db.collection('hub_cases').doc(caseId).collection('private_notes').add({
     text,
     unitCode:caseUnitCode({currentDesk:c.currentDesk}),
     authorUid:currentUser.uid,
     authorEmail:emailKey(currentUser.email),
     authorName:currentUser.displayName||currentUser.email,
     authorRole:R().label,
     createdAt:FV.serverTimestamp()
   });
   await loadPrivateHandling(caseId);
 }catch(e){alert('Không lưu được ghi chú xử lý nội bộ: '+e.message)}
}

function openCaseDetail(id){
 const c=hubCases.find(x=>x.id===id);if(!c)return;
 document.getElementById('drawerSmall').textContent='VƯỚNG MẮC / ISSUE';
 document.getElementById('drawerTitle').textContent=c.id+' — '+c.title;
 const canControl=R().type==='head';
 const isLead=R().type==='lead'&&(R().groups||[]).includes(c.sourceGroup);
 const receiver=['rnd','office','quality','bod'].includes(R().type);
 const follower=isSourceGroupFollower(c);

 document.getElementById('drawerBody').innerHTML=`
  ${follower?`<div class="follow-note"><b>Báo cáo thuộc phạm vi nhóm của bạn.</b><br>Bản ghi này không biến mất khi chuyển sang bộ phận khác. Bạn luôn theo dõi được trạng thái và các mốc công khai; chi tiết xử lý nội bộ chỉ hiển thị theo quyền.</div>`:''}
  <div class="formgrid">
   <div class="field"><label>Phân loại</label><b>${escapeHtml(c.category)}</b></div>
   <div class="field"><label>Mức độ</label>${badge(escapeHtml(c.severity),c.severity==='Cao'?'red':c.severity==='Trung bình'?'orange':'')}</div>
   <div class="field"><label>Trạng thái</label>${badge(escapeHtml(c.status),statusBadgeClass(c.status))}</div>
   <div class="field"><label>Nơi đang xử lý</label><b>${escapeHtml(c.currentDesk)}</b></div>
   <div class="field"><label>Nhóm báo cáo</label><b>${escapeHtml(c.sourceGroup)}</b></div>
   <div class="field"><label>Hạn phản hồi</label><b>${escapeHtml(c.deadline)}</b></div>
  </div>
  <div class="section"><h4>Báo cáo / nội dung được phép theo dõi</h4><div class="summary-visible">${escapeHtml(c.summary)}</div></div>
  <div class="section"><h4>Lịch sử trạng thái công khai / Audit trail</h4><div class="auditline" id="caseAuditBox"><div>Đang tải lịch sử...</div></div></div>
  <div class="section"><h4>Xử lý nội bộ theo quyền</h4><div id="privateHandlingBox" class="private-zone"><div>Đang kiểm tra quyền...</div></div></div>
 `;
 let actions=`<button class="btn" onclick="pinCase('${c.id}')">📌 Ghim về bàn làm việc</button>`;
 if(isLead && ['Mới','Đã tiếp nhận'].includes(c.status)) actions+=`<button class="btn primary" onclick="caseAction('${c.id}','Gửi Trưởng phòng')">Gửi Trưởng phòng</button>`;
 if(canControl){
  actions+=`<button class="btn" onclick="routeCase('${c.id}')">Chuyển xử lý</button>`;
  actions+=`<button class="btn primary" onclick="caseAction('${c.id}','Đã xử lý')">Đánh dấu đã xử lý</button>`;
  actions+=`<button class="btn" onclick="caseAction('${c.id}','Đóng')">Đóng</button>`;
 }
 if(receiver) actions+=`<button class="btn primary" onclick="caseAction('${c.id}','Đã tiếp nhận')">Xác nhận tiếp nhận</button>`;
 document.getElementById('drawerFoot').innerHTML=actions;
 openDrawer();
 loadCaseEvents(id);
 loadPrivateHandling(id);
 HUB_INTERDEPT.injectPanel(id);
 HUB_CHAT.selectCase(id);
}
async function caseAction(id,action){
 const c=hubCases.find(x=>x.id===id);if(!c)return;
 const patch={updatedAt:FV.serverTimestamp(),updatedByEmail:emailKey(currentUser.email)};
 if(action==='Gửi Trưởng phòng'){patch.status='Chờ Trưởng phòng';patch.currentDesk='Trưởng phòng PTN'}
 else if(action==='Đã xử lý'){patch.status='Đã xử lý';patch.currentDesk='PTN'}
 else if(action==='Đóng'){patch.status='Đóng'}
 else if(action==='Đã tiếp nhận'){patch.status='Đã tiếp nhận'}
 try{
  await db.collection('hub_cases').doc(id).update(patch);
  await writeCaseEvent(id,action,'');
  closeDrawer();
 }catch(e){alert('Không cập nhật được: '+e.message)}
}
async function routeCase(id){
 const choice=prompt(
 `Chuyển xử lý tới:
1 - R&D
2 - Khối Văn phòng / HCNS
3 - Khối Văn phòng / Kế toán
4 - Khối Văn phòng / Lấy mẫu - Kho
5 - Quản lý chất lượng
6 - Ban Giám đốc

Nhập số 1-6:`,'1');
 if(!choice)return;
 const map={
  '1':{desk:'R&D',space:'rnd',unitCode:'RD'},
  '2':{desk:'Khối Văn phòng / HCNS',space:'office',unitCode:'HCNS'},
  '3':{desk:'Khối Văn phòng / Kế toán',space:'office',unitCode:'KT'},
  '4':{desk:'Khối Văn phòng / Lấy mẫu - Kho',space:'office',unitCode:'KHO'},
  '5':{desk:'Quản lý chất lượng',space:'quality',unitCode:'QLCL'},
  '6':{desk:'Ban Giám đốc',space:'bod',unitCode:'BGD'}
 };
 const route=map[String(choice).trim()];
 if(!route){alert('Lựa chọn không hợp lệ.');return}
 const target=route.desk;
 const patch={
  currentDesk:target,
  currentSpace:route.space,
  currentUnitCode:route.unitCode,
  schemaVersion:'2.0',
  status:target==='Ban Giám đốc'?'Chờ quyết định':'Chờ phản hồi',
  updatedAt:FV.serverTimestamp(),updatedByEmail:emailKey(currentUser.email)
 };
 try{
  await db.collection('hub_cases').doc(id).update(patch);
  await writeCaseEvent(id,'Chuyển xử lý',target);
  closeDrawer();
 }catch(e){alert('Không chuyển xử lý được: '+e.message)}
}
async function pinCase(id){
 try{
  const key=currentUser.uid+'_'+id;
  await db.collection('hub_pins').doc(key).set({
    userUid:currentUser.uid,userEmail:emailKey(currentUser.email),
    caseId:id,createdAt:FV.serverTimestamp()
  },{merge:true});
  alert('Đã ghim '+id+' về Bàn làm việc.');
 }catch(e){alert('Không ghim được: '+e.message)}
}
async function unpinCase(id){
 try{
  await db.collection('hub_pins').doc(currentUser.uid+'_'+id).delete();
 }catch(e){alert('Không bỏ ghim được: '+e.message)}
}
function exportHubCases(){
 const data=visibleCases().map(c=>({...c,createdAt:fmtTs(c.createdAt),updatedAt:fmtTs(c.updatedAt)}));
 const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
 const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='HUB_PTN_CLOUD_BACKUP_'+new Date().toISOString().slice(0,10)+'.json';a.click();URL.revokeObjectURL(a.href);
}
function resetHubCases(){alert('HUB-PTN không cho phép reset dữ liệu thật từ giao diện.')}
function renderCaseBoard(){return HUB_INTERDEPT.renderBoard()}
function renderLegacyCaseBoard(){
 const list=visibleCases();
 const buckets=[
  ['Mới / Tiếp nhận',x=>['Mới','Đã tiếp nhận','Chờ Trưởng phòng'].includes(x.status)],
  ['Đang xử lý',x=>x.status==='Đang xử lý'],
  ['Đang chờ',x=>['Chờ phản hồi','Chờ quyết định'].includes(x.status)],
  ['Đã xử lý / Đóng',x=>['Đã xử lý','Đóng'].includes(x.status)]
 ];
 return `<div class="caseboard">${buckets.map(([name,fn])=>`<div class="casecol"><h3>${name}</h3>${list.filter(fn).map(c=>`<div class="casecard" onclick="openCaseDetail('${c.id}')"><div class="casecode">${c.id}</div><div class="title">${escapeHtml(c.title)}</div><div class="meta">${escapeHtml(c.sourceGroup)} • ${escapeHtml(c.currentDesk)} • ${escapeHtml(c.deadline)}</div><div style="margin-top:7px">${badge(escapeHtml(c.status),statusBadgeClass(c.status))}</div></div>`).join('')||'<div class="item"><div class="meta">Không có.</div></div>'}</div>`).join('')}</div>`;
}

async function openAccessManager(){
 if(R().type!=='head')return;
 document.getElementById('drawerSmall').textContent='PHÂN QUYỀN HUB-PTN';
 document.getElementById('drawerTitle').textContent='Quản lý người được phép truy cập';
 document.getElementById('drawerBody').innerHTML=`
  <div class="notice"><b>Nguyên tắc:</b> quyền HUB gắn với email Google định danh, vai trò và đơn vị. Người chưa được cấp sẽ không đọc được dữ liệu HUB.</div>
  <div class="formgrid">
   <div class="field"><label>Họ tên</label><input id="aName" placeholder="Họ tên nhân sự"></div>
   <div class="field"><label>Mã nhân sự</label><input id="aEmployeeId" placeholder="Ví dụ: NS-017"></div>
  </div>
  <div class="field"><label>Email Google định danh</label><input id="aEmail" placeholder="ten@gmail.com"></div>
  <div class="field"><label>Vai trò</label><select id="aRole" onchange="syncAccessUnitByRole()">
   <option value="lead3tr">Trưởng nhóm 3T-R</option>
   <option value="leadkn">Trưởng nhóm K-N</option>
   <option value="leadknnight">Phụ trách ca đêm K-N</option>
   <option value="leadatas">Trưởng nhóm ATAS</option>
   <option value="head">Trưởng phòng PTN</option>
   <option value="testeng">Kỹ sư thử nghiệm</option>
   <option value="coord">Quản lý điều phối</option>
   <option value="ktv3tr">KTV nhóm 3T-R</option>
   <option value="ktvkn">KTV nhóm K-N</option>
   <option value="ktvatas">KTV nhóm ATAS</option>
   <option value="rnd">R&D</option>
   <option value="office">Khối Văn phòng</option>
   <option value="quality">Bộ phận Quản lý chất lượng</option>
   <option value="bod">Ban Giám đốc</option>
  </select></div>
  <div class="field"><label>Đơn vị chính</label><select id="aUnit">${MEAL_UNITS.map(x=>`<option value="${x.code}">${escapeHtml(x.label)}</option>`).join('')}</select></div>
  <div class="section">
   <h4>Quyền bổ sung</h4>
   <label class="checkline"><input type="checkbox" id="permMealUnit"> Được báo cơm tập thể cho đơn vị được gán</label>
   <label class="checkline"><input type="checkbox" id="permMealGuest"> Được báo suất khách cho đơn vị được gán</label>
  </div>
  <div class="notice"><b>Mô hình V2.1:</b> quyền theo email + vai trò + đơn vị. HCNS, Kế toán và Lấy mẫu–Kho không mặc định nhìn lẫn hồ sơ xử lý của nhau.</div>
  <button class="btn primary" onclick="saveAccess()">Cấp / cập nhật quyền</button>
  <div class="section"><h4>Danh sách đã cấp</h4><div id="accessList">Đang tải...</div></div>`;
 document.getElementById('drawerFoot').innerHTML='<button class="btn" onclick="closeDrawer()">Đóng</button>';
 openDrawer();
 syncAccessUnitByRole();
 loadAccessList();
}
function roleGroups(role){
 if(role==='lead3tr')return ['3TR']; if(role==='leadkn'||role==='leadknnight')return ['KN']; if(role==='leadatas')return ['ATAS'];
 if(['head','bod','testeng','coord'].includes(role))return ['3TR','KN','ATAS']; return [];
}
function roleSpaces(role){
 if(role==='head'||role==='bod')return ['ptn','rnd','office','quality','bod','common','commonRoom'];
 if(role.startsWith('lead'))return ['ptn','rnd','office','common','commonRoom'];
 if(role==='testeng')return ['ptn','rnd','quality','common','commonRoom'];
 if(role==='coord')return ['ptn','office','quality','common','commonRoom'];
 if(role==='rnd')return ['rnd','common'];
 if(role==='office'||role==='hr')return ['office','common'];
 if(role==='quality')return ['quality','common'];
 if(role.startsWith('ktv'))return ['ptn','office','common'];
 return ['common'];
}
function syncAccessUnitByRole(){
 const role=document.getElementById('aRole')?.value||'';
 const unit=document.getElementById('aUnit');
 if(unit){
   const defaults=roleDefaultUnits(role);
   if(defaults.length===1)unit.value=defaults[0];
 }
 const defs=roleDefaultPermissions(role);
 const m=document.getElementById('permMealUnit');
 const g=document.getElementById('permMealGuest');
 if(m)m.checked=defs.includes('meal.unit.manage');
 if(g)g.checked=defs.includes('meal.guest.create');
}
async function saveAccess(){
 const email=emailKey(document.getElementById('aEmail').value);
 const role=document.getElementById('aRole').value;
 const name=document.getElementById('aName').value.trim();
 const employeeId=document.getElementById('aEmployeeId').value.trim();
 const unitCode=document.getElementById('aUnit').value;
 if(!email||!email.includes('@')){alert('Email không hợp lệ.');return}
 if(!unitCode){alert('Cần chọn đơn vị chính.');return}
 try{
  await db.collection('hub_access').doc(email).set({
    email,name,employeeId,role,
    groups:roleGroups(role),
    spaces:roleSpaces(role),
    unitCodes:[unitCode],
    department:unitDepartment(unitCode),
    personnelTitle:roles[role]?.label||role,
    permissions:[
      ...(document.getElementById('permMealUnit')?.checked?['meal.unit.manage']:[]),
      ...(document.getElementById('permMealGuest')?.checked?['meal.guest.create']:[]),
      ...(role==='head'?['access.manage','case.route','common.publish']:[])
    ],
    active:true,
    accessModelVersion:'2.0',
    updatedAt:FV.serverTimestamp(),
    updatedBy:emailKey(currentUser.email)
  },{merge:true});
  await db.collection('hub_audit_logs').add({
    action:'ACCESS_GRANT_OR_UPDATE',
    targetEmail:email,targetRole:role,targetUnitCode:unitCode,
    actorUid:currentUser.uid,actorEmail:emailKey(currentUser.email),
    createdAt:FV.serverTimestamp()
  }).catch(()=>{});
  await loadAccessList();
  ['aEmail','aName','aEmployeeId'].forEach(id=>{const el=document.getElementById(id);if(el)el.value=''});
 }catch(e){alert('Không cấp quyền được: '+e.message)}
}
async function revokeAccess(email){
 if(!confirm('Thu hồi quyền của '+email+'?'))return;
 try{
  await db.collection('hub_access').doc(email).set({active:false,updatedAt:FV.serverTimestamp(),updatedBy:emailKey(currentUser.email)},{merge:true});
  await loadAccessList();
 }catch(e){alert('Không thu hồi được: '+e.message)}
}
async function loadAccessList(){
 const el=document.getElementById('accessList');if(!el)return;
 try{
  const snap=await db.collection('hub_access').orderBy('email').get();
  el.innerHTML='<div class="access-table header"><div>Nhân sự / Email</div><div>Vai trò</div><div>Trạng thái</div><div></div></div>'+
   `<div class="access-table"><div><b>Dương Đức Vượng</b><div class="meta">NS-001 • bebewofl@gmail.com</div></div><div>Trưởng phòng PTN</div><div>${badge('Chủ sở hữu','green')}</div><div></div></div>`+
   snap.docs.map(d=>{
    const x=d.data();
    return `<div class="access-table"><div><b>${escapeHtml(x.name||'Chưa đặt tên')}</b><div class="meta">${escapeHtml(x.employeeId||'')} ${x.employeeId?'• ':''}${escapeHtml(x.email||d.id)}</div></div><div>${escapeHtml(roles[x.role]?.label||x.role)}<div class="meta">${escapeHtml((x.unitCodes||[]).map(c=>mealUnit(c).short).join(', ')||x.department||'Chưa gán đơn vị')}</div></div><div>${x.active===false?badge('Đã thu hồi','red'):badge('Đang hoạt động','green')}</div><div>${x.active===false?'':`<button class="btn" onclick="revokeAccess('${escapeHtml(d.id)}')">Thu hồi</button>`}</div></div>`;
   }).join('');
 }catch(e){el.textContent='Không tải được danh sách: '+e.message}
}

function R(){return roles[st.role]} function canSpace(s){return R().spaces.includes(s)}
function badge(t,c=''){return `<span class="badge ${c}">${t}</span>`}
function head(title,sub,actions=''){return `<div class="head"><div><h1>${title}</h1><p>${sub}</p></div><div>${actions}</div></div>`}
function accessNote(){
 let txt=R().type==='head'
 ? 'Đây chính là bàn Trưởng phòng PTN: tổng hợp việc chờ xử lý, vướng mắc, cảnh báo, nhóm và nội dung cần trình BGD.'
 : R().type==='bod'
 ? 'BGD xem/giám sát tổng thể; trong PTN không mặc định sửa hoặc xóa dữ liệu quản trị nghiệp vụ.'
 : R().type==='testeng'
 ? 'Kỹ sư Thử nghiệm là đầu mối kỹ thuật cấp cao của PTN, tham mưu và xử lý chuyên môn dưới quyền Trưởng phòng.'
 : R().type==='coord'
 ? 'Quản lý điều phối là đầu mối điều phối/vận hành cấp cao của PTN, hỗ trợ Trưởng phòng và phối hợp các nhóm.'
 : 'Nội dung hiển thị theo vai trò, membership và phạm vi dữ liệu. Vị trí chưa được xác định thẩm quyền chính thức không mặc định có quyền quản trị PTN; chỉ được cấp quyền xem/bình luận hoặc tham gia case theo quyết định của Trưởng phòng/BGD.';
 return `<div class="notice"><b>${R().label}.</b> ${txt}</div>`;
}
function renderDesk(){
 const needs=casesNeedMyAction();
 const waiting=casesWaiting();
 const opened=openCases();
 const highs=highCases();
 const pins=pinCases();
 const rows=needs.slice(0,8).map(c=>`<tr onclick="openCaseDetail('${c.id}')" style="cursor:pointer">
   <td>${badge(c.severity,c.severity==='Cao'?'red':c.severity==='Trung bình'?'orange':'')}</td>
   <td><b>${escapeHtml(c.id)} — ${escapeHtml(c.title)}</b><div class="meta">${escapeHtml(c.summary||'')}</div></td>
   <td>${escapeHtml(c.currentDesk||'—')}</td>
   <td>${escapeHtml(c.deadline||'—')}</td>
   <td>${badge(escapeHtml(c.status),statusBadgeClass(c.status))}</td>
 </tr>`).join('');
 return head('Bàn làm việc của tôi','Tổng hợp realtime theo đúng quyền và dữ liệu liên quan tới tài khoản đang đăng nhập.',
 `<button class="btn" onclick="nav('commonRoom')">Phòng chung PTN</button><button class="btn" onclick="openReminder()">⏰ Hẹn nhắc</button>`)+accessNote()+`
 <div class="cards">
  <div class="card metric"><div class="lab">Cần tôi xử lý</div><div class="num" style="color:#2858c7">${needs.length}</div><small>Theo vai trò và nơi đang xử lý</small></div>
  <div class="card metric"><div class="lab">Đang chờ</div><div class="num" style="color:#b54708">${waiting.length}</div><small>Chờ phản hồi / quyết định</small></div>
  <div class="card metric"><div class="lab">Vướng mắc đang mở</div><div class="num" style="color:#b42318">${opened.length}</div><small>Dữ liệu Firestore realtime</small></div>
  <div class="card metric"><div class="lab">Mức cao</div><div class="num" style="color:#067647">${highs.length}</div><small>Cần ưu tiên theo dõi</small></div>
 </div>
 <div class="grid2"><div>
  <div class="panel"><div class="ph"><h3>VIỆC / VẤN ĐỀ CẦN XỬ LÝ</h3><span class="badge green">Dữ liệu thật</span></div>
   <div class="tablewrap"><table><thead><tr><th>Mức</th><th>Nội dung</th><th>Nơi xử lý</th><th>Hạn</th><th>Trạng thái</th></tr></thead>
   <tbody>${rows||'<tr><td colspan="5"><div class="meta">Hiện không có nội dung cần xử lý theo quyền của bạn.</div></td></tr>'}</tbody></table></div>
  </div>
 </div><div>
  <div class="panel"><div class="ph"><h3>PHÒNG CHUNG PTN</h3><button class="btn" onclick="nav('commonRoom')">Mở</button></div><div class="list">
   <div class="item"><div class="title">Không gian quản lý chung</div><div class="meta">Giao việc tổng • đề xuất • điều phối • kỹ thuật • họp • kết luận</div></div>
  </div></div>
  <div class="panel"><div class="ph"><h3>CÁC BỘ PHẬN PTN</h3><button class="btn" onclick="nav('groups')">Xem</button></div><div class="list">
   <div class="item"><div class="title">05 đầu mối trong cơ cấu PTN</div><div class="meta">3T-R • K-N • ATAS • Quản lý điều phối • Kỹ sư thử nghiệm</div></div>
  </div></div>
  <div class="panel"><div class="ph"><h3>ĐÃ GHIM VỀ BÀN LÀM VIỆC</h3><button class="btn" onclick="nav('pinned')">Xem tất cả</button></div><div class="list">
   ${pins.length?pins.slice(0,4).map(c=>`<div class="item"><div class="title">${escapeHtml(c.id)} — ${escapeHtml(c.title)}</div><div class="meta">${escapeHtml(c.status)} • ${escapeHtml(c.currentDesk)}</div></div>`).join(''):'<div class="item"><div class="meta">Chưa ghim nội dung nào.</div></div>'}
  </div></div>
 </div></div>`;
}
function renderGroups(){
 const units=[
  {id:'3TR',type:'group',name:'Nhóm 3T-R',desc:'Trưởng nhóm: Lê Đức Độ. Không gian công việc, vướng mắc, giao việc và trao đổi của nhóm 3T-R.'},
  {id:'KN',type:'group',name:'Nhóm K-N',desc:'Trưởng nhóm/đầu mối chính: Phan Ngọc Tuyến. Phụ trách ca đêm: Trần Thị Tuyền. Hai đầu mối phối hợp theo ca; Phan Ngọc Tuyến là Trưởng nhóm chính.'},
  {id:'ATAS',type:'group',name:'Nhóm ATAS',desc:'Trưởng nhóm: Nguyễn Anh Tú. Không gian công việc, vướng mắc, giao việc và trao đổi của nhóm ATAS.'},
  {id:'COORD',type:'role',name:'Quản lý điều phối',desc:'Đầu mối điều phối công việc, vận hành, xử lý luồng việc và phối hợp giữa các nhóm trong PTN.'},
  {id:'TESTENG',type:'role',name:'Kỹ sư thử nghiệm',desc:'Đầu mối kỹ thuật của PTN, cầm trịch các vấn đề chuyên môn, phương pháp, thiết bị và xử lý kỹ thuật.'}
 ];
 return head('Các bộ phận PTN','Gồm 3 nhóm do Trưởng nhóm phụ trách và 2 đầu mối quản lý/chuyên môn của PTN.')+accessNote()+`
 <div class="notice"><b>Cơ cấu hiển thị:</b> Nhóm 3T-R, Nhóm K-N, Nhóm ATAS, Quản lý điều phối và Kỹ sư thử nghiệm. Ba nhóm là các bộ phận theo Trưởng nhóm; Quản lý điều phối và Kỹ sư thử nghiệm là hai đầu mối quản lý/chuyên môn thuộc cơ cấu PTN.</div>
 <div class="units-grid">${units.map(u=>{
   let ok=false;
   if(R().type==='head' || R().type==='bod') ok=true;
   else if(u.type==='group' && R().groups.includes(u.id)) ok=true;
   else if(u.id==='COORD' && R().type==='coord') ok=true;
   else if(u.id==='TESTENG' && R().type==='testeng') ok=true;

   const buttonLabel = u.type==='group' ? 'Truy cập nhóm' : 'Mở bộ phận';
   const clickAction = ok ? (u.type==='group' ? `openGroup('${u.id}')` : `openPTNRoleUnit('${u.id}')`) : '';
   const statusText = ok ? 'Có quyền' : 'Không có quyền';

   return `<div class="card unit-card ${ok?'':'locked'}">
    <div class="status">${ok?badge(statusText,'green'):badge(statusText)}</div>
    <h3>${u.name}</h3>
    <p>${u.desc}</p>
    <button class="btn ${ok?'primary':''}" onclick="${clickAction}" ${ok?'':'disabled'}>${buttonLabel}</button>
    ${u.type==='role' ? '<div class="unit-note">Vị trí quản lý/chuyên môn trong cơ cấu PTN.</div>' : ''}
   </div>`;
 }).join('')}</div>`;
}
function openGroup(id){
 const names={'3TR':'Nhóm 3T-R','KN':'Nhóm K-N','ATAS':'Nhóm ATAS'};
 if(!R().groups.includes(id)){alert('Không có quyền truy cập nhóm này.');return}
 document.getElementById('content').innerHTML=head(names[id],`Không gian làm việc của ${names[id]}.`,
 R().type==='head'||R().type==='lead'?'<button class="btn">Thành viên</button> <button class="btn primary">+ Giao việc nhóm</button>':'')+`
 <div class="panel"><div class="ph"><h3>CÔNG VIỆC NHÓM</h3></div><div class="list">
 <div class="item"><div class="title">Công việc đang thực hiện</div><div class="meta">Người phụ trách • deadline • trạng thái</div></div>
 <div class="item"><div class="title">Vướng mắc cần xử lý</div><div class="meta">Có thể đưa lên Trưởng phòng nếu vượt thẩm quyền</div></div>
 </div></div>`;
}

function openPTNRoleUnit(id){
 const data={
  'COORD':{
    title:'Quản lý điều phối',
    subtitle:'Bộ phận/đầu mối điều phối của PTN.',
    body:`<div class="panel"><div class="ph"><h3>VAI TRÒ CHÍNH</h3></div><div class="list">
      <div class="item"><div class="title">Điều phối công việc và luồng xử lý</div><div class="meta">Theo dõi tiến độ, điểm nghẽn, phối hợp các nhóm và hỗ trợ vận hành cho Trưởng phòng.</div></div>
      <div class="item"><div class="title">Phối hợp liên bộ phận</div><div class="meta">Làm việc với HCNS/kho/lấy mẫu hoặc đầu mối liên quan theo chỉ đạo của Trưởng phòng.</div></div>
      <div class="item"><div class="title">Nhắc việc và cảnh báo</div><div class="meta">Theo dõi việc chậm, việc chờ, việc cần ưu tiên và hỗ trợ điều chỉnh nhịp chạy việc.</div></div>
    </div></div>`
  },
  'TESTENG':{
    title:'Kỹ sư thử nghiệm',
    subtitle:'Bộ phận/đầu mối kỹ thuật của PTN.',
    body:`<div class="panel"><div class="ph"><h3>VAI TRÒ CHÍNH</h3></div><div class="list">
      <div class="item"><div class="title">Cầm trịch kỹ thuật PTN</div><div class="meta">Phân tích bất thường, tham mưu kỹ thuật và hỗ trợ giải quyết các case chuyên môn khó.</div></div>
      <div class="item"><div class="title">Thiết bị – phương pháp – điều kiện thử</div><div class="meta">Theo dõi độ tin cậy kỹ thuật, tình trạng thiết bị và chuẩn hóa chuyên môn.</div></div>
      <div class="item"><div class="title">Phối hợp PTN ↔ R&D</div><div class="meta">Làm đầu mối kỹ thuật khi cần làm việc với R&D và hỗ trợ đào tạo nội bộ PTN.</div></div>
    </div></div>`
  }
 };
 const x=data[id];
 if(!x){alert('Không tìm thấy bộ phận.');return}
 document.getElementById('content').innerHTML=head(x.title,x.subtitle,(R().type==='head' || R().type==='bod')?'<button class="btn">Xem tổng hợp</button>':'') + x.body;
}
function renderCommonRoom(){
 if(!canSpace('commonRoom')) return denied();
 const canManage=['head','lead','bod','testeng','coord'].includes(R().type);
 const headMode=R().type==='head';
 return head('Phòng chung PTN','Workspace quản lý chung của Trưởng phòng và các đầu mối quản lý/chuyên môn PTN.',
 `${canManage?'<button class="btn" onclick="openInvite()">+ Mời thêm người</button>':''} ${headMode?'<button class="btn primary" onclick="alert(\'Pilot: tạo giao việc tổng cho các nhóm trưởng\')">+ Giao việc tổng</button>':''}`)+`
 <div class="notice"><b>Phòng chung PTN là không gian quản lý PTN.</b> Thành phần thường trực: Trưởng phòng + các Trưởng nhóm; sau này có Quản lý điều phối và Kỹ sư thử nghiệm. Dùng để giao việc tổng, trao đổi/đề xuất, điều phối, kỹ thuật, kết luận; Họp là một mục chức năng khi cần.</div>

 <div class="room-tabs">
   <button class="room-tab active" onclick="switchRoomTab(this,'overview')">Tổng quan</button>
   <button class="room-tab" onclick="switchRoomTab(this,'assign')">Giao việc tổng</button>
   <button class="room-tab" onclick="switchRoomTab(this,'proposal')">Trao đổi / Đề xuất</button>
   <button class="room-tab" onclick="switchRoomTab(this,'coordination')">Điều phối</button>
   <button class="room-tab" onclick="switchRoomTab(this,'technical')">Kỹ thuật thử nghiệm</button>
   <button class="room-tab" onclick="switchRoomTab(this,'meeting')">Họp</button>
   <button class="room-tab" onclick="switchRoomTab(this,'conclusion')">Theo dõi / Kết luận</button>
 </div>

 <div id="room-overview" class="room-section active">
   <div class="grid2">
    <div>
      <div class="panel">
       <div class="ph"><h3>LUỒNG GIAO VIỆC TỔNG</h3></div>
       <div style="padding:13px">
        <div class="flowline">
          <span class="flowstep"><b>Trưởng phòng</b><br>Giao việc tổng</span><span class="arrow">→</span>
          <span class="flowstep"><b>Trưởng nhóm</b><br>Tiếp nhận</span><span class="arrow">→</span>
          <span class="flowstep"><b>Mang về nhóm</b><br>Phân phối chi tiết</span><span class="arrow">→</span>
          <span class="flowstep"><b>KTV</b><br>Thực hiện/cập nhật</span><span class="arrow">→</span>
          <span class="flowstep"><b>Lead</b><br>Tổng hợp phản hồi</span>
        </div>
       </div>
      </div>
      <div class="panel">
       <div class="ph"><h3>VIỆC TỔNG ĐANG THEO DÕI</h3></div>
       <div class="assignment header"><div>Mã</div><div>Nội dung</div><div>Nhóm nhận</div><div>Hạn</div><div>Trạng thái</div></div>
       <div class="assignment"><div>—</div><div><b>Chưa có giao việc tổng</b><div class="meta">Module giao việc tổng sẽ được nối Firestore ở bước kế tiếp.</div></div><div>—</div><div>—</div><div>${badge('Trống')}</div></div>
      </div>
    </div>
    <div>
      <div class="panel"><div class="ph"><h3>THÀNH VIÊN THƯỜNG TRỰC</h3></div><div class="list">
       <div class="item"><div class="title">Trưởng phòng PTN</div><div class="meta">Chủ trì • quyền kiểm soát cao nhất trong PTN</div></div>
       <div class="item"><div class="title">Trưởng nhóm 3T-R — Lê Đức Độ</div><div class="meta">Nhận việc tổng • quản lý nhóm 3T-R</div></div>
       <div class="item"><div class="title">Trưởng nhóm K-N — Phan Ngọc Tuyến</div><div class="meta">Đầu mối chính của nhóm • nhận việc tổng • quản lý nhóm</div></div>
       <div class="item"><div class="title">Phụ trách ca đêm K-N — Trần Thị Tuyền</div><div class="meta">Đầu mối vận hành ca đêm • phối hợp và báo cáo trong phạm vi nhóm K-N</div></div>
       <div class="item"><div class="title">Trưởng nhóm ATAS — Nguyễn Anh Tú</div><div class="meta">Nhận việc tổng • quản lý nhóm ATAS</div></div>
       <div class="item"><div class="title">Quản lý điều phối</div><div class="meta">Đầu mối điều phối/vận hành • hỗ trợ Trưởng phòng • vị trí trong cơ cấu PTN</div></div>
       <div class="item"><div class="title">Kỹ sư thử nghiệm</div><div class="meta">Đầu mối kỹ thuật PTN • tham mưu chuyên môn • vị trí trong cơ cấu PTN</div></div>
      </div></div>

       <div class="accessline"><b>Ý nghĩa quản trị:</b> hai vị trí này được tạo sẵn trong cơ cấu như các vị trí mục tiêu để PTN có lộ trình phát triển đội ngũ. Đây là thông điệp rõ ràng với nội bộ PTN, BGD và các phòng ban rằng PTN đang được xây theo hướng chuyên nghiệp, có chuẩn bị nhân sự kế cận và có cơ cấu vận hành bài bản. Khi PTN mở rộng, hai vị trí này có thể mang vai trò gần cấp Phó phòng nhưng vẫn dưới quyền kiểm soát của Trưởng phòng PTN.</div>
      </div></div>
    </div>
   </div>
 </div>

 <div id="room-assign" class="room-section">
   <div class="panel">
    <div class="ph"><h3>GIAO VIỆC TỔNG CHO CÁC TRƯỞNG NHÓM</h3>${headMode?'<button class="btn primary">+ Giao việc tổng</button>':''}</div>
    <div class="assignment header"><div>Mã</div><div>Nội dung</div><div>Nhóm nhận</div><div>Hạn</div><div>Thao tác</div></div>
    <div class="assignment"><div>—</div><div><b>Chưa có giao việc tổng đang hoạt động</b><div class="meta">Không hiển thị dữ liệu mẫu. Chỉ kích hoạt khi module có Firestore, phân quyền và audit.</div></div><div>—</div><div>—</div><div>${badge('Trống')}</div></div>
   </div>
   <div class="notice"><b>Nguyên tắc:</b> “Mang về nhóm” tạo liên kết công việc con trong nhóm nhưng giữ tham chiếu về việc tổng GT-xxx. Trưởng phòng theo dõi được tiến độ tổng mà không cần trực tiếp quản lý từng KTV.</div>
 </div>

 <div id="room-proposal" class="room-section">
   <div class="panel"><div class="ph"><h3>TRAO ĐỔI / ĐỀ XUẤT CỦA CÁC ĐẦU MỐI PTN</h3><button class="btn">+ Tạo đề xuất</button></div>
    <div class="proposal"><div class="title">Chưa có đề xuất đang hoạt động</div><div class="meta">Không dùng dữ liệu mô phỏng. Chỉ mở module khi đã có Firestore, phân quyền và audit.</div></div>
   </div>
 </div>

 <div id="room-coordination" class="room-section">
   <div class="panel"><div class="ph"><h3>QUẢN LÝ ĐIỀU PHỐI</h3><span class="badge">Vị trí dự kiến</span></div><div class="list">
    <div class="item"><div class="title">Theo dõi luồng việc giữa các nhóm</div><div class="meta">Điểm nghẽn • ưu tiên • người chờ • phối hợp liên phòng</div></div>
    <div class="item"><div class="title">Đề xuất điều chỉnh nguồn lực</div><div class="meta">Trưởng phòng là người quyết định cuối cùng trong PTN</div></div>
    <div class="item"><div class="title">Theo dõi xử lý phát sinh vận hành</div><div class="meta">Không thay thế quyền quản lý nhóm của Lead</div></div>
   </div></div>
 </div>

 <div id="room-technical" class="room-section">
   <div class="panel"><div class="ph"><h3>KỸ THUẬT THỬ NGHIỆM</h3><span class="badge">Vị trí dự kiến</span></div><div class="list">
    <div class="item"><div class="title">Case kỹ thuật cần đầu mối chuyên môn</div><div class="meta">Phân tích • phương pháp • thiết bị • bất thường kỹ thuật</div></div>
    <div class="item"><div class="title">Tham mưu kỹ thuật cho Trưởng phòng</div><div class="meta">Kỹ sư Thử nghiệm không tự phê duyệt thay Trưởng phòng nếu chưa được ủy quyền</div></div>
    <div class="item"><div class="title">Phối hợp PTN ↔ R&D</div><div class="meta">Theo quyền từng case, có audit và kết luận</div></div>
   </div></div>
 </div>

 <div id="room-meeting" class="room-section">
   <div class="panel">
    <div class="ph"><h3>HỌP / TRAO ĐỔI TRỰC TUYẾN</h3><span class="badge">Chưa kích hoạt production</span></div>
    <div class="list">
     <div class="item"><div class="title">Không sử dụng mô phỏng làm chức năng thật</div><div class="meta">Camera, micro, chia sẻ màn hình, ghi âm, transcript và tóm tắt chỉ được mở lại khi đã có hạ tầng, quyền riêng tư, thông báo/chấp thuận và audit đầy đủ.</div></div>
     <div class="item"><div class="title">Giai đoạn Foundation</div><div class="meta">Phòng chung PTN tập trung vào case, giao việc, đề xuất, điều phối và kết luận có dữ liệu thật.</div></div>
    </div>
   </div>
 </div>

 <div id="room-conclusion" class="room-section">
   <div class="panel"><div class="ph"><h3>THEO DÕI / KẾT LUẬN</h3></div><div class="list">
    <div class="item"><div class="title">Chưa có nội dung theo dõi/kết luận trong module Phòng chung</div><div class="meta">Các VM thật hiện được theo dõi tại Không gian PTN.</div></div>
   </div></div>
 </div>`;
}
function switchRoomTab(btn,id){
 document.querySelectorAll('.room-tab').forEach(x=>x.classList.remove('active'));
 document.querySelectorAll('.room-section').forEach(x=>x.classList.remove('active'));
 btn.classList.add('active');
 const el=document.getElementById('room-'+id);if(el)el.classList.add('active');
}
function setMeetingMode(btn,mode){
 document.querySelectorAll('.modebtn').forEach(x=>x.classList.remove('active'));
 btn.classList.add('active');
 const labels={online:'Họp trực tuyến',offline:'Họp trực tiếp',hybrid:'Họp kết hợp'};
 alert('Đã chọn: '+labels[mode]);
}
function toggleRecording(){
 const btn=document.getElementById('recordBtn');
 if(btn.classList.contains('recording')){
   btn.classList.remove('recording'); btn.textContent='● Ghi âm cuộc họp';
   alert('Đã dừng ghi âm (mô phỏng).');
 }else{
   const ok=confirm('Xác nhận: người tham dự đã được thông báo và đồng ý ghi âm?');
   if(!ok)return;
   btn.classList.add('recording'); btn.textContent='■ Dừng ghi âm';
   alert('Đang ghi âm cuộc họp (mô phỏng).');
 }
}
function simulateTranscript(){
 const box=document.getElementById('transcriptBox');
 if(!box)return;
 box.innerHTML='<b>Trưởng phòng:</b> Rà soát VM-026 và yêu cầu nhóm 3T-R tổng hợp hiện trạng.<br><br><b>Trưởng nhóm 3T-R:</b> Đã kiểm tra, đề nghị R&D phối hợp phân tích bo mạch và dữ liệu sau rung.<br><br><b>Trưởng phòng:</b> Chốt giao nhóm 3T-R hoàn thiện báo cáo trước 10:00 ngày 26/08; R&D phản hồi kỹ thuật trước 15:00 cùng ngày.';
}
function generateSummary(){
 const box=document.getElementById('summaryBox');
 if(!box)return;
 box.innerHTML='<h4>Tóm tắt nháp</h4><b>Nội dung chính:</b> Rà soát bất thường VM-026 sau bài rung.<br><br><b>Kết luận dự kiến:</b> Cần phối hợp R&D để phân tích nguyên nhân kỹ thuật trước khi đóng case.<br><br><b>Công việc phát sinh:</b><br>1. Nhóm 3T-R hoàn thiện báo cáo hiện trạng — hạn 26/08 10:00.<br>2. R&D phản hồi phân tích kỹ thuật — hạn 26/08 15:00.<br><br><b>Trạng thái:</b> Bản tóm tắt do hệ thống tạo, phải được Chủ trì cuộc họp xác nhận trước khi trở thành biên bản/kết luận chính thức.';
}
function archiveMeeting(){
 alert('Pilot: hồ sơ cuộc họp sẽ lưu gồm thông tin cuộc họp, danh sách tham dự, tệp ghi âm, transcript, tóm tắt đã xác nhận, kết luận, việc phát sinh và audit trail.');
}

let localStream=null;
async function startLocalMedia(){
 try{
   if(localStream){return}
   localStream=await navigator.mediaDevices.getUserMedia({
     video:{width:{ideal:1280},height:{ideal:720},frameRate:{ideal:30,max:30}},
     audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}
   });
   const v=document.getElementById('localVideo');
   if(v){v.srcObject=localStream;document.getElementById('localPlaceholder').style.display='none'}
 }catch(e){
   alert('Không mở được camera/micro. Kiểm tra quyền trình duyệt hoặc thiết bị.\\n'+e.message);
 }
}
function toggleLocalVideo(){
 if(!localStream){startLocalMedia();return}
 const t=localStream.getVideoTracks()[0]; if(t)t.enabled=!t.enabled;
}
function toggleLocalAudio(){
 if(!localStream){startLocalMedia();return}
 const t=localStream.getAudioTracks()[0]; if(t)t.enabled=!t.enabled;
}
function stopLocalMedia(){
 if(localStream){localStream.getTracks().forEach(t=>t.stop());localStream=null}
 const v=document.getElementById('localVideo');if(v)v.srcObject=null;
 const ph=document.getElementById('localPlaceholder');if(ph)ph.style.display='';
}
function sendMeetingChat(){
 const input=document.getElementById('chatInput'), box=document.getElementById('chatMessages');
 if(!input||!box||!input.value.trim())return;
 const d=document.createElement('div');d.className='msg mine';
 d.innerHTML='<b>'+R().label+'</b><div class="bubble"></div>';
 d.querySelector('.bubble').textContent=input.value.trim();
 box.appendChild(d);input.value='';box.scrollTop=box.scrollHeight;
}
function openInvite(){
 document.getElementById('drawerSmall').textContent='PHÒNG CHUNG PTN';
 document.getElementById('drawerTitle').textContent='Mời thêm người tham gia';
 document.getElementById('drawerBody').innerHTML=`
  <div class="field"><label>Người được mời</label><input id="inviteName" placeholder="Ví dụ: Nguyễn Văn A / R&D / KTV..."></div>
  <div class="field"><label>Phạm vi lời mời</label><select id="inviteScope"><option>Tham gia cuộc họp cụ thể</option><option>Tham gia Phòng chung trong khoảng thời gian</option><option>Họp toàn PTN</option></select></div>
  <div class="field"><label>Lý do / Nội dung mời</label><textarea id="inviteReason" placeholder="Nêu rõ nội dung cần tham gia"></textarea></div>
  <div class="notice"><b>Cơ chế 2 chiều:</b> gửi lời mời chưa có nghĩa người đó đã vào phòng. Chỉ sau khi người được mời chấp thuận thì quyền tham gia mới có hiệu lực.</div>`;
 document.getElementById('drawerFoot').innerHTML='<button class="btn" onclick="closeDrawer()">Hủy</button><button class="btn primary" onclick="sendInvite()">Gửi lời mời</button>';
 openDrawer();
}
function sendInvite(){
 const n=document.getElementById('inviteName').value.trim();
 const s=document.getElementById('inviteScope').value;
 if(!n)return;
 st.pendingInvites.push({name:n,scope:s});
 closeDrawer();nav('commonRoom');
}
function acceptInvite(i){
 const x=st.pendingInvites.splice(i,1)[0];
 st.invitedGuests.push(x.name);
 nav('commonRoom');
}
function declineInvite(i){st.pendingInvites.splice(i,1);nav('commonRoom')}
function renderPTN(){
 if(!canSpace('ptn'))return denied();
 const list=visibleCases();
 const openCount=list.filter(x=>!['Đã xử lý','Đóng'].includes(x.status)).length;
 const waitCount=list.filter(x=>x.status.startsWith('Chờ')).length;
 return head('Không gian Phòng Thử nghiệm','Trung tâm theo dõi công việc, vướng mắc và tình trạng xử lý của PTN.',
 `${R().type==='head'?'<button class="btn" onclick="openAccessManager()">Quản lý quyền</button> ':''}<button class="btn" onclick="exportHubCases()">Xuất backup</button> <button class="btn primary" onclick="openCreateCase()">+ Báo cáo vấn đề</button>`)+accessNote()+`
 <div class="notice"><b>Quy tắc chống “miss” thông tin:</b> vấn đề đã báo phải có mã, nơi đang xử lý, người/cấp phụ trách, trạng thái, lần cập nhật cuối và lịch sử. <b>Nhóm đã báo vẫn nhìn thấy bản ghi và trạng thái kể cả khi chuyển xử lý sang đơn vị khác.</b> Nội dung phân tích/cách xử lý nội bộ được tách riêng và chỉ người đủ quyền xem.</div>
 <div class="cards">
  <div class="card metric"><div class="lab">Vấn đề đang mở</div><div class="num" style="color:#b42318">${openCount}</div><small>Không còn nằm riêng trong Tele/chat</small></div>
  <div class="card metric"><div class="lab">Đang chờ phản hồi</div><div class="num" style="color:#b54708">${waitCount}</div><small>BGD / R&D / Khối VP / QLCL...</small></div>
  <div class="card metric"><div class="lab">Bộ phận PTN</div><div class="num">05</div><small>3 nhóm + Điều phối + Kỹ sư thử nghiệm</small></div>
  <div class="card metric"><div class="lab">Audit trail</div><div class="num" style="color:#067647">Bật</div><small>Sự kiện xử lý lưu riêng, không cho sửa/xóa</small></div>
 </div>
 <div class="panel">
  <div class="ph"><h3>BẢNG XỬ LÝ VẤN ĐỀ / VƯỚNG MẮC</h3><span class="badge green">Firestore realtime</span></div>
  <div style="padding:12px">${renderCaseBoard()}</div>
 </div>
 <div class="panel">
  <div class="ph"><h3>TRẠNG THÁI ĐỂ PTN CÙNG THEO DÕI</h3></div>
  <div class="case-table header"><div>Mã</div><div>Nội dung</div><div>Nhóm</div><div>Nơi xử lý</div><div>Trạng thái</div><div>Cập nhật</div></div>
  ${list.map(c=>`<div class="case-table" onclick="openCaseDetail('${c.id}')" style="cursor:pointer"><div class="casecode">${c.id}</div><div><b>${c.title}</b><div class="meta">${c.summary}</div></div><div>${c.sourceGroup}</div><div>${c.currentDesk}</div><div>${badge(c.status,statusBadgeClass(c.status))}</div><div>${fmtTs(c.updatedAt)}</div></div>`).join('')}
 </div>
 <div class="panel"><div class="ph"><h3>KHÔNG GIAN TRỌNG TÂM</h3></div><div class="list">
  <div class="item"><div class="title">Các bộ phận PTN</div><div class="meta">Nhóm 3T-R • Nhóm K-N • Nhóm ATAS • Quản lý điều phối • Kỹ sư thử nghiệm</div><div style="margin-top:8px"><button class="btn" onclick="nav('groups')">Mở Các bộ phận PTN</button></div></div>
  <div class="item"><div class="title">Phòng chung PTN</div><div class="meta">Giao việc tổng • trao đổi/đề xuất • điều phối • kỹ thuật • họp • theo dõi/kết luận</div><div style="margin-top:8px"><button class="btn" onclick="nav('commonRoom')">Mở Phòng chung</button></div></div>
 </div></div>`;
}
function renderPinned(){
 const pins=pinCases();
 return head('Nội dung đã ghim','Các bản ghi tham chiếu đã ghim về Bàn làm việc cá nhân.')+`
 <div class="notice"><b>Nguyên tắc:</b> ghim không sao chép bản gốc. Nội dung luôn mở về cùng case đang được cập nhật trên Firestore.</div>
 <div class="panel"><div class="list">
  ${pins.length?pins.map(c=>`<div class="item">
   <div class="title">${escapeHtml(c.id)} — ${escapeHtml(c.title)}</div>
   <div class="meta">${escapeHtml(c.sourceGroup)} • ${escapeHtml(c.currentDesk)} • ${escapeHtml(c.status)} • Hạn: ${escapeHtml(c.deadline||'—')}</div>
   <div style="margin-top:8px"><button class="btn" onclick="openCaseDetail('${c.id}')">Mở bản gốc ↗</button> <button class="btn" onclick="unpinCase('${c.id}')">Bỏ ghim</button></div>
  </div>`).join(''):'<div class="item"><div class="meta">Chưa có nội dung nào được ghim.</div></div>'}
 </div></div>`}
function openNotifications(){
 const alerts=notificationCases().slice(0,12);
 document.getElementById('drawerSmall').textContent='THÔNG BÁO / CẢNH BÁO';
 document.getElementById('drawerTitle').textContent='Trung tâm thông báo';
 document.getElementById('drawerBody').innerHTML=`
  <div class="notice"><b>Tính năng xuyên HUB.</b> Danh sách dưới đây được sinh từ dữ liệu case thật theo quyền của người dùng.</div>
  ${alerts.length?alerts.map(c=>`<div class="item"><div class="title">${badge(c.severity==='Cao'?'Ưu tiên cao':'Đang chờ',c.severity==='Cao'?'red':'orange')} &nbsp; ${escapeHtml(c.id)} — ${escapeHtml(c.title)}</div><div class="meta">${escapeHtml(c.status)} • ${escapeHtml(c.currentDesk)} • Hạn: ${escapeHtml(c.deadline||'—')}</div><div style="margin-top:8px"><button class="btn" onclick="closeDrawer();openCaseDetail('${c.id}')">Mở</button> <button class="btn" onclick="pinCase('${c.id}')">📌 Ghim về bàn làm việc</button></div></div>`).join(''):'<div class="item"><div class="meta">Hiện không có cảnh báo theo dữ liệu được phép xem.</div></div>'}`;
 document.getElementById('drawerFoot').innerHTML='<button class="btn" onclick="closeDrawer()">Đóng</button>';
 openDrawer();
}
function pinToDesk(title){alert('Nội dung này chưa có bản ghi cloud để ghim.');}
function renderTasks(){
 const list=casesNeedMyAction();
 return head('Việc của tôi','Các vấn đề/case đang cần bạn tiếp nhận, xử lý hoặc phản hồi theo quyền hiện tại.')+`
 <div class="panel"><div class="list">
 ${list.length?list.map(c=>`<div class="item"><div class="title">${escapeHtml(c.id)} — ${escapeHtml(c.title)}</div><div class="meta">${escapeHtml(c.currentDesk)} • ${escapeHtml(c.status)} • Hạn: ${escapeHtml(c.deadline||'—')}</div><div style="margin-top:8px"><button class="btn" onclick="openCaseDetail('${c.id}')">Mở xử lý</button></div></div>`).join(''):'<div class="item"><div class="meta">Hiện không có việc cần xử lý.</div></div>'}
 </div></div>`}


function renderCompanyCommon(){
 if(!canSpace('common'))return denied();
 const canSeeSummary=['head','office','bod','coord'].includes(R().type);
 setTimeout(()=>{
   loadMealCompactSummary();
   setupMealReminder();
 },0);
 return head(
  'Khu vực chung Công ty',
  'Không gian dùng chung cho các phòng ban được cấp quyền trên HUB.',
  `<button class="btn primary" onclick="openMealCenter()">🍱 Đăng ký cơm</button>
   <button class="btn" onclick="enableMealReminder()">🔔 Nhắc 10:55</button>`
 )+`
 <div class="notice"><b>Phạm vi:</b> PTN • R&D • Khối Văn phòng • Ban Giám đốc • Bộ phận QLCL • các đơn vị khác khi được cấp quyền. Nội dung kỹ thuật hoặc xử lý nhạy cảm vẫn ở không gian riêng theo quyền.</div>
 <div class="office-grid">
  <div class="office-card"><h3>Thông báo chung</h3><p>Sẵn cấu trúc không gian chung. Module đăng thông báo có audit sẽ kích hoạt cùng đợt mở rộng phòng ban.</p></div>
  <div class="office-card"><h3>Báo cơm trưa</h3><p>Cá nhân • theo phòng/bộ phận • khách. Phòng đã báo tập thể thì khóa báo cá nhân để tránh trùng.</p></div>
  <div class="office-card"><h3>Lịch / Sự kiện</h3><p>Chưa kích hoạt dữ liệu dùng chung. Không hiển thị lịch mô phỏng.</p></div>
  <div class="office-card"><h3>Tài liệu chung</h3><p>Chưa kích hoạt kho tài liệu. Chỉ mở khi có quy tắc quyền đọc/tải và nguồn lưu trữ xác định.</p></div>
  <div class="office-card"><h3>Yêu cầu chung</h3><p>Yêu cầu phối hợp nhiều phòng ban; không thay thế VM kỹ thuật hoặc hồ sơ thử nghiệm.</p></div>
  <div class="office-card"><h3>Theo dõi</h3><p>Theo dõi phản hồi/xác nhận đối với nội dung chung.</p></div>
 </div>
 <div class="meal-compact">
   <div class="meal-compact-head">
     <div><div class="meal-compact-title">CƠM TRƯA HÔM NAY</div><div class="meta">Nhắc đăng ký lúc 10:55 · Tổng hợp không đọc ghi chú cá nhân</div></div>
     <button class="btn" onclick="openMealCenter()">Cập nhật</button>
   </div>
   <div id="mealCompactSummary"><div class="meta" style="margin-top:8px">Đang tải tổng hợp...</div></div>
 </div>
 `;
}

function renderOffice(){
 if(!canSpace('office'))return denied();
 return head(
  'PTN-Khối Văn phòng',
  'Không gian phối hợp riêng giữa PTN với HCNS/Hành chính, Kế toán và Bộ phận Lấy mẫu - Kho.'
 )+`
 <div class="notice"><b>Phạm vi:</b> HCNS/Hành chính • Kế toán • Bộ phận Lấy mẫu - Kho. <b>Báo cơm và thông báo chung toàn Công ty thực hiện tại Khu vực chung Công ty.</b></div>
 <div class="office-grid">
  <div class="office-card"><h3>HCNS / Hành chính</h3><p>Nhân sự, chế độ, hành chính và yêu cầu phối hợp riêng với PTN.</p></div>
  <div class="office-card"><h3>Kế toán</h3><p>Nội dung tài chính/kế toán liên quan PTN theo phạm vi được chia sẻ.</p></div>
  <div class="office-card"><h3>Bộ phận Lấy mẫu - Kho</h3><p>Bàn giao mẫu, phụ kiện, tình trạng kho, lấy mẫu và trả kho.</p></div>
 </div>`;
}
function localDateISO(){
 const d=new Date(), off=d.getTimezoneOffset();
 return new Date(d.getTime()-off*60000).toISOString().slice(0,10);
}
function mealDeptDocId(date,unitCode){return date+'_'+unitCode}
async function departmentMealReport(date,unitCode){
 return await db.collection('hub_meal_department_reports').doc(mealDeptDocId(date,unitCode)).get();
}
function openMealCenter(mode='personal'){
 document.getElementById('drawerSmall').textContent='KHU VỰC CHUNG CÔNG TY';
 document.getElementById('drawerTitle').textContent='Đăng ký cơm trưa';
 document.getElementById('drawerBody').innerHTML=`
  <div class="notice"><b>Chọn cách báo:</b> Cá nhân • Theo phòng/bộ phận • Khách. Khi một phòng/bộ phận đã báo tập thể, hệ thống khóa báo cá nhân của đơn vị đó để không cộng trùng.</div>
  <div class="meal-tabs">
   <button class="btn ${mode==='personal'?'active':''}" onclick="renderMealForm('personal')">Cá nhân</button>
   ${canManageMealDepartment()?`<button class="btn ${mode==='department'?'active':''}" onclick="renderMealForm('department')">Theo phòng</button>`:''}
   ${canCreateGuestMeal()?`<button class="btn ${mode==='guest'?'active':''}" onclick="renderMealForm('guest')">Khách</button>`:''}
  </div>
  <div id="mealForm"></div>`;
 document.getElementById('drawerFoot').innerHTML='<button class="btn" onclick="closeDrawer()">Đóng</button>';
 openDrawer();
 renderMealForm(mode);
}
function activateMealTab(mode){
 const buttons=[...document.querySelectorAll('.meal-tabs .btn')];
 buttons.forEach(b=>b.classList.remove('active'));
 if(mode==='personal'&&buttons[0])buttons[0].classList.add('active');
 if(mode==='department'&&buttons[1])buttons[1].classList.add('active');
 if(mode==='guest'&&buttons[2])buttons[2].classList.add('active');
}
function renderMealForm(mode){
 activateMealTab(mode);
 const el=document.getElementById('mealForm'); if(!el)return;
 const date=localDateISO(), unit=defaultMealUnitCode();

 if(mode==='personal'){
  el.innerHTML=`
   <div id="personalMealLock"></div>
   <div class="field"><label>Ngày</label><input id="mealDate" type="date" value="${date}" onchange="checkPersonalMealLock()"></div>
   <div class="field"><label>Phòng / Bộ phận</label><select id="mealUnitCode" onchange="checkPersonalMealLock()">${mealUnitOptionsAllowed(unit)}</select></div>
   <div class="field"><label>Đăng ký</label><select id="mealChoice"><option value="Có ăn">Có ăn</option><option value="Không ăn">Không ăn</option></select></div>
   <div class="field"><label>Ghi chú</label><input id="mealNote" placeholder="Ví dụ: ăn chay... (nếu có)"></div>
   <button id="savePersonalMealBtn" class="btn primary" onclick="saveMealPersonal()">Lưu báo cá nhân</button>`;
  setTimeout(checkPersonalMealLock,0);
  return;
 }

 if(mode==='department'){
  const allowed=['head','bod','office','coord','lead'].includes(R().type);
  if(!allowed){el.innerHTML='<div class="notice">Tài khoản của bạn không có quyền báo theo phòng/bộ phận.</div>';return}
  el.innerHTML=`
   <div class="field"><label>Ngày</label><input id="mealDeptDate" type="date" value="${date}"></div>
   <div class="field"><label>Phòng / Bộ phận</label><select id="mealDeptUnit">${mealUnitOptionsAllowed(unit)}</select></div>
   <div class="formgrid">
    <div class="field"><label>Số suất ăn</label><input id="mealDeptCount" type="number" min="0" value="0"></div>
    <div class="field"><label>Số người không ăn</label><input id="mealDeptNoCount" type="number" min="0" value="0"></div>
   </div>
   <div class="field"><label>Ghi chú</label><input id="mealDeptNote" placeholder="Ví dụ: đã chốt phòng lúc 10:50"></div>
   <button class="btn primary" onclick="saveMealDepartment()">Lưu báo theo phòng/bộ phận</button>`;
  return;
 }

 el.innerHTML=`
  <div class="field"><label>Ngày</label><input id="mealGuestDate" type="date" value="${date}"></div>
  <div class="field"><label>Bộ phận tiếp khách</label><select id="mealGuestUnit">${mealUnitOptionsAllowed(unit)}</select></div>
  <div class="formgrid">
   <div class="field"><label>Số suất khách</label><input id="mealGuestCount" type="number" min="1" value="1"></div>
   <div class="field"><label>Khách / Đơn vị</label><input id="mealGuestOrg" placeholder="Ví dụ: Công ty ABC"></div>
  </div>
  <div class="field"><label>Ghi chú</label><input id="mealGuestNote" placeholder="Ví dụ: khách hướng dẫn sử dụng tủ"></div>
  <button class="btn primary" onclick="saveMealGuest()">Lưu suất khách</button>`;
}
async function checkPersonalMealLock(){
 const box=document.getElementById('personalMealLock');
 const btn=document.getElementById('savePersonalMealBtn');
 const choice=document.getElementById('mealChoice');
 const note=document.getElementById('mealNote');
 if(!box||!btn)return;
 const date=document.getElementById('mealDate')?.value;
 const unitCode=document.getElementById('mealUnitCode')?.value;
 if(!date||!unitCode)return;
 try{
  const snap=await departmentMealReport(date,unitCode);
  if(snap.exists){
   const x=snap.data(), u=mealUnit(unitCode);
   box.innerHTML=`<div class="meal-lock"><b>${escapeHtml(u.label)} đã báo tập thể.</b><br>Đã chốt ${Number(x.mealCount||0)} suất. Báo cá nhân của đơn vị này được khóa để tránh trùng dữ liệu.</div>`;
   btn.disabled=true; choice.disabled=true; note.disabled=true;
  }else{
   box.innerHTML='';
   btn.disabled=false; choice.disabled=false; note.disabled=false;
  }
 }catch(e){
  box.innerHTML='<div class="notice">Chưa kiểm tra được trạng thái báo theo phòng.</div>';
 }
}
async function saveMealPersonal(){
 const date=document.getElementById('mealDate').value;
 const unitCode=document.getElementById('mealUnitCode').value;
 if(!canUseMealUnit(unitCode))return alert('Tài khoản không được phép báo cơm cho đơn vị này.');
 const choice=document.getElementById('mealChoice').value;
 const note=document.getElementById('mealNote').value.trim();
 if(!date||!unitCode)return alert('Chọn ngày và phòng/bộ phận.');
 try{
  const dept=await departmentMealReport(date,unitCode);
  if(dept.exists)return alert(mealUnit(unitCode).label+' đã báo tập thể. Không thể báo cá nhân để tránh trùng.');
  const u=mealUnit(unitCode);
  const id=date+'_'+currentUser.uid;
  // Transitional compatibility:
  // 1) Save the private/original meal record first using current production Rules.
  // 2) Best-effort write the minimal public status. This becomes authoritative
  //    after Rules V2.1 is deployed, but MUST NOT block meal registration now.
  await db.collection('hub_meal_reports').doc(id).set({
   reportType:'personal',date,unitCode,unitLabel:u.label,parentGroup:u.parent,
   choice,note,
   userUid:currentUser.uid,userEmail:emailKey(currentUser.email),
   userName:currentUser.displayName||currentUser.email,
   role:R().label,updatedAt:FV.serverTimestamp()
  },{merge:true});

  try{
   await db.collection('hub_meal_public_status').doc(id).set({
    date,unitCode,choice,userUid:currentUser.uid,updatedAt:FV.serverTimestamp()
   },{merge:true});
  }catch(publicErr){
   // Expected while current production Rules do not yet include
   // hub_meal_public_status. Do not fail the user's meal registration.
   console.info('Meal public status pending Rules V2.1:', publicErr?.code||publicErr?.message||publicErr);
  }

  closeDrawer();loadMealCompactSummary();
 }catch(e){alert('Không lưu được báo cá nhân: '+e.message)}
}
async function saveMealDepartment(){
 if(!['head','bod','office','coord','lead'].includes(R().type))return;
 const date=document.getElementById('mealDeptDate').value;
 const unitCode=document.getElementById('mealDeptUnit').value;
 if(!canManageMealDepartment()||!canUseMealUnit(unitCode))return alert('Tài khoản không có quyền báo cơm tập thể cho đơn vị này.');
 const mealCount=Math.max(0,Number(document.getElementById('mealDeptCount').value||0));
 const noMealCount=Math.max(0,Number(document.getElementById('mealDeptNoCount').value||0));
 const note=document.getElementById('mealDeptNote').value.trim();
 if(!date||!unitCode)return alert('Chọn ngày và phòng/bộ phận.');
 const u=mealUnit(unitCode);
 try{
  await db.collection('hub_meal_department_reports').doc(mealDeptDocId(date,unitCode)).set({
   reportType:'department',date,unitCode,unitLabel:u.label,parentGroup:u.parent,
   mealCount,noMealCount,note,
   reportedByUid:currentUser.uid,reportedByEmail:emailKey(currentUser.email),
   reportedByName:currentUser.displayName||currentUser.email,
   reportedByRole:R().label,updatedAt:FV.serverTimestamp()
  },{merge:true});
  closeDrawer();loadMealCompactSummary();
 }catch(e){alert('Không lưu được báo theo phòng/bộ phận: '+e.message)}
}
async function saveMealGuest(){
 const date=document.getElementById('mealGuestDate').value;
 const unitCode=document.getElementById('mealGuestUnit').value;
 if(!canCreateGuestMeal()||!canUseMealUnit(unitCode))return alert('Tài khoản không có quyền báo suất khách cho đơn vị này.');
 const guestCount=Math.max(1,Number(document.getElementById('mealGuestCount').value||1));
 const guestOrg=document.getElementById('mealGuestOrg').value.trim();
 const note=document.getElementById('mealGuestNote').value.trim();
 if(!date||!unitCode)return alert('Chọn ngày và bộ phận tiếp khách.');
 const u=mealUnit(unitCode);
 try{
  await db.collection('hub_meal_guest_reports').add({
   reportType:'guest',date,unitCode,unitLabel:u.label,parentGroup:u.parent,
   guestCount,guestOrg,note,
   reportedByUid:currentUser.uid,reportedByEmail:emailKey(currentUser.email),
   reportedByName:currentUser.displayName||currentUser.email,
   reportedByRole:R().label,createdAt:FV.serverTimestamp(),updatedAt:FV.serverTimestamp()
  });
  closeDrawer();loadMealCompactSummary();
 }catch(e){alert('Không lưu được suất khách: '+e.message)}
}
function normalizeLegacyUnit(x){
 if(x.unitCode)return x.unitCode;
 const d=String(x.department||'').toLowerCase();
 if(d.includes('r&d'))return 'RD';
 if(d.includes('kế toán')||d.includes('ke toan'))return 'KT';
 if(d.includes('kho')||d.includes('lấy mẫu')||d.includes('lay mau'))return 'KHO';
 if(d.includes('giám đốc')||d.includes('giam doc'))return 'BGD';
 if(d.includes('chất lượng')||d.includes('chat luong'))return 'QLCL';
 if(d.includes('hành chính')||d.includes('hanh chinh')||d.includes('hcns')||d.includes('văn phòng'))return 'HCNS';
 return 'PTN';
}
async function loadMealCompactSummary(){
 const el=document.getElementById('mealCompactSummary');if(!el)return;
 const date=localDateISO();
 try{
  let personalSnap=null;
  let personalSource='public';

  // V2.1.1 compatibility:
  // Before Rules V2.1 is deployed, public status is denied by current Rules.
  // In that case only, fall back to the legacy personal collection.
  try{
   personalSnap=await db.collection('hub_meal_public_status').where('date','==',date).get();
  }catch(publicErr){
   personalSource='legacy';
   personalSnap=await db.collection('hub_meal_reports').where('date','==',date).get();
  }

  // For owner/supervisory roles, bridge same-day legacy data if the new
  // public collection is readable but still empty during migration.
  if(personalSource==='public' && personalSnap.empty && ['head','bod','coord'].includes(R().type)){
   try{
    const legacy=await db.collection('hub_meal_reports').where('date','==',date).get();
    if(!legacy.empty){personalSnap=legacy;personalSource='legacy-bridge'}
   }catch(e){}
  }

  const [deptSnap,guestSnap]=await Promise.all([
   db.collection('hub_meal_department_reports').where('date','==',date).get(),
   db.collection('hub_meal_guest_reports').where('date','==',date).get()
  ]);

  const deptByUnit={};
  deptSnap.docs.forEach(d=>{
   const x=d.data(), code=normalizeLegacyUnit(x);
   deptByUnit[code]=(deptByUnit[code]||0)+Number(x.mealCount||0);
  });

  const personalByUnit={};
  personalSnap.docs.forEach(d=>{
   const x=d.data(), code=normalizeLegacyUnit(x);
   if(deptByUnit[code]!==undefined)return;
   if(x.choice==='Có ăn')personalByUnit[code]=(personalByUnit[code]||0)+1;
  });

  const unitTotals={};
  MEAL_UNITS.forEach(u=>unitTotals[u.code]=(deptByUnit[u.code]||0)+(personalByUnit[u.code]||0));

  const guestDocs=guestSnap.docs.map(d=>d.data());
  const guestTotal=guestDocs.reduce((s,x)=>s+Number(x.guestCount||0),0);
  const guestNames=[...new Set(guestDocs.map(x=>String(x.guestOrg||'').trim()).filter(Boolean))];

  const ptn=unitTotals.PTN||0;
  const rd=unitTotals.RD||0;
  const hcns=unitTotals.HCNS||0, kt=unitTotals.KT||0, kho=unitTotals.KHO||0;
  const office=hcns+kt+kho;
  const bgd=unitTotals.BGD||0;
  const qlcl=unitTotals.QLCL||0;
  const total=ptn+rd+office+bgd+qlcl+guestTotal;

  const guestText=guestTotal
    ? `Khách: ${guestTotal}${guestNames.length?' ('+guestNames.map(escapeHtml).join(', ')+')':''}`
    : 'Khách: 0';

  el.innerHTML=`
   <div class="meal-total">Tổng ${total} suất</div>
   <div class="meal-breakdown">
    PTN: <b>${ptn}</b> ·
    R&D: <b>${rd}</b> ·
    Khối Văn phòng: <b>${office}</b>
      (HCNS/Hành chính: ${hcns}; Lấy mẫu-Kho: ${kho}; Kế toán: ${kt}) ·
    Ban Giám đốc: <b>${bgd}</b> ·
    Bộ phận QLCL: <b>${qlcl}</b> ·
    ${guestText}
   </div>`;
 }catch(e){
  el.innerHTML='<div class="meta" style="margin-top:7px">Không tải được tổng hợp: '+escapeHtml(e.message)+'</div>';
 }
}
function mealReminderKey(){return 'hub_meal_reminder_'+localDateISO()}
function enableMealReminder(){
 if(!('Notification' in window))return alert('Trình duyệt này không hỗ trợ thông báo hệ thống.');
 Notification.requestPermission().then(p=>{
  if(p==='granted'){
   localStorage.setItem('hub_meal_reminder_enabled','1');
   alert('Đã bật nhắc báo cơm lúc 10:55 khi HUB/PWA đang hoạt động.');
   setupMealReminder();
  }else alert('Chưa cấp quyền thông báo.');
 });
}
function setupMealReminder(){
 if(window.__mealReminderTimer)clearTimeout(window.__mealReminderTimer);
 const now=new Date(), target=new Date(now);
 target.setHours(10,55,0,0);
 if(now>=target)return;
 window.__mealReminderTimer=setTimeout(checkAndNotifyMeal,target-now);
}
async function checkAndNotifyMeal(){
 if(sessionStorage.getItem(mealReminderKey()))return;
 sessionStorage.setItem(mealReminderKey(),'1');
 let already=false;
 try{
  const date=localDateISO();
  const personal=await db.collection('hub_meal_reports').doc(date+'_'+currentUser.uid).get();
  if(personal.exists)already=true;
  if(!already){
   const code=defaultMealUnitCode();
   const dept=await departmentMealReport(date,code);
   if(dept.exists)already=true;
  }
 }catch(e){}
 if(already)return;
 const msg='10:55 - Bạn hoặc đơn vị của bạn chưa đăng ký cơm trưa hôm nay.';
 alert(msg);
 if(localStorage.getItem('hub_meal_reminder_enabled')==='1' && 'Notification' in window && Notification.permission==='granted'){
  try{new Notification('HUB-PTN • Nhắc báo cơm',{body:msg,tag:'hub-meal-'+localDateISO()});}catch(e){}
 }
}

function renderQuality(){
 if(!canSpace('quality'))return denied();
 const canCreate=R().type==='head';
 setTimeout(loadQualityHandoffs,0);
 return head('PTN-Bộ phận Quản lý chất lượng','Không gian bàn giao hồ sơ đã khóa từ PTN sang đầu mối Quản lý chất lượng.',
 canCreate?'<button class="btn primary" onclick="openQualityHandoff()">+ Chuyển hồ sơ sang QLCL</button>':'')+`
 <div class="warn-structure"><b>Trạng thái nhân sự: Chưa gán người phụ trách chính thức.</b><br>Không gian được tạo sẵn để Ban Giám đốc phân định đúng người, trách nhiệm và quyền hạn; việc có không gian trên HUB không đồng nghĩa đã có quyết định bổ nhiệm.</div>
 <div class="panel" style="margin-top:14px"><div class="ph"><h3>NGUYÊN TẮC KIỂM SOÁT HỒ SƠ</h3></div><div style="padding:12px">
  <div class="workflow">
   <div class="step"><b>1. PTN</b><br>Phiếu/Data gốc → bản ghi hiện trường → VERIFY/LOCK → phê duyệt kỹ thuật PTN.</div><div class="arr">→</div>
   <div class="step"><b>2. PDF-HFI</b><br>Đóng gói bản ghi chuẩn của PTN. HUB chỉ lưu mã/reference/deep-link.</div><div class="arr">→</div>
   <div class="step"><b>3. QLCL</b><br>Kiểm tra tính đầy đủ, biểu mẫu, truy vết; không tự sửa số liệu kỹ thuật đã khóa.</div><div class="arr">→</div>
   <div class="step"><b>4. Hồ sơ trả khách</b><br>Lập Biên bản thử nghiệm/hồ sơ phát hành từ nguồn PTN đã khóa theo mẫu Công ty.</div><div class="arr">→</div>
   <div class="step"><b>5. Phê duyệt phát hành</b><br>GĐĐH/người được ủy quyền theo thẩm quyền Công ty.</div>
  </div>
 </div></div>
 <div class="notice"><b>Điểm bảo vệ PTN:</b> nếu QLCL phát hiện sai/thiếu kỹ thuật, hồ sơ phải trả lại PTN bằng bản ghi truy vết; QLCL không sửa âm thầm Data gốc hoặc nội dung kỹ thuật đã LOCK.</div>
 <div class="notice"><b>ISO/IEC 17025:</b> cấu trúc này hỗ trợ phân tách trách nhiệm, tính toàn vẹn dữ liệu và truy vết. Việc đáp ứng/công nhận ISO/IEC 17025 còn phụ thuộc quy trình, thẩm quyền, năng lực và hệ thống tài liệu được Công ty phê duyệt.</div>
 <div class="panel"><div class="ph"><h3>HỒ SƠ BÀN GIAO SANG QLCL</h3></div><div id="qualityHandoffs"><div style="padding:12px">Đang tải...</div></div></div>
 `;
}
function openQualityHandoff(){
 if(R().type!=='head')return;
 document.getElementById('drawerSmall').textContent='BÀN GIAO PTN → QLCL';
 document.getElementById('drawerTitle').textContent='Chuyển hồ sơ đã khóa';
 document.getElementById('drawerBody').innerHTML=`
  <div class="notice"><b>Không upload/copy hồ sơ thử nghiệm vào HUB.</b> Chỉ lưu reference tới nguồn chính thức trong Webapp Điều hành PTN.</div>
  <div class="field"><label>Mã YCTN / mã hồ sơ</label><input id="qhCode" placeholder="Ví dụ: 260730-TN-03"></div>
  <div class="field"><label>Tên/diễn giải</label><input id="qhTitle" placeholder="Ví dụ: PDF-HFI — Tủ trung tâm TX7008-6"></div>
  <div class="field"><label>Deep-link / đường dẫn nguồn</label><input id="qhUrl" placeholder="Link tới hồ sơ trong Điều hành PTN (nếu có)"></div>
  <div class="field"><label>Ghi chú bàn giao</label><textarea id="qhNote" placeholder="Phạm vi cần QLCL kiểm tra/đóng gói"></textarea></div>`;
 document.getElementById('drawerFoot').innerHTML='<button class="btn" onclick="closeDrawer()">Hủy</button><button class="btn primary" onclick="saveQualityHandoff()">Chuyển sang QLCL</button>';
 openDrawer();
}
async function saveQualityHandoff(){
 const refCode=document.getElementById('qhCode').value.trim();
 const title=document.getElementById('qhTitle').value.trim();
 const sourceUrl=document.getElementById('qhUrl').value.trim();
 const note=document.getElementById('qhNote').value.trim();
 if(!refCode||!title){alert('Cần nhập mã hồ sơ và tên/diễn giải.');return}
 try{
  await db.collection('hub_quality_handoffs').add({
   refCode,title,sourceUrl,note,
   sourceType:'PDF-HFI',
   status:'Mới chuyển',
   createdByUid:currentUser.uid,
   createdByEmail:emailKey(currentUser.email),
   createdByName:currentUser.displayName||currentUser.email,
   createdAt:FV.serverTimestamp(),
   updatedAt:FV.serverTimestamp()
  });
  closeDrawer();loadQualityHandoffs();
 }catch(e){alert('Không chuyển được hồ sơ: '+e.message)}
}
async function loadQualityHandoffs(){
 const el=document.getElementById('qualityHandoffs');if(!el)return;
 try{
  const snap=await db.collection('hub_quality_handoffs').orderBy('updatedAt','desc').limit(50).get();
  if(snap.empty){el.innerHTML='<div style="padding:12px" class="meta">Chưa có hồ sơ bàn giao.</div>';return}
  el.innerHTML='<div class="handoff-row header"><div>Mã</div><div>Hồ sơ</div><div>Trạng thái</div><div>Cập nhật</div></div>'+
   snap.docs.map(d=>{const x=d.data();return `<div class="handoff-row"><div><b>${escapeHtml(x.refCode)}</b></div><div><b>${escapeHtml(x.title)}</b><div class="meta">Nguồn: PDF-HFI${x.sourceUrl?' • Có deep-link':''}</div></div><div>${badge(escapeHtml(x.status),x.status==='Đã tiếp nhận'?'blue':'')}</div><div>${escapeHtml(fmtTs(x.updatedAt))}</div></div>`}).join('');
 }catch(e){el.innerHTML='<div style="padding:12px">Không tải được: '+escapeHtml(e.message)+'</div>'}
}

function generic(title,sub,key){
 if(key&&!canSpace(key))return denied();
 return head(title,sub)+accessNote()+`<div class="panel"><div class="list"><div class="item"><div class="title">Nội dung đang xử lý</div><div class="meta">Có trạng thái • người phụ trách • deadline • audit</div></div></div></div>`;
}
function denied(){return head('Không có quyền truy cập','Không gian này không thuộc phạm vi quyền hiện tại.')+`<div class="card" style="padding:22px"><b>Quyền truy cập bị từ chối</b><p style="color:#667085">HUB không hiển thị nội dung nếu người dùng không có membership hoặc lời mời hợp lệ.</p></div>`}
function render(page){
 if(['rnd','office','hr','quality','bod'].includes(page)){
   if(!canSpace(page==='hr'?'office':page))return denied();
   const content=HUB_INTERDEPT.render(page);
   return page==='rnd'?HUB_CHAT.wrap(content):content;
 }
 if(page==='desk')return renderDesk();
 if(page==='groups')return renderGroups();
 if(page==='commonRoom')return renderCommonRoom();
 if(page==='ptn')return renderPTN();
 if(page==='tasks')return renderTasks();
 if(page==='pinned')return renderPinned();
 if(page==='common')return renderCompanyCommon();
 if(page==='rnd')return generic('PTN ↔ R&D','Không gian kỹ thuật riêng.','rnd');
 if(page==='office')return renderOffice();
 if(page==='quality')return renderQuality();
 if(page==='bod')return generic('PTN ↔ Ban Giám đốc','Vấn đề trình, quyết định, kết luận và theo dõi.','bod');
 return renderDesk();
}
function applyMenu(){
 document.querySelectorAll('[data-space]').forEach(b=>b.style.display=canSpace(b.dataset.space)?'flex':'none');
}
function nav(page){
 document.querySelectorAll('.nav button[data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===page));
 HUB_CHAT.stop();
 document.getElementById('content').innerHTML=render(page);
 if(page==='rnd')HUB_CHAT.hydrate();
 if(innerWidth<821)document.getElementById('sidebar').classList.remove('open');
}
function openReminder(){
 document.getElementById('drawerSmall').textContent='NHẮC VIỆC CÁ NHÂN';
 document.getElementById('drawerTitle').textContent='Hẹn nhắc trên thiết bị này';
 document.getElementById('drawerBody').innerHTML=`
  <div class="notice"><b>Phạm vi Foundation:</b> nhắc cục bộ trên trình duyệt/thiết bị hiện tại. Chưa đồng bộ đa thiết bị và chưa phải Web Push khi trình duyệt đã đóng.</div>
  <div class="field"><label>Nội dung</label><input id="remText" value="Kiểm tra việc cần xử lý"></div>
  <div class="field"><label>Thời điểm</label><input id="remAt" type="datetime-local"></div>
  <div class="field"><label>Mức độ</label><select id="remLevel"><option>Trung bình</option><option>Cao</option><option>Thấp</option></select></div>`;
 document.getElementById('drawerFoot').innerHTML=`<button class="btn" onclick="closeDrawer()">Hủy</button><button class="btn primary" onclick="saveLocalReminder()">Lưu nhắc</button>`;
 openDrawer();
}
async function saveLocalReminder(){
 const text=document.getElementById('remText')?.value.trim();
 const at=document.getElementById('remAt')?.value;
 const level=document.getElementById('remLevel')?.value||'Trung bình';
 if(!text||!at)return alert('Cần nhập nội dung và thời điểm.');
 const when=new Date(at).getTime();
 if(!Number.isFinite(when)||when<=Date.now())return alert('Thời điểm nhắc phải ở tương lai.');
 const key='hub_local_reminders_'+(currentUser?.uid||'local');
 const arr=JSON.parse(localStorage.getItem(key)||'[]');
 arr.push({id:Date.now(),text,at,level});
 localStorage.setItem(key,JSON.stringify(arr.slice(-50)));
 if('Notification' in window && Notification.permission==='default'){
   try{await Notification.requestPermission()}catch(e){}
 }
 scheduleLocalReminder({text,at});
 closeDrawer();
 alert('Đã lưu nhắc trên thiết bị này.');
}
function scheduleLocalReminder(r){
 const delay=new Date(r.at).getTime()-Date.now();
 if(delay<=0||delay>2147483647)return;
 setTimeout(()=>{
   if('Notification' in window && Notification.permission==='granted'){
     try{new Notification('HUB-PTN • Nhắc việc',{body:r.text,tag:'hub-reminder-'+r.at})}catch(e){}
   }else alert('Nhắc việc HUB-PTN: '+r.text);
 },delay);
}
function restoreLocalReminders(){
 if(!currentUser)return;
 const key='hub_local_reminders_'+currentUser.uid;
 try{
   const arr=JSON.parse(localStorage.getItem(key)||'[]');
   arr.filter(r=>new Date(r.at).getTime()>Date.now()).forEach(scheduleLocalReminder);
 }catch(e){}
}
function openDrawer(){document.getElementById('drawer').classList.add('open');document.getElementById('overlay').classList.add('show')}
function closeDrawer(){document.getElementById('drawer').classList.remove('open');document.getElementById('overlay').classList.remove('show')}
document.querySelectorAll('.nav button[data-page]').forEach(b=>b.onclick=()=>nav(b.dataset.page));
document.getElementById('menuBtn').onclick=()=>{document.getElementById('sidebar').classList.toggle('open');document.getElementById('overlay').classList.toggle('show')};
document.getElementById('overlay').onclick=()=>{closeDrawer();document.getElementById('sidebar').classList.remove('open')};
// Menu/render chính được kích hoạt sau khi Firebase xác thực và nạp quyền.

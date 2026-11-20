'use strict';
const {directory}=require('./accounts');
const profiles={
 director:['Giám đốc','BGĐ',['ptn','pkt','qlcl','office','sampling','warehouse'],['management']],
 ptn:['Trưởng phòng Thử nghiệm','PTN',['lead','pkt','qlcl','office','sampling','warehouse','director'],['testing']],
 pkt:['Trưởng phòng Kỹ thuật','PKT',['engineer','ptn','qlcl','office','director'],['equipment']],
 engineer:['Kỹ sư trực','PKT',['pkt','ptn','director'],[]],
 qlcl:['Trưởng phòng QLCL','QLCL',['ptn','pkt','office','sampling','director'],['quality']],
 office:['Phụ trách HCNS','HCNS',['ptn','qlcl','sampling'],['records']],
 warehouse:['Phụ trách Kho','Kho',['ptn','office','sampling'],['records']],
 sampling:['Phụ trách Lấy mẫu','Lấy mẫu',['ptn','qlcl','office'],['records']],
 lead:['Trưởng nhóm','PTN',['ptn'],[]], staff:['Thử nghiệm viên','PTN',['lead'],[]],
 admin:['Quản trị kỹ thuật','CNTT',[],[]],accounts:['Quản trị tài khoản','HCNS',[],[]],viewer:['Người chỉ xem','BGĐ',[],[]]
};
async function provision(db,auth,prefix){
const unitList=[...new Set(Object.values(profiles).map(p=>p[1]))];
for(const [key,[title,unit,routes,scopes]] of Object.entries(profiles)){
  const uid=prefix+key;
  try{await auth.getUser(uid);}catch(e){if(e.code!=='auth/user-not-found')throw e;await auth.createUser({uid,displayName:title});}
  const ref=db.collection('hub_v3_members').doc(uid);
  if((await ref.get()).exists)continue;
  const business=!['admin','accounts','viewer'].includes(key);
  const mgr=key==='accounts',reviewer={engineer:'pkt',staff:'ptn',lead:'ptn'}[key]||key;
  const m={active:true,name:title,title,unit,group:'',rev:1,canReport:business,canHandle:business&&key!=='staff',
    canClose:business&&!['staff','lead','engineer'].includes(key),mayPause:['ptn','pkt','lead','engineer'].includes(key),
    canDecide:scopes.length>0,scopes,delegation:null,overview:['director','viewer'].includes(key),canCoordinate:key==='director',technical:key==='admin',
    manageAccounts:mgr,manageUnits:mgr?unitList:[],grantScopes:mgr?['testing','equipment','management','quality','records']:[],
    unitLead:business&&!['staff','lead','engineer'].includes(key),routes:routes.map(x=>prefix+x),
    emergencyRoutes:['staff','lead'].includes(key)?['pkt','ptn','director'].map(x=>prefix+x):[],reviewerUid:business?prefix+reviewer:''};
  const batch=db.batch();batch.create(ref,m);batch.set(db.collection('hub_v3_directory').doc(uid),directory(m));await batch.commit();
}
}
module.exports={provision,profiles};

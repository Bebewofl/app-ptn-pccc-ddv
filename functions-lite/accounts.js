'use strict';
const {need,text,uid,rid,scopes,unique,snapshot}=require('./domain');
const {get,active,profile,members,now,Timestamp}=require('./data');
function manages(m,unit){return m.manageAccounts===true && (m.manageUnits||[]).includes(unit);}
function directory(m){return {name:m.name,title:m.title,unit:m.unit,active:m.active,canHandle:m.canHandle,unitLead:!!m.unitLead,scopes:m.scopes||[], delegation:m.delegation || null};}
function checkedList(v,limit=50){need(Array.isArray(v)&&v.length<=limit,'Danh sách vượt giới hạn.');return unique(v.map(uid));}
async function list(db,id){
  const m=await active(db,id);need(m.manageAccounts,'Ngoài quyền quản trị tài khoản.',403);
  const [all,logs]=await Promise.all([members(db).get(),db.collection('hub_v3_access_events').orderBy('at','desc').get()]);
  return {profiles:all.docs.filter(s=>manages(m,s.data().unit)).map(s=>({...s.data(),uid:s.id})),
    events:logs.docs.map(s=>s.data()).filter(e=>manages(m,e.after.unit)&&(!e.before || manages(m,e.before.unit))).slice(0,100)};
}
async function save({db,auth},id,input){
  const target=uid(input.uid),key=rid(input.requestId), reason=text(input.reason,500,true);
  const initial=await active(db,id);need(target!==id && initial.manageAccounts,'Không được tự sửa quyền hoặc quản trị ngoài phạm vi.',403);
  const found=await auth.getUser(target).catch(()=>null);need(found,'Chưa tìm thấy định danh trong hệ thống đăng nhập Test.');
  const ref=members(db).doc(target),event=db.collection('hub_v3_access_events').doc(id+'_'+key);
  return db.runTransaction(async tx=>{
    const mgr=await active(db,id,tx), s=await tx.get(ref),old=s.data()||null,prior=await tx.get(event);
    const unit=text(input.unit,60,true);
    need(manages(mgr,unit)&&(!old||manages(mgr,old.unit))&&!old?.manageAccounts&&!old?.technical,'Ngoài phạm vi quản trị được giao.',403);
    if(prior.exists){need(prior.data().target===target,'Lần gửi đã được sử dụng.',409);return {ok:true};}
    need((old?.rev||0)===input.rev,'Quyền vừa thay đổi. Tải lại danh sách.',409);
    const selected=checkedList(input.scopes||[],5);
    need(selected.every(k=>scopes.includes(k)&&(mgr.grantScopes||[]).includes(k)),'Lĩnh vực vượt phạm vi được phép cấp.',403);
    const routes=checkedList(input.routes || []),emergencyRoutes=checkedList(input.emergencyRoutes||[]);
    const reviewer=input.reviewerUid?uid(input.reviewerUid):'';
    for(const who of unique([...routes,...emergencyRoutes,reviewer])){
      const other=who===target?input:await profile(db,who,tx);
      need(other?.active!==false && !!other && (who!==reviewer || other.canClose) && (!(routes.includes(who)||emergencyRoutes.includes(who)) || (who!==target&&other.canHandle)), 'Kiểm tra tuyến và người xác nhận đang hoạt động.');
    }
    if(input.canReport)need(!!reviewer,'Người báo cáo cần một đầu mối xác nhận.');
    let delegation=null;
    if(input.delegation){
      const d=input.delegation,from=uid(d.from),donor=await profile(db,from,tx);
      need(from!==target && donor?.active && manages(mgr,donor.unit) && donor.scopes?.includes(d.scope) && mgr.grantScopes?.includes(d.scope),'Không có căn cứ ủy quyền trong phạm vi.',403);
      need(Number.isSafeInteger(d.until)&& d.until>Date.now() && d.until<=Date.now()+366*86400000,'Hạn ủy quyền không hợp lệ.');
      delegation={from,scope:d.scope,until:Timestamp.fromMillis(d.until)};
    }
    const m={active:input.active===true,name:text(input.name,100,true),unit,title:text(input.title,100,true),group:old?.group||'',
      routes,emergencyRoutes,reviewerUid:reviewer,scopes:selected,delegation,rev:(old?.rev||0)+1,
      canReport:input.canReport===true,canHandle:input.canHandle===true,canClose:input.canClose===true,mayPause:input.mayPause===true,
      canDecide:selected.length>0||!!delegation,overview:old?.overview===true,unitLead:input.unitLead===true,
      manageAccounts:false,technical:false};
    tx.set(ref,m);tx.set(db.collection('hub_v3_directory').doc(target),directory(m));
    tx.create(event,{actor:snapshot(id,mgr),target,reason,before:old,after:m,at:now()});
    return {ok:true};
  });
}
module.exports={list,save,directory};

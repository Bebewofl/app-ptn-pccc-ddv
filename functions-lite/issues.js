'use strict';
const { need, text, uid, rid, code, issueCode, states, scopes, priorities, unique, canRead, checkTarget, allowed, flagValues, transition } = require('./domain');
const {active,profile,caseData,cases,record,now,Timestamp} = require('./data');
function visible(m,id,c) { need(canRead(m,id,c),'Hồ sơ không tồn tại hoặc ngoài phạm vi tài khoản.',404); }
function summary(c,id,m) {
  const {readers, ...row}=c;
  return {...row, involved:readers.includes(id), actions:allowed(m,id,c)};
}
async function workspace(db,id) {
  const m = await active(db,id), ref=cases(db);
  const qs=[ref.where('readers','array-contains',id).get()];
  if(m.overview) qs.push(ref.where('restricted','==',false).get());
  const [directory,seen,...views]=await Promise.all([db.collection('hub_v3_directory').get(), db.collection('hub_v3_members').doc(id).collection('seen').get(),...qs]);
  const rows=new Map();
  for(const view of views) for(const d of view.docs) rows.set(d.id,summary(d.data(),id,m));
  return {member:{...m,uid:id}, directory:directory.docs.map(d=>({...d.data(),id:d.id})), cases:[...rows.values()],
    seen:Object.fromEntries(seen.docs.map(d=>[d.id,d.data().rev]))};
}
function needsReplacement(c,person){
  if(!c.nextUid || c.status===states.closed)return false;
  if(!person?.active)return true;
  if(c.status===states.done)return !person.canClose;
  if(c.status===states.decision)return !person.effectiveScopes?.includes(c.decisionScope);
  return [states.new,states.work].includes(c.status)&&!person.canHandle;
}
function mayReplace(m,id,c){return (m.canCoordinate===true|| (c.reviewerUid===id && m.canClose))&&c.status!==states.closed;}
async function detail(db,id,key) {
  const m=await active(db,id), c=await caseData(db,code(key)); visible(m,id,c);
  const ref=cases(db).doc(key);
  const [events,files]=await Promise.all([ref.collection('events').orderBy('rev').get(),ref.collection('files').get()]);
  const row=summary(c,id,m);
  if(mayReplace(m,id,c) && c.nextUid && needsReplacement(c,await profile(db,c.nextUid)))row.actions.push('handover');
  return {issue:row, events:events.docs.map(d=>d.data()), files:files.docs.filter(d=>d.data().state==='ready'||d.data().uploader===id).map(d=>({...d.data(),id:d.id}))};
}
async function create(db,id,input) {
  need(!['reporterUid','sourceUnit','actorUid','readers','status'].some(k=>Object.hasOwn(input,k)),'Danh tính và trạng thái do hệ thống ghi nhận.',403);
  const key=rid(input.requestId), target=uid(input.target), issue=issueCode(id,key), ref=cases(db).doc(issue);
  return db.runTransaction(async tx=>{
    const m=await active(db,id,tx);
    need(m.canReport,'Tài khoản chưa được cấp quyền báo cáo.',403);
    const old=await tx.get(ref);
    if(old.exists){need(old.data().reporterUid===id && old.data().createRequest===key,'Mã vấn đề trùng. Gửi lại bằng biểu mẫu mới.',409);return {code:issue};}
    const severity=input.severity || priorities[0];
    need(priorities.includes(severity),'Mức độ ưu tiên không hợp lệ.');
    const to=await profile(db,target,tx);
    checkTarget(m,id,target,to,severity);
    const reviewer=m.reviewerUid && await profile(db,m.reviewerUid,tx);
    need(reviewer?.active && reviewer.canClose,'Cần cấu hình người xác nhận đang hoạt động.',409);
    const collaborators=[];
    if(input.invite){const who=uid(input.invite); const invited=await profile(db,who,tx);checkTarget(m,id,who,invited,severity);if(who!==target)collaborators.push(who);}
    const domain=input.domain || (to.scopes?.length===1?to.scopes[0]:'management');
    need(scopes.includes(domain),'Lĩnh vực không hợp lệ.');
    let deadline=null;
    if(input.deadline){need(Number.isSafeInteger(input.deadline)&&input.deadline>0&&input.deadline<4102444800000,'Hạn phản hồi không hợp lệ.');deadline=Timestamp.fromMillis(input.deadline);}
    const refs={};for(const k of ['yctn','model','customer','station'])refs[k]=text(input.references?.[k],160);
    const flags=flagValues(input.flags);flags.paused=false;
    const d={code:issue,createRequest:key,title:text(input.title,160,true),body:text(input.body,4000,true),severity,
      domain,flags,deadline,references:refs,reference:Object.values(refs).filter(Boolean).join(' · '),
      restricted:input.restricted===true, reporterUid:id,reporterName:m.name,reporterTitle:m.title,sourceUnit:m.unit,sourceGroup:m.group||'',
      ownerUid:target,ownerUnit:to.unit,ownerName:to.name,nextUid:target,reviewerUid:m.reviewerUid,collaborators,
      readers:unique([id,target,m.reviewerUid,...collaborators]),status:states.new,inviteRevisions:Object.fromEntries(collaborators.map(who=>[who,1])),coordinationReplies:{},actorUid:id,lastAction:'create',lastNote:'',lastBasis:'',createdAt:now()};
    record(tx,ref,null,d,id,m,key);
    return {code:issue};
  });
}
async function act(db,id,input) {
  need(!['actorUid','ownerUid','nextUid','reviewerUid','readers','status'].some(k=>Object.hasOwn(input,k)),'Danh tính và trạng thái do hệ thống ghi nhận.',403);
  const ref=cases(db).doc(code(input.code)), key=rid(input.requestId);
  return db.runTransaction(async tx=>{
    const m=await active(db,id,tx), c=await caseData(db,ref.id,tx);
    visible(m,id,c);
    const prior=await tx.get(ref.collection('events').doc(key));
    if(prior.exists){need(prior.data().actorUid===id && prior.data().action===input.action,'Mã thao tác đã được sử dụng.',409);return {code:ref.id,rev:prior.data().rev};}
    need(input.rev===c.rev,'Vấn đề vừa được cập nhật. Mở lại để xem phiên bản mới.',409);
    const people={};
    if(input.target){const who=uid(input.target);people[who]=await profile(db,who,tx);}
    if(input.action==='report_done')people[c.reviewerUid]=await profile(db,c.reviewerUid,tx);
    let change;
    if(input.action==='handover'){
      need(mayReplace(m,id,c)&&needsReplacement(c,await profile(db,c.nextUid,tx)),'Hồ sơ vẫn có đầu mối đủ quyền hoặc ngoài phạm vi điều phối.',403);
      const target=uid(input.target), to=people[target];checkTarget(m,id,target,to,c.severity);
      const note=text(input.note,4000,true);
      change={actorUid:id,lastAction:'handover',lastNote:note,lastBasis:'',readers:unique([...c.readers,target,id]),nextUid:target};
      if(c.status===states.done){need(to.canClose,'Người thay thế cần quyền xác nhận.',403);change.reviewerUid=target;}
      else if(c.status===states.decision){need(to.effectiveScopes.includes(c.decisionScope),'Người thay thế thiếu quyền quyết định.',403);}
      else if(c.status!==states.more){Object.assign(change,{ownerUid:target,ownerUnit:to.unit,ownerName:to.name,status:states.new});}
    }else change=transition(c,m,id,input,people);
    const rev=record(tx,ref,c,change,id,m,key,input.target?{target:{uid:input.target,name:people[input.target]?.name||'',unit:people[input.target]?.unit||''}}:{});
    return {code:ref.id,rev};
  });
}
async function seen(db,id,input) {
  const ref=cases(db).doc(code(input.code)), mine=db.collection('hub_v3_members').doc(id).collection('seen').doc(ref.id);
  await db.runTransaction(async tx=>{const m=await active(db,id,tx), c=await caseData(db,ref.id,tx);visible(m,id,c);
    const old=await tx.get(mine);need(Number.isInteger(input.rev)&&input.rev>0&&input.rev<=c.rev,'Mốc đã đọc không hợp lệ.');
    if((old.data()?.rev || 0)<input.rev)tx.set(mine,{rev:input.rev,at:now()});});
  return {ok:true};
}
module.exports={workspace,detail,create,act,seen,visible};

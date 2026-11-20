'use strict';
const {AsyncLocalStorage}=require('node:async_hooks');
const {need,uid}=require('./domain');
const context=new AsyncLocalStorage();
function auditPrincipal(id){return context.getStore()?.principal||id;}
function validRole(id,local){return new RegExp('^'+(local?'demo':'pilot')+'-[a-z]{2,20}$').test(id);}
async function access(db,principal,tx){
  const ref=db.collection('hub_v3_pilot_access').doc(principal);
  const data=(await (tx?tx.get(ref):ref.get())).data();
  return data?.active===true&&Array.isArray(data.roles)?data.roles:[];
}
async function session(db,principal,local){
  const roles=(await access(db,principal)).filter(r=>validRole(r,local));
  const docs=roles.length?await db.getAll(...roles.map(r=>db.collection('hub_v3_directory').doc(r))):[];
  return {roles:docs.filter(d=>d.data()?.active).map(d=>({uid:d.id,name:d.data().name,unit:d.data().unit}))};
}
async function run(db,principal,role,local,cb){
  if(!role)return cb(principal);
  uid(role);
  need(validRole(role,local) && (await access(db,principal)).includes(role),'Vai trò thực nghiệm chưa được ủy quyền.',403);
  return context.run({principal,role},()=>cb(role));
}
async function verify(db,id,tx){
  const ctx=context.getStore();if(!ctx)return;
  need(ctx.role===id&&(await access(db,ctx.principal,tx)).includes(id),'Quyền sử dụng vai trò thực nghiệm đã bị thu hồi.',403);
}
module.exports={session,run,verify,auditPrincipal};

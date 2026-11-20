// Rules for editing the pre-created synthetic profiles. Permission changes and the
// immutable before/after snapshot use the same multi-location update.
export function accountRules({active,root,role,me,person,v,all,any,one,eq,has,val,str,bool,required,clock,deny,roleIds,domains}){
 const core=['active','canReport','canHandle','canClose','mayPause','unitLead','overview','canCoordinate','technical','manageAccounts','group','name','title','unit','rev','reviewerUid'];
 const mutable=['event','principal','updatedBy','reason'];
 const maps={routes:roleIds,emergencyRoutes:roleIds,scopes:domains};
 const administrative=all(active,eq(v(me,'manageAccounts'),'true'));
 const belongs=(unit)=>me+".child('manageUnits').child("+unit+").val() == true";
 const profileRule={
  '.write':all(administrative,'data.exists()','newData.exists()','$id != '+role,eq(v('data','technical'),'false'),eq(v('data','manageAccounts'),'false'),belongs(v('data','unit')),belongs(v('newData','unit'))),
  '.validate':all(has('newData',[...core,...mutable]),...['technical','manageAccounts','overview','canCoordinate','group'].map(k=>eq(v('newData',k),v('data',k))),"!newData.child('manageUnits').exists()","!newData.child('grantScopes').exists()",eq(v('newData','rev'),v('data','rev')+' + 1'),eq(v('newData','principal'),'auth.uid'),eq(v('newData','updatedBy'),role),v('newData','event')+".matches(/^[a-f0-9-]{36}$/)","!"+root+".child('accessEvents').child("+v('newData','event')+").exists()","newData.parent().parent().child('accessEvents').child("+v('newData','event')+").child('target').val() == $id",any(all(eq(v('newData','reviewerUid'),"''"),eq(v('newData','canReport'),'false')),all(eq(v('newData','reviewerUid'),'$id'),eq(v('newData','canClose'),'true')),all(v('newData','reviewerUid')+" != ''",v('newData','reviewerUid')+" != $id",eq(v(person(v('newData','reviewerUid')),'active'),'true'),eq(v(person(v('newData','reviewerUid')),'canClose'),'true')))),
  $other:deny
 };
 for(const key of core) profileRule[key]=bool;
 for(const key of ['group','reviewerUid','event','updatedBy','principal'])profileRule[key]=str(128);
 for(const key of ['name','title','unit'])profileRule[key]=required(100);
 profileRule.reason=required(500);profileRule.rev=val('newData.isNumber()');
 for(const [k,options] of Object.entries(maps)){
   const permitted=k==='scopes'?me+".child('grantScopes').child($key).val() == true":all('$key != $id',eq(v(person('$key'),'active'),'true'),eq(v(person('$key'),'canHandle'),'true'));
   profileRule[k]={$key:val(all(one('$key',...options),'newData.val() == true',permitted))};
 }
 const who=person(v('newData','from'));
 profileRule.delegation={'.validate':all(has('newData',['scope','from','until']),one(v('newData','scope'),...domains),v('newData','from')+' != $id',eq(v(who,'active'),'true'),belongs(v(who,'unit')),who+".child('scopes').child("+v('newData','scope')+").val() == true",me+".child('grantScopes').child("+v('newData','scope')+").val() == true",v('newData','until')+' > now',v('newData','until')+' <= now + 31622400000'),scope:str(30),from:str(128),until:val('newData.isNumber()'),$other:deny};
 const userId=v('newData','target'),o=person(userId),n="newData.parent().parent().child('profiles').child("+userId+")";
 const fields=[...core,...Object.entries(maps).flatMap(([path,ks])=>ks.map(k=>path+'/'+k)),...['scope','from','until'].map(k=>'delegation/'+k)];
 // Each leaf in the audit copy is compared even when a prior value was removed.
 const snapshot=(at,src)=>all(...fields.map(k=>eq(v('newData',at+'/'+k),v(src,k))));
 const snapshotRule={};for(const k of core)snapshotRule[k]=val(true);
 for(const [k,ks] of Object.entries(maps))snapshotRule[k]={$key:val(all(one('$key',...ks),'newData.val() == true'))};
 snapshotRule.delegation={scope:str(30),from:str(128),until:val('newData.isNumber()'),$other:deny};snapshotRule.$other=deny;
 const auditRule={'.read':administrative,$key:{
  '.write':all(administrative,'!data.exists()','newData.exists()'),
  '.validate':all(has('newData',['actor','principal','target','reason','before','after','at']),eq(v(n,'event'),'$key'),eq(v(n,'rev'),v(o,'rev')+' + 1'),eq(v(n,'principal'),'auth.uid'),eq(v('newData','principal'),'auth.uid'),eq(v('newData','actor/uid'),role),eq(v('newData','actor/name'),v(me,'name')),eq(v('newData','reason'),v(n,'reason')),snapshot('before',o),snapshot('after',n)),
  actor:{uid:str(128),name:str(100),$other:deny},principal:str(128),at:clock,reason:required(500),target:str(128),before:snapshotRule,after:snapshotRule,$other:deny
 }};
 return {profileRule,auditRule};
}

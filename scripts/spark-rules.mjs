// Generate Firebase Realtime Database rules for the independent HUB Spark pilot.
import {accountRules} from './spark-account-rules.mjs';
import {writeFile} from 'node:fs/promises';
const root="root.child('hubLite')", grants=root+".child('grants').child(auth.uid)", role=root+".child('selected').child(auth.uid).val()";
const person=id=>root+".child('profiles').child("+id+")", me=person(role);
const v=(node,path)=>node+".child('"+path+"').val()";
const active="auth != null && "+grants+".child("+role+").val() == true && "+v(me,'active')+" == true";
const route=(id,sev)=>"("+id+" != '' && "+id+" != "+role+" && "+v(person(id),'active')+" == true && "+v(person(id),'canHandle')+" == true && ("+me+".child('routes').child("+id+").val() == true || ("+sev+" == 'Khẩn cấp' && "+me+".child('emergencyRoutes').child("+id+").val() == true)))";
const scope=(id,s)=>{
 const p=person(id), donor=person(v(p,'delegation/from'));
 return "("+s+" != '' && ("+p+".child('scopes').child("+s+").val() == true || ("+v(p,'delegation/scope')+" == "+s+" && "+v(p,'delegation/until')+" > now && "+v(donor,'active')+" == true && "+donor+".child('scopes').child("+s+").val() == true)))";
};
const list=a=>"["+a.map(x=>"'"+x+"'").join(',')+"]";
const has=(n,a)=>n+".hasChildren("+list(a)+")";
const eq=(a,b)=>a+" == "+b;
const all=(...items)=>"("+items.join(" && ")+")", any=(...items)=>"("+items.join(" || ")+")";
const one=(x,...values)=>any(...values.map(t=>eq(x,"'"+t+"'")));
const val=e=>({'.validate':e}), deny=val(false), clock=val('newData.isNumber() && newData.val() == now');
const bool=val('newData.isBoolean()'), str=max=>val("newData.isString() && newData.val().length <= "+max);
const nonBlank=x=> x+".length > 0 && !"+x+".matches(/^[ \\t\\n\\r]*$/)";
const required=max=>val("newData.isString() && newData.val().length <= "+max+" && "+nonBlank('newData.val()'));
const literal=(values)=>val(one('newData.val()',...values));
const flags=['safety','quality','temporary','verifyImpact','needResume'];
const domains=['testing','equipment','quality','management','records'];
const kinds=['create','accept','respond','assign','route','invite','collaborate','supplement','supply','propose','decision_request','approve','reject','flags','pause','resume','report_done','close','continue','reopen','attach','handover'];
const baseHead=['state','owner','next','reviewer','rev','event','actor','principal','at','kind','target','scope','purpose','pauseScope','paused','needResume'];
const roleIds=['director','ptn','pkt','engineer','qlcl','office','warehouse','sampling','lead','staff','admin','accounts','viewer'].map(x=>'pilot-'+x);
const old="data.child('head')", head="newData.child('head')", source="newData.child('source')";
const o=k=>v(old,k), n=k=>v(head,k), s=k=>v(source,k);
const kind=n('kind'),target=n('target'),own=all(eq(o('owner'),role),eq(v(me,'canHandle'),'true')),next=eq(o('next'),role);
const actorCan=(...values)=>one(o('state'),...values);
function outcome(k,state,nextValue,extra,changes={}){
 const wanted={owner:o('owner'),reviewer:o('reviewer'),scope:o('scope'),purpose:o('purpose'),paused:o('paused'),pauseScope:o('pauseScope'),needResume:o('needResume'),...changes};
 return all(one(kind,...k.split(' ')),eq(n('state'),state),eq(n('next'),nextValue),...Object.entries(wanted).map(([key,value])=>eq(n(key),value)),extra);
}
const targetOK=route(target,s('severity')),targetRead="newData.child('readers').child("+target+").val() == true";
const curScope=n('scope'),initialScope=s('domain'),pauseTarget=n('pauseScope'),oldPause=o('pauseScope');
const flagsInput="newData.child('events').child("+n('event')+").child('flags/needResume').val() == true";
const mayResume=all(any(eq(o('paused'),'true'),eq(o('needResume'),'true')),one(oldPause,'testing','equipment'),scope(role,oldPause));
const newWork=all(actorCan('work'),own,next), isReviewer=all(eq(o('reviewer'),role),eq(v(me,'canClose'),'true'));
const eventPath="newData.child('events').child("+n('event')+")";
const canReplace=any(v(person(o('next')),'active')+" != true",all(actorCan('new','work'),v(person(o('next')),'canHandle')+" != true"),all(actorCan('done'),v(person(o('next')),'canClose')+" != true"),all(actorCan('decision'),"!("+scope(o('next'),o('scope'))+")"));
const replacement=all(o('state')+" != 'closed'",any(isReviewer,eq(v(me,'canCoordinate'),'true')),canReplace,targetOK,targetRead);
const branches=[
 outcome('accept',"'work'",o('owner'),all(actorCan('new'),own,next)),
 outcome('respond propose',o('state'),o('next'),newWork),
 outcome('assign route',"'new'",target,all(actorCan('new','work'),own,next,targetOK,targetRead,any(eq(kind,"'route'"),all(actorCan('work'),eq(v(person(target),'unit'),v(me,'unit'))))),{owner:target}),
 outcome('invite',o('state'),o('next'),all(newWork,targetOK,targetRead,"!data.child('collaborators').child("+target+").exists()","newData.child('collaborators').child("+target+").val() == true")),
 outcome('collaborate',o('state'),o('next'),all(o('state')+" != 'closed'","data.child('collaborators').child("+role+").val() == true",eq(v(me,'canHandle'),'true'),o('owner')+" != "+role)),
 outcome('supplement',"'more'",s('reporter'),newWork),
 outcome('supply',"'work'",o('owner'),all(actorCan('more'),next)),
 outcome('decision_request',"'decision'",target,all(newWork,targetOK,targetRead,scope(target,curScope),one(curScope,...domains),any(all(eq(n('purpose'),"'general'"),any(eq(curScope,initialScope),eq(curScope,"'management'"))),all(eq(n('purpose'),"'resume'"),any(eq(o('paused'),'true'),eq(o('needResume'),'true')),one(oldPause,'testing','equipment'),eq(curScope,oldPause)))),{scope:curScope,purpose:n('purpose')}),
 outcome('approve reject',"'work'",o('owner'),all(actorCan('decision'),next,scope(role,o('scope'))),{paused:"(("+kind+" == 'approve' && "+o('purpose')+" == 'resume') ? false : "+o('paused')+")",needResume:"(("+kind+" == 'approve' && "+o('purpose')+" == 'resume') ? false : "+o('needResume')+")"}),
 outcome('pause',"'work'",o('owner'),all(newWork,eq(v(me,'mayPause'),'true'),eq(o('paused'),'false'),one(pauseTarget,'testing','equipment'),any("!("+one(initialScope,'testing','equipment')+")",eq(pauseTarget,initialScope))),{pauseScope:pauseTarget,paused:'true',needResume:'true'}),
 outcome('resume',"'work'",o('owner'),all(newWork,mayResume),{paused:'false',needResume:'false'}),
 outcome('flags',"'work'",o('owner'),newWork,{needResume:"("+o('needResume')+" == true || "+flagsInput+")",pauseScope:"("+oldPause+" != '' ? "+oldPause+" : ("+one(initialScope,'testing','equipment')+" ? "+initialScope+" : 'testing'))"}),
 outcome('report_done',"'done'",o('reviewer'),all(newWork,eq(o('paused'),'false'),eq(o('needResume'),'false'),eq(v(person(o('reviewer')),'active'),'true'),eq(v(person(o('reviewer')),'canClose'),'true'))),
 outcome('close',"'closed'","''",all(actorCan('done'),next,isReviewer)),
 outcome('continue',"'work'",o('owner'),all(actorCan('done'),next,isReviewer)),
 outcome('reopen',"'work'",o('owner'),all(actorCan('closed'),isReviewer)),
 outcome('attach',o('state'),o('next'),all(o('state')+" != 'closed'",any(own,next,eq(s('reporter'),role),"data.child('collaborators').child("+role+").val() == true"),"newData.parent().parent().child('files').child($code).child("+n('event')+").exists()")),
 outcome('handover',"'new'",target,all(replacement,actorCan('new','work')),{owner:target}),
 outcome('handover',o('state'),target,all(replacement,any(actorCan('more'),all(actorCan('decision'),scope(target,o('scope'))),all(actorCan('done'),eq(v(person(target),'canClose'),'true')))),{reviewer:"("+o('state')+" == 'done' ? "+target+" : "+o('reviewer')+")"})
];
const start=all(eq(kind,"'create'"),eq(n('rev'),'1'),eq(n('state'),"'new'"),eq(n('owner'),s('target')),eq(n('next'),s('target')),eq(n('reviewer'),v(me,'reviewerUid')),eq(v(person(n('reviewer')),'active'),'true'),eq(v(person(n('reviewer')),'canClose'),'true'),eq(n('scope'),"''"),eq(n('purpose'),"'general'"),eq(n('paused'),'false'),eq(n('needResume'),v(source,'flags/needResume')),eq(n('pauseScope'),"("+one(initialScope,'testing','equipment')+" ? "+initialScope+" : 'testing')"),eq(v(me,'canReport'),'true'),route(s('target'),s('severity')),eq(s('reporter'),role),eq(s('name'),v(me,'name')),eq(s('unit'),v(me,'unit')),eq(s('titleAtReport'),v(me,'title')),eq(n('target'),s('target')),eq(s('at'),'now'),"newData.child('readers').child("+role+").val() == true","newData.child('readers').child("+n('reviewer')+").val() == true","newData.child('readers').child("+s('target')+").val() == true",any(eq(s('invite'),"''"),all(route(s('invite'),s('severity')),s('invite')+" != "+s('target'),"newData.child('readers').child("+s('invite')+").val() == true","newData.child('collaborators').child("+s('invite')+").val() == true")));
const sourceFields=['reporter','name','unit','titleAtReport','at','target','invite','title','body','severity','domain','restricted','deadline','yctn','model','customer','station','flags'];
const headRule={'.write':active+' && newData.exists()','.validate':has('newData',baseHead),$other:deny};
for(const k of baseHead)headRule[k]=str(128);
Object.assign(headRule,{rev:val('newData.isNumber()'),at:clock,paused:bool,needResume:bool,kind:literal(kinds),event:val("newData.isString() && newData.val().matches(/^[a-f0-9-]{36}$/)")});
const flagRule={'.validate':has('newData',flags),...Object.fromEntries(flags.map(f=>[f,bool])),$other:deny};
const sourceRule={'.write':active+' && !data.exists() && newData.exists()','.validate':has('newData',sourceFields),$other:deny};
for(const k of sourceFields)sourceRule[k]=str(160);
Object.assign(sourceRule,{title:required(160),body:required(4000),at:clock,restricted:bool,flags:flagRule,severity:literal(['Bình thường','Quan trọng','Khẩn cấp']),domain:literal(domains),deadline:val('newData.isNumber() && newData.val() >= 0 && newData.val() < 4102444800000')});
const sn="newData.parent().parent()", eh=sn+".child('head')", ek=v(eh,'kind');
const eventFields=['id','rev','kind','actor','principal','at','name','unit','title','state','owner','next','reviewer','note','basis','flags','target','scope','purpose','paused','needResume','pauseScope','fileType','fileSize','fileHash','targetName','targetUnit'];
const eventRule={'.write':active+' && !data.exists() && newData.exists()','.validate':all(has('newData',eventFields),eq('$event',v(eh,'event')),eq(v('newData','id'),'$event'),...['rev','kind','actor','principal','at','state','owner','next','reviewer','target','scope','purpose','paused','needResume','pauseScope'].map(k=>eq(v('newData',k),v(eh,k))),eq(v('newData','name'),v(me,'name')),eq(v('newData','unit'),v(me,'unit')),eq(v('newData','title'),v(me,'title')),any(one(ek,'create','accept'),all(nonBlank(v('newData','note')))),any("!("+one(ek,'approve','reject','pause','resume')+")",all(nonBlank(v('newData','basis'))))),$other:deny};
for(const k of eventFields)eventRule[k]=str(160);
Object.assign(eventRule,{at:clock,rev:val('newData.isNumber()'),flags:flagRule,note:str(4000),basis:str(1000),paused:bool,needResume:bool});
const chosen=v(eh,'target');
const payload=sn+".parent().parent().child('files').child($code).child($event)";
Object.assign(eventRule,{fileSize:val('newData.isNumber()'),fileType:str(100),fileHash:str(64)});
eventRule['.validate']=all(eventRule['.validate'],any(all(eq(chosen,"''"),eq(v('newData','targetName'),"''"),eq(v('newData','targetUnit'),"''")),all(chosen+" != ''",eq(v('newData','targetName'),v(person(chosen),'name')),eq(v('newData','targetUnit'),v(person(chosen),'unit')))),any(all(eq(ek,"'attach'"),...['fileSize','fileHash','fileType'].map((k,i)=>eq(v('newData',k),v(payload,['size','sha256','type'][i])))),all(ek+" != 'attach'",eq(v('newData','fileSize'),'0'),eq(v('newData','fileHash'),"''"),eq(v('newData','fileType'),"''"))));
const localRead=(snap)=>any(snap+".child('readers').child("+role+").val() == true",all(eq(v(me,'overview'),'true'),eq(v(snap,'source/restricted'),'false')));
const actorActive=all(active,eq(n('actor'),role),eq(n('principal'),'auth.uid'),eq(n('at'),'now'));
const caseRules={
 '.read':all(active,localRead('data')),
 '.validate':all("$code.matches(/^VM3-[A-Z0-9]{16}$/)",actorActive,has('newData',['head','source','events','readers']),eventPath+".exists()","!data.child('events').child("+n('event')+").exists()",any(all('!data.exists()',start),all('data.exists()',localRead('data'),eq(n('rev'),o('rev')+' + 1'),any(...branches)))),
 source:sourceRule,head:headRule,events:{$event:eventRule},
 readers:{$id:{'.write':all(active,'!data.exists()','newData.val() == true'),'.validate':any(all(eq(v(eh,'kind'),"'create'"),any(...['reporter','target','invite'].map(k=>eq('$id',v(sn,'source/'+k))),eq('$id',v(eh,'reviewer')))),all(one(v(eh,'kind'),'invite','assign','route','decision_request','handover'),eq('$id',v(eh,'target'))))}},
 collaborators:{$id:{'.write':all(active,'!data.exists()','newData.val() == true'),'.validate':any(all(eq(v(eh,'kind'),"'create'"),eq('$id',v(sn,'source/invite'))),all(eq(v(eh,'kind'),"'invite'"),eq('$id',v(eh,'target'))))}},$other:deny
};
const cases=root+".child('cases').child($code)";
const newFileCase="newData.parent().parent().parent().child('cases').child($code)";
const fileFields=['name','type','size','sha256','uploader','bytes','at'];
const files={'.read':all(active,localRead(cases)),$file:{
 '.write':all(active,'!data.exists()','newData.exists()'),
 '.validate':all(has('newData',fileFields),eq(v(newFileCase,'head/event'),'$file'),eq(v(newFileCase,'head/kind'),"'attach'"),eq(v(newFileCase,'head/actor'),role),eq(v('newData','uploader'),role),eq(v(newFileCase,'head/rev'),v(cases,'head/rev')+' + 1'),eq(v('newData','name'),newFileCase+".child('events').child($file).child('note').val()"),"newData.child('bytes').val().length <= (newData.child('size').val()+2)/3*4","newData.child('bytes').val().length >= newData.child('size').val()/3*4"),
 name:required(150),type:literal(['image/png','image/jpeg','image/webp','application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']),bytes:str(6990508),size:val('newData.isNumber() && newData.val() > 0 && newData.val() <= 5242880'),sha256:val("newData.isString() && newData.val().matches(/^[a-f0-9]{64}$/)"),uploader:str(128),at:clock,$other:deny}};
const idx=['source/restricted',...roleIds.map(id=>'readers/'+id)];
const {profileRule,auditRule}=accountRules({active,root,role,me,person,v,all,any,one,eq,has,val,str,bool,required,clock,deny,roleIds,domains});
const profileRules={'.read':"auth != null && "+grants+".exists()",$id:profileRule};
const selectedRule={'.read':'auth != null && auth.uid == $uid','.write':all('auth != null','auth.uid == $uid','newData.isString()',grants+".child(newData.val()).val() == true",eq(v(person('newData.val()'),'active'),'true'))};
const rules={rules:{'.read':false,'.write':false,hubLite:{
 grants:{$uid:{'.read':'auth != null && auth.uid == $uid'}},selected:{$uid:selectedRule},profiles:profileRules,accessEvents:auditRule,
 cases:{'.indexOn':idx,'.read':all(active,any(all(any(...roleIds.map(id=>all(eq(role,"'"+id+"'"), "query.orderByChild == 'readers/"+id+"'"))),'query.equalTo == true'),all(eq(v(me,'overview'),'true'),"query.orderByChild == 'source/restricted'",'query.equalTo == false'))),$code:caseRules},
 files:{$code:files},seen:{$role:{'.read':all(active,eq('$role',role)),$code:{'.write':all(active,eq('$role',role),localRead(cases),'newData.isNumber()','newData.val() > 0','(!data.exists() || newData.val() >= data.val())','newData.val() <= '+v(cases,'head/rev'))}}}
}}};
await writeFile(new URL('../rules/database.spark.json',import.meta.url),JSON.stringify(rules,null,2)+'\n');

import {$,el,field,choices,check,extra,button,formSubmit,checked,flags,priorities,scopes,labels,selectedUid,targetChoices,safeMessage,notice} from './ui.js';
const fileAccept='.jpg,.jpeg,.png,.webp,.pdf,.docx,.xlsx';
export function chooseFiles(parent){
  return field(parent,'Ảnh hoặc tài liệu · tối đa 5 MB mỗi tệp','input','files',{type:'file',multiple:true,accept:fileAccept});
}
const inputText=(f,label,key,max=160,required=false)=>field(f,label,'input',key,{maxLength:max,required});
function flagsForm(box,current={}){
  const keys=['safety','quality','temporary','verifyImpact','needResume'];
  for(const k of keys)check(box,flags[k],k,current[k]);return keys;
}
export function reportForm(ctx){
  const {member,dir}=ctx.state, box=ctx.modal('Báo cáo vấn đề'), f=el('form');box.append(f);
  inputText(f,'Tiêu đề vấn đề *','rTitle',160,true);
  field(f,'Nội dung vấn đề *','textarea','rBody',{required:true,maxLength:4000});
  const target=field(f,'Gửi đến *','select','rTarget',{required:true});
  const more=extra(f,'Thông tin bổ sung, mức độ và tệp');
  const sev=field(more,'Mức độ ưu tiên','select','rSeverity');choices(sev,priorities.map(v=>[v,v]));
  const domain=field(more,'Lĩnh vực cần xử lý','select','domain');choices(domain,Object.entries(scopes),'Theo đầu mối tiếp nhận');
  const invite=field(more,'Mời phối hợp','select','invite');
  function refresh(){targetChoices(target,dir,member,sev.value);targetChoices(invite,dir,member,sev.value,{withUnits:false,exclude:[selectedUid(target.value)]});}
  refresh();const keys=flagsForm(more);
  const warning=el('p',safeMessage,'warning');f.insertBefore(warning,more);warning.hidden=true;
  const warn=()=>{warning.hidden=!(sev.value==='Khẩn cấp'||f.elements.safety.checked);};
  sev.onchange=()=>{refresh();warn();};f.elements.safety.onchange=warn;target.onchange=refresh;
  check(more,'Hạn chế người xem (chỉ những người tham gia)','restricted');
  for(const [key,label] of Object.entries({yctn:'Mã YCTN',model:'Model thiết bị',customer:'Khách hàng',station:'Trạm máy'}))inputText(more,label,key);
  field(more,'Hạn phản hồi','input','deadline',{type:'datetime-local'});const files=chooseFiles(more);
  const requestId=crypto.randomUUID(), fileIds=new Map();
  formSubmit(f,'Gửi báo cáo',async data=>{
    const references=Object.fromEntries(['yctn','model','customer','station'].map(k=>[k,data.get(k)]));
    const {code}=await ctx.api('create',{requestId,title:data.get('rTitle'),body:data.get('rBody'),target:selectedUid(target.value),severity:sev.value,
      invite:selectedUid(invite.value),domain:domain.value,references,flags:checked(data,keys),restricted:data.has('restricted'),
      deadline:data.get('deadline')?new Date(data.get('deadline')).getTime():null});
    try{await ctx.files(code,files.files,fileIds);}
    catch(e){notice('Đã tạo '+code+'. '+e.message+' Nhấn Gửi báo cáo để thử lại tệp.');return;}
    await ctx.refresh();await ctx.open(code);notice('Đã gửi '+code+'.');
  });
}
export function actionForm(ctx,c,action){
  const {member,dir}=ctx.state, key=crypto.randomUUID();
  const send=async v=>{await ctx.api('action',{code:c.code,rev:c.rev,requestId:key,action,...v});await ctx.refresh();await ctx.open(c.code);};
  if(action==='accept')return send({});
  const box=ctx.modal(labels[action]),f=el('form');box.append(el('p',c.code+' · '+c.title,'meta'),f);
  const n=field(f,action==='close'?'Kết luận xác nhận *':action==='report_done'?'Kết quả thực hiện *':'Nội dung hoặc lý do *','textarea','aNote',{required:true,maxLength:4000});
  let basis,target,scope,purpose,pauseScope,flagKeys=[];
  if(action==='pause' && !['testing','equipment'].includes(c.domain)){pauseScope=field(f,'Thẩm quyền kỹ thuật cho phép tiếp tục *','select','pauseScope',{required:true});choices(pauseScope,['testing','equipment'].map(k=>[k,scopes[k]]),'Chọn thẩm quyền');}
  if(action==='decision_request'&&(c.flags?.paused||c.flags?.needResume)){purpose=check(f,'Xin quyết định cho phép tiếp tục hoạt động','resumePurpose');}
  if(['approve','reject','pause','resume'].includes(action))basis=field(f,'Căn cứ quyết định *','textarea','aBasis',{required:true,maxLength:1000});
  if(action==='decision_request'){scope=field(f,'Thẩm quyền cần xin ý kiến','select','scope');choices(scope,[...new Set([c.pauseScope,c.domain||'management','management'].filter(Boolean))].map(s=>[s,scopes[s]]));}
  if(['route','assign','invite','decision_request','handover'].includes(action)){
    target=field(f,'Người nhận *','select','aTarget',{required:true});
    const update=()=>targetChoices(target,dir,member,c.severity,{assign:action==='assign',decision:scope?.value,exclude:action==='invite'?[c.ownerUid,...(c.collaborators||[])]:[]});
    update();if(scope)scope.onchange=update;
  }
  if(action==='flags')flagKeys=flagsForm(f,c.flags);
  if(['pause','resume'].includes(action))f.append(el('p','Ghi lại quyết định của người có thẩm quyền và căn cứ thực tế.','warning'));
  formSubmit(f,'Xác nhận',async data=>send({note:n.value,basis:basis?.value||'',target:selectedUid(target?.value),scope:scope?.value,pauseScope:pauseScope?.value,purpose:purpose?.checked?'resume':'general',flags:checked(data,flagKeys)}));
  f.append(button('Về hồ sơ',()=>ctx.open(c.code)));
}

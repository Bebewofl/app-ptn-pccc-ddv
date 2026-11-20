import {el,field,check,choices,extra,button,formSubmit,scopes,date} from './ui.js';
export async function adminPage(ctx,selected){
  const box=ctx.modal('Quản trị tài khoản'),token=ctx.view();box.append(el('p','Đang tải danh sách…'));
  const {profiles,events}=await ctx.api('accounts-list');
  if(ctx.view()!==token)return;box.replaceChildren();
  const mgr=ctx.state.member,dir=ctx.state.dir;
  const select=field(box,'Tài khoản','select','editAccount');
  choices(select,profiles.filter(p=>!p.manageAccounts&&!p.technical&&p.uid!==mgr.uid).map(p=>[p.uid,p.unit+' · '+p.name+(p.active?'':' (tạm khóa)')]),'Kích hoạt tài khoản đã đăng nhập Test');
  select.value=selected||'';select.onchange=()=>adminPage(ctx,select.value).catch(ctx.error);
  const p=profiles.find(r=>r.uid===selected)||{}, f=el('form');box.append(f);
  const id=field(f,'Mã tài khoản Firebase (UID) *','input','uid',{required:true,value:p.uid||'',readOnly:!!p.uid,maxLength:128});
  const name=field(f,'Tên hiển thị *','input','name',{required:true,value:p.name||'',maxLength:100});
  const unit=field(f,'Bộ phận *','select','unit',{required:true});choices(unit,mgr.manageUnits.map(s=>[s,s]));if(p.unit)unit.value=p.unit;
  const title=field(f,'Chức vụ *','input','title',{required:true,value:p.title||'',maxLength:100});
  for(const [key,label] of Object.entries({active:'Đang hoạt động',canReport:'Được báo cáo',canHandle:'Được tiếp nhận và xử lý',canClose:'Được xác nhận và đóng',mayPause:'Được ghi nhận tạm dừng',unitLead:'Đầu mối nhận theo bộ phận'}))check(f,label,key,p[key]??key==='active');
  const opt=extra(f,'Tuyến xử lý và thẩm quyền');
  const candidates=dir.filter(v=>v.active&&v.id!==p.uid);
  const listing=(label,key,people,values)=>{const s=field(opt,label,'select',key,{multiple:true,size:4});choices(s,people.map(v=>[v.id,v.unit+' · '+v.name]));for(const o of s.options)o.selected=(values||[]).includes(o.value);return s;};
  const routes=listing('Tuyến thông thường','routes',candidates.filter(r=>r.canHandle),p.routes);
  const emergency=listing('Tuyến bổ sung khi khẩn','emergencyRoutes',candidates.filter(r=>r.canHandle),p.emergencyRoutes);
  const reviewer=field(opt,'Người xác nhận kết quả','select','reviewerUid');choices(reviewer,[...dir.filter(r=>r.active).map(r=>[r.id,r.unit+' · '+r.name]),...(!p.uid?[['self','Chính tài khoản mới']]:[])],'Chưa chỉ định');reviewer.value=p.reviewerUid||'';
  for(const s of mgr.grantScopes||[])check(opt,scopes[s],'scope_'+s,p.scopes?.includes(s));
  const deleg=extra(f,'Ủy quyền có thời hạn');const from=field(deleg,'Người ủy quyền','select','from');choices(from,candidates.filter(r=>r.scopes?.length&&mgr.manageUnits.includes(r.unit)).map(r=>[r.id,r.name]),'Không ủy quyền');from.value=p.delegation?.from||'';
  const scope=field(deleg,'Lĩnh vực ủy quyền','select','delegatedScope');
  const refresh=()=>choices(scope,(dir.find(r=>r.id===from.value)?.scopes||[]).map(k=>[k,scopes[k]]));refresh();if(p.delegation)scope.value=p.delegation.scope;from.onchange=refresh;
  const until=field(deleg,'Hết hạn ủy quyền','input','until',{type:'datetime-local'});if(p.delegation?.until){const d=new Date(p.delegation.until);until.value=new Date(d-d.getTimezoneOffset()*60000).toISOString().slice(0,16);}
  const reason=field(f,'Căn cứ cấp hoặc thay đổi quyền *','textarea','reason',{required:true,maxLength:500});
  const key=crypto.randomUUID();formSubmit(f,'Lưu phân quyền',async data=>{
    const values=s=>[...s.selectedOptions].map(o=>o.value);
    await ctx.api('accounts-save',{uid:id.value.trim(),name:name.value,unit:unit.value,title:title.value,reason:reason.value,rev:p.rev||0,requestId:key,
      ...Object.fromEntries(['active','canReport','canHandle','canClose','mayPause','unitLead'].map(k=>[k,data.has(k)])),
      reviewerUid:reviewer.value==='self'?id.value.trim():reviewer.value,routes:values(routes),emergencyRoutes:values(emergency),
      scopes:(mgr.grantScopes||[]).filter(k=>data.has('scope_'+k)),delegation:from.value?{from:from.value,scope:scope.value,until:new Date(until.value).getTime()}:null});
    await ctx.refresh();await adminPage(ctx,id.value.trim());ctx.error({message:'Đã lưu phân quyền.'});
  });
  const history=extra(box,'Lịch sử thay đổi quyền');for(const e of events){const line=el('div',date(e.at)+' · '+e.actor.name+' · '+e.after.name+' · '+e.reason,'event');
    const changed=Object.keys(e.after).filter(k=>k!=='rev'&&JSON.stringify(e.before?.[k])!==JSON.stringify(e.after[k]));line.append(el('small','Phiên bản '+(e.before?.rev||0)+' → '+e.after.rev+' · '+changed.length+' thuộc tính thay đổi'));history.append(line);}
  if(!events.length)history.append(el('p','Chưa có thay đổi.'));
}

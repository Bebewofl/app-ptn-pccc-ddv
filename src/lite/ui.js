export const $=id=>document.getElementById(id);
export const pages={mine:'Việc cần tôi xử lý',overview:'Tổng quan',all:'Danh sách vấn đề',history:'Lịch sử và kết luận'};
export const statuses=['Chờ tiếp nhận','Đang xử lý','Chờ bổ sung','Chờ quyết định','Chờ xác nhận','Đã đóng'];
export const statusLabel=s=>({'Chờ bổ sung':'Chờ bổ sung hoặc phản hồi','Chờ quyết định':'Chờ quyết định hoặc xác nhận','Chờ xác nhận':'Đã xử lý – chờ đóng'})[s]||s;
export const priorities=['Bình thường','Quan trọng','Khẩn cấp'];
export const scopes={management:'Quản lý, điều phối',testing:'Chuyên môn thử nghiệm',equipment:'Kỹ thuật thiết bị',quality:'Hệ thống chất lượng',records:'Hồ sơ, giao nhận'};
export const flags={safety:'Ảnh hưởng an toàn',quality:'Có thể ảnh hưởng chất lượng',temporary:'Đã có biện pháp tạm thời',paused:'Đang tạm dừng',verifyImpact:'Cần xác minh ảnh hưởng',needResume:'Cần quyết định cho tiếp tục'};
export const labels={create:'Báo cáo vấn đề',accept:'Tiếp nhận',respond:'Phản hồi',assign:'Phân công',route:'Chuyển hoặc trả lại',invite:'Mời phối hợp',collaborate:'Gửi ý kiến phối hợp',supplement:'Yêu cầu bổ sung',supply:'Bổ sung thông tin',propose:'Đề xuất phương án',decision_request:'Yêu cầu quyết định',approve:'Chấp thuận',reject:'Không chấp thuận',flags:'Cập nhật ảnh hưởng',pause:'Ghi nhận tạm dừng',resume:'Ghi nhận cho tiếp tục',report_done:'Ghi nhận kết quả',close:'Xác nhận và đóng',continue:'Yêu cầu xử lý tiếp',reopen:'Mở lại',attach:'Đính kèm tệp'};
export const date=n=>n?new Date(n).toLocaleString('vi-VN',{dateStyle:'short',timeStyle:'short'}):'Chưa đặt';
export const late=c=>c.status!=='Đã đóng'&&c.deadline>0&&c.deadline<Date.now();
export const nextAction=c=>({'Chờ tiếp nhận':'Tiếp nhận','Đang xử lý':'Xử lý và phản hồi','Chờ bổ sung':'Bổ sung thông tin','Chờ quyết định':'Ghi quyết định','Chờ xác nhận':'Xác nhận kết quả','Đã đóng':'Đã kết thúc'})[c.status]||'Xem hồ sơ';
export const normalize=s=>String(s||'').toLocaleLowerCase('vi').normalize('NFD').replace(/\p{M}/gu,'').replace(/đ/g,'d');
export function el(tag,value,cls){const n=document.createElement(tag);if(value!=null)n.textContent=value;if(cls)n.className=cls;return n;}
export function opt(s,value,label){const o=el('option',label);o.value=value;s.append(o);return o;}
export function button(label,fn,primary=false){const b=el('button',label,primary?'primary':'');b.type='button';b.onclick=fn;return b;}
export function field(parent,title,kind,name,props={}){const label=el('label',title),n=el(kind);n.id=name;n.name=name;Object.assign(n,props);label.append(n);parent.append(label);return n;}
export function choices(s,list,first){s.replaceChildren();if(first)opt(s,'',first);for(const [v,label] of list)opt(s,v,label);}
export function check(parent,title,key,value=false){const l=el('label',null,'check'),n=el('input');n.type='checkbox';n.name=key;n.checked=value;l.append(n,document.createTextNode(title));parent.append(l);return n;}
export function extra(parent,label){const d=el('details');d.append(el('summary',label));parent.append(d);return d;}
export const safeMessage='Có nguy cơ mất an toàn. Thực hiện biện pháp an toàn và báo trực tiếp ngay theo quy trình tại chỗ.';
export function notice(s=''){($('modal').open?$('modalMsg'):$('message')).textContent=s;}
export function formSubmit(f,label,fn){const b=el('button',label,'primary');b.type='submit';f.append(b);let saving=false;
  f.onsubmit=async e=>{e.preventDefault();if(saving)return;saving=true;b.disabled=true;notice();try{await fn(new FormData(f));}catch(err){if(f.isConnected)notice(err.message);}finally{saving=false;b.disabled=false;}};}
export function checked(form,keys){return Object.fromEntries(keys.map(k=>[k,form.has(k)]));}
export function downloadBlob(blob,name){const url=URL.createObjectURL(blob),a=el('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
export function targetChoices(s,dir,member,severity,{assign=false,decision='',withUnits=true,exclude=[]}={}){
  const ids=[...(member.routes||[]),...(severity==='Khẩn cấp'?(member.emergencyRoutes||[]):[])];
  const rows=dir.filter(d=>d.active&&d.canHandle&&ids.includes(d.id)&&!exclude.includes(d.id)&&(!assign||d.unit===member.unit)&&(!decision||d.scopes?.includes(decision)||(d.delegation?.scope===decision&&d.delegation.until>Date.now())));
  const old=s.value;choices(s,[], 'Chọn bộ phận hoặc người tiếp nhận');
  if(withUnits)for(const unit of new Set(rows.map(p=>p.unit))){const leaders=rows.filter(p=>p.unit===unit&&p.unitLead);if(leaders.length===1)opt(s,'unit:'+leaders[0].id,unit+' · Đầu mối bộ phận');}
  for(const p of rows)opt(s,p.id,p.unit+' · '+p.name);if([...s.options].some(o=>o.value===old))s.value=old;
}
export const selectedUid=v=>(v||'').replace(/^unit:/,'');

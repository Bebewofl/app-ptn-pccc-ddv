/* HUB-PTN V2.2.1 — phối hợp liên phòng thực tế. Loaded after stable V2.1.1. */
(function(){
  const V22_VERSION='2.2.1';
  const RND_HEAD_EMAIL='ngocson707@gmail.com';
  const CACHE=new Map();
  const WARM=new Set();

  function esc(v){
    const s=String(v??'');
    try{if(typeof escapeHtml==='function')return escapeHtml(s)}catch(e){}
    return s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function attr(v){return esc(v).replace(/`/g,'&#96;')}
  function email(){try{return String(currentUser?.email||'').trim().toLowerCase()}catch(e){return ''}}
  function role(){try{return R()?.type||''}catch(e){return ''}}
  function isHead(){return role()==='head'}
  function hasPerm(p){
    try{if(typeof hasPermission==='function'&&hasPermission(p))return true}catch(e){}
    try{return Array.isArray(currentAccess?.permissions)&&currentAccess.permissions.includes(p)}catch(e){return false}
  }
  function isRndHead(){return role()==='rnd'&&(email()===RND_HEAD_EMAIL||hasPerm('rnd.tech.overview'))}
  function cases(){try{return Array.isArray(hubCases)?hubCases:[]}catch(e){return []}}
  function visible(){
    try{if(typeof visibleCases==='function')return visibleCases()}catch(e){}
    try{if(typeof groupCanSee==='function')return cases().filter(groupCanSee)}catch(e){}
    return cases();
  }
  function sourceUnit(c){
    if(c?.sourceUnitCode)return String(c.sourceUnitCode);
    if(c?.sourceSpace==='rnd'||c?.originUnitCode==='RD'||String(c?.sourceGroup||'')==='RND')return 'RD';
    return 'PTN';
  }
  function currentUnit(c){
    if(c?.currentUnitCode)return String(c.currentUnitCode);
    const d=String(c?.currentDesk||'');
    if(d==='R&D')return 'RD';
    if(d==='Khối Văn phòng / HCNS'||d==='HCNS')return 'HCNS';
    if(d==='Khối Văn phòng / Kế toán'||d==='Kế toán')return 'KT';
    if(d==='Khối Văn phòng / Lấy mẫu - Kho'||d==='Kho / Lấy mẫu'||d==='Lấy mẫu - Kho')return 'KHO';
    if(d==='Quản lý chất lượng')return 'QLCL';
    if(d==='Ban Giám đốc')return 'BGD';
    return 'PTN';
  }
  function unitLabel(u){return ({RD:'R&D',PTN:'PTN',HCNS:'HCNS',KT:'Kế toán',KHO:'Lấy mẫu–Kho',QLCL:'Bộ phận QLCL',BGD:'Ban Giám đốc'})[u]||u}
  function currentLabel(c){return unitLabel(currentUnit(c))}
  function completed(c){return /đã xử lý|đóng|hoàn thành/i.test(String(c?.status||''))}
  function comments(caseId){return CACHE.get(String(caseId||''))||[]}
  function responses(c){return comments(c?.id).filter(x=>x.type==='department_response')}
  function chats(c){return comments(c?.id).filter(x=>x.type==='interdept_chat')}
  function attachmentRecords(c){return comments(c?.id).filter(x=>x.type==='case_attachment')}
  function latestResponse(c){return responses(c)[0]||null}

  async function loadComments(caseId){
    const id=String(caseId||''); if(!id)return [];
    try{
      const snap=await db.collection('hub_comments').where('caseId','==',id).get();
      const rows=snap.docs.map(d=>({id:d.id,...d.data()}));
      rows.sort((a,b)=>{
        const ta=a.createdAt?.toMillis?a.createdAt.toMillis():Date.parse(a.createdAt||0)||0;
        const tb=b.createdAt?.toMillis?b.createdAt.toMillis():Date.parse(b.createdAt||0)||0;
        return tb-ta;
      });
      CACHE.set(id,rows);
      refreshStatus(id);
      return rows;
    }catch(e){
      console.warn('V2.2.1 comments read skipped',id,e?.code||e?.message||e);
      return CACHE.get(id)||[];
    }
  }
  function warm(list){
    (list||[]).forEach(c=>{
      const id=String(c.id||'');if(!id||CACHE.has(id)||WARM.has(id))return;
      WARM.add(id);setTimeout(()=>loadComments(id).finally(()=>WARM.delete(id)),0);
    });
  }

  function effectiveStatus(c){
    if(completed(c))return String(c.status||'Đã xử lý');
    const cur=currentUnit(c),src=sourceUnit(c),desk=unitLabel(cur),r=latestResponse(c),base=String(c?.status||'');
    if(r){
      const s=String(r.responseStatus||'');
      if(s==='Đang xử lý')return desk+' đang xử lý';
      if(s==='Cần PTN bổ sung thông tin')return 'Chờ PTN bổ sung thông tin';
      if(s==='Đã xử lý – chờ PTN xác nhận'||s==='Đã xử lý - chờ PTN xác nhận')return 'Chờ PTN xác nhận';
      if(s==='Đề nghị chuyển bộ phận khác')return 'Chờ Trưởng phòng điều phối lại';
    }
    if(cur==='RD'&&src==='PTN'){
      if(base==='Đã tiếp nhận'||base==='Đang xử lý')return 'R&D đang xử lý';
      return 'Chờ R&D tiếp nhận';
    }
    if(cur==='PTN'&&src==='RD'){
      if(base==='Đã tiếp nhận'||base==='Đang xử lý')return 'PTN đang xử lý';
      return 'Chờ PTN tiếp nhận';
    }
    if(cur!=='PTN'){
      if(base==='Đã tiếp nhận'||base==='Đang xử lý')return desk+' đang xử lý';
      if(cur==='BGD')return 'Chờ Ban Giám đốc quyết định';
      return 'Chờ '+desk+' tiếp nhận';
    }
    return base||'Mới';
  }
  function stage(c){
    const s=effectiveStatus(c).toLowerCase();
    if(completed(c))return 'done';
    if(s.includes('chờ ptn xác nhận'))return 'confirm';
    if(s.includes('đang xử lý')||s.includes('chờ ptn bổ sung')||s.includes('điều phối lại'))return 'work';
    return 'wait';
  }
  function cls(s){const x=String(s||'').toLowerCase();if(/đã xử lý|đóng|hoàn thành/.test(x))return'done';if(x.includes('đang xử lý'))return'work';if(x.includes('bổ sung')||x.includes('điều phối'))return'alert';return'wait'}
  function statusHtml(c){const s=effectiveStatus(c);return `<span class="v22-badge ${cls(s)}">${esc(s)}</span>`}
  function refreshStatus(id){
    const c=cases().find(x=>String(x.id)===String(id));if(!c)return;
    document.querySelectorAll(`[data-v22-status="${CSS.escape(String(id))}"]`).forEach(el=>el.innerHTML=statusHtml(c));
  }

  function pairName(c){
    const src=sourceUnit(c),cur=currentUnit(c);
    if(src==='RD')return 'R&D → '+unitLabel(cur);
    if(cur==='RD'||c?.lastExternalUnitCode==='RD'||c?.interdeptPair==='PTN-RD')return 'PTN → R&D';
    return unitLabel(src)+' → '+unitLabel(cur);
  }
  function rndPairCases(){
    return visible().filter(c=>currentUnit(c)==='RD'||sourceUnit(c)==='RD'||c?.lastExternalUnitCode==='RD'||c?.interdeptPair==='PTN-RD');
  }
  function genericPairCases(units){return visible().filter(c=>units.includes(currentUnit(c))||units.includes(sourceUnit(c))||units.includes(c?.lastExternalUnitCode))}
  function card(c){
    return `<div class="v22-case" onclick="openCaseDetail('${attr(c.id)}')"><div class="v22-case-code">${esc(c.id)}</div><div class="v22-case-title">${esc(c.title)}</div><div class="v22-case-meta"><span>${esc(pairName(c))}</span><span>•</span><span>Hiện tại: <b>${esc(currentLabel(c))}</b></span><span>•</span><span>Hạn: ${esc(c.deadline||'Chưa đặt')}</span></div><div class="v22-state-line" data-v22-status="${attr(c.id)}">${statusHtml(c)}</div></div>`;
  }
  function section(title,list,empty){return `<div class="v22-panel"><div class="v22-panel-head"><h3>${esc(title)}</h3><span class="v22-badge">${list.length}</span></div><div class="v22-panel-body"><div class="v22-case-list">${list.length?list.map(card).join(''):`<div class="v22-empty">${esc(empty)}</div>`}</div></div></div>`}

  function pageInfo(page){
    if(page==='rnd')return {title:'PTN ↔ R&D',sub:'Chỉ hiển thị các vấn đề/vướng mắc thực sự đang phối hợp giữa PTN và R&D, cùng lịch sử đã xử lý.',units:['RD']};
    if(page==='office'||page==='hr')return {title:'PTN-Khối Văn phòng',sub:'Các case chuyển HCNS, Kế toán, Lấy mẫu–Kho và lịch sử phối hợp.',units:['HCNS','KT','KHO']};
    if(page==='quality')return {title:'PTN-Bộ phận Quản lý chất lượng',sub:'Case/handoff chuyển QLCL và lịch sử xử lý.',units:['QLCL']};
    if(page==='bod')return {title:'PTN ↔ Ban Giám đốc',sub:'Vấn đề cần quyết định/kết luận và lịch sử đã xử lý.',units:['BGD']};
    return null;
  }
  function renderInterdept(page){
    const info=pageInfo(page);if(!info)return'';
    const list=page==='rnd'?rndPairCases():genericPairCases(info.units);warm(list);
    const waits=list.filter(c=>stage(c)==='wait');
    const works=list.filter(c=>stage(c)==='work');
    const confirms=list.filter(c=>stage(c)==='confirm');
    const dones=list.filter(c=>stage(c)==='done');
    const setup=page==='rnd'&&isHead()?`<button class="btn" onclick="v22GrantRndHead()">Cấu hình Trưởng phòng R&D</button>`:'';
    const guide=page==='rnd'?`<div class="v22-notice"><b>Chờ tiếp nhận:</b> VM đã được chuyển sang R&D nhưng R&D chưa xác nhận/bắt đầu xử lý. &nbsp; <b>Đang xử lý:</b> R&D đã tiếp nhận hoặc đã gửi phản hồi đang xử lý. Chat chỉ dùng hỏi đáp nhanh; kết luận kỹ thuật phải ghi ở “Phản hồi của bộ phận xử lý”.</div>`:'';
    return `<div class="v22-page-head"><div><h1>${esc(info.title)}</h1><p>${esc(info.sub)}</p></div><div class="v22-tools">${setup}</div></div>${guide}
      <div class="v22-metrics"><div class="v22-metric"><span>Chờ tiếp nhận</span><b>${waits.length}</b></div><div class="v22-metric"><span>Đang xử lý / phối hợp</span><b>${works.length}</b></div><div class="v22-metric"><span>Chờ xác nhận</span><b>${confirms.length}</b></div><div class="v22-metric"><span>Đã xử lý / Lịch sử</span><b>${dones.length}</b></div></div>
      ${section('CHỜ TIẾP NHẬN',waits,'Không có case chờ tiếp nhận.')}
      ${section('ĐANG XỬ LÝ / PHỐI HỢP',works,'Không có case đang xử lý.')}
      ${section('CHỜ XÁC NHẬN',confirms,'Không có case chờ xác nhận.')}
      ${section('ĐÃ XỬ LÝ / LỊCH SỬ',dones,'Chưa có case hoàn thành trong không gian này.')}`;
  }

  // Trưởng phòng R&D có thể xem public case PTN ở Không gian PTN, nhưng trang PTN↔R&D KHÔNG hiển thị tổng quan toàn PTN.
  try{if(typeof groupCanSee==='function'){const old=groupCanSee;groupCanSee=function(c){if(isRndHead())return true;return old(c)}}}catch(e){}
  try{if(typeof caseQueryForRole==='function'){const old=caseQueryForRole;caseQueryForRole=function(){if(isRndHead())return db.collection('hub_cases');return old.apply(this,arguments)}}}catch(e){}
  try{if(typeof render==='function'){const old=render;render=function(page){if(['rnd','office','hr','quality','bod'].includes(page))return renderInterdept(page);return old(page)}}}catch(e){}

  // Bảng PTN: làm rõ “đang xử lý” và “chờ phản hồi/xác nhận”.
  try{
    if(typeof renderCaseBoard==='function'){
      renderCaseBoard=function(){
        const list=visible();warm(list);
        const buckets=[
          ['Mới / Tiếp nhận',x=>!completed(x)&&stage(x)==='wait'&&currentUnit(x)==='PTN'],
          ['Đang xử lý',x=>stage(x)==='work'],
          ['Chờ phản hồi / xác nhận',x=>!completed(x)&&(stage(x)==='wait'&&currentUnit(x)!=='PTN'||stage(x)==='confirm')],
          ['Đã xử lý / Đóng',x=>stage(x)==='done']
        ];
        return `<div class="caseboard">${buckets.map(([title,fn])=>{const rows=list.filter(fn);return `<div class="casecol"><h3>${esc(title)}</h3>${rows.length?rows.map(c=>`<div class="casecard" onclick="openCaseDetail('${attr(c.id)}')"><div class="casecode">${esc(c.id)}</div><b>${esc(c.title)}</b><div class="v22-board-location">${esc(c.sourceGroup||'')} • ${esc(pairName(c))} • ${esc(c.deadline||'Chưa đặt')}</div><div class="case-actions" data-v22-status="${attr(c.id)}">${statusHtml(c)}</div></div>`).join(''):'<div class="v22-empty">Không có.</div>'}</div>`}).join('')}</div>`;
      };
    }
  }catch(e){console.warn('V2.2.1 board override skipped',e)}

  async function grantRndHead(){
    if(!isHead()){alert('Chỉ Trưởng phòng PTN được cấu hình quyền này.');return}
    if(!confirm('Cấp Nguyễn Ngọc Sơn quyền Trưởng phòng R&D: xem tổng quan CASE CÔNG KHAI PTN và xử lý case R&D?\n\nPrivate handling các bộ phận khác vẫn không được mở.'))return;
    try{
      await db.collection('hub_access').doc(RND_HEAD_EMAIL).set({email:RND_HEAD_EMAIL,name:'Nguyễn Ngọc Sơn',role:'rnd',department:'R&D',personnelTitle:'Trưởng phòng R&D',unitCodes:['RD'],active:true,accessModelVersion:'2.2.1',spaces:FV.arrayUnion('rnd','common','ptn'),permissions:FV.arrayUnion('rnd.tech.overview','rnd.response.manage'),updatedAt:FV.serverTimestamp(),updatedBy:email()},{merge:true});
      try{await db.collection('hub_audit_logs').add({action:'GRANT_RND_HEAD_V221',targetEmail:RND_HEAD_EMAIL,actorUid:currentUser.uid,actorEmail:email(),createdAt:FV.serverTimestamp()})}catch(e){}
      alert('Đã cấu hình Nguyễn Ngọc Sơn – Trưởng phòng R&D. Sau khi Hosting Preview đạt, mới chạy Rules V2.2 để test quyền đọc public case PTN.');
    }catch(e){alert('Không cấp được quyền: '+(e?.message||e))}
  }
  window.v22GrantRndHead=grantRndHead;

  function fmtTime(v){if(!v)return'';try{const d=v.toDate?v.toDate():new Date(v);return d.toLocaleString('vi-VN',{hour12:false})}catch(e){return''}}
  function safeId(id){return String(id||'').replace(/[^a-zA-Z0-9_-]/g,'_')}
  function canRespond(c){
    const cur=currentUnit(c),src=sourceUnit(c),r=role();
    if(r==='rnd')return cur==='RD';
    if(r==='quality')return cur==='QLCL';
    if(r==='bod')return cur==='BGD';
    if(r==='office'||r==='hr'){try{return accessUnits().includes(cur)}catch(e){return ['HCNS','KT','KHO'].includes(cur)}}
    if(r==='head')return cur==='PTN'&&src==='RD';
    return false;
  }
  function attachmentLinks(arr){
    return (arr||[]).map(a=>a?.dataUrl?`<a class="v22-attachment" href="${attr(a.dataUrl)}" download="${attr(a.name||'tep-dinh-kem')}">📎 ${esc(a.path||a.name||'Tệp')}</a>`:'').filter(Boolean).join('');
  }
  function responseHtml(r){
    const files=attachmentLinks(r.attachments);const links=(r.externalLinks||[]).map(u=>`<a class="v22-attachment" href="${attr(u)}" target="_blank" rel="noopener">🔗 Tài liệu liên kết</a>`).join('');
    return `<div class="v22-response"><div class="v22-response-head"><div><div class="v22-response-title">${esc(r.department||'Bộ phận xử lý')} — ${esc(r.userName||r.userEmail||'')}</div><div class="v22-state-line"><span class="v22-badge ${cls(r.responseStatus)}">${esc(r.responseStatus||'Phản hồi')}</span></div></div><div class="v22-response-time">${esc(fmtTime(r.createdAt))}</div></div>${r.description?`<div class="v22-response-section"><label>Mô tả xử lý</label><div>${esc(r.description)}</div></div>`:''}${r.technicalResult?`<div class="v22-response-section"><label>Kết quả kỹ thuật</label><div>${esc(r.technicalResult)}</div></div>`:''}${r.proposal?`<div class="v22-response-section"><label>Đề xuất / bước tiếp theo</label><div>${esc(r.proposal)}</div></div>`:''}${files||links?`<div class="v22-response-section"><label>Đính kèm / tài liệu</label><div class="v22-attachments">${files}${links}</div></div>`:''}</div>`;
  }
  function caseAttachmentsHtml(c){
    const rows=attachmentRecords(c);if(!rows.length)return'';
    return `<div class="v22-response-wrap"><h4>TỆP / ẢNH / TÀI LIỆU KHI BÁO CÁO</h4>${rows.map(r=>`<div class="v22-response"><div class="v22-response-head"><div class="v22-response-title">${esc(r.userName||r.userEmail||'Người báo')}</div><div class="v22-response-time">${esc(fmtTime(r.createdAt))}</div></div><div class="v22-attachments">${attachmentLinks(r.attachments)}${(r.externalLinks||[]).map(u=>`<a class="v22-attachment" href="${attr(u)}" target="_blank" rel="noopener">🔗 Link tài liệu</a>`).join('')}</div></div>`).join('')}</div>`;
  }
  function responseForm(c){
    if(!canRespond(c))return'';const sid=safeId(c.id);
    return `<div class="v22-form"><h4>PHẢN HỒI CỦA BỘ PHẬN XỬ LÝ</h4><div class="v22-form-grid"><div class="v22-field"><label>Trạng thái xử lý</label><select id="v22Status_${sid}"><option>Đang xử lý</option><option>Cần PTN bổ sung thông tin</option><option>Đã xử lý – chờ PTN xác nhận</option><option>Đề nghị chuyển bộ phận khác</option></select></div><div class="v22-field"><label>Ảnh / file nhỏ</label><input id="v22Files_${sid}" type="file" multiple accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"></div></div><div class="v22-field"><label>Mô tả xử lý</label><textarea id="v22Desc_${sid}" placeholder="Nêu việc đã kiểm tra/thực hiện..."></textarea></div><div class="v22-field"><label>Kết quả kỹ thuật</label><textarea id="v22Result_${sid}" placeholder="Kết quả, nguyên nhân, thông số hoặc nhận định kỹ thuật..."></textarea></div><div class="v22-field"><label>Đề xuất / bước tiếp theo</label><textarea id="v22Proposal_${sid}" placeholder="Đề xuất xử lý tiếp hoặc thông tin cần bổ sung..."></textarea></div><div class="v22-field"><label>Link tài liệu/video/thư mục lớn (Drive/OneDrive)</label><input id="v22Link_${sid}" type="text" placeholder="https://..."></div><div class="v22-notice warn">Ảnh/file nhỏ có thể đính trực tiếp. Video, thư mục hoặc file dung lượng lớn nên dùng link Drive/OneDrive để tránh vượt giới hạn Firestore.</div><div class="v22-form-actions"><button class="btn primary" onclick="v22SaveResponse('${attr(c.id)}')">Gửi phản hồi có truy vết</button></div></div>`;
  }
  function confirmControls(c){
    if(!isHead())return'';const r=latestResponse(c);if(!r||!String(r.responseStatus||'').includes('chờ PTN xác nhận'))return'';
    return `<div class="v22-confirm"><button class="btn primary" onclick="v22PtnConfirm('${attr(c.id)}',true)">Xác nhận hoàn thành</button><button class="btn" onclick="v22PtnConfirm('${attr(c.id)}',false)">Yêu cầu bộ phận bổ sung</button></div>`;
  }
  function chatHtml(c){
    const rows=chats(c).slice().reverse();const sid=safeId(c.id);
    return `<div class="v22-chat"><div class="v22-chat-head"><b>Trao đổi nhanh PTN ↔ bộ phận xử lý</b><span>Không dùng chat thay cho kết luận/VM chính thức.</span></div><div class="v22-chat-messages" id="v22ChatMessages_${sid}">${rows.length?rows.map(m=>`<div class="v22-chat-msg ${m.userEmail===email()?'mine':''}"><b>${esc(m.userName||m.userEmail||'')}</b><span>${esc(fmtTime(m.createdAt))}</span><div>${esc(m.message||'')}</div></div>`).join(''):'<div class="v22-empty">Chưa có trao đổi nhanh.</div>'}</div><div class="v22-chat-input"><input id="v22ChatInput_${sid}" placeholder="Hỏi/đáp nhanh về case này..." onkeydown="if(event.key==='Enter')v22SendChat('${attr(c.id)}')"><button class="btn primary" onclick="v22SendChat('${attr(c.id)}')">Gửi</button></div></div>`;
  }
  function panelHtml(c){
    const rs=responses(c);
    return `${caseAttachmentsHtml(c)}<div class="v22-response-wrap"><h4>PHẢN HỒI CỦA BỘ PHẬN XỬ LÝ</h4><div class="v22-notice"><b>Trạng thái:</b> ${esc(effectiveStatus(c))}. Phản hồi chính thức phải ghi tại đây; chat chỉ để hỏi đáp nhanh.</div>${rs.length?rs.map(responseHtml).join(''):'<div class="v22-empty">Chưa có phản hồi chính thức của bộ phận xử lý.</div>'}${confirmControls(c)}${responseForm(c)}${chatHtml(c)}</div>`;
  }
  async function injectPanel(caseId){
    const c=cases().find(x=>String(x.id)===String(caseId));if(!c)return;
    const body=document.getElementById('drawerBody');if(!body)return;const id='v22Panel_'+safeId(caseId);let slot=document.getElementById(id);
    if(!slot){slot=document.createElement('div');slot.id=id;slot.innerHTML='<div class="v22-empty">Đang tải phối hợp liên phòng...</div>';body.appendChild(slot)}
    await loadComments(caseId);slot.innerHTML=panelHtml(c);
  }
  try{if(typeof openCaseDetail==='function'){const old=openCaseDetail;openCaseDetail=function(id){const out=old.apply(this,arguments);setTimeout(()=>injectPanel(id),0);return out}}}catch(e){}

  function readData(file){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(String(r.result||''));r.onerror=()=>rej(r.error||new Error('Không đọc được file'));r.readAsDataURL(file)})}
  function loadImg(data){return new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=()=>rej(new Error('Không đọc được ảnh'));i.src=data})}
  async function pack(file,path){
    const isImg=String(file.type||'').startsWith('image/');
    if(!isImg){if(file.size>180000)throw new Error(`File ${file.name} lớn hơn 180 KB. Hãy dùng link Drive/OneDrive.`);return{name:file.name,path:path||file.webkitRelativePath||file.name,type:file.type||'application/octet-stream',size:file.size,dataUrl:await readData(file)}}
    const raw=await readData(file);if(raw.length<=240000)return{name:file.name,path:path||file.webkitRelativePath||file.name,type:file.type||'image/jpeg',size:file.size,dataUrl:raw};
    const img=await loadImg(raw);let w=img.width,h=img.height,max=1280;if(Math.max(w,h)>max){const q=max/Math.max(w,h);w=Math.round(w*q);h=Math.round(h*q)}const cv=document.createElement('canvas');cv.width=w;cv.height=h;cv.getContext('2d').drawImage(img,0,0,w,h);let q=.76,out='';while(q>=.42){out=cv.toDataURL('image/jpeg',q);if(out.length<=280000)break;q-=.08}if(out.length>320000)throw new Error(`Ảnh ${file.name} quá lớn. Hãy dùng link Drive/OneDrive.`);return{name:file.name.replace(/\.[^.]+$/,'.jpg'),path:path||file.webkitRelativePath||file.name,type:'image/jpeg',size:Math.round(out.length*.75),dataUrl:out};
  }
  async function buildAttachments(files,folderFiles){
    const src=[...(files||[]),...(folderFiles||[])].slice(0,8);const arr=[];let total=0;
    for(const f of src){const a=await pack(f,f.webkitRelativePath||f.name);total+=String(a.dataUrl||'').length;if(total>540000)throw new Error('Tổng tệp đính kèm quá lớn. Giảm số file hoặc dùng link thư mục Drive/OneDrive.');arr.push(a)}return arr;
  }
  async function addEvent(caseId,action,detail){try{await db.collection('hub_case_events').add({caseId,action,detail:detail||'',actorUid:currentUser.uid,actorEmail:email(),actorName:currentUser.displayName||email(),createdAt:FV.serverTimestamp(),schemaVersion:'2.2.1'})}catch(e){}}

  async function saveResponse(caseId){
    const c=cases().find(x=>String(x.id)===String(caseId));if(!c||!canRespond(c)){alert('Tài khoản không có quyền phản hồi case này.');return}
    const sid=safeId(caseId),status=document.getElementById('v22Status_'+sid)?.value||'Đang xử lý',description=document.getElementById('v22Desc_'+sid)?.value.trim()||'',technicalResult=document.getElementById('v22Result_'+sid)?.value.trim()||'',proposal=document.getElementById('v22Proposal_'+sid)?.value.trim()||'',link=document.getElementById('v22Link_'+sid)?.value.trim()||'';
    if(!description&&!technicalResult&&!proposal){alert('Cần nhập ít nhất mô tả xử lý, kết quả kỹ thuật hoặc đề xuất.');return}if(link&&!/^https?:\/\//i.test(link)){alert('Link phải bắt đầu bằng http:// hoặc https://');return}
    try{
      const attachments=await buildAttachments(Array.from(document.getElementById('v22Files_'+sid)?.files||[]),[]);
      await db.collection('hub_comments').add({caseId:String(caseId),type:'department_response',department:currentLabel(c),departmentCode:currentUnit(c),responseStatus:status,description,technicalResult,proposal,attachments,externalLinks:link?[link]:[],userUid:currentUser.uid,userEmail:email(),userName:currentUser.displayName||email(),createdAt:FV.serverTimestamp(),schemaVersion:'2.2.1'});
      await addEvent(String(caseId),'DEPARTMENT_RESPONSE',`${currentLabel(c)}: ${status}`);await loadComments(caseId);await injectPanel(caseId);alert('Đã gửi phản hồi và lưu truy vết.');
    }catch(e){alert('Không lưu được phản hồi: '+(e?.message||e))}
  }
  window.v22SaveResponse=saveResponse;

  async function sendChat(caseId){
    const sid=safeId(caseId),input=document.getElementById('v22ChatInput_'+sid),msg=input?.value.trim()||'';if(!msg)return;
    try{await db.collection('hub_comments').add({caseId:String(caseId),type:'interdept_chat',message:msg,userUid:currentUser.uid,userEmail:email(),userName:currentUser.displayName||email(),createdAt:FV.serverTimestamp(),schemaVersion:'2.2.1'});input.value='';await loadComments(caseId);await injectPanel(caseId)}catch(e){alert('Không gửi được chat: '+(e?.message||e))}
  }
  window.v22SendChat=sendChat;

  async function ptnConfirm(caseId,approved){
    if(!isHead()){alert('Chỉ Trưởng phòng PTN được xác nhận kết quả xử lý.');return}const c=cases().find(x=>String(x.id)===String(caseId));if(!c)return;const oldUnit=currentUnit(c),oldDesk=currentLabel(c);
    try{
      const ref=db.collection('hub_cases').doc(String(caseId));
      if(approved){await ref.update({status:'Đã xử lý',currentDesk:'PTN',currentSpace:'ptn',currentUnitCode:'PTN',lastExternalUnitCode:oldUnit,lastExternalDesk:oldDesk,interdeptPair:oldUnit==='RD'?'PTN-RD':c.interdeptPair||'',updatedAt:FV.serverTimestamp()});await addEvent(String(caseId),'PTN_CONFIRM_RESPONSE',`PTN xác nhận hoàn thành phản hồi của ${oldDesk}`)}
      else{await ref.update({status:`Chờ ${oldDesk} bổ sung`,updatedAt:FV.serverTimestamp()});await addEvent(String(caseId),'PTN_REQUEST_MORE',`PTN yêu cầu ${oldDesk} bổ sung phản hồi`)}
      const local=cases().find(x=>String(x.id)===String(caseId));if(local){local.status=approved?'Đã xử lý':`Chờ ${oldDesk} bổ sung`;if(approved){local.currentDesk='PTN';local.currentSpace='ptn';local.currentUnitCode='PTN';local.lastExternalUnitCode=oldUnit;local.lastExternalDesk=oldDesk;if(oldUnit==='RD')local.interdeptPair='PTN-RD'}}
      try{if(typeof closeDrawer==='function')closeDrawer()}catch(e){}setTimeout(()=>{try{if(typeof nav==='function')nav('ptn')}catch(e){}},100);
    }catch(e){alert('Không cập nhật được trạng thái PTN: '+(e?.message||e))}
  }
  window.v22PtnConfirm=ptnConfirm;

  // Bổ sung tệp/ảnh/video/thư mục vào form Tạo bản ghi hiện có mà không thay nghiệp vụ createCase gốc.
  try{
    if(typeof openCreateCase==='function'){
      const oldOpen=openCreateCase;openCreateCase=function(){const out=oldOpen.apply(this,arguments);setTimeout(()=>{
        const body=document.getElementById('drawerBody');if(!body||document.getElementById('cV22Files'))return;
        const box=document.createElement('div');box.className='v22-form';box.id='v22CreateAttachments';box.innerHTML=`<h4>TỆP / ẢNH / VIDEO / THƯ MỤC ĐÍNH KÈM</h4><div class="v22-field"><label>Chọn file, ảnh hoặc video</label><input id="cV22Files" type="file" multiple accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"></div><div class="v22-field"><label>Chọn thư mục (Chrome/Edge)</label><input id="cV22Folder" type="file" multiple webkitdirectory directory></div><div class="v22-field"><label>Link file/thư mục lớn trên Drive/OneDrive</label><input id="cV22Link" type="text" placeholder="https://..."></div><div class="v22-notice warn">File nhỏ lưu kèm bản ghi. Video, thư mục lớn hoặc nhiều file nên dùng link Drive/OneDrive.</div>`;body.appendChild(box);
      },0);return out};
    }
  }catch(e){console.warn('V2.2.1 create form attachment injection skipped',e)}

  try{
    if(typeof createCase==='function'){
      const oldCreate=createCase;createCase=async function(){
        let expected='';try{if(typeof nextCaseCode==='function')expected=nextCaseCode()}catch(e){}
        const files=Array.from(document.getElementById('cV22Files')?.files||[]),folders=Array.from(document.getElementById('cV22Folder')?.files||[]),link=document.getElementById('cV22Link')?.value.trim()||'';
        if(link&&!/^https?:\/\//i.test(link)){alert('Link đính kèm phải bắt đầu bằng http:// hoặc https://');return}
        const out=await Promise.resolve(oldCreate.apply(this,arguments));
        if(!files.length&&!folders.length&&!link)return out;
        try{
          await new Promise(r=>setTimeout(r,300));
          let id=expected;if(!id){const first=cases()[0];id=first?.id||''}if(!id)throw new Error('Không xác định được mã VM vừa tạo.');
          const attachments=await buildAttachments(files,folders);
          await db.collection('hub_comments').add({caseId:String(id),type:'case_attachment',attachments,externalLinks:link?[link]:[],userUid:currentUser.uid,userEmail:email(),userName:currentUser.displayName||email(),createdAt:FV.serverTimestamp(),schemaVersion:'2.2.1'});
          await addEvent(String(id),'CASE_ATTACHMENT_ADD',`Đính kèm ${attachments.length} file${link?' + link tài liệu':''}`);CACHE.delete(String(id));
        }catch(e){alert('Bản ghi đã tạo nhưng tệp đính kèm chưa lưu được: '+(e?.message||e))}
        return out;
      };
    }
  }catch(e){console.warn('V2.2.1 createCase wrapper skipped',e)}

  setTimeout(()=>{
    document.querySelectorAll('small,div,span').forEach(el=>{if(el.children.length===0&&/Phiên bản V2\.(1\.1|2)(?!\.)/.test(el.textContent||''))el.textContent=(el.textContent||'').replace(/Phiên bản V2\.(1\.1|2)(?!\.)/,'Phiên bản V2.2.1')});
    console.info('HUB-PTN V2.2.1 loaded');
  },0);
})();

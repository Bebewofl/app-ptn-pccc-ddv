/* HUB-PTN V2.2 — Xử lý liên phòng. Loaded after stable V2.1.1 source. */
(function(){
  const V22_VERSION='2.2';
  const V22_RND_HEAD_EMAIL='ngocson707@gmail.com';
  const V22_RESPONSE_CACHE=new Map();
  const V22_WARMING=new Set();

  function v22Esc(v){
    const s=String(v??'');
    try{ if(typeof escapeHtml==='function') return escapeHtml(s); }catch(e){}
    return s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function v22Attr(v){return v22Esc(v).replace(/`/g,'&#96;')}
  function v22Email(){
    try{return String(currentUser?.email||'').trim().toLowerCase()}catch(e){return ''}
  }
  function v22RoleType(){try{return R()?.type||''}catch(e){return ''}}
  function v22IsHead(){return ['head'].includes(v22RoleType())}
  function v22HasPermission(p){
    try{if(typeof hasPermission==='function' && hasPermission(p))return true}catch(e){}
    try{return Array.isArray(currentAccess?.permissions)&&currentAccess.permissions.includes(p)}catch(e){return false}
  }
  function v22IsRndHead(){return v22RoleType()==='rnd' && (v22Email()===V22_RND_HEAD_EMAIL || v22HasPermission('rnd.tech.overview'))}
  function v22Cases(){try{return Array.isArray(hubCases)?hubCases:[]}catch(e){return []}}
  function v22VisibleCases(){
    try{if(typeof visibleCases==='function')return visibleCases()}catch(e){}
    const all=v22Cases();
    try{if(typeof groupCanSee==='function')return all.filter(groupCanSee)}catch(e){}
    return all;
  }
  function v22Unit(c){
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
  function v22DeskLabel(c){
    const u=v22Unit(c);
    return ({RD:'R&D',HCNS:'HCNS',KT:'Kế toán',KHO:'Lấy mẫu–Kho',QLCL:'Bộ phận QLCL',BGD:'Ban Giám đốc',PTN:'PTN'})[u]||String(c?.currentDesk||'PTN');
  }
  function v22IsExternal(c){return v22Unit(c)!=='PTN'}
  function v22LatestResponse(c){
    const list=V22_RESPONSE_CACHE.get(String(c?.id||''))||[];
    return list[0]||null;
  }
  function v22EffectiveStatus(c){
    const latest=v22LatestResponse(c);
    const desk=v22DeskLabel(c);
    if(latest && v22IsExternal(c)){
      const rs=String(latest.responseStatus||'');
      if(rs==='Đang xử lý')return desk+' đang xử lý';
      if(rs==='Cần PTN bổ sung thông tin')return desk+' cần PTN bổ sung';
      if(rs==='Đã xử lý – chờ PTN xác nhận'||rs==='Đã xử lý - chờ PTN xác nhận')return desk+' đã phản hồi – chờ PTN xác nhận';
      if(rs==='Đề nghị chuyển bộ phận khác')return desk+' đề nghị chuyển bộ phận';
    }
    const s=String(c?.status||'');
    if(v22IsExternal(c)){
      if(/đóng|đã xử lý/i.test(s))return s;
      if(/chờ.*bổ sung/i.test(s))return 'Chờ '+desk+' bổ sung';
      if(/đang xử lý/i.test(s))return desk+' đang xử lý';
      if(v22Unit(c)==='BGD')return 'Chờ Ban Giám đốc quyết định';
      if(/mới|đã tiếp nhận|chờ|phản hồi/i.test(s)||!s)return 'Chờ '+desk+' xử lý';
    }
    return s||'Mới';
  }
  function v22StatusClass(s){
    const x=String(s||'').toLowerCase();
    if(x.includes('đã xử lý')||x.includes('đóng')||x.includes('hoàn thành'))return 'done';
    if(x.includes('đang xử lý'))return 'work';
    if(x.includes('cần ptn')||x.includes('đề nghị'))return 'alert';
    if(x.includes('chờ'))return 'wait';
    return '';
  }
  function v22StatusHtml(c){const s=v22EffectiveStatus(c);return `<span class="v22-badge ${v22StatusClass(s)}">${v22Esc(s)}</span>`}
  function v22CaseCard(c){
    const id=v22Esc(c.id), desk=v22DeskLabel(c);
    return `<div class="v22-case" onclick="openCaseDetail('${v22Attr(c.id)}')">
      <div class="v22-case-code">${id}</div>
      <div class="v22-case-title">${v22Esc(c.title)}</div>
      <div class="v22-case-meta"><span>${v22Esc(c.sourceGroup||'')}</span><span>•</span><span>Nơi xử lý: <b>${v22Esc(desk)}</b></span><span>•</span><span>Hạn: ${v22Esc(c.deadline||'Chưa đặt')}</span></div>
      <div class="v22-state-line" data-v22-status="${v22Attr(c.id)}">${v22StatusHtml(c)}</div>
    </div>`;
  }
  function v22RefreshStatusDom(id){
    const c=v22Cases().find(x=>String(x.id)===String(id)); if(!c)return;
    document.querySelectorAll(`[data-v22-status="${CSS.escape(String(id))}"]`).forEach(el=>el.innerHTML=v22StatusHtml(c));
  }

  async function v22LoadResponses(caseId){
    const id=String(caseId||''); if(!id)return [];
    try{
      const snap=await db.collection('hub_comments').where('caseId','==',id).get();
      const rows=snap.docs.map(d=>({id:d.id,...d.data()})).filter(x=>x.type==='department_response');
      rows.sort((a,b)=>{
        const ta=a.createdAt?.toMillis?a.createdAt.toMillis():Date.parse(a.createdAt||0)||0;
        const tb=b.createdAt?.toMillis?b.createdAt.toMillis():Date.parse(b.createdAt||0)||0;
        return tb-ta;
      });
      V22_RESPONSE_CACHE.set(id,rows);
      v22RefreshStatusDom(id);
      return rows;
    }catch(e){
      console.warn('V2.2 response read skipped',id,e?.code||e?.message||e);
      return V22_RESPONSE_CACHE.get(id)||[];
    }
  }
  function v22WarmResponses(list){
    (list||[]).forEach(c=>{
      const id=String(c.id||''); if(!id||V22_WARMING.has(id)||V22_RESPONSE_CACHE.has(id))return;
      V22_WARMING.add(id);
      setTimeout(()=>v22LoadResponses(id).finally(()=>V22_WARMING.delete(id)),0);
    });
  }

  // Keep source-group visibility; R&D head gets public PTN overview after Rules V2.2 is enabled.
  try{
    if(typeof groupCanSee==='function'){
      const oldGroupCanSee=groupCanSee;
      groupCanSee=function(c){if(v22IsRndHead())return true;return oldGroupCanSee(c)};
    }
  }catch(e){console.warn('V2.2 group visibility wrapper skipped',e)}

  // R&D head query changes from currentDesk=R&D to public all-cases query. Rules V2.2 remains the server gate.
  try{
    if(typeof caseQueryForRole==='function'){
      const oldCaseQuery=caseQueryForRole;
      caseQueryForRole=function(){
        if(v22IsRndHead())return db.collection('hub_cases');
        return oldCaseQuery.apply(this,arguments);
      };
    }
  }catch(e){console.warn('V2.2 case query wrapper skipped',e)}

  // Board: transferred cases stay on source board and show where they are waiting.
  try{
    if(typeof renderCaseBoard==='function'){
      renderCaseBoard=function(){
        const list=v22VisibleCases();
        v22WarmResponses(list);
        const buckets=[
          ['Mới / Tiếp nhận',x=>!v22IsExternal(x)&&['Mới','Đã tiếp nhận','Chờ Trưởng phòng'].includes(String(x.status||''))],
          ['Đang xử lý',x=>v22EffectiveStatus(x).toLowerCase().includes('đang xử lý')],
          ['Đang chờ',x=>v22EffectiveStatus(x).toLowerCase().includes('chờ')||v22IsExternal(x)&&!v22EffectiveStatus(x).toLowerCase().includes('đang xử lý')&&!/đã xử lý|đóng/i.test(v22EffectiveStatus(x))],
          ['Đã xử lý / Đóng',x=>/đã xử lý|đóng|hoàn thành/i.test(v22EffectiveStatus(x))]
        ];
        return `<div class="caseboard">${buckets.map(([title,fn])=>{
          const rows=list.filter(fn);
          return `<div class="casecol"><h3>${v22Esc(title)}</h3>${rows.length?rows.map(c=>`<div class="casecard" onclick="openCaseDetail('${v22Attr(c.id)}')"><div class="casecode">${v22Esc(c.id)}</div><b>${v22Esc(c.title)}</b><div class="v22-board-location">${v22Esc(c.sourceGroup||'')} • <b>${v22Esc(v22DeskLabel(c))}</b> • ${v22Esc(c.deadline||'Chưa đặt')}</div><div class="case-actions" data-v22-status="${v22Attr(c.id)}">${v22StatusHtml(c)}</div></div>`).join(''):'<div class="v22-empty">Không có.</div>'}</div>`;
        }).join('')}</div>`;
      };
    }
  }catch(e){console.warn('V2.2 board override skipped',e)}

  function v22PageInfo(page){
    if(page==='rnd')return {title:'PTN ↔ R&D',sub:'Không gian kỹ thuật liên phòng: tiếp nhận, phản hồi và theo dõi VM có truy vết.',units:['RD']};
    if(page==='office'||page==='hr')return {title:'PTN-Khối Văn phòng',sub:'Phối hợp HCNS, Kế toán, Lấy mẫu–Kho theo đúng đơn vị được phân quyền.',units:['HCNS','KT','KHO']};
    if(page==='quality')return {title:'PTN-Bộ phận Quản lý chất lượng',sub:'Theo dõi case/handoff chuyển QLCL; không sửa dữ liệu thử nghiệm đã khóa.',units:['QLCL']};
    if(page==='bod')return {title:'PTN ↔ Ban Giám đốc',sub:'Vấn đề cần giám sát, quyết định, kết luận và theo dõi trạng thái.',units:['BGD']};
    return null;
  }
  function v22RelevantCases(units){return v22VisibleCases().filter(c=>units.includes(v22Unit(c)))}
  function v22MetricCount(list,kind){
    if(kind==='wait')return list.filter(c=>v22EffectiveStatus(c).toLowerCase().includes('chờ')).length;
    if(kind==='work')return list.filter(c=>v22EffectiveStatus(c).toLowerCase().includes('đang xử lý')).length;
    if(kind==='confirm')return list.filter(c=>v22EffectiveStatus(c).toLowerCase().includes('chờ ptn xác nhận')).length;
    if(kind==='done')return list.filter(c=>/đã xử lý|đóng|hoàn thành/i.test(v22EffectiveStatus(c))).length;
    return 0;
  }
  function v22RenderInterdept(page){
    const info=v22PageInfo(page); if(!info)return '';
    const list=v22RelevantCases(info.units);
    v22WarmResponses(list);
    const all=v22VisibleCases();
    const ownerRndSetup=(page==='rnd'&&v22IsHead())?`<button class="btn" onclick="v22GrantRndHead()">Cấu hình Trưởng phòng R&D</button>`:'';
    const publicOverview=(page==='rnd'&&(v22IsHead()||v22IsRndHead()))?`<div class="v22-panel"><div class="v22-panel-head"><h3>TỔNG QUAN VƯỚNG MẮC CÔNG KHAI PTN</h3><span class="v22-badge">${all.length} VM</span></div><div class="v22-panel-body v22-tech-overview"><div class="v22-case-list">${all.length?all.map(v22CaseCard).join(''):'<div class="v22-empty">Chưa có dữ liệu trong phạm vi quyền.</div>'}</div></div></div>`:'';
    return `<div class="v22-page-head"><div><h1>${v22Esc(info.title)}</h1><p>${v22Esc(info.sub)}</p></div><div class="v22-tools">${ownerRndSetup}</div></div>
      <div class="v22-notice"><b>V2.2:</b> VM vẫn tồn tại ở nhóm/phòng phát hiện sau khi chuyển xử lý. Không gian này chỉ bổ sung nơi xử lý, phản hồi và trạng thái; không thay thế hồ sơ thử nghiệm chính thức.</div>
      <div class="v22-metrics"><div class="v22-metric"><span>Đang chờ bộ phận</span><b>${v22MetricCount(list,'wait')}</b></div><div class="v22-metric"><span>Đang xử lý</span><b>${v22MetricCount(list,'work')}</b></div><div class="v22-metric"><span>Chờ PTN xác nhận</span><b>${v22MetricCount(list,'confirm')}</b></div><div class="v22-metric"><span>Đã xử lý/Đóng</span><b>${v22MetricCount(list,'done')}</b></div></div>
      <div class="v22-panel"><div class="v22-panel-head"><h3>VẤN ĐỀ / VƯỚNG MẮC ĐANG Ở ${v22Esc(info.title.replace('PTN ↔ ','').replace('PTN-',''))}</h3><span class="v22-badge">${list.length}</span></div><div class="v22-panel-body"><div class="v22-case-list">${list.length?list.map(v22CaseCard).join(''):'<div class="v22-empty">Chưa có VM đang ở bộ phận này.</div>'}</div></div></div>
      ${publicOverview}`;
  }

  // Replace only interdepartment pages. Other HUB pages remain from V2.1.1.
  try{
    if(typeof render==='function'){
      const oldRender=render;
      render=function(page){
        if(['rnd','office','hr','quality','bod'].includes(page))return v22RenderInterdept(page);
        return oldRender(page);
      };
    }
  }catch(e){console.warn('V2.2 render wrapper skipped',e)}

  async function v22GrantRndHead(){
    if(!v22IsHead()){alert('Chỉ Trưởng phòng PTN được cấu hình quyền này.');return}
    if(!confirm('Cấp Nguyễn Ngọc Sơn (ngocson707@gmail.com) quyền Trưởng phòng R&D: xem tổng quan CASE CÔNG KHAI PTN và xử lý case R&D?\n\nPrivate handling các bộ phận khác vẫn không được mở.'))return;
    try{
      const ref=db.collection('hub_access').doc(V22_RND_HEAD_EMAIL);
      await ref.set({
        email:V22_RND_HEAD_EMAIL,name:'Nguyễn Ngọc Sơn',role:'rnd',department:'R&D',personnelTitle:'Trưởng phòng R&D',unitCodes:['RD'],active:true,accessModelVersion:'2.2',
        spaces:FV.arrayUnion('rnd','common','ptn'),
        permissions:FV.arrayUnion('rnd.tech.overview','rnd.response.manage'),
        updatedAt:FV.serverTimestamp(),updatedBy:v22Email()
      },{merge:true});
      try{await db.collection('hub_audit_logs').add({action:'GRANT_RND_HEAD_V22',targetEmail:V22_RND_HEAD_EMAIL,actorUid:currentUser.uid,actorEmail:v22Email(),createdAt:FV.serverTimestamp()})}catch(e){}
      alert('Đã cấu hình Nguyễn Ngọc Sơn thành Trưởng phòng R&D V2.2.\n\nBước tiếp: sau khi Owner test Hosting Preview OK, chạy 02_DEPLOY_RULES_V2_2_FOR_RND_HEAD_TEST.cmd rồi đăng nhập tài khoản anh Sơn để test quyền tổng quan.');
    }catch(e){alert('Không cấp được quyền: '+(e?.message||e))}
  }
  window.v22GrantRndHead=v22GrantRndHead;

  function v22FmtTime(v){
    if(!v)return '';
    try{const d=v.toDate?v.toDate():new Date(v);return d.toLocaleString('vi-VN',{hour12:false})}catch(e){return ''}
  }
  function v22CanRespond(c){
    const u=v22Unit(c),r=v22RoleType();
    if(r==='rnd')return u==='RD';
    if(r==='quality')return u==='QLCL';
    if(r==='bod')return u==='BGD';
    if(r==='office'||r==='hr'){
      try{return accessUnits().includes(u)}catch(e){return ['HCNS','KT','KHO'].includes(u)}
    }
    return false;
  }
  function v22ResponseHtml(r){
    const atts=Array.isArray(r.attachments)?r.attachments:[];
    const links=Array.isArray(r.externalLinks)?r.externalLinks:[];
    const files=[...atts.map(a=>a.dataUrl?`<a class="v22-attachment" href="${v22Attr(a.dataUrl)}" download="${v22Attr(a.name||'tep-dinh-kem')}">📎 ${v22Esc(a.name||'Tệp')}</a>`:''),...links.map(u=>`<a class="v22-attachment" href="${v22Attr(u)}" target="_blank" rel="noopener">🔗 Tài liệu liên kết</a>`)].filter(Boolean).join('');
    return `<div class="v22-response"><div class="v22-response-head"><div><div class="v22-response-title">${v22Esc(r.department||'Bộ phận xử lý')} — ${v22Esc(r.userName||r.userEmail||'')}</div><div class="v22-state-line"><span class="v22-badge ${v22StatusClass(r.responseStatus)}">${v22Esc(r.responseStatus||'Phản hồi')}</span></div></div><div class="v22-response-time">${v22Esc(v22FmtTime(r.createdAt))}</div></div>
      ${r.description?`<div class="v22-response-section"><label>Mô tả xử lý</label><div>${v22Esc(r.description)}</div></div>`:''}
      ${r.technicalResult?`<div class="v22-response-section"><label>Kết quả kỹ thuật</label><div>${v22Esc(r.technicalResult)}</div></div>`:''}
      ${r.proposal?`<div class="v22-response-section"><label>Đề xuất / bước tiếp theo</label><div>${v22Esc(r.proposal)}</div></div>`:''}
      ${files?`<div class="v22-response-section"><label>Đính kèm / tài liệu</label><div class="v22-attachments">${files}</div></div>`:''}
    </div>`;
  }
  function v22SafeId(id){return String(id||'').replace(/[^a-zA-Z0-9_-]/g,'_')}
  function v22ResponseForm(c){
    const sid=v22SafeId(c.id);
    if(!v22CanRespond(c))return '';
    return `<div class="v22-form"><h4>PHẢN HỒI CỦA BỘ PHẬN XỬ LÝ</h4><div class="v22-form-grid"><div class="v22-field"><label>Trạng thái xử lý</label><select id="v22Status_${sid}"><option>Đang xử lý</option><option>Cần PTN bổ sung thông tin</option><option>Đã xử lý – chờ PTN xác nhận</option><option>Đề nghị chuyển bộ phận khác</option></select></div><div class="v22-field"><label>Ảnh / file nhỏ (tối đa 3 file)</label><input id="v22Files_${sid}" type="file" multiple></div></div>
      <div class="v22-field"><label>Mô tả xử lý</label><textarea id="v22Desc_${sid}" placeholder="Nêu việc đã kiểm tra/thực hiện..."></textarea></div>
      <div class="v22-field"><label>Kết quả kỹ thuật</label><textarea id="v22Result_${sid}" placeholder="Kết quả, nguyên nhân, thông số hoặc nhận định kỹ thuật..."></textarea></div>
      <div class="v22-field"><label>Đề xuất / bước tiếp theo</label><textarea id="v22Proposal_${sid}" placeholder="Đề xuất xử lý tiếp, điều kiện cần PTN bổ sung..."></textarea></div>
      <div class="v22-field"><label>Link tài liệu lớn (Drive/OneDrive, nếu có)</label><input id="v22Link_${sid}" type="text" placeholder="https://..."></div>
      <div class="v22-notice warn">Tệp lưu trực tiếp chỉ dành cho ảnh/file nhỏ. File lớn dùng link Drive/OneDrive để tránh vượt giới hạn bản ghi Firestore.</div>
      <div class="v22-form-actions"><button class="btn primary" onclick="v22SaveResponse('${v22Attr(c.id)}')">Gửi phản hồi có truy vết</button></div></div>`;
  }
  function v22ConfirmControls(c,responses){
    if(!v22IsHead()||!responses.length)return '';
    const latest=responses[0],s=String(latest.responseStatus||'');
    if(!s.includes('chờ PTN xác nhận'))return '';
    return `<div class="v22-confirm"><button class="btn primary" onclick="v22PtnConfirm('${v22Attr(c.id)}',true)">Xác nhận hoàn thành</button><button class="btn" onclick="v22PtnConfirm('${v22Attr(c.id)}',false)">Yêu cầu bộ phận bổ sung</button></div>`;
  }
  function v22PanelHtml(c,responses){
    return `<div class="v22-response-wrap"><h4>PHẢN HỒI CỦA BỘ PHẬN XỬ LÝ</h4><div class="v22-notice"><b>Trạng thái liên phòng:</b> ${v22Esc(v22EffectiveStatus(c))}. Phản hồi này là bản ghi phối hợp có truy vết; không thay thế data/kết quả thử nghiệm chính thức.</div>
      ${responses.length?responses.map(v22ResponseHtml).join(''):'<div class="v22-empty">Chưa có phản hồi chính thức của bộ phận xử lý.</div>'}
      ${v22ConfirmControls(c,responses)}${v22ResponseForm(c)}</div>`;
  }
  async function v22InjectCasePanel(caseId){
    const c=v22Cases().find(x=>String(x.id)===String(caseId));if(!c)return;
    const body=document.getElementById('drawerBody');if(!body)return;
    const slotId='v22Panel_'+v22SafeId(caseId);
    let slot=document.getElementById(slotId);
    if(!slot){slot=document.createElement('div');slot.id=slotId;slot.innerHTML='<div class="v22-response-wrap"><div class="v22-empty">Đang tải phản hồi liên phòng...</div></div>';body.appendChild(slot)}
    const responses=await v22LoadResponses(caseId);
    slot.innerHTML=v22PanelHtml(c,responses);
  }

  // Preserve original case detail then append V2.2 response/history controls.
  try{
    if(typeof openCaseDetail==='function'){
      const oldOpenCaseDetail=openCaseDetail;
      openCaseDetail=function(id){
        const out=oldOpenCaseDetail.apply(this,arguments);
        setTimeout(()=>v22InjectCasePanel(id),0);
        return out;
      };
    }
  }catch(e){console.warn('V2.2 detail wrapper skipped',e)}

  function v22ReadAsDataURL(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result||''));r.onerror=()=>reject(r.error||new Error('Không đọc được file'));r.readAsDataURL(file)})}
  function v22LoadImage(dataUrl){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('Không đọc được ảnh'));img.src=dataUrl})}
  async function v22Attachment(file){
    const isImage=String(file.type||'').startsWith('image/');
    if(!isImage){
      if(file.size>180000)throw new Error(`File ${file.name} lớn hơn 180 KB. Hãy dùng link Drive/OneDrive.`);
      return {name:file.name,type:file.type||'application/octet-stream',size:file.size,dataUrl:await v22ReadAsDataURL(file)};
    }
    const raw=await v22ReadAsDataURL(file);
    if(raw.length<=240000)return {name:file.name,type:file.type||'image/jpeg',size:file.size,dataUrl:raw};
    const img=await v22LoadImage(raw);let w=img.width,h=img.height;const max=1280;
    if(Math.max(w,h)>max){const r=max/Math.max(w,h);w=Math.round(w*r);h=Math.round(h*r)}
    const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0,w,h);
    let q=.76,out='';
    while(q>=.42){out=canvas.toDataURL('image/jpeg',q);if(out.length<=280000)break;q-=.08}
    if(out.length>320000)throw new Error(`Ảnh ${file.name} vẫn quá lớn sau nén. Hãy dùng link Drive/OneDrive.`);
    return {name:file.name.replace(/\.[^.]+$/,'.jpg'),type:'image/jpeg',size:Math.round(out.length*.75),dataUrl:out};
  }
  function v22DepartmentForCase(c){return v22DeskLabel(c)}
  async function v22AddEvent(caseId,action,detail){
    try{await db.collection('hub_case_events').add({caseId,action,detail:detail||'',actorUid:currentUser.uid,actorEmail:v22Email(),actorName:currentUser.displayName||v22Email(),createdAt:FV.serverTimestamp(),schemaVersion:'2.2'})}catch(e){console.warn('V2.2 audit event skipped',e?.code||e?.message||e)}
  }
  async function v22SaveResponse(caseId){
    const c=v22Cases().find(x=>String(x.id)===String(caseId));if(!c||!v22CanRespond(c)){alert('Tài khoản không có quyền phản hồi case này.');return}
    const sid=v22SafeId(caseId);
    const status=document.getElementById('v22Status_'+sid)?.value||'Đang xử lý';
    const description=document.getElementById('v22Desc_'+sid)?.value.trim()||'';
    const technicalResult=document.getElementById('v22Result_'+sid)?.value.trim()||'';
    const proposal=document.getElementById('v22Proposal_'+sid)?.value.trim()||'';
    const link=document.getElementById('v22Link_'+sid)?.value.trim()||'';
    if(!description&&!technicalResult&&!proposal){alert('Cần nhập ít nhất mô tả xử lý, kết quả kỹ thuật hoặc đề xuất.');return}
    if(link&&!/^https?:\/\//i.test(link)){alert('Link tài liệu phải bắt đầu bằng http:// hoặc https://');return}
    try{
      const files=Array.from(document.getElementById('v22Files_'+sid)?.files||[]).slice(0,3);
      const attachments=[];let totalChars=0;
      for(const file of files){const a=await v22Attachment(file);totalChars+=String(a.dataUrl||'').length;if(totalChars>520000)throw new Error('Tổng file đính kèm quá lớn. Hãy giảm số file hoặc dùng link Drive/OneDrive.');attachments.push(a)}
      const payload={
        caseId:String(caseId),type:'department_response',department:v22DepartmentForCase(c),departmentCode:v22Unit(c),responseStatus:status,description,technicalResult,proposal,attachments,externalLinks:link?[link]:[],
        userUid:currentUser.uid,userEmail:v22Email(),userName:currentUser.displayName||v22Email(),roleLabel:(()=>{try{return R().label}catch(e){return ''}})(),createdAt:FV.serverTimestamp(),schemaVersion:'2.2'
      };
      await db.collection('hub_comments').add(payload);
      await v22AddEvent(String(caseId),'DEPARTMENT_RESPONSE',`${v22DepartmentForCase(c)}: ${status}`);
      await v22LoadResponses(caseId);
      await v22InjectCasePanel(caseId);
      alert('Đã gửi phản hồi và lưu truy vết.');
    }catch(e){alert('Không lưu được phản hồi: '+(e?.message||e))}
  }
  window.v22SaveResponse=v22SaveResponse;

  async function v22PtnConfirm(caseId,approved){
    if(!v22IsHead()){alert('Chỉ Trưởng phòng PTN được xác nhận kết quả xử lý.');return}
    const c=v22Cases().find(x=>String(x.id)===String(caseId));if(!c)return;
    const oldDesk=v22DeskLabel(c),oldUnit=v22Unit(c);
    try{
      const ref=db.collection('hub_cases').doc(String(caseId));
      if(approved){
        await ref.update({status:'Đã xử lý',currentDesk:'PTN',currentSpace:'ptn',currentUnitCode:'PTN',updatedAt:FV.serverTimestamp()});
        await v22AddEvent(String(caseId),'PTN_CONFIRM_RESPONSE',`Trưởng phòng PTN xác nhận hoàn thành phản hồi của ${oldDesk}`);
      }else{
        await ref.update({status:`Chờ ${oldDesk} bổ sung`,updatedAt:FV.serverTimestamp()});
        await v22AddEvent(String(caseId),'PTN_REQUEST_MORE',`PTN yêu cầu ${oldDesk} bổ sung phản hồi`);
      }
      const local=v22Cases().find(x=>String(x.id)===String(caseId));
      if(local){local.status=approved?'Đã xử lý':`Chờ ${oldDesk} bổ sung`;if(approved){local.currentDesk='PTN';local.currentSpace='ptn';local.currentUnitCode='PTN'}local.updatedAt=new Date().toLocaleString('vi-VN')}
      try{if(typeof closeDrawer==='function')closeDrawer()}catch(e){}
      setTimeout(()=>{try{if(typeof nav==='function')nav('ptn')}catch(e){}},100);
    }catch(e){alert('Không cập nhật được trạng thái PTN: '+(e?.message||e))}
  }
  window.v22PtnConfirm=v22PtnConfirm;

  // Refresh visible version text if source used a slightly different wrapper.
  setTimeout(()=>{
    document.querySelectorAll('small,div,span').forEach(el=>{
      if(el.children.length===0 && /Phiên bản V2\.1\.1/.test(el.textContent||''))el.textContent=(el.textContent||'').replace(/Phiên bản V2\.1\.1/,'Phiên bản V2.2');
    });
    console.info('HUB-PTN V2.2 interdepartment workflow loaded');
  },0);
})();

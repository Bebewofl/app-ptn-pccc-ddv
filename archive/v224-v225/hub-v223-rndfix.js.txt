/* HUB-PTN V2.2.3 — fix R&D response permissions + audit without composite index */
(function(){
  const VERSION='2.2.3';
  const GENERAL='GENERAL';

  function email(){try{return String(currentUser?.email||'').trim().toLowerCase()}catch(e){return''}}
  function role(){try{return R()?.type||''}catch(e){return''}}
  function safeId(id){return String(id||'').replace(/[^a-zA-Z0-9_-]/g,'_')}
  function allCases(){try{return Array.isArray(hubCases)?hubCases:[]}catch(e){return[]}}
  function caseById(id){return allCases().find(c=>String(c.id)===String(id))||null}
  function currentUnit(c){
    if(c?.currentUnitCode)return String(c.currentUnitCode);
    const d=String(c?.currentDesk||'');
    if(d==='R&D')return'RD';
    if(d==='Khối Văn phòng / HCNS'||d==='HCNS')return'HCNS';
    if(d==='Khối Văn phòng / Kế toán'||d==='Kế toán')return'KT';
    if(d==='Khối Văn phòng / Lấy mẫu - Kho'||d==='Kho / Lấy mẫu'||d==='Lấy mẫu - Kho')return'KHO';
    if(d==='Quản lý chất lượng')return'QLCL';
    if(d==='Ban Giám đốc')return'BGD';
    return'PTN';
  }
  function sourceUnit(c){
    if(c?.sourceUnitCode)return String(c.sourceUnitCode);
    if(c?.sourceSpace==='rnd'||c?.originUnitCode==='RD'||String(c?.sourceGroup||'')==='RND')return'RD';
    return'PTN';
  }
  function unitLabel(u){return({RD:'R&D',PTN:'PTN',HCNS:'HCNS',KT:'Kế toán',KHO:'Lấy mẫu–Kho',QLCL:'Bộ phận QLCL',BGD:'Ban Giám đốc'})[u]||u}
  function canRespond(c){
    const r=role(),cur=currentUnit(c),src=sourceUnit(c);
    if(r==='rnd')return cur==='RD';
    if(r==='head')return cur==='PTN'&&src==='RD';
    if(r==='quality')return cur==='QLCL';
    if(r==='bod')return cur==='BGD';
    if(r==='office'||r==='hr'){try{return accessUnits().includes(cur)}catch(e){return['HCNS','KT','KHO'].includes(cur)}}
    return false;
  }
  function readData(file){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(String(r.result||''));r.onerror=()=>rej(r.error||new Error('Không đọc được file'));r.readAsDataURL(file)})}
  function loadImg(data){return new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=()=>rej(new Error('Không đọc được ảnh'));i.src=data})}
  async function pack(file){
    const isImg=String(file.type||'').startsWith('image/');
    if(!isImg){if(file.size>180000)throw new Error(`File ${file.name} lớn hơn 180 KB. Hãy dùng link Drive/OneDrive.`);return{name:file.name,path:file.webkitRelativePath||file.name,type:file.type||'application/octet-stream',size:file.size,dataUrl:await readData(file)}}
    const raw=await readData(file);if(raw.length<=240000)return{name:file.name,path:file.name,type:file.type||'image/jpeg',size:file.size,dataUrl:raw};
    const img=await loadImg(raw);let w=img.width,h=img.height,max=1280;if(Math.max(w,h)>max){const q=max/Math.max(w,h);w=Math.round(w*q);h=Math.round(h*q)}
    const cv=document.createElement('canvas');cv.width=w;cv.height=h;cv.getContext('2d').drawImage(img,0,0,w,h);let q=.76,out='';
    while(q>=.42){out=cv.toDataURL('image/jpeg',q);if(out.length<=280000)break;q-=.08}
    if(out.length>320000)throw new Error(`Ảnh ${file.name} quá lớn. Hãy dùng link Drive/OneDrive.`);
    return{name:file.name.replace(/\.[^.]+$/,'.jpg'),path:file.name,type:'image/jpeg',size:Math.round(out.length*.75),dataUrl:out};
  }
  async function attachmentsFromInput(id){
    const files=Array.from(document.getElementById(id)?.files||[]).slice(0,3),arr=[];let total=0;
    for(const f of files){const a=await pack(f);total+=String(a.dataUrl||'').length;if(total>520000)throw new Error('Tổng file đính kèm quá lớn. Giảm số file hoặc dùng link Drive/OneDrive.');arr.push(a)}
    return arr;
  }
  function authorFields(){
    const em=email(),name=currentUser?.displayName||em,uid=currentUser?.uid||'';
    return{userUid:uid,userEmail:em,userName:name,createdByUid:uid,createdByEmail:em,createdByName:name,authorUid:uid,authorEmail:em};
  }
  async function addEvent(caseId,action,detail){
    try{const a=authorFields();await db.collection('hub_case_events').add({caseId:String(caseId),action,detail:detail||'',actorUid:a.userUid,actorEmail:a.userEmail,actorName:a.userName,createdByUid:a.userUid,createdByEmail:a.userEmail,createdAt:FV.serverTimestamp(),schemaVersion:VERSION})}catch(e){console.warn('V2.2.3 audit event skipped',e?.code||e?.message||e)}
  }

  // Compatibility response writer: sends both legacy/current author field names.
  window.v22SaveResponse=async function(caseId){
    const c=caseById(caseId);if(!c||!canRespond(c)){alert('Tài khoản không có quyền phản hồi case này.');return}
    const sid=safeId(caseId);
    const status=document.getElementById('v22Status_'+sid)?.value||'Đang xử lý';
    const description=document.getElementById('v22Desc_'+sid)?.value.trim()||'';
    const technicalResult=document.getElementById('v22Result_'+sid)?.value.trim()||'';
    const proposal=document.getElementById('v22Proposal_'+sid)?.value.trim()||'';
    const link=document.getElementById('v22Link_'+sid)?.value.trim()||'';
    if(!description&&!technicalResult&&!proposal){alert('Cần nhập ít nhất mô tả xử lý, kết quả kỹ thuật hoặc đề xuất.');return}
    if(link&&!/^https?:\/\//i.test(link)){alert('Link phải bắt đầu bằng http:// hoặc https://');return}
    try{
      const attachments=await attachmentsFromInput('v22Files_'+sid),a=authorFields();
      await db.collection('hub_comments').add({
        caseId:String(caseId),type:'department_response',department:unitLabel(currentUnit(c)),departmentCode:currentUnit(c),responseStatus:status,
        description,technicalResult,proposal,attachments,externalLinks:link?[link]:[],...a,createdAt:FV.serverTimestamp(),schemaVersion:VERSION
      });
      await addEvent(caseId,'DEPARTMENT_RESPONSE',`${unitLabel(currentUnit(c))}: ${status}`);
      alert('Đã gửi phản hồi và lưu truy vết.');
      setTimeout(()=>{try{openCaseDetail(String(caseId))}catch(e){}},120);
    }catch(e){
      const msg=String(e?.message||e);
      if(/permission|insufficient/i.test(msg))alert('Rules hiện tại chưa cho phép R&D ghi phản hồi V2.2.3. Hãy chạy file 02_DEPLOY_RULES_V2_2_3_RND_RESPONSE_TEST.cmd trong ZIP Preview rồi thử lại.');
      else alert('Không lưu được phản hồi: '+msg);
    }
  };

  // Compatibility writer for fixed chat panel. Reads active thread from the visible selector.
  window.v222SendChat=async function(){
    const input=document.getElementById('v222ChatInput'),msg=input?.value.trim()||'';if(!msg)return;
    const thread=String(document.getElementById('v222ThreadSelect')?.value||GENERAL),a=authorFields();
    try{
      if(thread===GENERAL){
        await db.collection('hub_interdept_chat').add({spaceKey:'PTN-RD',threadKey:GENERAL,type:'space_chat',message:msg,...a,createdAt:FV.serverTimestamp(),schemaVersion:VERSION});
      }else{
        await db.collection('hub_comments').add({caseId:thread,type:'interdept_chat',message:msg,...a,createdAt:FV.serverTimestamp(),schemaVersion:VERSION});
      }
      input.value='';
    }catch(e){alert('Không gửi được chat: '+(e?.message||e))}
  };

  function fmtTime(v){if(!v)return'';try{const d=v.toDate?v.toDate():new Date(v);return d.toLocaleString('vi-VN',{hour12:false})}catch(e){return''}}
  function esc(v){const s=String(v??'');return s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function findAuditErrorNode(){
    const root=document.getElementById('drawerBody');if(!root)return null;
    const nodes=[...root.querySelectorAll('div,span,p,small')];
    const candidates=nodes.filter(el=>/Chưa tải được audit|query requires an index|create_composite/i.test(el.textContent||''));
    if(!candidates.length)return null;
    return candidates.sort((a,b)=>a.children.length-b.children.length)[0];
  }
  async function renderAuditNoIndex(caseId){
    const target=findAuditErrorNode();if(!target)return;
    try{
      const snap=await db.collection('hub_case_events').where('caseId','==',String(caseId)).get();
      const rows=snap.docs.map(d=>d.data()).sort((a,b)=>{
        const ta=a.createdAt?.toMillis?a.createdAt.toMillis():Date.parse(a.createdAt||0)||0;
        const tb=b.createdAt?.toMillis?b.createdAt.toMillis():Date.parse(b.createdAt||0)||0;
        return tb-ta;
      });
      target.innerHTML=rows.length?rows.map(x=>`<div style="padding:5px 0;border-bottom:1px solid #eef1f5"><b>${esc(x.action||'Cập nhật')}</b><div style="font-size:11px;color:#667085">${esc(fmtTime(x.createdAt))} · ${esc(x.actorName||x.actorEmail||x.createdByEmail||'')}</div>${x.detail?`<div style="margin-top:2px">${esc(x.detail)}</div>`:''}</div>`).join(''):'<div style="color:#667085">Chưa có sự kiện audit cho VM này.</div>';
    }catch(e){target.innerHTML='<div style="color:#b42318">Chưa tải được audit theo quyền hiện tại.</div>'}
  }

  // The old detail view uses where(caseId)+orderBy(createdAt), which asks Firestore for a composite index.
  // V2.2.3 reloads the same events with only where(caseId) and sorts client-side.
  try{
    if(typeof openCaseDetail==='function'){
      const old=openCaseDetail;
      openCaseDetail=function(id){
        const out=old.apply(this,arguments);
        [350,900,1800].forEach(ms=>setTimeout(()=>renderAuditNoIndex(id),ms));
        return out;
      };
    }
  }catch(e){console.warn('V2.2.3 audit wrapper skipped',e)}

  setTimeout(()=>{
    document.querySelectorAll('small,div,span').forEach(el=>{
      if(el.children.length===0&&/Phiên bản V2\.2\.2/.test(el.textContent||''))el.textContent=(el.textContent||'').replace('Phiên bản V2.2.2','Phiên bản V2.2.3');
    });
    console.info('HUB-PTN V2.2.3 R&D response + audit fix loaded');
  },0);
})();

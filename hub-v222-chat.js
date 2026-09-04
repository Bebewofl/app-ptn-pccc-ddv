/* HUB-PTN V2.2.2 — fixed chat panel + VM threads for PTN ↔ R&D */
(function(){
  const VERSION='2.2.2';
  const SPACE_KEY='PTN-RD';
  const GENERAL='GENERAL';
  const LS_KEY='hub_v222_rnd_chat_thread';
  let activeThread=localStorage.getItem(LS_KEY)||GENERAL;
  let unsubscribe=null;
  let liveMessages=[];

  function esc(v){
    const s=String(v??'');
    try{if(typeof escapeHtml==='function')return escapeHtml(s)}catch(e){}
    return s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function attr(v){return esc(v).replace(/`/g,'&#96;')}
  function email(){try{return String(currentUser?.email||'').trim().toLowerCase()}catch(e){return ''}}
  function role(){try{return R()?.type||''}catch(e){return ''}}
  function allCases(){try{return Array.isArray(hubCases)?hubCases:[]}catch(e){return []}}
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
  function isRndPair(c){return currentUnit(c)==='RD'||sourceUnit(c)==='RD'||c?.lastExternalUnitCode==='RD'||c?.interdeptPair==='PTN-RD'}
  function pairCases(){return allCases().filter(isRndPair)}
  function caseById(id){return allCases().find(c=>String(c.id)===String(id))||null}
  function fmtTime(v){if(!v)return'';try{const d=v.toDate?v.toDate():new Date(v);return d.toLocaleString('vi-VN',{hour12:false})}catch(e){return''}}
  function threadLabel(id){
    if(id===GENERAL)return 'Trao đổi chung PTN ↔ R&D';
    const c=caseById(id);return c?`${c.id} · ${c.title}`:String(id);
  }
  function canQuoteToResponse(c){
    if(!c)return false;
    const r=role(),cur=currentUnit(c),src=sourceUnit(c);
    if(r==='rnd')return cur==='RD';
    if(r==='head')return cur==='PTN'&&src==='RD';
    return false;
  }

  function panelShell(){
    const opts=[`<option value="${GENERAL}">Trao đổi chung</option>`,...pairCases().map(c=>`<option value="${attr(c.id)}">${esc(c.id)} · ${esc(c.title)}</option>`)].join('');
    return `<aside class="v222-chat-panel" id="v222ChatPanel">
      <div class="v222-chat-title"><div><b>Trao đổi nhanh PTN ↔ R&D</b><span>1 panel cố định · chat chia theo thread VM</span></div><button class="v222-icon-btn" onclick="v222RefreshChat()" title="Làm mới">↻</button></div>
      <div class="v222-thread-select"><label>Luồng trao đổi</label><select id="v222ThreadSelect" onchange="v222SwitchThread(this.value)">${opts}</select></div>
      <div class="v222-thread-meta" id="v222ThreadMeta"></div>
      <div class="v222-chat-messages" id="v222ChatMessages"><div class="v22-empty">Đang tải trao đổi...</div></div>
      <div class="v222-chat-compose"><textarea id="v222ChatInput" rows="2" placeholder="Hỏi/đáp nhanh... Shift+Enter để xuống dòng"></textarea><button class="btn primary" onclick="v222SendChat()">Gửi</button></div>
      <div class="v222-chat-note">Chat dùng trao đổi nhanh. Kết luận kỹ thuật, trạng thái xử lý và tệp chính thức phải lưu trong VM/Phản hồi xử lý để audit.</div>
    </aside>`;
  }

  function wrapRndPage(base){return `<div class="v222-rnd-layout"><div class="v222-rnd-main">${base}</div>${panelShell()}</div>`}

  try{
    if(typeof render==='function'){
      const oldRender=render;
      render=function(page){
        const base=oldRender(page);
        if(page!=='rnd')return base;
        setTimeout(()=>hydratePanel(),0);
        return wrapRndPage(base);
      };
    }
  }catch(e){console.warn('V2.2.2 render wrapper skipped',e)}

  function removePerVmChat(){document.querySelectorAll('#drawerBody .v22-chat').forEach(el=>el.remove())}
  function watchDrawer(){
    removePerVmChat();
    const root=document.getElementById('drawerBody');if(!root)return;
    const mo=new MutationObserver(removePerVmChat);mo.observe(root,{childList:true,subtree:true});setTimeout(()=>mo.disconnect(),5000);
  }

  try{
    if(typeof openCaseDetail==='function'){
      const oldOpen=openCaseDetail;
      openCaseDetail=function(id){
        if(isRndPair(caseById(id)))setThread(String(id),true);
        const out=oldOpen.apply(this,arguments);
        setTimeout(watchDrawer,0);setTimeout(removePerVmChat,250);setTimeout(removePerVmChat,900);
        return out;
      };
    }
  }catch(e){console.warn('V2.2.2 detail wrapper skipped',e)}

  function setThread(id,subscribe){
    const ids=new Set([GENERAL,...pairCases().map(c=>String(c.id))]);
    activeThread=ids.has(String(id))?String(id):GENERAL;
    localStorage.setItem(LS_KEY,activeThread);
    const sel=document.getElementById('v222ThreadSelect');if(sel)sel.value=activeThread;
    renderThreadMeta();
    if(subscribe!==false)subscribeThread();
  }
  window.v222SwitchThread=function(id){setThread(id,true)};

  function renderThreadMeta(){
    const el=document.getElementById('v222ThreadMeta');if(!el)return;
    if(activeThread===GENERAL){el.innerHTML='<b>Trao đổi chung</b><span>Không gắn với VM cụ thể. Nội dung cần quyết định/kết luận phải chuyển sang một VM.</span>';return}
    const c=caseById(activeThread);
    if(!c){el.innerHTML='<b>'+esc(activeThread)+'</b>';return}
    el.innerHTML=`<div><b>${esc(c.id)} · ${esc(c.title)}</b><span>${esc(sourceUnit(c)==='RD'?'R&D → PTN':'PTN → R&D')} · Hiện tại: ${esc(unitLabel(currentUnit(c)))}</span></div><button class="v222-link-btn" onclick="openCaseDetail('${attr(c.id)}')">Mở VM</button>`;
  }

  function sortAsc(rows){return rows.slice().sort((a,b)=>{const ta=a.createdAt?.toMillis?a.createdAt.toMillis():Date.parse(a.createdAt||0)||0;const tb=b.createdAt?.toMillis?b.createdAt.toMillis():Date.parse(b.createdAt||0)||0;return ta-tb})}
  function renderMessages(rows){
    liveMessages=sortAsc(rows);
    const el=document.getElementById('v222ChatMessages');if(!el)return;
    if(!liveMessages.length){el.innerHTML='<div class="v22-empty">Chưa có trao đổi trong luồng này.</div>';return}
    const c=activeThread===GENERAL?null:caseById(activeThread);
    el.innerHTML=liveMessages.map(m=>{
      const mine=String(m.userEmail||'').toLowerCase()===email();
      const quote=(activeThread!==GENERAL&&canQuoteToResponse(c))?`<button class="v222-quote" onclick="v222QuoteToResponse('${attr(m.id)}')">Gắn vào phản hồi</button>`:'';
      return `<div class="v222-msg ${mine?'mine':''}"><div class="v222-msg-head"><b>${esc(m.userName||m.userEmail||'')}</b><span>${esc(fmtTime(m.createdAt))}</span></div><div class="v222-msg-body">${esc(m.message||'')}</div>${quote}</div>`;
    }).join('');
    el.scrollTop=el.scrollHeight;
  }

  function subscribeThread(){
    if(unsubscribe){try{unsubscribe()}catch(e){}unsubscribe=null}
    const target=document.getElementById('v222ChatMessages');if(target)target.innerHTML='<div class="v22-empty">Đang tải trao đổi...</div>';
    if(activeThread===GENERAL){
      try{
        unsubscribe=db.collection('hub_interdept_chat').where('spaceKey','==',SPACE_KEY).onSnapshot(snap=>{
          const rows=snap.docs.map(d=>({id:d.id,...d.data()})).filter(x=>x.threadKey===GENERAL);
          renderMessages(rows);
        },err=>{if(target)target.innerHTML=`<div class="v222-error">Chưa đọc được Trao đổi chung: ${esc(err.message||err)}<br><small>Owner có thể test Hosting trước; R&D cần Rules V2.2.2 để dùng trao đổi chung.</small></div>`});
      }catch(e){if(target)target.innerHTML='<div class="v222-error">Không mở được Trao đổi chung.</div>'}
      return;
    }
    try{
      unsubscribe=db.collection('hub_comments').where('caseId','==',activeThread).onSnapshot(snap=>{
        const rows=snap.docs.map(d=>({id:d.id,...d.data()})).filter(x=>x.type==='interdept_chat');renderMessages(rows);
      },err=>{if(target)target.innerHTML=`<div class="v222-error">Không đọc được chat VM: ${esc(err.message||err)}</div>`});
    }catch(e){if(target)target.innerHTML='<div class="v222-error">Không mở được chat VM.</div>'}
  }

  function hydratePanel(){
    const panel=document.getElementById('v222ChatPanel');if(!panel)return;
    const ids=new Set([GENERAL,...pairCases().map(c=>String(c.id))]);if(!ids.has(activeThread))activeThread=GENERAL;
    const sel=document.getElementById('v222ThreadSelect');if(sel)sel.value=activeThread;
    renderThreadMeta();subscribeThread();
  }
  window.v222RefreshChat=function(){hydratePanel()};

  window.v222SendChat=async function(){
    const input=document.getElementById('v222ChatInput');const msg=input?.value.trim()||'';if(!msg)return;
    try{
      if(activeThread===GENERAL){
        await db.collection('hub_interdept_chat').add({spaceKey:SPACE_KEY,threadKey:GENERAL,type:'space_chat',message:msg,userUid:currentUser.uid,userEmail:email(),userName:currentUser.displayName||email(),createdAt:FV.serverTimestamp(),schemaVersion:VERSION});
      }else{
        await db.collection('hub_comments').add({caseId:activeThread,type:'interdept_chat',message:msg,userUid:currentUser.uid,userEmail:email(),userName:currentUser.displayName||email(),createdAt:FV.serverTimestamp(),schemaVersion:VERSION});
      }
      input.value='';
    }catch(e){alert('Không gửi được chat: '+(e?.message||e))}
  };

  window.v222QuoteToResponse=function(messageId){
    if(activeThread===GENERAL){alert('Trao đổi chung không gắn trực tiếp vào phản hồi. Hãy chọn một VM cụ thể.');return}
    const m=liveMessages.find(x=>String(x.id)===String(messageId));const c=caseById(activeThread);
    if(!m||!c)return;
    if(!canQuoteToResponse(c)){alert('Tài khoản hiện tại không phải bộ phận đang chịu trách nhiệm phản hồi VM này.');return}
    const quote=`Trao đổi nhanh ${fmtTime(m.createdAt)} — ${m.userName||m.userEmail||''}:\n${m.message||''}`;
    openCaseDetail(activeThread);
    let tries=0;const timer=setInterval(()=>{
      tries++;const sid=String(activeThread).replace(/[^a-zA-Z0-9_-]/g,'_');const ta=document.getElementById('v22Desc_'+sid);
      if(ta){ta.value=(ta.value?ta.value+'\n\n':'')+quote;ta.focus();clearInterval(timer)}else if(tries>30){clearInterval(timer);alert('Không tìm thấy ô Mô tả phản hồi. Hãy mở VM và thử lại.')}
    },100);
  };

  // Shift+Enter keeps a new line; Enter sends quick chat.
  document.addEventListener('keydown',e=>{
    if(e.target?.id==='v222ChatInput'&&e.key==='Enter'&&!e.shiftKey){e.preventDefault();window.v222SendChat()}
  });

  setTimeout(()=>{
    document.querySelectorAll('small,div,span').forEach(el=>{
      if(el.children.length===0&&/Phiên bản V2\.2\.1/.test(el.textContent||''))el.textContent=(el.textContent||'').replace('Phiên bản V2.2.1','Phiên bản V2.2.2');
    });
    console.info('HUB-PTN V2.2.2 fixed threaded chat loaded');
  },0);
})();

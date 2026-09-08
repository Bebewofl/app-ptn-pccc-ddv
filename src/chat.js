/* HUB-PTN V2.2.4 — reliable bidirectional PTN ↔ R&D threaded chat */
(function(){
  const VERSION=window.HUB_BUILD_INFO.version;
  const SPACE_KEY='PTN-RD';
  const GENERAL='GENERAL';
  const LS_KEY='hub_v224_rnd_chat_thread';
  let activeThread=GENERAL;
  let sessionUid=null;
  let sending=false;
  let unsubscribeMain=null;
  let legacyToken=0;
  let mainMessages=[];
  let legacyMessages=[];

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
  function isRndPair(c){return !!c&&(currentUnit(c)==='RD'||sourceUnit(c)==='RD'||c?.lastExternalUnitCode==='RD'||c?.interdeptPair==='PTN-RD')}
  function pairCases(){return allCases().filter(isRndPair)}
  function caseById(id){return allCases().find(c=>String(c.id)===String(id))||null}
  function fmtTime(v){if(!v)return'';try{const d=v.toDate?v.toDate():new Date(v);return d.toLocaleString('vi-VN',{hour12:false})}catch(e){return''}}
  function canQuoteToResponse(c){
    if(!c)return false;
    const r=role(),cur=currentUnit(c),src=sourceUnit(c);
    if(r==='rnd')return cur==='RD';
    if(r==='head')return cur==='PTN'&&src==='RD';
    return false;
  }
  function allowedThread(id){return id===GENERAL||pairCases().some(c=>String(c.id)===String(id))}

  function panelShell(){
    const opts=[`<option value="${GENERAL}">Trao đổi chung</option>`,...pairCases().map(c=>`<option value="${attr(c.id)}">${esc(c.id)} · ${esc(c.title)}</option>`)].join('');
    return `<aside class="v222-chat-panel" id="v222ChatPanel">
      <div class="v222-chat-title"><div><b>Trao đổi nhanh PTN ↔ R&D</b><span>Đồng bộ hai chiều · realtime · chia theo thread VM</span></div><button class="v222-icon-btn" onclick="v222RefreshChat()" title="Làm mới">↻</button></div>
      <div class="v222-thread-select"><label>Luồng trao đổi</label><select id="v222ThreadSelect" onchange="v222SwitchThread(this.value)">${opts}</select></div>
      <div class="v222-thread-meta" id="v222ThreadMeta"></div>
      <div class="v222-chat-messages" id="v222ChatMessages"><div class="v22-empty">Đang đồng bộ trao đổi...</div></div>
      <div class="v222-chat-compose"><textarea id="v222ChatInput" rows="2" placeholder="Hỏi/đáp nhanh... Shift+Enter để xuống dòng"></textarea><button class="btn primary" id="v224SendBtn" onclick="v222SendChat()">Gửi</button></div>
      <div class="v222-chat-note" id="v224ChatState">Chat dùng trao đổi nhanh. Kết luận kỹ thuật/trạng thái chính thức phải lưu trong VM/Phản hồi xử lý để audit.</div>
    </aside>`;
  }
  function wrapRndPage(base){return `<div class="v222-rnd-layout"><div class="v222-rnd-main">${base}</div>${panelShell()}</div>`}

  function stop(){
    legacyToken++;
    if(unsubscribeMain)unsubscribeMain();
    unsubscribeMain=null;mainMessages=[];legacyMessages=[];
  }
  function reset(){stop();sessionUid=null;activeThread=GENERAL;sending=false}
  function selectCase(id){if(isRndPair(caseById(id)))setThread(String(id),!!document.getElementById('v222ChatPanel'))}

  function setThread(id,subscribe){
    activeThread=allowedThread(String(id))?String(id):GENERAL;
    try{localStorage.setItem(LS_KEY+'_'+currentUser.uid,activeThread)}catch{}
    const sel=document.getElementById('v222ThreadSelect');if(sel)sel.value=activeThread;
    renderThreadMeta();
    if(subscribe!==false)subscribeThread();
  }
  window.v222SwitchThread=id=>setThread(id,true);

  function renderThreadMeta(){
    const el=document.getElementById('v222ThreadMeta');if(!el)return;
    if(activeThread===GENERAL){el.innerHTML='<div><b>Trao đổi chung</b><span>PTN ↔ R&D · không gắn với VM cụ thể</span></div>';return}
    const c=caseById(activeThread);
    if(!c){el.innerHTML='<b>'+esc(activeThread)+'</b>';return}
    el.innerHTML=`<div><b>${esc(c.id)} · ${esc(c.title)}</b><span>${esc(sourceUnit(c)==='RD'?'R&D → PTN':'PTN → R&D')} · Hiện tại: ${esc(unitLabel(currentUnit(c)))}</span></div><button class="v222-link-btn" onclick="openCaseDetail('${attr(c.id)}')">Mở VM</button>`;
  }

  function millis(v){try{return v?.toMillis?v.toMillis():(Date.parse(v||0)||0)}catch(e){return 0}}
  function mergeRows(){
    const map=new Map();
    [...legacyMessages,...mainMessages].forEach(m=>{
      const key=m._dedupeKey||m.id||`${m.userEmail}|${millis(m.createdAt)}|${m.message}`;
      if(!map.has(key))map.set(key,m);
    });
    return [...map.values()].sort((a,b)=>millis(a.createdAt)-millis(b.createdAt));
  }
  function renderMessages(){
    const rows=mergeRows();
    const el=document.getElementById('v222ChatMessages');if(!el)return;
    if(!rows.length){el.innerHTML='<div class="v22-empty">Chưa có trao đổi trong luồng này.</div>';return}
    const c=activeThread===GENERAL?null:caseById(activeThread);
    el.innerHTML=rows.map(m=>{
      const mine=String(m.userEmail||'').toLowerCase()===email();
      const quote=(activeThread!==GENERAL&&canQuoteToResponse(c))?`<button class="v222-quote" onclick="v222QuoteToResponse('${attr(m.id||'')}')">Gắn vào phản hồi</button>`:'';
      return `<div class="v222-msg ${mine?'mine':''}"><div class="v222-msg-head"><b>${esc(m.userName||m.userEmail||'')}</b><span>${esc(fmtTime(m.createdAt))}</span></div><div class="v222-msg-body">${esc(m.message||'')}</div>${quote}</div>`;
    }).join('');
    el.scrollTop=el.scrollHeight;
  }

  async function loadLegacy(thread,token){
    legacyMessages=[];
    if(thread===GENERAL){renderMessages();return}
    try{
      const snap=await db.collection('hub_comments').where('caseId','==',thread).get();
      if(token!==legacyToken)return;
      legacyMessages=snap.docs.map(d=>({id:'legacy_'+d.id,_legacyId:d.id,...d.data()})).filter(x=>x.type==='interdept_chat').map(x=>({...x,_dedupeKey:`legacy:${x._legacyId}`}));
    }catch(e){
      console.info('Legacy VM chat read skipped:',e?.code||e?.message||e);
    }
    if(token===legacyToken)renderMessages();
  }

  function subscribeThread(){
    if(unsubscribeMain){try{unsubscribeMain()}catch(e){}unsubscribeMain=null}
    mainMessages=[];legacyMessages=[];legacyToken++;const token=legacyToken;const thread=activeThread;
    const target=document.getElementById('v222ChatMessages');if(target)target.innerHTML='<div class="v22-empty">Đang đồng bộ trao đổi...</div>';
    try{
      // Single-field query only: no composite index. Both GENERAL and VM threads use the same collection.
      unsubscribeMain=db.collection('hub_interdept_chat').where('spaceKey','==',SPACE_KEY).onSnapshot(snap=>{
        if(token!==legacyToken)return;
        mainMessages=snap.docs.map(d=>({id:d.id,...d.data()})).filter(x=>String(x.threadKey||'')===thread);
        renderMessages();
      },err=>{
        if(token!==legacyToken)return;
        mainMessages=[];legacyMessages=[];
        if(target)target.innerHTML=`<div class="v222-error">Không đồng bộ được chat hai chiều: ${esc(err.message||err)}</div>`;
      });
      loadLegacy(activeThread,token);
    }catch(e){if(target)target.innerHTML='<div class="v222-error">Không mở được kênh chat PTN ↔ R&D.</div>'}
  }

  function hydratePanel(){
    const panel=document.getElementById('v222ChatPanel');if(!panel)return;
    if(sessionUid!==currentUser?.uid){
      reset();sessionUid=currentUser?.uid;
      try{activeThread=localStorage.getItem(LS_KEY+'_'+sessionUid)||GENERAL}catch{}
    }
    if(!allowedThread(activeThread))activeThread=GENERAL;
    const sel=document.getElementById('v222ThreadSelect');if(sel)sel.value=activeThread;
    renderThreadMeta();subscribeThread();
  }
  window.v222RefreshChat=hydratePanel;

  function setSending(on,msg){
    const btn=document.getElementById('v224SendBtn');if(btn){btn.disabled=!!on;btn.textContent=on?'Đang gửi...':'Gửi'}
    const state=document.getElementById('v224ChatState');if(state&&msg)state.textContent=msg;
  }
  window.v222SendChat=async function(){
    if(sending)return;
    const input=document.getElementById('v222ChatInput');const msg=input?.value.trim()||'';if(!msg)return;
    if(!currentUser?.uid){alert('Phiên đăng nhập chưa sẵn sàng. Hãy F5 và thử lại.');return}
    if(!allowedThread(activeThread)){alert('VM không còn trong phạm vi trao đổi.');return}
    const sentThread=activeThread;const sentUid=currentUser.uid;sending=true;
    setSending(true,'Đang gửi và đồng bộ tới PTN/R&D...');
    try{
      await db.collection('hub_interdept_chat').add({
        spaceKey:SPACE_KEY,
        threadKey:sentThread,
        caseId:sentThread===GENERAL?'':sentThread,
        type:'interdept_chat',message:msg,
        userUid:currentUser.uid,userEmail:email(),userName:currentUser.displayName||email(),
        roleType:role(),createdAt:FV.serverTimestamp(),schemaVersion:VERSION
      });
      if(currentUser?.uid===sentUid&&activeThread===sentThread&&input.value.trim()===msg)input.value='';
      setSending(false,'Đã gửi. Tin nhắn được đồng bộ realtime cho PTN và R&D trong đúng thread này.');
    }catch(e){
      setSending(false,'Gửi thất bại.');
      alert('Không gửi được chat PTN ↔ R&D: '+(e?.message||e));
    }finally{sending=false}
  };

  window.v222QuoteToResponse=function(messageId){
    if(activeThread===GENERAL){alert('Trao đổi chung không gắn trực tiếp vào phản hồi. Hãy chọn một VM cụ thể.');return}
    const m=mergeRows().find(x=>String(x.id)===String(messageId));const c=caseById(activeThread);
    if(!m||!c)return;
    if(!canQuoteToResponse(c)){alert('Tài khoản hiện tại không phải bộ phận đang chịu trách nhiệm phản hồi VM này.');return}
    const quote=`Trao đổi nhanh ${fmtTime(m.createdAt)} — ${m.userName||m.userEmail||''}:\n${m.message||''}`;
    const quotedThread=activeThread;
    openCaseDetail(quotedThread);
    let tries=0;const timer=setInterval(()=>{
      tries++;if(activeThread!==quotedThread){clearInterval(timer);return}const sid=String(quotedThread).replace(/[^a-zA-Z0-9_-]/g,'_');const ta=document.getElementById('v22Desc_'+sid);
      if(ta){ta.value=(ta.value?ta.value+'\n\n':'')+quote;ta.focus();clearInterval(timer)}else if(tries>30){clearInterval(timer);alert('Không tìm thấy ô Mô tả phản hồi. Hãy mở VM và thử lại.')}
    },100);
  };

  document.addEventListener('keydown',e=>{
    if(e.target?.id==='v222ChatInput'&&e.key==='Enter'&&!e.shiftKey){e.preventDefault();window.v222SendChat()}
  });

  window.HUB_CHAT={wrap:wrapRndPage,hydrate:hydratePanel,selectCase,isPair:isRndPair,stop,reset};
})();

/* HUB-PTN V2.2.5 — stable runtime bootstrap; no MutationObserver loop */
(function(){
  const VERSION='2.2.5';
  const DISPLAY='Phiên bản V2.2.5 · Tạo bởi Dương Đức Vượng';

  window.HUB_BUILD_INFO={
    version:VERSION,
    display:DISPLAY,
    baseline:'HUB V2.1.1 production',
    builtFromGitHub:true
  };

  function applyVersion(){
    const nodes=document.querySelectorAll('small,span,p,div');
    for(const el of nodes){
      if(el.children.length) continue;
      const t=String(el.textContent||'').trim();
      if(!t) continue;
      if(/^Phiên bản\s+V\d+(?:\.\d+)*(?:\s*·\s*Tạo bởi Dương Đức Vượng)?$/i.test(t)){
        if(t!==DISPLAY) el.textContent=DISPLAY;
      }
    }
  }

  function markReady(){
    document.documentElement.setAttribute('data-hub-version',VERSION);
    document.documentElement.setAttribute('data-hub-ready','1');
    applyVersion();
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',markReady,{once:true});
  }else{
    markReady();
  }

  [150,500,1200,2500].forEach(ms=>setTimeout(applyVersion,ms));
  console.info('HUB-PTN V2.2.5 runtime ready');
})();

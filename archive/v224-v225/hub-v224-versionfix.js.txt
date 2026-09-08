/* HUB-PTN V2.2.4 — force visible version label after all overlays */
(function(){
  const TARGET='Phiên bản V2.2.4';
  function applyVersion(){
    document.querySelectorAll('small,div,span,p').forEach(el=>{
      if(el.children.length>0)return;
      const t=String(el.textContent||'');
      if(/Phiên bản\s+V\d+(?:\.\d+)*/i.test(t)){
        el.textContent=t.replace(/Phiên bản\s+V\d+(?:\.\d+)*/i,TARGET);
      }
    });
  }
  applyVersion();
  [50,150,400,900,1800,3200].forEach(ms=>setTimeout(applyVersion,ms));
  const mo=new MutationObserver(()=>applyVersion());
  try{mo.observe(document.body,{childList:true,subtree:true,characterData:true})}catch(e){}
  setTimeout(()=>{try{mo.disconnect()}catch(e){}},8000);
  console.info('HUB-PTN visible version locked to V2.2.4');
})();

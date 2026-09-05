/* HUB-PTN V2.2.4 SAFE visible version lock - FIX2 */
(function(){
  const TARGET='Phiên bản V2.2.4';
  let applying=false;
  function applyVersion(){
    if(applying)return;
    applying=true;
    try{
      document.querySelectorAll('small,div,span,p').forEach(el=>{
        if(el.children.length>0)return;
        const oldText=String(el.textContent||'');
        if(!/Phiên bản\s+V\d+(?:\.\d+)*/i.test(oldText))return;
        const newText=oldText.replace(/Phiên bản\s+V\d+(?:\.\d+)*/i,TARGET);
        if(newText!==oldText)el.textContent=newText;
      });
    }finally{applying=false;}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',applyVersion,{once:true});
  else applyVersion();
  [100,350,900,1800,3200,6000].forEach(ms=>setTimeout(applyVersion,ms));
  let mo=null;
  try{
    mo=new MutationObserver(()=>applyVersion());
    if(document.body)mo.observe(document.body,{childList:true,subtree:true});
    setTimeout(()=>{try{if(mo)mo.disconnect()}catch(e){}},7000);
  }catch(e){}
  console.info('HUB-PTN visible version safe lock V2.2.4 FIX2');
})();

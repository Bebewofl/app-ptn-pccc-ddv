'use strict';
const {onRequest}=require('firebase-functions/v2/https');
const {resources}=require('./data');
const {need,jsonData}=require('./domain');
const issues=require('./issues'), accounts=require('./accounts'), files=require('./files');
const demoRoles=['director','ptn','pkt','engineer','qlcl','office','sampling','lead','staff','admin','accounts','viewer'];
async function handler(req,res) {
  res.set('Cache-Control','private, no-store');
  res.set('X-Content-Type-Options','nosniff');
  try{
    need(req.method==='POST','Phương thức không hợp lệ.',405);
    need(req.is('application/json'),'Nội dung yêu cầu không hợp lệ.',415);
    const {db,auth,bucket,local}=resources(), input=req.body||{};
    const path=req.path.replace(/^\/api\//,'').replace(/^\//,'');
    if(path==='demo-login'){
      need(local&&demoRoles.includes(input.role),'Chức năng không khả dụng.',404);
      return res.json({token:await auth.createCustomToken('demo-'+input.role)});
    }
    let id;
    try {const token=/^Bearer (.+)$/.exec(req.get('Authorization')||'')?.[1];need(token,'Cần đăng nhập.',401);id=(await auth.verifyIdToken(token,true)).uid;}
    catch {return res.status(401).json({error:'Phiên đăng nhập đã hết hạn.'});}
    const services={db,auth,bucket};
    if(path==='file-read'){
      const f=await files.download(services,id,input);
      res.set('Content-Disposition',"attachment; filename*=UTF-8''"+encodeURIComponent(f.name));
      return res.type(f.type).send(f.bytes);
    }
    const handlers={
      workspace:()=>issues.workspace(db,id), detail:()=>issues.detail(db,id,input.code),
      create:()=>issues.create(db,id,input), action:()=>issues.act(db,id,input), seen:()=>issues.seen(db,id,input),
      'accounts-list':()=>accounts.list(db,id),'accounts-save':()=>accounts.save(services,id,input),
      'file-add':()=>files.upload(services,id,input)
    };
    need(Object.hasOwn(handlers,path),'Đường dẫn không hợp lệ.',404);
    return res.json(jsonData(await handlers[path]()));
  }catch(err){
    const status=Number.isInteger(err.status)?err.status:500;
    if(status===500)console.error('HUB request failed',String(err.code||err.name),String(err.message||'').slice(0,190));
    return res.status(status).json({error:status===500?'Chưa lưu được dữ liệu. Kiểm tra kết nối và thử lại.':err.message});
  }
}
exports.hubLiteApi=onRequest({region:'us-central1',maxInstances:3,memory:'256MiB',timeoutSeconds:60,
  serviceAccount:'hub-v3-runtime@hub-ptn-test.iam.gserviceaccount.com'},handler);

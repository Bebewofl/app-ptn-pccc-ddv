'use strict';
const crypto=require('node:crypto');
const {need,text,rid,code,canRead,states}=require('./domain');
const {active,caseData,cases,now,record}=require('./data');
const maxBytes=5*1024*1024;
const types={
  pdf:'application/pdf',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',
  docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
};
function parse(input){
  const name=text(input.name,150,true),ext=name.split('.').pop().toLowerCase(),type=types[ext];
  need(type && !/[/\\\u0000-\u001f]/.test(name),'Chọn ảnh JPG, PNG, WebP, PDF, DOCX hoặc XLSX.');
  need(typeof input.data==='string'&&input.data.length>0&&input.data.length<=Math.ceil(maxBytes/3)*4,'Tệp vượt quá 5 MB.');
  const bytes=Buffer.from(input.data,'base64');need(bytes.length>0&&bytes.length<=maxBytes,'Dung lượng tệp không hợp lệ.');
  const header=bytes.subarray(0,12);
  const matches={pdf:header.toString('ascii').startsWith('%PDF-'),png:header.subarray(0,8).toString('hex')==='89504e470d0a1a0a',
    jpg:header.subarray(0,3).toString('hex')==='ffd8ff',jpeg:header.subarray(0,3).toString('hex')==='ffd8ff',
    webp:header.toString('ascii',0,4)==='RIFF'&&header.toString('ascii',8)==='WEBP'};
  const office=ext==='docx'||ext==='xlsx';
  need(office ? header.length>=4&&header.subarray(0,4).toString('hex')==='504b0304'&&bytes.includes('[Content_Types].xml')&&bytes.includes(ext==='docx'?'word/':'xl/') : matches[ext], 'Nội dung tệp không khớp định dạng đã chọn.');
  return {name,type,bytes,hash:crypto.createHash('sha256').update(bytes).digest('hex')};
}
function writeAllowed(m,id,c){
  need(m.active && c.readers.includes(id) && c.status!==states.closed &&
    (c.reporterUid===id||c.ownerUid===id||c.nextUid===id||c.collaborators?.includes(id)),'Không có quyền bổ sung tệp vào hồ sơ.',403);
}
async function upload({db,bucket},id,input){
  const key=rid(input.requestId), file=parse(input), ref=cases(db).doc(code(input.code)), meta=ref.collection('files').doc(key);
  const path='hub-v3/'+ref.id+'/'+key, object=bucket.file(path);
  const existing=await db.runTransaction(async tx=>{
    const m=await active(db,id,tx), c=await caseData(db,ref.id,tx);writeAllowed(m,id,c);
    const s=await tx.get(meta);
    if(s.exists){const d=s.data();need(d.uploader===id&&d.sha256===file.hash&&d.name===file.name,'Lần tải đã dùng cho một tệp khác.',409);return d.state;}
    tx.create(meta,{name:file.name,type:file.type,size:file.bytes.length,sha256:file.hash,uploader:id,uploaderName:m.name,state:'pending',startedAt:now()});
    return 'pending';
  });
  if(existing==='ready')return {id:key};
  try {await object.save(file.bytes,{resumable:false,preconditionOpts:{ifGenerationMatch:0},metadata:{contentType:'application/octet-stream',cacheControl:'private, no-store',metadata:{sha256:file.hash}}});}
  catch(e){if(Number(e.code)!==412)throw e;const [metadata]=await object.getMetadata();need(metadata.metadata?.sha256===file.hash,'Dữ liệu lưu không khớp.',409);}
  await db.runTransaction(async tx=>{
    const m=await active(db,id,tx), c=await caseData(db,ref.id,tx);writeAllowed(m,id,c);
    const s=await tx.get(meta);
    if(s.data()?.state==='ready')return;
    need(s.data()?.state==='pending' && s.data().sha256===file.hash,'Cần kiểm tra lại tệp đang chờ.',409);
    tx.update(meta,{state:'ready',at:now()});
    record(tx,ref,c,{lastAction:'attach',lastNote:file.name,lastBasis:'',actorUid:id},id,m,'file-'+key,{fileId:key,sha256:file.hash});
  });
  return {id:key};
}
async function download({db,bucket},id,input){
  const m=await active(db,id),ref=cases(db).doc(code(input.code)), c=await caseData(db,ref.id);
  need(canRead(m,id,c),'Hồ sơ ngoài phạm vi tài khoản.',404);
  const key=rid(input.fileId),f=(await ref.collection('files').doc(key).get()).data();
  need(f?.state==='ready','Tệp chưa hoàn tất.',404);
  const [bytes]=await bucket.file('hub-v3/'+ref.id+'/'+key).download();
  need(bytes.length===f.size&&crypto.createHash('sha256').update(bytes).digest('hex')===f.sha256,'Tệp chưa đối soát được.',409);
  return {bytes,type:f.type,name:f.name};
}
module.exports={upload,download,maxBytes};

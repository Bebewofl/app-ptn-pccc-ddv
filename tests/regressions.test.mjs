import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs/promises';
const app=await fs.readFile(new URL('../src/app.js',import.meta.url),'utf8');
const inter=await fs.readFile(new URL('../src/interdept.js',import.meta.url),'utf8');
const chat=await fs.readFile(new URL('../src/chat.js',import.meta.url),'utf8');
function functionSource(name){
  const start=app.search(new RegExp('^(?:async )?function '+name+'\\(','m'));
  assert.ok(start>=0,name);
  const rest=app.slice(start);const next=rest.slice(1).search(/^(?:async )?function /m);
  return next<0?rest:rest.slice(0,next+1);
}
function harness(){
  const elements=new Map(),writes=[],listeners=[],alerts=[];
  const element=id=>{if(!elements.has(id))elements.set(id,{value:'',innerHTML:'',textContent:'',files:[],isConnected:true,children:[],classList:{add(){},remove(){},toggle(){}},appendChild(){}});return elements.get(id)};
  const ctx=vm.createContext({console,URL,Map,Set,Date,Promise,CSS:{escape:String},setTimeout(){},setInterval(){},clearInterval(){},
    HUB_BUILD_INFO:{version:'2.2.5'},currentUser:{uid:'ptn',email:'ptn@example.com',displayName:'PTN'},currentAccess:{permissions:[]},hubCases:[],
    R:()=>({type:'head',groups:[]}),accessUnits:()=>['RD'],hasPermission:()=>false,
    alert:msg=>alerts.push(msg),confirm:()=>false,localStorage:{getItem:()=>null,setItem(){}},
    document:{getElementById:element,querySelectorAll:()=>[],addEventListener(){},createElement:()=>({})},
    FV:{serverTimestamp:()=>123},
    db:{collection(name){return {
      where(field,op,value){const q={where(nextField,nextOp,nextValue){q.thread=nextValue;return q},get:async()=>({docs:[],empty:true}),onSnapshot(cb,err){const l={name,field,value,thread:q.thread,cb,err,stopped:false};listeners.push(l);return()=>l.stopped=true}};return q},
      async add(data){writes.push({name,data})},doc(id){return {async set(data){writes.push({name,id,data})},async update(data){writes.push({name,id,data})}}}
    }}}
  });ctx.window=ctx;
  return {ctx,element,writes,listeners,alerts,load(code){vm.runInContext(code,ctx)}};
}

test('source group keeps VM after routing; R&D overview does not widen private handling',()=>{
  const h=harness();h.load(inter);
  h.ctx.caseMatchesAssignedUnit=c=>c.currentUnitCode==='RD';
  for(const name of ['groupCanSee','visibleCases','canSeePrivateHandling','caseQueryForRole'])h.load(functionSource(name));
  const c={id:'VM-011',sourceGroup:'3TR',currentUnitCode:'RD'};
  h.ctx.hubCases=[c];h.ctx.R=()=>({type:'lead',groups:['3TR']});
  assert.equal(h.ctx.visibleCases().length,1);
  c.currentUnitCode='KT';assert.equal(h.ctx.visibleCases().length,1);
  assert.equal(h.ctx.canSeePrivateHandling(c),false);
  h.ctx.R=()=>({type:'rnd'});h.ctx.currentUser.email='ngocson707@gmail.com';
  assert.equal(h.ctx.groupCanSee(c),false,'email alone grants nothing');
  h.ctx.currentAccess.permissions=['rnd.tech.overview'];
  assert.equal(h.ctx.groupCanSee(c),true);
  assert.equal(h.ctx.canSeePrivateHandling(c),false);
  c.currentUnitCode='RD';assert.equal(h.ctx.canSeePrivateHandling(c),true);
});

test('audit uses only caseId, sorts locally, and escapes content',async()=>{
  const h=harness();const query=[];
  h.ctx.db={collection(name){assert.equal(name,'hub_case_events');return {where(...args){query.push(args);return {get:async()=>({empty:false,docs:[{data:()=>({createdAt:{toMillis:()=>20},action:'later'})},{data:()=>({createdAt:{toMillis:()=>10},action:'<first>'})}]})}}}}};
  h.ctx.escapeHtml=s=>String(s).replaceAll('<','&lt;');h.ctx.fmtTs=()=>'';
  h.load(functionSource('loadCaseEvents'));await h.ctx.loadCaseEvents('VM-011');
  assert.deepEqual(query,[['caseId','==','VM-011']]);
  const output=h.element('caseAuditBox').innerHTML;
  assert.ok(output.indexOf('&lt;first>')<output.indexOf('later'));assert.ok(!output.includes('<first>'));
});

test('R&D response preserves author compatibility, attachment and link payloads',async()=>{
  const h=harness();h.load(inter);h.ctx.R=()=>({type:'rnd'});h.ctx.currentAccess.permissions=['rnd.response.manage'];
  h.ctx.hubCases=[{id:'VM-011',currentUnitCode:'RD'}];
  h.ctx.FileReader=class{readAsDataURL(){this.result='data:text/plain;base64,aGk=';this.onload()}};
  h.element('v22Desc_VM-011').value='Kết quả thử';
  h.element('v22Link_VM-011').value='https://example.com/result';
  h.element('v22Files_VM-011').files=[{name:'result.txt',size:2,type:'text/plain'}];
  await h.ctx.v22SaveResponse('VM-011');
  const response=h.writes[0].data;
  assert.equal(response.type,'department_response');assert.equal(response.caseId,'VM-011');
  assert.equal(response.userUid,response.authorUid);assert.equal(response.userUid,response.createdByUid);
  assert.equal(response.attachments[0].dataUrl,'data:text/plain;base64,aGk=');
  assert.equal(response.externalLinks[0],'https://example.com/result');
  assert.equal(h.writes[1].name,'hub_case_events');
  h.ctx.hubCases[0].currentUnitCode='PTN';
  await h.ctx.v22SaveResponse('VM-011');assert.equal(h.writes.length,2);
});

test('create attaches only to the actual allocated VM; failed creation writes no attachments',async()=>{
  const h=harness();let saved=null;
  h.ctx.HUB_INTERDEPT={prepareCreateAttachments:async()=>({attachments:['file']}),saveCreateAttachments:async(id,data)=>saved={id,data}};
  h.ctx.getNextCaseCode=async()=>'VM-123';h.ctx.emailKey=x=>x;h.ctx.writeCaseEvent=async()=>{};h.ctx.closeDrawer=()=>{};
  h.element('cTitle').value='New VM';h.load(functionSource('createCase'));
  assert.equal(await h.ctx.createCase(),'VM-123');assert.equal(saved.id,'VM-123');
  saved=null;h.ctx.db.collection=()=>({doc:()=>({set:async()=>{throw Error('denied')}})});
  await h.ctx.createCase();assert.equal(saved,null);
  h.element('cTitle').value='';await h.ctx.createCase();assert.equal(saved,null);
});

test('chat uses one realtime store, isolates threads and ignores late callbacks',async()=>{
  const h=harness();h.ctx.hubCases=[{id:'VM-011',currentUnitCode:'RD'},{id:'VM-012',sourceUnitCode:'RD'}];h.load(chat);
  h.ctx.HUB_CHAT.hydrate();h.ctx.v222SwitchThread('VM-011');
  const a=h.listeners.at(-1);
  const snap={docs:[{id:'a',data:()=>({threadKey:'VM-011',message:'only 11'})},{id:'b',data:()=>({threadKey:'VM-012',message:'only 12'})},{id:'g',data:()=>({threadKey:'GENERAL',message:'general'})}]};
  a.cb(snap);assert.ok(h.element('v222ChatMessages').innerHTML.includes('only 11'));assert.ok(!h.element('v222ChatMessages').innerHTML.includes('only 12'));
  h.ctx.v222SwitchThread('VM-012');const b=h.listeners.at(-1);assert.equal(a.stopped,true);b.cb(snap);
  a.cb(snap);assert.ok(!h.element('v222ChatMessages').innerHTML.includes('only 11'));
  h.element('v222ChatInput').value='R&D reply';h.ctx.currentUser={uid:'rd',email:'rd@example.com'};await h.ctx.v222SendChat();
  assert.equal(h.writes[0].name,'hub_interdept_chat');assert.equal(h.writes[0].data.threadKey,'VM-012');
  h.ctx.v222SwitchThread('GENERAL');h.element('v222ChatInput').value='PTN reply';h.ctx.currentUser={uid:'ptn',email:'ptn@example.com'};await h.ctx.v222SendChat();
  assert.equal(h.writes[1].data.threadKey,'GENERAL');
  h.ctx.HUB_CHAT.reset();assert.ok(h.listeners.every(x=>x.stopped));
  assert.ok(h.listeners.every(x=>x.field==='spaceKey'&&x.value==='PTN-RD'));
});

test('duplicate Enter clicks do not create duplicate chat writes',async()=>{
  const h=harness();h.load(chat);let resolve;
  h.ctx.db.collection=()=>({add:()=>new Promise(r=>{resolve=r})});
  h.element('v222ChatInput').value='hello';const first=h.ctx.v222SendChat();
  assert.ok(resolve);const original=resolve;await h.ctx.v222SendChat();assert.equal(resolve,original);
  resolve();await first;
});

test('complete application loads modules before auth and renders PTN/R&D without runtime overrides',()=>{
  const h=harness();let authCallback;
  h.ctx.firebase={firestore:Object.assign(()=>h.ctx.db,{FieldValue:h.ctx.FV}),auth:()=>({onAuthStateChanged:cb=>{authCallback=cb}})};
  h.ctx.location={search:'',href:'https://example.com/'};h.ctx.URLSearchParams=URLSearchParams;
  h.ctx.document.querySelector=()=>null;
  h.load(inter);h.load(chat);h.load(app);
  assert.equal(typeof authCallback,'function');
  h.load("currentUser={uid:'ptn',email:'ptn@example.com'};currentAccess={role:'head',spaces:['ptn','rnd'],permissions:[]};hubCases=[{id:'VM-011',title:'Demo',sourceGroup:'3TR',currentUnitCode:'RD',currentDesk:'R&D',status:'Đang xử lý'}];");
  assert.match(vm.runInContext("render('rnd')",h.ctx),/v222ChatPanel/);
  assert.match(vm.runInContext("render('ptn')",h.ctx),/VM-011/);
});

test('private handling queries the current department and writes an explicit unit tag',async()=>{
  const h=harness();let filter,saved;
  h.ctx.R=()=>({type:'rnd',label:'R&D'});h.ctx.hubCases=[{id:'VM-011',currentDesk:'R&D'}];
  h.ctx.canSeePrivateHandling=()=>true;h.ctx.emailKey=x=>x;h.ctx.escapeHtml=String;h.ctx.fmtTs=()=>'';
  h.load(functionSource('caseUnitCode'));
  h.ctx.db={collection:()=>({doc:()=>({collection:()=>({where(...args){filter=args;return {get:async()=>({docs:[]})}},add:async data=>saved=data})})})};
  h.load(functionSource('loadPrivateHandling'));h.load(functionSource('addPrivateNote'));
  await h.ctx.loadPrivateHandling('VM-011');assert.deepEqual(filter,['unitCode','==','RD']);
  await h.ctx.addPrivateNote('VM-011','Private RD note');assert.equal(saved.unitCode,'RD');assert.equal(saved.text,'Private RD note');
});

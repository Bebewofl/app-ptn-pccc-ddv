import {before,after,test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {initializeTestEnvironment,assertSucceeds,assertFails} from '@firebase/rules-unit-testing';
import {doc,collection,setDoc,updateDoc,getDoc,getDocs,query,where,onSnapshot,deleteField} from 'firebase/firestore';

if(process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8085')throw Error('Tests require local emulator at 127.0.0.1:8085; refusing any other target');
let env,baseline;
const members={
  head:{role:'head',unitCodes:['PTN'],groups:['3TR','KN'],permissions:[]},
  rd:{role:'rnd',unitCodes:['RD'],groups:[],permissions:['rnd.tech.overview','rnd.response.manage']},
  rdBasic:{role:'rnd',unitCodes:['RD'],groups:[],permissions:[]},
  lead:{role:'lead3tr',unitCodes:['PTN'],groups:['3TR'],permissions:[]},
  ktv:{role:'ktv3tr',unitCodes:['PTN'],groups:['3TR'],permissions:[]},
  office:{role:'office',unitCodes:['KT'],groups:[],permissions:[]},
  inactive:{role:'rnd',unitCodes:['RD'],groups:[],permissions:['rnd.tech.overview'],active:false}
};
const cases={
  'VM-011':{sourceGroup:'3TR',currentDesk:'R&D',currentUnitCode:'RD',sourceUnitCode:'PTN'},
  'VM-012':{sourceGroup:'KN',currentDesk:'R&D',currentUnitCode:'RD',sourceUnitCode:'PTN'},
  'VM-013':{sourceGroup:'3TR',currentDesk:'Khối Văn phòng / Kế toán',currentUnitCode:'KT',sourceUnitCode:'PTN'},
  'VM-014':{sourceGroup:'3TR',currentDesk:'PTN',currentUnitCode:'PTN',sourceUnitCode:'RD'}
};
const db=(who,e=env)=>e.authenticatedContext(who,{email:who+'@example.com'}).firestore();
const chatData=(who,thread)=>({spaceKey:'PTN-RD',threadKey:thread,caseId:thread==='GENERAL'?'':thread,type:'interdept_chat',message:'hello',userUid:who,userEmail:who+'@example.com'});
async function seed(e){await e.withSecurityRulesDisabled(async ctx=>{
  const d=ctx.firestore();
  for(const [id,m] of Object.entries(members))await setDoc(doc(d,'hub_access',id+'@example.com'),{active:true,...m});
  for(const [id,c] of Object.entries(cases))await setDoc(doc(d,'hub_cases',id),{title:id,status:'Đang xử lý',...c});
  await setDoc(doc(d,'hub_cases/VM-011/private_notes/old'),{text:'Legacy PTN secret',authorUid:'head',authorEmail:'head@example.com'});
  await setDoc(doc(d,'hub_cases/VM-011/private_notes/ptn'),{unitCode:'PTN',text:'PTN secret'});
  await setDoc(doc(d,'hub_cases/VM-011/private_notes/rd'),{unitCode:'RD',text:'RD secret'});
  await setDoc(doc(d,'hub_interdept_chat/kn'),chatData('rd','VM-012'));
  await setDoc(doc(d,'hub_interdept_chat/three'),chatData('rd','VM-011'));
  await setDoc(doc(d,'hub_case_events/event'),{caseId:'VM-011',action:'Created'});
});}
before(async()=>{
  env=await initializeTestEnvironment({projectId:'demo-hub-candidate',firestore:{host:'127.0.0.1',port:8085,rules:await fs.readFile('rules/firestore.candidate.rules','utf8')}});
  baseline=await initializeTestEnvironment({projectId:'demo-hub-received',firestore:{host:'127.0.0.1',port:8085,rules:await fs.readFile('rules/production-received-2026-09-08.rules','utf8')}});
  await seed(env);await seed(baseline);
});
after(async()=>{await env?.cleanup();await baseline?.cleanup()});

test('received Rules reproduce missing R&D overview, denied new chat and inherited private-note access',async()=>{
  const d=db('rd',baseline);
  await assertFails(getDocs(collection(d,'hub_cases')));
  await assertFails(setDoc(doc(d,'hub_interdept_chat/new'),chatData('rd','VM-011')));
  await assertSucceeds(getDoc(doc(d,'hub_cases/VM-011/private_notes/old')));
});
test('candidate permits R&D public overview but denies inactive and unprivileged overview',async()=>{
  await assertSucceeds(getDocs(collection(db('rd'),'hub_cases')));
  await assertFails(getDocs(collection(db('rdBasic'),'hub_cases')));
  await assertFails(getDoc(doc(db('inactive'),'hub_cases/VM-011')));
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(),'hub_cases/VM-011')));
});
test('source group follows transferred VM without access to another group or private notes',async()=>{
  const d=db('lead');
  const snap=await assertSucceeds(getDocs(query(collection(d,'hub_cases'),where('sourceGroup','==','3TR'))));
  assert.ok(snap.docs.some(x=>x.id==='VM-013'));
  await assertFails(getDoc(doc(d,'hub_cases/VM-012')));
  await assertFails(getDoc(doc(d,'hub_cases/VM-011/private_notes/rd')));
});
test('R&D reads only RD-tagged notes; legacy/other department and broad query are denied',async()=>{
  const d=db('rd');
  await assertSucceeds(getDoc(doc(d,'hub_cases/VM-011/private_notes/rd')));
  await assertFails(getDoc(doc(d,'hub_cases/VM-011/private_notes/old')));
  await assertFails(getDoc(doc(d,'hub_cases/VM-011/private_notes/ptn')));
  await assertFails(getDocs(collection(d,'hub_cases/VM-011/private_notes')));
  await assertSucceeds(getDocs(query(collection(d,'hub_cases/VM-011/private_notes'),where('unitCode','==','RD'))));
  await assertSucceeds(getDoc(doc(db('head'),'hub_cases/VM-011/private_notes/old')));
});
test('note writes require actual department and author identity',async()=>{
  const d=db('rd');const note={text:'RD internal',unitCode:'RD',authorUid:'rd',authorEmail:'rd@example.com'};
  await assertSucceeds(setDoc(doc(d,'hub_cases/VM-011/private_notes/new'),note));
  await assertFails(setDoc(doc(d,'hub_cases/VM-011/private_notes/wrong-unit'),{...note,unitCode:'PTN'}));
  await assertFails(setDoc(doc(d,'hub_cases/VM-011/private_notes/spoof'),{...note,authorUid:'head'}));
});
test('department response requires managing permission and current responsibility; attachments survive',async()=>{
  const response={caseId:'VM-011',type:'department_response',authorUid:'rd',authorEmail:'rd@example.com',attachments:[{name:'image.png',dataUrl:'data:image/png;base64,aA=='}],externalLinks:['https://example.com/result']};
  await assertSucceeds(setDoc(doc(db('rd'),'hub_comments/response'),response));
  await assertFails(setDoc(doc(db('rdBasic'),'hub_comments/no-permission'),{...response,authorUid:'rdBasic',authorEmail:'rdBasic@example.com'}));
  await assertFails(setDoc(doc(db('rd'),'hub_comments/wrong-case'),{...response,caseId:'VM-013'}));
  await assertSucceeds(getDoc(doc(db('head'),'hub_comments/response')));
  await assertSucceeds(setDoc(doc(db('head'),'hub_comments/back-to-ptn'),{...response,caseId:'VM-014',authorUid:'head',authorEmail:'head@example.com'}));
});
test('chat Rules enforce thread query, group scope, author and append-only',async()=>{
  const d=db('lead');
  await assertSucceeds(getDocs(query(collection(d,'hub_interdept_chat'),where('spaceKey','==','PTN-RD'),where('threadKey','==','VM-011'))));
  await assertFails(getDocs(query(collection(d,'hub_interdept_chat'),where('spaceKey','==','PTN-RD'))));
  await assertFails(getDoc(doc(d,'hub_interdept_chat/kn')));
  await assertSucceeds(setDoc(doc(d,'hub_interdept_chat/lead-msg'),chatData('lead','VM-011')));
  await assertFails(updateDoc(doc(d,'hub_interdept_chat/lead-msg'),{message:'edited'}));
  await assertFails(setDoc(doc(d,'hub_interdept_chat/forbidden'),chatData('lead','VM-012')));
  await assertFails(setDoc(doc(d,'hub_interdept_chat/spoof'),chatData('rd','VM-011')));
  await assertFails(setDoc(doc(db('ktv'),'hub_interdept_chat/ktv-msg'),chatData('ktv','GENERAL')));
  await assertSucceeds(setDoc(doc(db('rd'),'hub_interdept_chat/general'),chatData('rd','GENERAL')));
});
test('two independent clients receive the other side in realtime within the same thread',async()=>{
  async function received(reader,writer,id){
    let unsub;const ready=new Promise((resolve,reject)=>{
      const timeout=setTimeout(()=>{unsub?.();reject(Error('Realtime timeout'))},8000);
      unsub=onSnapshot(query(collection(db(reader),'hub_interdept_chat'),where('spaceKey','==','PTN-RD'),where('threadKey','==','VM-011')),snap=>{
        if(snap.docs.some(x=>x.id===id)){clearTimeout(timeout);unsub();resolve()}
      },e=>{clearTimeout(timeout);reject(e)});
    });
    await setDoc(doc(db(writer),'hub_interdept_chat',id),chatData(writer,'VM-011'));await ready;
  }
  await received('rd','head','from-ptn');await received('head','rd','from-rd');
});
test('single-case audit query allowed and identity spoof denied',async()=>{
  await assertSucceeds(getDocs(query(collection(db('rd'),'hub_case_events'),where('caseId','==','VM-011'))));
  await assertFails(setDoc(doc(db('rd'),'hub_case_events/spoof'),{caseId:'VM-011',actorUid:'head',actorEmail:'head@example.com'}));
});
test('receiver cannot inject or delete fields, arbitrarily close VM, or update while inactive',async()=>{
  await assertSucceeds(updateDoc(doc(db('rd'),'hub_cases/VM-011'),{status:'Đã tiếp nhận'}));
  await assertFails(updateDoc(doc(db('rd'),'hub_cases/VM-011'),{status:'Đã xử lý'}));
  await assertFails(updateDoc(doc(db('rd'),'hub_cases/VM-011'),{injected:true}));
  await assertFails(updateDoc(doc(db('rd'),'hub_cases/VM-011'),{sourceGroup:deleteField()}));
  await assertFails(updateDoc(doc(db('inactive'),'hub_cases/VM-011'),{status:'Đã tiếp nhận'}));
});

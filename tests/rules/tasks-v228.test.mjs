import {before,after,test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {initializeTestEnvironment,assertSucceeds,assertFails} from '@firebase/rules-unit-testing';
import {doc,collection,setDoc,updateDoc,getDoc,getDocs,query,where,serverTimestamp} from 'firebase/firestore';

if(process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8085')throw Error('Tests require local emulator at 127.0.0.1:8085');
let env;
const owner=()=>env.authenticatedContext('owner',{email:'bebewofl@gmail.com'}).firestore();
const manager=()=>env.authenticatedContext('manager',{email:'manager@example.com'}).firestore();
const lead=()=>env.authenticatedContext('lead',{email:'dowait17@gmail.com'}).firestore();
const outsider=()=>env.authenticatedContext('outsider',{email:'outsider@example.com'}).firestore();

const taskBase={
  code:'CV-001',title:'Kiểm tra bàn giao ca',description:'Kiểm tra và báo cáo kết quả',
  priority:'Cao',deadlineLocal:'2026-10-06T17:00',linkedCaseId:'',
  assigneeEmail:'dowait17@gmail.com',assigneeName:'Lê Đức Độ',assigneeRole:'Trưởng nhóm 3T-R',assigneeGroup:'3TR',
  assignedByUid:'manager',assignedByEmail:'manager@example.com',assignedByName:'Trưởng phòng PTN',
  status:'Chưa xác nhận',progressNote:'',reportText:'',decisionNote:'',schemaVersion:'2.2.8'
};

before(async()=>{
  env=await initializeTestEnvironment({
    projectId:'demo-hub-tasks-v228',
    firestore:{host:'127.0.0.1',port:8085,rules:await fs.readFile('rules/firestore.candidate.rules','utf8')}
  });
  await env.withSecurityRulesDisabled(async ctx=>{
    await setDoc(doc(ctx.firestore(),'hub_access','manager@example.com'),{active:true,role:'head',groups:['3TR','KN','ATAS'],unitCodes:['PTN'],permissions:[]});
  });
});
after(async()=>env?.cleanup());

test('head creates task only for approved PTN lead mapping',async()=>{
  await assertSucceeds(setDoc(doc(owner(),'hub_tasks/CV-001'),{...taskBase,createdAt:serverTimestamp(),updatedAt:serverTimestamp(),updatedByEmail:'manager@example.com'}));
  await assertFails(setDoc(doc(owner(),'hub_tasks/CV-002'),{...taskBase,code:'CV-002',assigneeEmail:'outsider@example.com',createdAt:serverTimestamp(),updatedAt:serverTimestamp(),updatedByEmail:'manager@example.com'}));
});

test('assigned lead sees only constrained own-task query',async()=>{
  const d=lead();
  const snap=await assertSucceeds(getDocs(query(collection(d,'hub_tasks'),where('assigneeEmail','==','dowait17@gmail.com'))));
  assert.equal(snap.size,1);
  await assertFails(getDocs(collection(d,'hub_tasks')));
  await assertFails(getDoc(doc(outsider(),'hub_tasks/CV-001')));
});

test('lead must acknowledge before progress and must report before review',async()=>{
  const d=lead();
  await assertFails(updateDoc(doc(d,'hub_tasks/CV-001'),{status:'Hoàn thành',updatedAt:serverTimestamp(),updatedByEmail:'dowait17@gmail.com'}));
  await assertSucceeds(updateDoc(doc(d,'hub_tasks/CV-001'),{status:'Đang thực hiện',acknowledgedAt:serverTimestamp(),updatedAt:serverTimestamp(),updatedByEmail:'dowait17@gmail.com'}));
  await assertSucceeds(updateDoc(doc(d,'hub_tasks/CV-001'),{progressNote:'Đã kiểm tra 50%',progressUpdatedAt:serverTimestamp(),updatedAt:serverTimestamp(),updatedByEmail:'dowait17@gmail.com'}));
  await assertFails(updateDoc(doc(d,'hub_tasks/CV-001'),{status:'Chờ Trưởng phòng xác nhận',reportText:'',reportedAt:serverTimestamp(),updatedAt:serverTimestamp(),updatedByEmail:'dowait17@gmail.com'}));
  await assertSucceeds(updateDoc(doc(d,'hub_tasks/CV-001'),{status:'Chờ Trưởng phòng xác nhận',reportText:'Đã hoàn thành và kiểm tra kết quả.',reportedAt:serverTimestamp(),updatedAt:serverTimestamp(),updatedByEmail:'dowait17@gmail.com'}));
});

test('head closes only after report; events are append-only and identity-bound',async()=>{
  const h=manager();
  await assertSucceeds(setDoc(doc(h,'hub_task_events/e1'),{taskId:'CV-001',action:'Kiểm tra',detail:'',actorUid:'manager',actorEmail:'manager@example.com'}));
  await assertFails(setDoc(doc(lead(),'hub_task_events/spoof'),{taskId:'CV-001',action:'Giả mạo',detail:'',actorUid:'manager',actorEmail:'manager@example.com'}));
  await assertSucceeds(updateDoc(doc(h,'hub_tasks/CV-001'),{status:'Hoàn thành',confirmedAt:serverTimestamp(),decisionNote:'Đã xác nhận hoàn thành',updatedAt:serverTimestamp(),updatedByEmail:'manager@example.com'}));
  await assertFails(updateDoc(doc(lead(),'hub_tasks/CV-001'),{status:'Đang thực hiện',updatedAt:serverTimestamp(),updatedByEmail:'dowait17@gmail.com'}));
});

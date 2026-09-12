import {before,after,beforeEach,test} from 'node:test';
import fs from 'node:fs/promises';
import {initializeTestEnvironment,assertSucceeds,assertFails} from '@firebase/rules-unit-testing';
import {doc,setDoc,updateDoc,getDoc} from 'firebase/firestore';

if(process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8085')throw Error('Tests require local emulator at 127.0.0.1:8085');
let env;
const authDb=(uid,email)=>env.authenticatedContext(uid,{email}).firestore();
const HEAD='bebewofl@gmail.com';
const LEAD3='dowait17@gmail.com';
const KTV3='vuong06042004@gmail.com';
const KTV3B='maicongtuan829@gmail.com';
const KTVKN='binhduong04.dev@gmail.com';
const RESIGNED='phamxuanvinh1b2@gmail.com';

const access3=(target=KTV3,extra={})=>({
  email:target,name:target===KTV3?'Trần Đức Vượng':'Mai Công Tuấn',employeeId:target===KTV3?'NS-007':'NS-010',
  role:'ktv3tr',groups:['3TR'],spaces:['ptn','common'],unitCodes:['PTN'],permissions:[],active:true,
  department:'PTN',personnelTitle:'KTV',accessModelVersion:'2.2.7',grantedByEmail:LEAD3,grantedByRole:'Trưởng nhóm 3T-R',
  createdAt:new Date(),updatedAt:new Date(),updatedByEmail:LEAD3,...extra
});

before(async()=>{
  env=await initializeTestEnvironment({projectId:'demo-hub-v227',firestore:{host:'127.0.0.1',port:8085,rules:await fs.readFile('rules/firestore.candidate.rules','utf8')}});
});
beforeEach(async()=>{await env.clearFirestore()});
after(async()=>{await env?.cleanup()});

test('lead grants only active KTV in own group with fixed scope',async()=>{
  const d=authDb('lead3',LEAD3);
  await assertSucceeds(setDoc(doc(d,'hub_access',KTV3),access3()));
  await assertFails(setDoc(doc(d,'hub_access',KTVKN),{
    ...access3(KTV3),email:KTVKN,name:'Dương Lý Bình',employeeId:'NS-003',role:'ktvkn',groups:['KN']
  }));
  await assertFails(setDoc(doc(d,'hub_access',KTV3B),access3(KTV3B,{spaces:['ptn','common','commonRoom']})));
});

test('lead may revoke/restore own KTV but cannot mutate role or spaces',async()=>{
  const d=authDb('lead3',LEAD3);
  await assertSucceeds(setDoc(doc(d,'hub_access',KTV3),access3()));
  await assertSucceeds(updateDoc(doc(d,'hub_access',KTV3),{active:false,updatedAt:new Date(),updatedByEmail:LEAD3}));
  await assertFails(updateDoc(doc(d,'hub_access',KTV3),{spaces:['ptn','common','commonRoom'],updatedAt:new Date(),updatedByEmail:LEAD3}));
  await assertFails(updateDoc(doc(d,'hub_access',KTV3),{role:'head',updatedAt:new Date(),updatedByEmail:LEAD3}));
});

test('common room requires leader request and head approval',async()=>{
  const lead=authDb('lead3',LEAD3);const head=authDb('head',HEAD);
  await assertSucceeds(setDoc(doc(lead,'hub_access',KTV3),access3()));
  const req={targetEmail:KTV3,targetName:'Trần Đức Vượng',employeeId:'NS-007',groupCode:'3TR',requestedByUid:'lead3',requestedByEmail:LEAD3,requestedByName:'Lê Đức Độ',requestedByRole:'Trưởng nhóm 3T-R',status:'pending',createdAt:new Date(),schemaVersion:'2.2.7'};
  await assertSucceeds(setDoc(doc(lead,'hub_common_room_requests','req1'),req));
  await assertFails(updateDoc(doc(lead,'hub_access',KTV3),{spaces:['ptn','common','commonRoom'],updatedAt:new Date(),updatedByEmail:LEAD3}));
  await assertSucceeds(updateDoc(doc(head,'hub_access',KTV3),{spaces:['ptn','common','commonRoom'],updatedAt:new Date(),updatedByEmail:HEAD}));
  await assertSucceeds(updateDoc(doc(head,'hub_common_room_requests','req1'),{status:'approved',decidedAt:new Date(),decidedByEmail:HEAD,decisionNote:'OK'}));
  await assertSucceeds(getDoc(doc(authDb('ktv3',KTV3),'hub_access',KTV3)));
});

const meal=(email,employeeId,group,uid,reporterEmail)=>({
  reportType:'personal',date:'2026-09-13',unitCode:'PTN',unitLabel:'Phòng Thử nghiệm (PTN)',parentGroup:'PTN',choice:'Có ăn',note:'',
  employeeId,employeeName:'Test',employeeGroup:group,employeeEmail:email,
  userUid:uid,userEmail:reporterEmail,userName:'Reporter',role:'Test',updatedAt:new Date(),schemaVersion:'2.2.7'
});

test('PTN meal is individual by roster and group scope; collective PTN is blocked',async()=>{
  const lead=authDb('lead3',LEAD3);const head=authDb('head',HEAD);
  await assertSucceeds(setDoc(doc(lead,'hub_meal_reports','2026-09-13_NS-007'),meal(KTV3,'NS-007','3TR','lead3',LEAD3)));
  await assertFails(setDoc(doc(lead,'hub_meal_reports','2026-09-13_NS-003'),meal(KTVKN,'NS-003','KN','lead3',LEAD3)));
  await assertSucceeds(setDoc(doc(head,'hub_meal_reports','2026-09-13_NS-003'),meal(KTVKN,'NS-003','KN','head',HEAD)));
  await assertFails(setDoc(doc(head,'hub_meal_reports','2026-09-13_NS-006'),meal(RESIGNED,'NS-006','ATAS','head',HEAD)));
  await assertFails(setDoc(doc(lead,'hub_meal_department_reports','2026-09-13_PTN'),{date:'2026-09-13',unitCode:'PTN',count:8}));
});

test('PTN public meal status uses employee/date identity and rejects spoofed roster',async()=>{
  const lead=authDb('lead3',LEAD3);
  const good={date:'2026-09-13',unitCode:'PTN',choice:'Có ăn',employeeId:'NS-007',employeeName:'Trần Đức Vượng',employeeGroup:'3TR',employeeEmail:KTV3,userUid:'lead3',userEmail:LEAD3,updatedAt:new Date()};
  await assertSucceeds(setDoc(doc(lead,'hub_meal_public_status','2026-09-13_NS-007'),good));
  await assertFails(setDoc(doc(lead,'hub_meal_public_status','2026-09-13_NS-007_spoof'),{...good,employeeEmail:KTVKN,employeeId:'NS-003'}));
});

'use strict';
const { initializeApp, getApps } = require('firebase-admin/app');
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const { getStorage } = require('firebase-admin/storage');
const pilot=require('./pilot');
const { need, ms, snapshot, stateView } = require('./domain');
const demoProject = 'demo-hub-lite', testProject = 'hub-ptn-test';
function resources() {
  const project = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
  const local = project === demoProject && process.env.FUNCTIONS_EMULATOR === 'true';
  if (local) {
    need(process.env.FIRESTORE_EMULATOR_HOST === '127.0.0.1:8087' &&
      process.env.FIREBASE_AUTH_EMULATOR_HOST === '127.0.0.1:9097' &&
      (process.env.FIREBASE_STORAGE_EMULATOR_HOST === '127.0.0.1:9197' || process.env.STORAGE_EMULATOR_HOST === 'http://127.0.0.1:9197') &&
      (!process.env.STORAGE_EMULATOR_HOST || process.env.STORAGE_EMULATOR_HOST === 'http://127.0.0.1:9197'), 'Các dịch vụ thực nghiệm chưa được cách ly.', 503);
  } else {
    need(project === testProject && !['FUNCTIONS_EMULATOR','FIRESTORE_EMULATOR_HOST','FIREBASE_AUTH_EMULATOR_HOST','FIREBASE_STORAGE_EMULATOR_HOST','STORAGE_EMULATOR_HOST'].some(k=>process.env[k]), 'Môi trường ngoài phạm vi HUB Test.', 503);
  }
  const app = getApps()[0] || initializeApp({ projectId:project, storageBucket:local ? project+'.appspot.com' : project+'-v3-lite' });
  const db = local ? getFirestore(app) : getFirestore(app, 'hub-v3-lite');
  return { db, auth:getAuth(app), bucket:getStorage(app).bucket(), local };
}
const now = () => FieldValue.serverTimestamp();
const cases = db => db.collection('hub_v3_cases');
const members = db => db.collection('hub_v3_members');
const get = (ref, tx) => tx ? tx.get(ref) : ref.get();
async function profile(db, id, tx) {
  const result = await get(members(db).doc(id),tx);
  if (!result.exists) return null;
  const m = result.data(), effectiveScopes = [...(m.scopes || [])], d = m.delegation;
  if (m.active && d && ms(d.until)>Date.now() && d.from !== id) {
    const origin = await get(members(db).doc(d.from),tx);
    if (origin.exists && origin.data().active && (origin.data().scopes || []).includes(d.scope)) effectiveScopes.push(d.scope);
  }
  return {...m,effectiveScopes};
}
async function active(db,id,tx) {
  await pilot.verify(db,id,tx);
  const m = await profile(db,id,tx);
  need(m?.active,'Tài khoản chưa được kích hoạt hoặc đã tạm khóa.',403);
  return m;
}
async function caseData(db, code, tx) {
  const snap = await get(cases(db).doc(code),tx);
  need(snap.exists,'Hồ sơ không tồn tại hoặc ngoài phạm vi tài khoản.',404);
  return snap.data();
}
function record(tx, ref, old, patch, id, m, requestId, extra = {}) {
  const next = {...old,...patch, rev:(old?.rev || 0)+1, lastEvent:requestId, updatedAt:now() };
  if (old) tx.update(ref,{...patch,rev:next.rev,lastEvent:requestId,updatedAt:next.updatedAt});
  else tx.create(ref,next);
  tx.create(ref.collection('events').doc(requestId), {
    actor:snapshot(id,m), actorUid:id, principalUid:pilot.auditPrincipal(id), rev:next.rev, action:next.lastAction,
    note:next.lastNote || '', basis:next.lastBasis || '', status:next.status, ownerUid:next.ownerUid,
    nextUid:next.nextUid, before:stateView(old), after:stateView(next), at:now(), ...extra
  });
  return next.rev;
}
module.exports = {resources,now,cases,members,get,profile,active,caseData,record,Timestamp};

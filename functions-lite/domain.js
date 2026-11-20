'use strict';
const crypto = require('node:crypto');

const states = { new: 'Chờ tiếp nhận', work: 'Đang xử lý', more: 'Chờ bổ sung', decision: 'Chờ quyết định', done: 'Chờ xác nhận', closed: 'Đã đóng' };
const scopes = ['testing', 'equipment', 'quality', 'management', 'records'];
const priorities = ['Bình thường', 'Quan trọng', 'Khẩn cấp'];
const flags = ['safety', 'quality', 'temporary', 'paused', 'verifyImpact', 'needResume'];
const fail = (status, message) => { const err = new Error(message); err.status = status; throw err; };
const need = (test, message, status = 400) => { if (!test) fail(status, message); };
const text = (s, max, required = false) => {
  need(s == null || typeof s === 'string', 'Giá trị văn bản không hợp lệ.');
  const v = (s || '').trim();
  need(v.length <= max && (!required || v.length > 0), 'Kiểm tra nội dung bắt buộc và độ dài.');
  return v;
};
const uid = value => { need(typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value), 'Định danh tài khoản không hợp lệ.'); return value; };
const rid = value => { need(typeof value === 'string' && /^[a-f0-9-]{36}$/.test(value), 'Mã lần gửi không hợp lệ.'); return value; };
const code = value => { need(typeof value === 'string' && /^VM3-[A-Za-z0-9]{16}$/.test(value), 'Mã vấn đề không hợp lệ.'); return value; };
const issueCode = (id, key) => 'VM3-' + crypto.createHash('sha256').update(id + '/' + rid(key)).digest('hex').slice(0, 16).toUpperCase();
const unique = values => [...new Set(values.filter(Boolean))];
const ms = t => typeof t?.toMillis === 'function' ? t.toMillis() : t || 0;
const snapshot = (id, m) => ({ uid: id, name: m.name, unit: m.unit, title: m.title || '' });
const canRead = (m, id, c) => m.active && (c.readers.includes(id) || (m.overview === true && c.restricted === false));
const canHandle = (m, id, c) => m.active && m.canHandle && c.ownerUid === id;
function checkTarget(m, id, target, person, priority) {
  need(person?.active && person.canHandle && target !== id &&
    ((m.routes || []).includes(target) || (priority === 'Khẩn cấp' && (m.emergencyRoutes || []).includes(target))),
  'Đầu mối ngoài tuyến được cấp hoặc đang tạm khóa.', 403);
}
function allowed(m, id, c) {
  const s = c.status, own = canHandle(m, id, c), next = c.nextUid === id;
  if (s === states.closed) return c.reviewerUid === id && m.canClose ? ['reopen'] : [];
  const actions = [];
  if (s === states.new && next && own) actions.push('accept', 'route');
  if (s === states.work && next && own) {
    actions.push('respond', 'assign', 'route', 'invite', 'supplement', 'propose', 'decision_request', 'flags');
    if (!c.flags?.paused && !c.flags?.needResume) actions.push('report_done');
    if (!c.flags?.paused && m.mayPause) actions.push('pause');
    if ((c.flags?.paused || c.flags?.needResume) && ['testing','equipment'].includes(c.pauseScope||c.domain) && (m.effectiveScopes || []).includes(c.pauseScope||c.domain)) actions.push('resume');
  }
  if (c.collaborators?.includes(id) && !own && m.canHandle) actions.push('collaborate');
  if (s === states.more && next) actions.push('supply');
  if (s === states.decision && next && (m.effectiveScopes || []).includes(c.decisionScope)) actions.push('approve', 'reject');
  if (s === states.done && next && id === c.reviewerUid && m.canClose) actions.push('close', 'continue');
  return actions;
}
function flagValues(input = {}) {
  return Object.fromEntries(flags.map(k => [k, input[k] === true]));
}
function transition(c, m, id, input, people) {
  const action = input.action;
  need(allowed(m, id, c).includes(action), 'Quyền hoặc bước xử lý hiện tại không cho phép thao tác này.', 403);
  const note = text(input.note, 4000, action !== 'accept');
  const basis = text(input.basis, 1000, ['approve','reject','pause','resume'].includes(action));
  const p = { lastAction: action, lastNote: note, lastBasis: basis, actorUid: id };
  if (['assign','route','invite','decision_request'].includes(action)) {
    const target = uid(input.target), to = people[target];
    checkTarget(m, id, target, to, c.severity);
    p.readers = unique([...c.readers, target]);
    if (action === 'invite') {
      need(!c.collaborators?.includes(target) && target !== c.ownerUid, 'Đầu mối đã tham gia.');
      p.collaborators = unique([...(c.collaborators || []), target]);
      p.inviteRevisions = {...c.inviteRevisions,[target]:c.rev+1};
    } else if (action === 'decision_request') {
      need(scopes.includes(input.scope) && to.effectiveScopes.includes(input.scope), 'Đầu mối chưa có thẩm quyền quyết định nội dung này.', 403);
      if(input.purpose==='resume'){need((c.flags?.paused||c.flags?.needResume)&&['testing','equipment'].includes(input.scope)&&input.scope===(c.pauseScope||c.domain),'Cho tiếp tục cần đúng thẩm quyền kỹ thuật.');}
      else if (input.scope !== 'management') need(input.scope === c.domain, 'Lĩnh vực xác nhận phải đúng với vấn đề.');
      Object.assign(p, { decisionScope:input.scope,decisionPurpose:input.purpose==='resume'?'resume':'general', nextUid:target, status:states.decision });
    } else {
      if (action === 'assign') need(to.unit === m.unit, 'Chỉ phân công người trong cùng bộ phận. Dùng chuyển tuyến khi giao bộ phận khác.');
      Object.assign(p, { ownerUid:target, ownerName:to.name, ownerUnit:to.unit, nextUid:target, status:states.new });
    }
  }
  switch (action) {
    case 'collaborate': p.coordinationReplies={...c.coordinationReplies,[id]:c.rev+1};break;
    case 'accept': p.status = states.work; break;
    case 'supplement': Object.assign(p, { nextUid:c.reporterUid, status:states.more }); break;
    case 'supply': case 'approve': case 'reject': case 'continue': case 'reopen':
      if(action==='approve' && c.decisionPurpose==='resume') p.flags={...c.flags,paused:false,needResume:false};
      Object.assign(p, { nextUid:c.ownerUid, status:states.work }); break;
    case 'report_done':
      need(people[c.reviewerUid]?.active && people[c.reviewerUid].canClose, 'Người xác nhận chưa hoạt động. Cần điều phối thay thế.', 409);
      Object.assign(p,{ nextUid:c.reviewerUid, status:states.done, result:note }); break;
    case 'close': Object.assign(p,{ nextUid:'', status:states.closed, conclusion:note, confirmedBy:snapshot(id,m) }); break;
    case 'pause': p.pauseScope=['testing','equipment'].includes(c.domain)?c.domain:input.pauseScope;
      need(['testing','equipment'].includes(p.pauseScope),'Chọn thẩm quyền kỹ thuật trước khi ghi tạm dừng.'); p.flags = {...c.flags, paused:true, needResume:true}; break;
    case 'resume': p.flags = {...c.flags, paused:false, needResume:false}; break;
    case 'flags': {
      const changes = flagValues(input.flags);
      p.flags = {...changes, paused:!!c.flags?.paused, needResume:!!c.flags?.needResume || changes.needResume}; break;
    }
  }
  return p;
}
function stateView(c) {
  if (!c) return null;
  return { status:c.status, ownerUid:c.ownerUid, ownerName:c.ownerName || '', ownerUnit:c.ownerUnit || '',
    nextUid:c.nextUid, reviewerUid:c.reviewerUid, collaborators:c.collaborators || [], flags:c.flags || {},
    decisionScope:c.decisionScope || '', decisionPurpose:c.decisionPurpose||'',pauseScope:c.pauseScope||'', result:c.result || '', conclusion:c.conclusion || '' };
}
function jsonData(value) {
  if (value == null || typeof value !== 'object') return value;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (Array.isArray(value)) return value.map(jsonData);
  return Object.fromEntries(Object.entries(value).map(([k,v]) => [k,jsonData(v)]));
}
module.exports = {states,scopes,priorities,flags,fail,need,text,uid,rid,code,issueCode,unique,ms,snapshot,canRead,checkTarget,allowed,flagValues,transition,stateView,jsonData};

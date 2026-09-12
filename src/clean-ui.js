(() => {
'use strict';

const HIDE_PREFIXES = Object.freeze([
  'Trưởng phòng PTN. Đây chính là bàn Trưởng phòng PTN',
  'Cơ cấu hiển thị:',
  'Nguyên tắc: VM luôn giữ nhóm báo cáo',
  'Tính năng xuyên HUB.',
  'Chỉ hiển thị các vấn đề/vướng mắc thực sự đang phối hợp giữa PTN và R&D',
  'Chờ tiếp nhận: VM đã được chuyển sang R&D'
]);

function normalizeText(value){
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function shouldHide(text){
  const normalized = normalizeText(text);
  return HIDE_PREFIXES.some(prefix => normalized.startsWith(prefix));
}

function applyCleanUi(){
  const selectors = [
    '.notice',
    '.head p',
    '.v22-page-head p',
    '.v22-notice',
    '.op-form-note',
    '.follow-note',
    '.content > p',
    '.content section > p',
    '.content .panel > p'
  ].join(',');

  document.querySelectorAll(selectors).forEach(el => {
    if (shouldHide(el.textContent)) el.classList.add('hub-clean-hidden');
  });
}

const style = document.createElement('style');
style.textContent = `
  .hub-clean-hidden{display:none!important}
  .content .hub-clean-hidden + .cards{margin-top:0}
  .content .hub-clean-hidden + .grid2{margin-top:0}
`;
document.head.appendChild(style);

let scheduled = false;
function scheduleClean(){
  if(scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    applyCleanUi();
  });
}

if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', scheduleClean, {once:true});
}else{
  scheduleClean();
}

const observer = new MutationObserver(scheduleClean);
observer.observe(document.body, {childList:true, subtree:true});
document.addEventListener('click', scheduleClean, true);

window.HUB_CLEAN_UI = Object.freeze({apply:applyCleanUi});
})();

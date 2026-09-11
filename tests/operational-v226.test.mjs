import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const src=await fs.readFile(new URL('../src/operational-v226.js',import.meta.url),'utf8');
const css=await fs.readFile(new URL('../src/operational-v226.css',import.meta.url),'utf8');
const build=await fs.readFile(new URL('../scripts/build-hub.mjs',import.meta.url),'utf8');
const version=JSON.parse(await fs.readFile(new URL('../VERSION.json',import.meta.url),'utf8'));

test('V2.2.6 exposes exactly the five approved operational categories',()=>{
  for(const label of [
    'Con người & năng lực',
    'Trạm máy / Thiết bị',
    'Mẫu thử nghiệm / Khách hàng',
    'Kỹ thuật & Thử nghiệm',
    'Khác'
  ]) assert.match(src,new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.match(src,/categoryKey==='other'&&!otherDetail/);
  assert.match(src,/Phân loại Khác: cần ghi rõ nội dung vấn đề/);
});

test('new VM stores source group, reporter, classification and backwards-compatible category',()=>{
  for(const token of ['sourceGroup:','reportedBy:','reportedByRole:','reportedByEmail:','category,','categoryKey,','schemaVersion:\'2.2.6\'']) assert.ok(src.includes(token),token);
  assert.match(src,/Tạo bản ghi.*groupLabel\(c\.sourceGroup\).*category/s);
});

test('compact dashboard removes explanatory metric footnotes and shows group plus category columns',()=>{
  assert.match(src,/Nhóm báo/);
  assert.match(src,/Phân loại/);
  assert.match(src,/window\.renderDesk=function/);
  assert.match(src,/window\.renderPTN=function/);
  assert.match(css,/\.op-metrics \.metric small\{display:none\}/);
});

test('canonical build loads operational module after core app without runtime mutation observer',()=>{
  assert.match(build,/operational-v226\.css/);
  assert.match(build,/operational-v226\.js/);
  assert.doesNotMatch(src,/MutationObserver/);
  assert.equal(version.version,'2.2.6');
  assert.equal(version.environment,'test');
});

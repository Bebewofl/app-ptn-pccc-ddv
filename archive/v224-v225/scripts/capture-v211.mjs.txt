import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {mirrorSite} from './mirror-site.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.join(root,'baseline','v211');
try{
  await fs.access(path.join(out,'index.html'));
  console.log('Baseline V2.1.1 đã tồn tại trong GitHub, không ghi đè.');
  process.exit(0);
}catch{}

const {html}=await mirrorSite('https://app-ptn-pccc.web.app/',out);
if(!/Phiên bản\s+V2\.1\.1/i.test(html)){
  await fs.rm(out,{recursive:true,force:true});
  throw new Error('Production hiện không còn hiển thị V2.1.1; không tự chụp làm baseline để tránh rollback sai.');
}
console.log('Đã chụp baseline HUB V2.1.1 vào baseline/v211.');

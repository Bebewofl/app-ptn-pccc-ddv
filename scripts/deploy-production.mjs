import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const info=JSON.parse(await fs.readFile(path.join(root,'dist-production/build-info.json'),'utf8'));
const config=JSON.parse(await fs.readFile(path.join(root,'firebase.production.generated.json'),'utf8'));
const html=await fs.readFile(path.join(root,'dist-production/index.html'),'utf8');

if(info.projectId!=='app-ptn-pccc'||info.environment!=='production'||info.version!=='2.2.6'||info.release!=='Stable-1'){
  throw Error('Refusing deployment: production build metadata mismatch');
}
if(config.hosting?.public!=='dist-production'||config.firestore?.rules!=='rules/firestore.candidate.rules'){
  throw Error('Refusing deployment: generated Firebase config mismatch');
}
if(/HUB PTN TEST|Chỉ dùng dữ liệu thử nghiệm/i.test(html)){
  throw Error('Refusing deployment: test marker found in production HTML');
}
if(!html.includes('operational-v226.css')||!html.includes('operational-v226.js')){
  throw Error('Refusing deployment: HUB V2.2.6 operational assets missing');
}

const firebaseBin=path.join(root,'node_modules/firebase-tools/lib/bin/firebase.js');
const args=[firebaseBin,'deploy','--only','hosting,firestore:rules','--project','app-ptn-pccc','--config','firebase.production.generated.json','--non-interactive'];
const result=spawnSync(process.execPath,args,{cwd:root,stdio:'inherit',env:process.env});
if(result.error)throw result.error;
if((result.status??1)!==0)process.exit(result.status??1);
console.log('PRODUCTION DEPLOY OK: HUB V2.2.6 Stable-1');

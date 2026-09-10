import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dist=path.join(root,'dist-production');
const meta=JSON.parse(await fs.readFile(path.join(root,'VERSION.production.json'),'utf8'));
const firebaseConfig=JSON.parse(await fs.readFile(path.join(root,'config/firebase.production.json'),'utf8'));

if(meta.environment!=='production'||meta.projectId!=='app-ptn-pccc'||meta.release!=='Stable-1'){
  throw Error('Refusing production build: release metadata mismatch');
}
if(firebaseConfig.projectId!==meta.projectId||firebaseConfig.authDomain!=='app-ptn-pccc.firebaseapp.com'){
  throw Error('Refusing production build: Firebase production config mismatch');
}

const baseline=JSON.parse(await fs.readFile(path.join(root,'baseline/v211-manifest.json'),'utf8'));
const digest=data=>createHash('sha256').update(data).digest('hex');
for(const [file,hash] of Object.entries(baseline.files)){
  if(digest(await fs.readFile(path.join(root,'baseline/v211',file)))!==hash)throw Error('Baseline changed: '+file);
}

let sourceCommit='local';
try{sourceCommit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim()}catch{}

const files={};
for(const file of (await fs.readdir(path.join(root,'src'),{recursive:true})).sort()){
  if((await fs.stat(path.join(root,'src',file))).isFile())files[file.replaceAll('\\','/')]=digest(await fs.readFile(path.join(root,'src',file)));
}
const sourceHash=digest(JSON.stringify({meta,firebaseConfig,files}));
const info={...meta,sourceCommit,sourceHash,builtAt:new Date().toISOString()};

await fs.rm(dist,{recursive:true,force:true});
await fs.cp(path.join(root,'src'),dist,{recursive:true});

let html=await fs.readFile(path.join(dist,'index.html'),'utf8');
if(!html.includes('{{HUB_DISPLAY}}'))throw Error('Missing version placeholder');
const escaped=meta.display.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
html=html.replaceAll('{{HUB_DISPLAY}}',escaped).replace('<html lang="vi">',`<html lang="vi" data-hub-version="${meta.version}" data-hub-environment="production">`);
if(/HUB PTN TEST|Chỉ dùng dữ liệu thử nghiệm/i.test(html))throw Error('Test banner/text detected in production HTML');
await fs.writeFile(path.join(dist,'index.html'),html);

await fs.writeFile(path.join(dist,'firebase-init.js'),`if(firebase.apps.length)throw Error('Unexpected Firebase app already initialized');\nfirebase.initializeApp(${JSON.stringify(firebaseConfig)});\n`);
await fs.writeFile(path.join(dist,'build-info.json'),JSON.stringify(info,null,2)+'\n');
await fs.writeFile(path.join(dist,'build-info.js'),'window.HUB_BUILD_INFO=Object.freeze('+JSON.stringify(info)+');\n');

const hosting={
  hosting:{
    public:'dist-production',
    ignore:['firebase.production.generated.json','**/.*','**/node_modules/**'],
    headers:[{source:'**',headers:[{key:'Cache-Control',value:'no-store, max-age=0'}]}],
    rewrites:[{source:'**',destination:'/index.html'}]
  },
  firestore:{rules:'rules/firestore.candidate.rules'}
};
await fs.writeFile(path.join(root,'firebase.production.generated.json'),JSON.stringify(hosting,null,2)+'\n');
console.log(`PRODUCTION BUILD OK: HUB V${meta.version} ${meta.release}, source ${sourceHash.slice(0,12)}`);

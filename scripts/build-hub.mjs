import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dist=path.join(root,'dist');
const meta=JSON.parse(await fs.readFile(path.join(root,'VERSION.json'),'utf8'));
const firebaseConfig=JSON.parse(await fs.readFile(path.join(root,'config/firebase.test.json'),'utf8'));
if(meta.environment!=='test'||meta.projectId!=='hub-ptn-test'||firebaseConfig.projectId!==meta.projectId||firebaseConfig.authDomain!=='hub-ptn-test.firebaseapp.com')throw Error('This develop build must target hub-ptn-test');
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
const info={...meta,sourceCommit,sourceHash};
// Fixed output child of this repository; build never downloads or rewrites its source.
await fs.rm(dist,{recursive:true,force:true});
await fs.cp(path.join(root,'src'),dist,{recursive:true});
let html=await fs.readFile(path.join(dist,'index.html'),'utf8');
if(!html.includes('{{HUB_DISPLAY}}'))throw Error('Missing version placeholder');
const escaped=meta.display.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
html=html.replaceAll('{{HUB_DISPLAY}}',escaped).replace('<html lang="vi">',`<html lang="vi" data-hub-version="${meta.version}">`);
if(await fs.access(path.join(dist,'operational-v226.css')).then(()=>true).catch(()=>false)){
  html=html.replace('</head>','<link rel="stylesheet" href="operational-v226.css">\n</head>');
}
if(await fs.access(path.join(dist,'operational-v226.js')).then(()=>true).catch(()=>false)){
  html=html.replace('</body>','<script src="operational-v226.js"></script>\n</body>');
}
html=html.replace('<body>','<body>\n<div style="position:fixed;bottom:0;left:0;right:0;z-index:99999;background:#fff3cd;color:#664d03;text-align:center;font:600 12px sans-serif;padding:6px;pointer-events:none">HUB PTN TEST · Chỉ dùng dữ liệu thử nghiệm</div>');
await fs.writeFile(path.join(dist,'index.html'),html);
await fs.writeFile(path.join(dist,'firebase-init.js'),`if(firebase.apps.length)throw Error('Unexpected Firebase app already initialized');\nfirebase.initializeApp(${JSON.stringify(firebaseConfig)});\n`);
await fs.writeFile(path.join(dist,'build-info.json'),JSON.stringify(info,null,2)+'\n');
await fs.writeFile(path.join(dist,'build-info.js'),'window.HUB_BUILD_INFO=Object.freeze('+JSON.stringify(info)+');\n');
await fs.writeFile(path.join(root,'firebase.generated.json'),JSON.stringify({hosting:{public:'dist',ignore:['firebase.generated.json','**/.*','**/node_modules/**'],headers:[{source:'**',headers:[{key:'Cache-Control',value:'no-store, max-age=0'}]}],rewrites:[{source:'**',destination:'/index.html'}]}},null,2)+'\n');
console.log(`BUILD OK: HUB V${meta.version}, source ${sourceHash.slice(0,12)} (offline)`);
const testConfig=JSON.parse(await fs.readFile(path.join(root,'firebase.generated.json'),'utf8'));
testConfig.firestore={rules:'rules/firestore.candidate.rules'};
await fs.writeFile(path.join(root,'firebase.test.generated.json'),JSON.stringify(testConfig,null,2)+'\n');

import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {mirrorSite} from './mirror-site.mjs';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(__dirname,'..');
const meta=JSON.parse(await fs.readFile(path.join(root,'VERSION.json'),'utf8'));
const dist=path.join(root,'dist');
const stable=path.join(root,'baseline','v211');
const prodUrl='https://app-ptn-pccc.web.app/';

async function exists(p){try{await fs.access(p);return true}catch{return false}}

await fs.rm(dist,{recursive:true,force:true});
if(await exists(path.join(stable,'index.html'))){
  console.log('Baseline: GitHub snapshot HUB V2.1.1');
  await fs.cp(stable,dist,{recursive:true});
}else{
  console.log('Baseline: production HUB V2.1.1 (read-only fetch)');
  await mirrorSite(prodUrl,dist);
}

const overlays=[
  'hub-v22.js',
  'hub-v223-rndfix.js',
  'hub-v224-chat.js',
  'hub-v225-core.js'
];
const styles=['hub-v22.css','hub-v222-chat.css'];

for(const f of [...overlays,...styles]){
  const src=path.join(root,f);
  if(!(await exists(src))) throw new Error(`Thiếu file nguồn ${f}`);
  await fs.copyFile(src,path.join(dist,f));
}

const indexPath=path.join(dist,'index.html');
let html=await fs.readFile(indexPath,'utf8');

// Remove every older HUB overlay tag so a new build never stacks V2.2.x patches.
html=html.replace(/\s*<script[^>]+src=["'][^"']*hub-v22[^"']*["'][^>]*><\/script>\s*/gi,'\n');
html=html.replace(/\s*<link[^>]+href=["'][^"']*hub-v22[^"']*["'][^>]*>\s*/gi,'\n');
html=html.replace(/Phiên bản\s+V\d+(?:\.\d+)*(?:\s*·\s*Tạo bởi Dương Đức Vượng)?/gi,meta.display);

const cssTags=styles.map(f=>`  <link rel="stylesheet" href="${f}?v=${meta.version.replaceAll('.','')}">`).join('\n');
const jsTags=overlays.map(f=>`  <script src="${f}?v=${meta.version.replaceAll('.','')}"></script>`).join('\n');

if(!html.includes('</head>')) throw new Error('index.html không có </head>');
if(!html.includes('</body>')) throw new Error('index.html không có </body>');
html=html.replace('</head>',`${cssTags}\n</head>`);
html=html.replace('</body>',`${jsTags}\n</body>`);
html=html.replace(/<html([^>]*)>/i,(m,a)=>`<html${a} data-hub-build="${meta.version}">`);
await fs.writeFile(indexPath,html,'utf8');

await fs.writeFile(path.join(dist,'build-info.json'),JSON.stringify({
  version:meta.version,
  display:meta.display,
  baseline:meta.baseline,
  builtAt:new Date().toISOString(),
  sourceBranch:process.env.GITHUB_REF_NAME||'local'
},null,2));

const firebase={
  hosting:{
    public:'dist',
    ignore:['firebase.json','**/.*','**/node_modules/**'],
    headers:[
      {source:'/index.html',headers:[{key:'Cache-Control',value:'no-store, max-age=0'}]},
      {source:'/build-info.json',headers:[{key:'Cache-Control',value:'no-store, max-age=0'}]},
      {source:'**/*.@(js|css)',headers:[{key:'Cache-Control',value:'public, max-age=60'}]}
    ],
    rewrites:[{source:'**',destination:'/index.html'}]
  }
};
await fs.writeFile(path.join(root,'firebase.generated.json'),JSON.stringify(firebase,null,2));

if(!html.includes(meta.display)) throw new Error('Không khóa được nhãn phiên bản mới.');
for(const f of overlays){if(!html.includes(f)) throw new Error(`Chưa chèn ${f}`)}

console.log(`BUILD OK: HUB V${meta.version}`);
console.log(`OUTPUT: ${dist}`);

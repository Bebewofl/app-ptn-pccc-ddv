import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const baseline=path.join(root,'baseline/v211');
const rules='rules/production-received-2026-09-08.rules';

await fs.access(path.join(baseline,'index.html'));
await fs.access(path.join(root,rules));
const html=await fs.readFile(path.join(baseline,'index.html'),'utf8');
if(!html.includes('HUB_PTN_BUILD: V2.1.1_ACCESS_SECURITY_COMPAT'))throw Error('Refusing rollback: V2.1.1 baseline marker missing');

const config={
  hosting:{
    public:'baseline/v211',
    ignore:['firebase.rollback.generated.json','**/.*','**/node_modules/**'],
    headers:[{source:'**',headers:[{key:'Cache-Control',value:'no-store, max-age=0'}]}],
    rewrites:[{source:'**',destination:'/index.html'}]
  },
  firestore:{rules}
};
await fs.writeFile(path.join(root,'firebase.rollback.generated.json'),JSON.stringify(config,null,2)+'\n');

const firebaseBin=path.join(root,'node_modules/firebase-tools/lib/bin/firebase.js');
const result=spawnSync(process.execPath,[firebaseBin,'deploy','--only','hosting,firestore:rules','--project','app-ptn-pccc','--config','firebase.rollback.generated.json','--non-interactive'],{cwd:root,stdio:'inherit',env:process.env});
if(result.error)throw result.error;
if((result.status??1)!==0)process.exit(result.status??1);
console.log('ROLLBACK OK: HUB V2.1.1 restored');

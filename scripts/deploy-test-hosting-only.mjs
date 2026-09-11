import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const meta=JSON.parse(await fs.readFile(path.join(root,'VERSION.json'),'utf8'));
const config=JSON.parse(await fs.readFile(path.join(root,'firebase.generated.json'),'utf8'));
if(meta.version!=='2.2.6'||meta.environment!=='test'||meta.projectId!=='hub-ptn-test')throw Error('Refusing preview deploy: VERSION.json is not HUB V2.2.6 test');
if(config.hosting?.public!=='dist')throw Error('Refusing preview deploy: hosting output is not dist');
const firebaseBin=path.join(root,'node_modules/firebase-tools/lib/bin/firebase.js');
const result=spawnSync(process.execPath,[firebaseBin,'deploy','--only','hosting','--project','hub-ptn-test','--config','firebase.generated.json','--non-interactive'],{cwd:root,stdio:'inherit',env:process.env});
if(result.error)throw result.error;
process.exit(result.status??1);

import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const meta=JSON.parse(await fs.readFile(path.join(root,'VERSION.json'),'utf8'));
const config=JSON.parse(await fs.readFile(path.join(root,'firebase.test.generated.json'),'utf8'));
if(meta.version!=='2.2.7'||meta.environment!=='test'||meta.projectId!=='hub-ptn-test')throw Error('Refusing preview deploy: VERSION.json is not HUB V2.2.7 test');
if(config.hosting?.public!=='dist'||config.firestore?.rules!=='rules/firestore.candidate.rules')throw Error('Refusing preview deploy: generated test config is incomplete');
const firebaseBin=path.join(root,'node_modules/firebase-tools/lib/bin/firebase.js');
const result=spawnSync(process.execPath,[firebaseBin,'deploy','--only','firestore:rules,hosting','--project','hub-ptn-test','--config','firebase.test.generated.json','--non-interactive'],{cwd:root,stdio:'inherit',env:process.env});
if(result.error)throw result.error;
process.exit(result.status??1);

import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dist=path.join(root,'dist-lite');
await fs.rm(dist,{force:true,recursive:true});
await fs.cp(path.join(root,'src/lite'),dist,{recursive:true});
await fs.cp(path.join(root,'src/assets'),path.join(dist,'assets'),{recursive:true});
for(const file of ['firebase-app-compat.js','firebase-auth-compat.js','firebase-firestore-compat.js']){
 await fs.copyFile(path.join(root,'node_modules/firebase',file),path.join(dist,file));
}
console.log('HUB V3.0 LITE — local emulator build only');

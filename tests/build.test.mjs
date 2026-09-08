import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
async function outputHashes(){
  const hashes={};
  for(const file of (await fs.readdir(path.join(root,'dist'),{recursive:true})).sort()){
    if((await fs.stat(path.join(root,'dist',file))).isFile())hashes[file]=createHash('sha256').update(await fs.readFile(path.join(root,'dist',file))).digest('hex');
  }
  return hashes;
}
test('offline build is reproducible and ships only canonical source with complete local assets',async()=>{
  execFileSync(process.execPath,['scripts/build-hub.mjs'],{cwd:root});
  const first=await outputHashes();
  execFileSync(process.execPath,['scripts/build-hub.mjs'],{cwd:root});
  assert.deepEqual(await outputHashes(),first);
  const html=await fs.readFile(path.join(root,'dist/index.html'),'utf8');
  assert.ok(!/hub-v22|MutationObserver|\{\{HUB_DISPLAY\}\}/.test(html));
  for(const m of html.matchAll(/(?:src|href)="([^"]+)"/g)){
    if(m[1].startsWith('https:')||m[1].startsWith('/__/firebase/'))continue;
    await fs.access(path.join(root,'dist',m[1]));
  }
  assert.ok(Object.keys(first).every(f=>!f.includes('archive')&&!f.endsWith('.ps1')&&!f.endsWith('.cmd')));
  const cfg=JSON.parse(await fs.readFile(path.join(root,'firebase.generated.json'),'utf8'));
  assert.deepEqual(Object.keys(cfg),['hosting']);
});

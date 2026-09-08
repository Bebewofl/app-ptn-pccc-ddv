import fs from 'node:fs/promises';
import path from 'node:path';

export async function mirrorSite(baseUrl, outDir){
  const base=new URL(baseUrl);
  await fs.rm(outDir,{recursive:true,force:true});
  await fs.mkdir(outDir,{recursive:true});

  const res=await fetch(base,{redirect:'follow'});
  if(!res.ok) throw new Error(`Không tải được baseline ${base}: HTTP ${res.status}`);
  const html=await res.text();
  if(!/HUB-PTN/i.test(html)) throw new Error('Baseline tải về không có dấu hiệu HUB-PTN. Dừng để tránh build nhầm app.');
  await fs.writeFile(path.join(outDir,'index.html'),html,'utf8');

  const refs=new Set();
  for(const m of html.matchAll(/\b(?:src|href)=["']([^"']+)["']/gi)) refs.add(m[1]);
  for(const m of html.matchAll(/serviceWorker\.register\(\s*["']([^"']+)["']/gi)) refs.add(m[1]);

  for(const ref of refs){
    if(!ref||ref.startsWith('data:')||ref.startsWith('blob:')||ref.startsWith('#')||ref.startsWith('javascript:')) continue;
    let u;
    try{u=new URL(ref,base)}catch{continue}
    if(u.origin!==base.origin) continue;
    if(u.pathname==='/'||u.pathname.endsWith('/')) continue;
    const rel=decodeURIComponent(u.pathname.replace(/^\//,''));
    if(!rel||rel.includes('..')) continue;
    try{
      const rr=await fetch(u,{redirect:'follow'});
      if(!rr.ok) continue;
      const buf=Buffer.from(await rr.arrayBuffer());
      const dest=path.join(outDir,rel);
      await fs.mkdir(path.dirname(dest),{recursive:true});
      await fs.writeFile(dest,buf);
    }catch(e){
      console.warn('Bỏ qua asset không tải được:',u.href,e.message);
    }
  }

  return {html,source:base.href};
}

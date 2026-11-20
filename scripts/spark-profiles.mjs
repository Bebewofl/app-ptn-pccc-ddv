// Produces synthetic Test profiles only. UID grants are supplied privately during deployment.
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {profiles}=require('../functions-lite/fixtures.cjs');
export const roleIds=Object.keys(profiles).map(k=>'pilot-'+k);
export function sparkProfiles(){
 const records={}, units=[...new Set(Object.values(profiles).map(row=>row[1]))];
 const map=items=>Object.fromEntries(items.map(k=>[k,true]));
 for(const [key,[title,unit,routes,scopes]] of Object.entries(profiles)){
  const normal=!['admin','accounts','viewer'].includes(key),manager=key==='accounts',person='pilot-'+key;
  records[person]={active:true,name:title,title,unit,group:'',rev:1,canReport:normal,canHandle:normal&&key!=='staff',canClose:normal&&!['staff','lead','engineer'].includes(key),mayPause:['ptn','pkt','lead','engineer'].includes(key),overview:['director','viewer'].includes(key),canCoordinate:key==='director',technical:key==='admin',manageAccounts:manager,unitLead:normal&&!['staff','lead','engineer'].includes(key),reviewerUid:normal?'pilot-'+({engineer:'pkt',staff:'ptn',lead:'ptn'}[key]||key):''};
  if(routes.length)records[person].routes=map(routes.map(k=>'pilot-'+k));
  if(scopes.length)records[person].scopes=map(scopes);
  if(['staff','lead'].includes(key))records[person].emergencyRoutes=map(['pilot-pkt','pilot-ptn','pilot-director']);
  if(manager){records[person].manageUnits=map(units);records[person].grantScopes=map(['testing','equipment','management','quality','records']);}
 }
 return records;
}

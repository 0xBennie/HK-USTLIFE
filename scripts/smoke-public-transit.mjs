// Explicit live-network smoke. Ordinary tests use synthetic operator fixtures.
import {createProductApp} from '../dist/product/app.js';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
const dataDir=mkdtempSync(join(tmpdir(),'hkust-public-transit-'));
const app=createProductApp({dataDir});
const report={observed_at:new Date().toISOString(),synthetic:false,transport:'real local HTTP to live public operator APIs',checks:[]};
try{
 const base=await app.listen({host:'127.0.0.1',port:0});
 async function get(path){const response=await fetch(`${base}/api/v1${path}`,{signal:AbortSignal.timeout(12000)});assert.equal(response.status,200);return (await response.json()).data;}
 report.catalog=await get('/transport/public/routes');
 assert.equal(report.catalog.issues.length,0);
 assert.ok(report.catalog.routes.some(r=>r.operator==='kmb')&&report.catalog.routes.some(r=>r.operator==='gmb'));
 for(const routeId of ['kmb:91M:O:1','gmb:NT:11M:2004825:2']){
  const path=`/transport/public/routes/${encodeURIComponent(routeId)}`;
  const mapping=await get(`${path}/stops`);
  assert.equal(mapping.status,'available');
  const stop=mapping.stops.find(s=>/科技大学/.test(s.name.zh));assert.ok(stop);
  const predictions=await get(`${path}/arrivals?stop_sequence=${stop.sequence}`);
  report.checks.push({routeId,mapping,predictions});
  assert.ok(['available','no_predictions','disabled'].includes(predictions.status));
  assert.equal(predictions.stop.id,stop.id);
 }
 report.passed=true;
 console.log(JSON.stringify({passed:true,routes:report.catalog.routes.length,checks:report.checks.map(c=>({route:c.routeId,stops:c.mapping.stops.length,prediction_status:c.predictions.status}))},null,2));
}catch(error){report.passed=false;report.failure=String(error);process.exitCode=1;console.error(report.failure);}
finally{await app.close();rmSync(dataDir,{recursive:true,force:true});if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify(report,null,2));}

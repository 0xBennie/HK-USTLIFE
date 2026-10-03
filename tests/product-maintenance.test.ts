import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {createProductApp} from '../src/product/app.js';
let dir:string,app:ReturnType<typeof createProductApp>,member:string,admin:string,clock:number;
const sourceFetch=vi.fn<typeof fetch>();const target={target_kind:'place',target_id:'postal-counter'};
beforeEach(async()=>{
 clock=Date.parse('2026-10-03T00:00:00Z');sourceFetch.mockReset().mockImplementation(async()=>new Response('Official source fixture for local tests',{status:200}));dir=mkdtempSync(join(tmpdir(),'campus-maintenance-'));app=createProductApp({dataDir:dir,now:()=>clock,sourceFetch});
 async function login(email:string){const challenge=(await call('POST','/auth/email/challenges',{email},'')).json().data;const {code}=JSON.parse(readFileSync(join(dir,'mail',challenge.challenge_id+'.json'),'utf8'));return(await call('POST','/auth/email/verify',{challenge_id:challenge.challenge_id,code},'')).json().data.access_token;}
 member=await login('member@example.test');admin=await login('admin@example.test');
 const db=new DatabaseSync(join(dir,'campus.sqlite'));db.prepare("UPDATE users SET role='admin' WHERE email='admin@example.test'").run();db.close();
});
afterEach(async()=>{await app.close();rmSync(dir,{recursive:true,force:true});});
function call(method:'GET'|'POST',path:string,payload?:object,token = admin){return app.inject({method,url:'/api/v1'+path,payload,headers:{authorization:'Bearer '+token,'idempotency-key':randomUUID()}});}
async function entry(){return(await call('GET','/campus/places/postal-counter')).json().data;}
async function check(){const r=await call('POST','/admin/campus/source-checks',target);expect(r.statusCode,r.body).toBe(200);return r.json().data;}
function fields(p:any){const {name,location,description,published_hours,map_url,action_url}=p;return {name,location,description,published_hours,map_url,action_url};}
it('requires admin on every maintenance read/write and accepts only fixed target source URLs',async()=>{
 for(const path of ['/admin/campus/places','/admin/campus/corrections','/admin/campus/history?target_kind=place&target_id=postal-counter'])expect((await call('GET',path,undefined,member)).statusCode).toBe(403);
 expect((await call('POST','/admin/campus/source-checks',target,member)).statusCode).toBe(403);
 expect((await call('POST','/admin/campus/source-checks',{...target,url:'http://127.0.0.1/private'})).statusCode).toBe(400);
 await check();expect(sourceFetch.mock.calls[0][0]).toBe((await entry()).source.url);expect(sourceFetch.mock.calls[0][1]?.redirect).toBe('error');
});
it('captures evidence without publishing, then applies a versioned edit with audit and restart persistence',async()=>{
 const before=await entry(),evidence=await check();expect(await entry()).toEqual(before);
 const body={version:before.version,source_check_id:evidence.id,reason:'Verified official information',fields:{...fields(before),description:{zh:'测试核对后的说明',en:'Reviewed fixture information'}}};
 expect((await call('POST','/admin/campus/places/postal-counter',body,member)).statusCode).toBe(403);
 const saved=await call('POST','/admin/campus/places/postal-counter',body);expect(saved.statusCode,saved.body).toBe(200);expect(saved.json().data).toMatchObject({version:2,open_now:'unknown',availability:'unknown',source:{sha256:evidence.sha256}});
 expect((await call('POST','/admin/campus/places/postal-counter',body)).statusCode).toBe(409);
 const audit=(await call('GET','/admin/campus/history?target_kind=place&target_id=postal-counter')).json().data;expect(audit).toHaveLength(1);expect(audit[0].before.version).toBe(1);expect(audit[0].after.version).toBe(2);
 await app.close();app=createProductApp({dataDir:dir,now:()=>clock,sourceFetch});expect((await entry()).description.en).toBe('Reviewed fixture information');
});
it('rejects stale or mismatched evidence, unsafe links and invented realtime status',async()=>{
 const before=await entry(),evidence=await check(),body={version:1,source_check_id:evidence.id,reason:'Verified official information',fields:fields(before)};
 expect((await call('POST','/admin/campus/places/ef-locker',body)).statusCode).toBe(409);
 expect((await call('POST','/admin/campus/places/postal-counter',{...body,fields:{...body.fields,action_url:'javascript:alert(1)'}})).statusCode).toBe(400);
 expect((await call('POST','/admin/campus/places/postal-counter',{...body,fields:{...body.fields,open_now:'open'}})).statusCode).toBe(400);
 const db=new DatabaseSync(join(dir,'campus.sqlite'));db.prepare('UPDATE campus_source_checks SET retrieved_at=? WHERE id=?').run(clock-86400001,evidence.id);db.close();expect((await call('POST','/admin/campus/places/postal-counter',body)).statusCode).toBe(409);expect(await entry()).toEqual(before);
});
it('records a review decision for the submitter without allowing duplicate resolution or leaking other history',async()=>{
 const r=await call('POST','/campus/corrections',{...target,message:'Please recheck published opening hours'},member);expect(r.statusCode).toBe(201);const correction=r.json().data;
 const pending=(await call('GET','/admin/campus/corrections')).json().data;expect(pending.items[0].id).toBe(correction.id);
 const body={version:1,status:'resolved',resolution:'Checked the official source and retained the current hours.',source_check_id:(await check()).id};
 expect((await call('POST',`/admin/campus/corrections/${correction.id}/resolve`,body,member)).statusCode).toBe(403);
 expect((await call('POST',`/admin/campus/corrections/${correction.id}/resolve`,body)).statusCode).toBe(200);
 expect((await call('POST',`/admin/campus/corrections/${correction.id}/resolve`,body)).statusCode).toBe(409);
 const mine=(await call('GET','/me/campus/corrections',undefined,member)).json().data;expect(mine[0]).toMatchObject({status:'resolved',version:2,resolution:body.resolution});
 expect((await call('GET','/me/campus/corrections')).json().data).toEqual([]);
 const audit=(await call('GET','/admin/campus/history?target_kind=place&target_id=postal-counter')).json().data;expect(JSON.stringify(audit)).not.toContain(correction.message);
});
it('does not change public freshness or create success evidence for failed, oversized or redirect responses',async()=>{
 const before=await entry();
 for(const response of [new Response('Down',{status:503}),new Response('Oversized',{status:200,headers:{'content-length':'1000001'}}),new Response(new Uint8Array(1000001)),new Response(null,{status:302,headers:{location:'https://example.test'}})]){
  sourceFetch.mockResolvedValueOnce(response);expect((await call('POST','/admin/campus/source-checks',target)).statusCode).toBe(502);
 }
 expect(await entry()).toEqual(before);const db=new DatabaseSync(join(dir,'campus.sqlite'));expect(db.prepare('SELECT COUNT(*) AS n FROM campus_source_checks').get()?.n).toBe(0);db.close();
});

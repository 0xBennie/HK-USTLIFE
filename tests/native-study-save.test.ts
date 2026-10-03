import {beforeEach,afterEach,it,expect} from 'vitest';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createProductApp} from '../src/product/app';
import {StudySaveController} from '../apps/mobile/src/study/save-controller';
import {ApiFailure,type RequestOptions} from '../apps/mobile/src/api';
let dir:string,app:ReturnType<typeof createProductApp>,token:string;
async function request(path:string,options:RequestOptions={}){
 const response=await app.inject({method:(options.method??'GET') as 'GET'|'POST'|'PATCH',url:'/api/v1'+path,headers:{authorization:'Bearer '+token,...(options.idempotencyKey?{'idempotency-key':options.idempotencyKey}:{})},payload:options.body as object|undefined});
 const body=response.json();if(response.statusCode>=400)throw new ApiFailure(response.statusCode,body.error.code,body.error.message);return body.data;
}
beforeEach(async()=>{
 dir=mkdtempSync(join(tmpdir(),'campus-study-save-'));app=createProductApp({dataDir:dir});
 const challenge=(await app.inject({method:'POST',url:'/api/v1/auth/email/challenges',payload:{email:'student@example.test'}})).json().data;
 const {code}=JSON.parse(readFileSync(join(dir,'mail',challenge.challenge_id+'.json'),'utf8'));
 token = (await app.inject({method:'POST',url:'/api/v1/auth/email/verify',payload:{challenge_id:challenge.challenge_id,code}})).json().data.access_token;
});
afterEach(async()=>{await app.close();rmSync(dir,{recursive:true,force:true});});
it('commit then lost response retries the same task after server restart, ignoring changed payload',async()=>{
 let calls=0;const keys:string[]=[];
 const controller=new StudySaveController(async(path,options)=>{keys.push(options.idempotencyKey!);const result=await request(path,options);if(++calls===1)throw new ApiFailure(0,'NETWORK_ERROR','Lost response');return result;},randomUUID);
 const body={kind:'task',title:'Original private draft',subtasks:[{id:randomUUID(),title:'Read',done:false}]};
 expect(await controller.submit({path:'/study/items',method:'POST',body})).toBe(false);
 expect(controller.snapshot().phase).toBe('uncertain');body.title='Changed after timeout';body.subtasks[0].title='Changed';
 await app.close();app=createProductApp({dataDir:dir});
 expect(await controller.submit({path:'/study/items',method:'POST',body})).toBe(true);
 const page=await request('/study/items');expect(page.items).toHaveLength(1);expect(page.items[0]).toMatchObject({title:'Original private draft',subtasks:[{title:'Read',done:false}]});
 expect(keys[0]).toBe(keys[1]);expect(controller.snapshot().phase).toBe('saved');
});
it('suppresses synchronous double submit while the real request is in flight',async()=>{
 const started=Promise.withResolvers<void>(),release=Promise.withResolvers<void>();let calls=0;
 const controller=new StudySaveController(async(path,options)=>{calls++;started.resolve();await release.promise;return request(path,options);},randomUUID);
 const operation={path:'/study/items',method:'POST' as const,body:{kind:'task',title:'One task'}};
 const first=controller.submit(operation);await started.promise;expect(await controller.submit(operation)).toBe(false);release.resolve();expect(await first).toBe(true);expect(calls).toBe(1);
 expect((await request('/study/items')).items).toHaveLength(1);
});
it('a known validation rejection allows corrected data with a fresh receipt',async()=>{
 const keys:string[]=[];const controller=new StudySaveController((path,options)=>{keys.push(options.idempotencyKey!);return request(path,options);},randomUUID);
 expect(await controller.submit({path:'/study/items',method:'POST',body:{kind:'task',title:''}})).toBe(false);expect(controller.snapshot().phase).toBe('rejected');
 expect(await controller.submit({path:'/study/items',method:'POST',body:{kind:'task',title:'Corrected'}})).toBe(true);expect(keys[0]).not.toBe(keys[1]);
});
it('a lost versioned edit response is not reported as success when replay requires review',async()=>{
 const item=await request('/study/items',{method:'POST',body:{kind:'task',title:'Before'},idempotencyKey:randomUUID()});let calls=0;
 const controller=new StudySaveController(async(path,options)=>{const result=await request(path,options);if(++calls===1)throw new ApiFailure(0,'NETWORK_ERROR','Lost response');return result;},randomUUID);
 expect(await controller.submit({path:'/study/items/'+item.id,method:'PATCH',body:{version:item.version,title:'After'}})).toBe(false);
 expect(await controller.submit()).toBe(false);expect(controller.snapshot()).toMatchObject({phase:'rejected',error:{code:'VERSION_CONFLICT'}});
 expect((await request('/study/items')).items).toHaveLength(1);expect((await request('/study/items')).items[0].title).toBe('After');
});
it('does not replay a creation after the server receipt window may expire',async()=>{
 let now=0,calls=0;const controller=new StudySaveController(async(path,options)=>{calls++;await request(path,options);throw new ApiFailure(0,'NETWORK_ERROR','Lost response');},randomUUID,()=>now);
 await controller.submit({path:'/study/items',method:'POST',body:{kind:'task',title:'Check before recreating'}});
 now=23*60*60*1000;expect(await controller.submit()).toBe(false);
 expect(controller.snapshot()).toMatchObject({phase:'uncertain',error:{code:'RECEIPT_REVIEW_REQUIRED'}});expect(calls).toBe(1);
});
it('keeps the original request after an invalid acknowledgement and recovers without a duplicate course',async()=>{
 let calls=0;const keys:string[]=[];
 const controller=new StudySaveController(async(path,options)=>{keys.push(options.idempotencyKey!);const value=await request(path,options);return ++calls===1?{ok:true}:value;},randomUUID);
 expect(await controller.submit({path:'/study/courses',method:'POST',body:{title:'  Data & Decisions  ',code:'  ISOM  ',description:'Private course'}})).toBe(false);
 expect(controller.snapshot()).toMatchObject({phase:'uncertain',error:{code:'INVALID_RESPONSE'}});
 await app.close();app=createProductApp({dataDir:dir});
 expect(await controller.submit()).toBe(true);expect(keys[0]).toBe(keys[1]);
 const courses=await request('/study/courses');expect(courses.items).toHaveLength(1);expect(courses.items[0]).toMatchObject({title:'Data & Decisions',code:'ISOM'});
});
it('accepts normalized event timestamps and nested task titles from the real server',async()=>{
 const event=new StudySaveController(request,randomUUID);
 expect(await event.submit({path:'/study/items',method:'POST',body:{kind:'event',title:' Class ',starts_at:'2026-10-05T09:00:00+08:00',ends_at:'2026-10-05T10:00:00+08:00'}})).toBe(true);
 const task=new StudySaveController(request,randomUUID);
 expect(await task.submit({path:'/study/items',method:'POST',body:{kind:'task',title:'Assignment',subtasks:[{id:randomUUID(),title:' Read ',done:false}]}})).toBe(true);
 const note=new StudySaveController(request,randomUUID);
 expect(await note.submit({path:'/study/items',method:'POST',body:{kind:'note',title:'Notes',body:'  preserve whitespace  '}})).toBe(true);
});
it.each(['id','version','title','body'] as const)('does not dismiss an editor for a mismatched %s acknowledgement',async field=>{
 const item=await request('/study/items',{method:'POST',body:{kind:'note',title:'Before',body:'Private text'},idempotencyKey:randomUUID()});
 const controller=new StudySaveController(async(path,options)=>{
  const value=await request(path,options);return {...value,[field]:field==='id'?randomUUID():field==='version'?item.version:'Wrong content'};
 },randomUUID);
 expect(await controller.submit({path:'/study/items/'+item.id,method:'PATCH',body:{version:item.version,title:'After',body:'Exact saved text'}})).toBe(false);
 expect(controller.snapshot()).toMatchObject({phase:'uncertain',error:{code:'INVALID_RESPONSE'}});
 expect(await request('/study/items/'+item.id)).toMatchObject({title:'After',body:'Exact saved text',version:item.version+1});
 // Retrying the same reviewed version cannot overwrite the committed edit.
 expect(await controller.submit()).toBe(false);expect(controller.snapshot()).toMatchObject({phase:'rejected',error:{code:'VERSION_CONFLICT'}});
});
it.each([-1,Number.NaN,Number.POSITIVE_INFINITY])('refuses receipt replay after invalid elapsed time %s',async elapsed=>{
 let now=1000,calls=0;
 const controller=new StudySaveController(async(path,options)=>{calls++;await request(path,options);throw new ApiFailure(0,'NETWORK_ERROR','Lost acknowledgement');},randomUUID,()=>now);
 await controller.submit({path:'/study/items',method:'POST',body:{kind:'task',title:'No duplicate'}});
 now=1000+elapsed;expect(await controller.submit()).toBe(false);
 expect(controller.snapshot()).toMatchObject({phase:'uncertain',error:{code:'RECEIPT_REVIEW_REQUIRED'}});expect(calls).toBe(1);
 expect((await request('/study/items')).items).toHaveLength(1);
});
it('confirms the intended imported occurrence and keeps its source rule unchanged',async()=>{
 const content='BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:save-series\r\nDTSTART:20261005T010000Z\r\nRRULE:FREQ=WEEKLY;COUNT=2\r\nSUMMARY:Imported class\r\nEND:VEVENT\r\nEND:VCALENDAR';
 const preview=await request('/calendar/imports/preview',{method:'POST',body:{source_name:'Save fixture',content}});
 await request('/calendar/imports/'+preview.id+'/confirm',{method:'POST',body:{uids:['save-series']}});
 const day=await request('/me/calendar?from=2026-10-05&to=2026-10-13'),item=day.days[0].events[0];
 const original=await request('/calendar/sources/'+item.import_origin.source_id);
 const event={kind:'event',title:'Moved class',starts_at:'2026-10-05T03:00:00Z'};
 const path='/calendar/series/'+item.import_origin.series_id+'/occurrence';
 const controller=new StudySaveController(request,randomUUID);
 expect(await controller.submit({path,method:'PATCH',body:{version:item.version,recurrence_id:item.recurrence_id,event}})).toBe(true);
 const source=await request('/calendar/sources/'+item.import_origin.source_id);
 expect(source.series[0].summary).toEqual(original.series[0].summary);
 for(const field of ['series_id','recurrence_id','event']){
  const latest=await request('/calendar/sources/'+item.import_origin.source_id);
  const mismatch=new StudySaveController(async(p,options)=>{const value=await request(p,options);return {...value,[field]:field==='event'?{...value.event,title:'Wrong'}:'wrong-identity'};},randomUUID);
  expect(await mismatch.submit({path,method:'PATCH',body:{version:latest.series[0].version,recurrence_id:item.recurrence_id,event}})).toBe(false);
  expect(mismatch.snapshot()).toMatchObject({phase:'uncertain',error:{code:'INVALID_RESPONSE'}});
 }
});

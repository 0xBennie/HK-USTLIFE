import {beforeEach,afterEach,it,expect} from 'vitest';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createProductApp} from '../src/product/app';
import {StudyActionController,type StudyAction} from '../apps/mobile/src/study/action-controller';
import {ApiFailure,type RequestOptions} from '../apps/mobile/src/api';
let dir:string,app:ReturnType<typeof createProductApp>,token:string;
async function request(path:string,options:RequestOptions={}){const r=await app.inject({method:(options.method??'GET') as 'GET'|'POST'|'PATCH'|'DELETE',url:'/api/v1'+path,headers:{authorization:'Bearer '+token,'idempotency-key':options.idempotencyKey??randomUUID()},payload:options.body as object|undefined});const j=r.json();if(r.statusCode>=400)throw new ApiFailure(r.statusCode,j.error.code,j.error.message);return j.data;}
beforeEach(async()=>{dir=mkdtempSync(join(tmpdir(),'campus-study-actions-'));app=createProductApp({dataDir:dir});const c=(await app.inject({method:'POST',url:'/api/v1/auth/email/challenges',payload:{email:'student@example.test'}})).json().data;const {code}=JSON.parse(readFileSync(join(dir,'mail',c.challenge_id+'.json'),'utf8'));token = (await app.inject({method:'POST',url:'/api/v1/auth/email/verify',payload:{challenge_id:c.challenge_id,code}})).json().data.access_token;});
afterEach(async()=>{await app.close();rmSync(dir,{recursive:true,force:true});});
async function task(){return request('/study/items',{method:'POST',body:{kind:'task',title:'Private task'}});}
function toggle(t:any,status='done'):StudyAction{return {path:'/study/items/'+t.id,method:'PATCH',body:{version:t.version,status},label:t.title};}
it('synchronously locks a task toggle and refreshes the actual completed version before another action',async()=>{
 const item=await task(),started=Promise.withResolvers<void>(),release=Promise.withResolvers<void>();let writes=0;let list:any[]=[];
 const c=new StudyActionController(async(path,options)=>{writes++;started.resolve();await release.promise;return request(path,options);},async()=>{list=(await request('/study/items')).items;return true;});
 const pending=c.submit(toggle(item));await started.promise;expect(await c.submit(toggle(item))).toBe(false);release.resolve();expect(await pending).toBe(true);expect(writes).toBe(1);expect(list[0]).toMatchObject({status:'done',version:2});expect(c.snapshot().phase).toBe('saved');
 expect(await c.submit(toggle(list[0],'open'))).toBe(true);expect(list[0]).toMatchObject({status:'open',version:3});
});
it('does not undo a committed toggle after a lost response; read-only recovery survives backend restart',async()=>{
 const item=await task();let writes=0,reads=0;let current:any;
 const c=new StudyActionController(async(path,options)=>{writes++;await request(path,options);throw new ApiFailure(0,'NETWORK_ERROR','Response lost');},async()=>{reads++;current=(await request('/study/items')).items[0];return true;});
 expect(await c.submit(toggle(item))).toBe(false);expect(c.snapshot().phase).toBe('uncertain');expect(await c.submit(toggle(item,'open'))).toBe(false);
 await app.close();app=createProductApp({dataDir:dir});expect(await c.check()).toBe(true);expect(c.snapshot().phase).toBe('reviewed');expect(current).toMatchObject({status:'done',version:2});expect({writes,reads}).toEqual({writes:1,reads:1});
});
it('reports accepted write with failed refresh separately and never resends it on refresh retry',async()=>{
 const item=await task();let writes=0,reads=0;
 const c=new StudyActionController((p,o)=>{writes++;return request(p,o);},async()=>{reads++;if(reads<3)throw new ApiFailure(0,'NETWORK_ERROR','Read unavailable');expect((await request('/study/items')).items[0].status).toBe('done');return true;});
 expect(await c.submit(toggle(item))).toBe(false);expect(c.snapshot().phase).toBe('refresh-needed');expect(await c.submit(toggle(item))).toBe(false);expect(await c.check()).toBe(false);expect(c.snapshot().phase).toBe('refresh-needed');expect(await c.check()).toBe(true);expect(c.snapshot().phase).toBe('saved');expect(writes).toBe(1);
});
it('requires current-state review after version conflict and freezes a concurrent recovery',async()=>{
 const item=await task();await request('/study/items/'+item.id,{method:'PATCH',body:{version:1,title:'Changed elsewhere'}});let writes=0;const release=Promise.withResolvers<void>();
 const c=new StudyActionController((p,o)=>{writes++;return request(p,o);},async()=>{await release.promise;await request('/study/items');return true;});
 expect(await c.submit(toggle(item))).toBe(false);expect(c.snapshot()).toMatchObject({phase:'uncertain',error:{code:'VERSION_CONFLICT'}});const read=c.check();expect(c.snapshot().phase).toBe('checking');expect(await c.check()).toBe(false);expect(await c.submit(toggle(item))).toBe(false);release.resolve();expect(await read).toBe(true);expect(writes).toBe(1);expect((await request('/study/items')).items[0]).toMatchObject({title:'Changed elsewhere',status:'open',version:2});
});
it('recovers a lost delete response from the collection without repeating deletion or deleting detached records',async()=>{
 const course=await request('/study/courses',{method:'POST',body:{title:'Private course'}});const item=await request('/study/items',{method:'POST',body:{kind:'task',title:'Keep this task',course_id:course.id}});let writes=0;
 const c=new StudyActionController(async(p,o)=>{writes++;await request(p,o);throw new ApiFailure(0,'NETWORK_ERROR','Lost deletion response');},async()=>{expect((await request('/study/courses')).items).toEqual([]);expect((await request('/study/items')).items[0]).toMatchObject({id:item.id,course_id:null});return true;});
 expect(await c.submit({path:'/study/courses/'+course.id,method:'DELETE',body:{version:1},label:course.title})).toBe(false);expect(await c.check()).toBe(true);expect(c.snapshot().phase).toBe('reviewed');expect(writes).toBe(1);
});
it('leaves malformed successful responses unconfirmed and allows correction after an explicit validation rejection',async()=>{
 const item=await task();const c=new StudyActionController(async(p,o)=>{await request(p,o);return {};},async()=>{expect((await request('/study/items')).items[0].status).toBe('done');return true;});
 expect(await c.submit(toggle(item))).toBe(false);expect(c.snapshot()).toMatchObject({phase:'uncertain',error:{code:'INVALID_RESPONSE'}});expect(await c.check()).toBe(true);
 const valid=new StudyActionController(request,async()=>{await request('/study/items');return true;});expect(await valid.submit(toggle({...item,version:2},'bad'))).toBe(false);expect(valid.snapshot().phase).toBe('rejected');expect(await valid.submit(toggle({...item,version:2},'open'))).toBe(true);
});

it('accepts the dedicated imported-occurrence contract and refreshes its removal without editing the source',async()=>{
 const content='BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:private-series\r\nDTSTART:20261005T010000Z\r\nSUMMARY:Imported class\r\nEND:VEVENT\r\nEND:VCALENDAR';
 const preview=await request('/calendar/imports/preview',{method:'POST',body:{source_name:'Local fixture',content}});await request('/calendar/imports/'+preview.id+'/confirm',{method:'POST',body:{uids:['private-series']}});
 const day=()=>request('/me/calendar?from=2026-10-05&to=2026-10-06');const item=(await day()).days[0].events[0];const beforeSource=await request('/calendar/sources/'+item.import_origin.source_id);
 const c=new StudyActionController(request,async()=>{expect((await day()).days[0].events).toEqual([]);return true;});
 expect(await c.submit({path:'/calendar/series/'+item.import_origin.series_id+'/occurrence/status',method:'PATCH',body:{version:item.version,recurrence_id:item.recurrence_id,status:'cancelled'},label:item.title})).toBe(true);expect(c.snapshot().phase).toBe('saved');
 const source=await request('/calendar/sources/'+item.import_origin.source_id);expect(source.series[0].overrides[0].payload.status).toBe('cancelled');expect(source.series[0].id).toBe(beforeSource.series[0].id);expect(source.series[0].summary).toEqual(beforeSource.series[0].summary);
});

it('confirms school personal completion against its personal version, never the source version',async()=>{
 const action={path:'/school/records/school-id/personal',method:'PATCH' as const,body:{version:3,completed:true},label:'Essay'};
 const controller=new StudyActionController(async()=>({id:'school-id',version:1,personal:{version:4,completed:true}}),async()=>true);
 expect(await controller.submit(action)).toBe(true);expect(controller.snapshot().phase).toBe('saved');
 const wrong=new StudyActionController(async()=>({id:'school-id',version:99,personal:{version:3,completed:false}}),async()=>true);
 expect(await wrong.submit(action)).toBe(false);expect(wrong.snapshot().phase).toBe('uncertain');
});

import {beforeEach,afterEach,it,expect} from 'vitest';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createProductApp} from '../src/product/app.js';
let dir:string,app:ReturnType<typeof createProductApp>,alice:string,bob:string;
const time=Date.parse('2026-10-03T00:00:00Z');
beforeEach(async()=>{
 dir=mkdtempSync(join(tmpdir(),'campus-reminders-'));app=createProductApp({dataDir:dir,now:()=>time});
 async function login(email:string){const challenge=(await app.inject({method:'POST',url:'/api/v1/auth/email/challenges',payload:{email}})).json().data;const {code}=JSON.parse(readFileSync(join(dir,'mail',challenge.challenge_id+'.json'),'utf8'));return (await app.inject({method:'POST',url:'/api/v1/auth/email/verify',payload:{challenge_id:challenge.challenge_id,code}})).json().data.access_token;}
 alice=await login('alice@example.test');bob=await login('bob@example.test');
});
afterEach(async()=>{await app.close();rmSync(dir,{recursive:true,force:true});});
function call(method:'GET'|'POST'|'PATCH'|'PUT'|'DELETE',path:string,payload?:object,token = alice){return app.inject({method,url:'/api/v1'+path,payload,headers:{authorization:'Bearer '+token,'idempotency-key':randomUUID()}});}
async function feed(token = alice){const r=await call('GET','/me/reminders',undefined,token);expect(r.statusCode,r.body).toBe(200);return r.json().data;}
async function item(payload:object){const r=await call('POST','/study/items',payload);expect(r.statusCode,r.body).toBe(201);return r.json().data;}
it('uses authenticated identity and removes completed, cancelled, deleted and past reminders',async()=>{
 const task=await item({kind:'task',title:'Private task',due_at:'2026-10-05T04:00:00Z',remind_minutes:30});
 const event=await item({kind:'event',title:'Private event',starts_at:'2026-10-05T06:00:00Z',remind_minutes:10});
 await item({kind:'event',title:'No reminder',starts_at:'2026-10-05T06:00:00Z'});
 await item({kind:'event',title:'Past fire',starts_at:'2026-10-03T00:05:00Z',remind_minutes:10});
 expect((await app.inject('/api/v1/me/reminders')).statusCode).toBe(401);
 expect((await feed(bob)).items).toEqual([]);
 expect((await feed()).items.map((x:any)=>[x.title,x.fires_at])).toEqual([['Private task','2026-10-05T03:30:00.000Z'],['Private event','2026-10-05T05:50:00.000Z']]);
 await call('PATCH','/study/items/'+task.id,{version:1,status:'done'});
 await call('PATCH','/study/items/'+event.id,{version:1,status:'cancelled'});
 expect((await feed()).items).toEqual([]);
 await call('PATCH','/study/items/'+task.id,{version:2,status:'open',due_at:'2026-10-06T04:00:00Z'});
 expect((await feed()).items[0].fires_at).toBe('2026-10-06T03:30:00.000Z');
 await call('DELETE','/study/items/'+task.id,{version:3});expect((await feed()).items).toEqual([]);
});
it('saved activity reminders follow organizer reschedule, withdrawal and cancellation',async()=>{
 const created=await call('POST','/activities',{kind:'study',title:'Study hour',location:'Library',starts_at:'2026-10-05T04:00:00Z',ends_at:'2026-10-05T05:00:00Z',capacity:3,languages:['en'],visibility:'public'});
 expect(created.statusCode,created.body).toBe(201);const event=created.json().data;
 await call('POST',`/activities/${event.id}/join`,{activity_version:1,save_calendar:true},bob);
 await call('PUT',`/activities/${event.id}/preferences`,{bookmarked:false,calendar_saved:true,remind_minutes:10},bob);
 expect((await feed(bob)).items[0]).toMatchObject({fires_at:'2026-10-05T03:50:00.000Z',target:{kind:'activity',id:event.id}});
 await call('PATCH',`/activities/${event.id}`,{version:1,starts_at:'2026-10-06T04:00:00Z',ends_at:'2026-10-06T05:00:00Z'});
 expect((await feed(bob)).items[0].fires_at).toBe('2026-10-06T03:50:00.000Z');
 await call('POST',`/activities/${event.id}/withdraw`,{participation_version:1},bob);expect((await feed(bob)).items).toEqual([]);
 await call('PUT',`/activities/${event.id}/preferences`,{bookmarked:false,calendar_saved:true,remind_minutes:10},bob);
 await call('POST',`/activities/${event.id}/cancel`,{version:2});expect((await feed(bob)).items).toEqual([]);
});
it('only explicitly edited imported occurrences gain reminders, including moved exceptions',async()=>{
 const content='BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:weekly\r\nDTSTART:20261005T040000Z\r\nRRULE:FREQ=WEEKLY;COUNT=3\r\nSUMMARY:Weekly class\r\nEND:VEVENT\r\nEND:VCALENDAR';
 const preview=(await call('POST','/calendar/imports/preview',{source_name:'Example',content})).json().data;
 await call('POST',`/calendar/imports/${preview.id}/confirm`,{uids:['weekly']});expect((await feed()).items).toEqual([]);
 const occurrence=(await call('GET','/me/calendar?from=2026-10-05&to=2026-10-06')).json().data.days[0].events[0];
 const path=`/calendar/series/${occurrence.import_origin.series_id}/occurrence`;
 const r=await call('PATCH',path,{version:1,recurrence_id:occurrence.recurrence_id,event:{kind:'event',title:'Moved class',starts_at:'2026-10-07T04:00:00Z',remind_minutes:60}});expect(r.statusCode,r.body).toBe(200);
 expect((await feed()).items).toHaveLength(1);expect((await feed()).items[0]).toMatchObject({fires_at:'2026-10-07T03:00:00.000Z',target:{kind:'import'}});
 await call('PATCH',path+'/status',{version:2,recurrence_id:occurrence.recurrence_id,status:'cancelled'});expect((await feed()).items).toEqual([]);
});
it('limits by firing time with explicit deferred count and preserves preferences after restart',async()=>{
 for(let i=0;i<62;i++)await item({kind:'task',title:'Task '+i,due_at:new Date(time+(i+1)*3600000).toISOString(),remind_minutes:0});
 // The event is outside the 14-day target window, but its lead-time reminder is inside.
 await item({kind:'event',title:'Later event',starts_at:'2026-10-22T00:00:00Z',remind_minutes:10080});
 const before=await feed();expect(before.items).toHaveLength(60);expect(before.deferred).toBe(3);
 await app.close();app=createProductApp({dataDir:dir,now:()=>time});expect(await feed()).toEqual(before);
});

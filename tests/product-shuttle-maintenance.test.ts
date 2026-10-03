import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {createProductApp} from '../src/product/app.js';
let dir:string,app:ReturnType<typeof createProductApp>,admin:string,member:string,clock:number;
const sourceFetch=vi.fn<typeof fetch>();const routeId='hang-hau-to-campus';
beforeEach(async()=>{clock=Date.parse('2026-10-03T00:00:00Z');dir=mkdtempSync(join(tmpdir(),'shuttle-maintenance-'));sourceFetch.mockReset().mockImplementation(async()=>new Response('Official source fixture',{status:200}));app=createProductApp({dataDir:dir,now:()=>clock,sourceFetch});

 member=await login('member@example.test');admin=await login('admin@example.test');const db=new DatabaseSync(join(dir,'campus.sqlite'));db.prepare("UPDATE users SET role='admin' WHERE email='admin@example.test'").run();db.close();
});
afterEach(async()=>{await app.close();rmSync(dir,{recursive:true,force:true});});
async function login(email:string){const challenge=(await call('POST','/auth/email/challenges',{email},'')).json().data;const {code}=JSON.parse(readFileSync(join(dir,'mail',challenge.challenge_id+'.json'),'utf8'));return(await call('POST','/auth/email/verify',{challenge_id:challenge.challenge_id,code},'')).json().data.access_token;}
function call(method:'GET'|'POST',path:string,payload?:object,token = admin){return app.inject({method,url:'/api/v1'+path,payload,headers:{authorization:'Bearer '+token}});}
async function snapshot(){const r=await call('GET','/admin/campus/shuttle');expect(r.statusCode,r.body).toBe(200);return r.json().data;}
function fields(snapshot:any,id=routeId){const {id:_,source,refresh_due_at,...fields}=snapshot.catalog.routes.find((r:any)=>r.id===id);return fields;}
async function capture(holiday=false){const r=await call('POST','/admin/campus/source-checks',{target_kind:holiday?'shuttle_holidays':'shuttle_timetable',target_id:holiday?'calendar':'catalog'});expect(r.statusCode,r.body).toBe(200);return r.json().data;}
async function departures(id=routeId,at='2026-10-05T08:00:00+08:00'){return(await call('GET','/transport/routes/'+id+'/departures?at='+encodeURIComponent(at),undefined,'')).json().data;}
it('isolates admin routes and evidence, previews without mutation, persists student-visible edits and audit',async()=>{
 const before=await snapshot();for(const path of ['/admin/campus/shuttle'])expect((await call('GET',path,undefined,member)).statusCode).toBe(403);
 const body={revision:1,fields:{...fields(before),departures:['08:32','08:42']},at:'2026-10-05T08:33:00+08:00'};
 expect((await call('POST','/admin/campus/shuttle/routes/'+routeId+'/preview',body,member)).statusCode).toBe(403);
 const preview=await call('POST','/admin/campus/shuttle/routes/'+routeId+'/preview',body);expect(preview.statusCode,preview.body).toBe(200);expect(preview.json().data.upcoming.map((d:any)=>d.local_time)).toEqual(['08:42']);expect(await snapshot()).toEqual(before);
 const check=await capture();expect(await snapshot()).toEqual(before);const write={revision:1,fields:body.fields,reason:'Reviewed test timetable',source_check_id:check.id};
 expect((await call('POST','/admin/campus/shuttle/routes/'+routeId,write,member)).statusCode).toBe(403);
 const saved=await call('POST','/admin/campus/shuttle/routes/'+routeId,write);expect(saved.statusCode,saved.body).toBe(200);expect(saved.json().data.revision).toBe(2);
 expect((await departures()).upcoming.map((d:any)=>d.local_time)).toEqual(['08:32','08:42']);expect((await departures()).source.sha256).toBe(check.sha256);
 expect((await call('POST','/admin/campus/shuttle/routes/'+routeId,write)).statusCode).toBe(409);
 await app.close();app=createProductApp({dataDir:dir,now:()=>clock,sourceFetch});expect((await snapshot()).revision).toBe(2);expect((await departures()).timetable[0].local_time).toBe('08:32');
 const audit=(await call('GET','/admin/campus/history?target_kind=shuttle&target_id='+routeId)).json().data;expect(audit).toHaveLength(1);expect(audit[0]).toMatchObject({action:'edit_shuttle_route',before:{revision:1},after:{revision:2}});
});
it('rejects invalid dates, duplicate or unordered times, wrong/old evidence and preserves catalog',async()=>{
 const before=await snapshot(),check=await capture(),holiday=await capture(true),base={revision:1,source_check_id:check.id,reason:'Validated test change',fields:fields(before)};
 for(const patch of [{departures:['08:30','08:30']},{departures:['08:40','08:30']},{departures:['25:00']},{valid_from:'2026-02-30'},{valid_to:'2026-01-01'},{weekdays:[1,1]},{fare_minor:-1},{departures:[]},{extra:'unsupported'}])expect((await call('POST','/admin/campus/shuttle/routes/'+routeId,{...base,fields:{...base.fields,...patch}})).statusCode).toBe(400);
 expect((await call('POST','/admin/campus/shuttle/routes/'+routeId,{...base,source_check_id:holiday.id})).statusCode).toBe(409);
 clock+=86400001;admin=await login('admin@example.test');expect((await call('POST','/admin/campus/shuttle/routes/'+routeId,base)).statusCode).toBe(409);expect(await snapshot()).toEqual(before);
});
it('publishes holiday coverage transactionally without renewing timetable freshness',async()=>{
 const before=await snapshot(),check=await capture(true),body={revision:1,source_check_id:check.id,reason:'Reviewed complete test calendar',years:[2026],holidays:[{date:'2026-10-05',name:'Fixture holiday'}]};
 expect(sourceFetch.mock.calls[0][0]).toBe(before.catalog.holiday_source.url);
 expect((await call('POST','/admin/campus/shuttle/holidays',body,member)).statusCode).toBe(403);
 for(const patch of [{years:[2026,2027]},{holidays:[{date:'2027-01-01',name:'Wrong year'}]},{holidays:[body.holidays[0],body.holidays[0]]}])expect((await call('POST','/admin/campus/shuttle/holidays',{...body,...patch})).statusCode).toBe(400);
 const saved=await call('POST','/admin/campus/shuttle/holidays',body);expect(saved.statusCode,saved.body).toBe(200);expect(saved.json().data.catalog.routes).toEqual(before.catalog.routes);expect(await departures()).toMatchObject({status:'public_holiday',upcoming:[]});
 expect((await departures(routeId,'2027-10-05T08:00:00+08:00')).status).toBe('holiday_coverage_unknown');expect((await call('POST','/admin/campus/shuttle/holidays',body)).statusCode).toBe(409);
 const audit=(await call('GET','/admin/campus/history?target_kind=shuttle_holidays&target_id=calendar')).json().data;expect(audit[0].action).toBe('edit_shuttle_holidays');
 await app.close();app=createProductApp({dataDir:dir,now:()=>clock,sourceFetch});expect((await departures()).status).toBe('public_holiday');
});
it('renews only the reviewed route, and suppresses schedules when holiday evidence expires',async()=>{
 const before=await snapshot();clock=Date.parse(before.catalog.refresh_due_at)+1000;admin=await login('admin@example.test');const check=await capture();const response=await call('POST','/admin/campus/shuttle/routes/'+routeId,{revision:1,source_check_id:check.id,reason:'Rechecked this route only',fields:fields(before)});expect(response.statusCode,response.body).toBe(200);
 expect((await departures()).status).toBe('scheduled');expect((await departures('campus-to-hang-hau')).status).toBe('stale');expect((await call('GET','/transport/routes')).json().data.freshness).toBe('stale');
 clock=Date.parse(before.catalog.holiday_refresh_due_at)+1000;admin=await login('admin@example.test');const newer=await capture();await call('POST','/admin/campus/shuttle/routes/'+routeId,{revision:2,source_check_id:newer.id,reason:'Timetable reviewed; holidays stale',fields:fields(before)});expect((await departures()).status).toBe('stale');
});
it('honors an explicitly reviewed Sunday/holiday service instead of imposing the seed rule',async()=>{
 const before=await snapshot(),check=await capture();const r=await call('POST','/admin/campus/shuttle/routes/'+routeId,{revision:1,source_check_id:check.id,reason:'Fixture Sunday operation verified',fields:{...fields(before),weekdays:[0],exclude_public_holidays:false}});expect(r.statusCode,r.body).toBe(200);expect((await departures(routeId,'2026-10-04T08:00:00+08:00')).status).toBe('scheduled');
});

import {beforeEach,afterEach,it,expect} from 'vitest';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {createProductApp} from '../src/product/app.js';
let dir:string,app:ReturnType<typeof createProductApp>,owner:string,member:string,waiting:string,admin:string,clock:number;
const draft={kind:'study',title:'[DEMO] Quiet study',location:'Library',starts_at:'2026-10-05T02:00:00Z',ends_at:'2026-10-05T03:00:00Z',capacity:1,languages:['en'],interaction:'quiet',visibility:'public'};
beforeEach(async()=>{clock=Date.parse('2026-10-03T00:00:00Z');dir=mkdtempSync(join(tmpdir(),'campus-admin-activity-'));app=createProductApp({dataDir:dir,now:()=>clock});async function login(email:string){const c=(await call('POST','/auth/email/challenges',{email},'')).json().data;const {code}=JSON.parse(readFileSync(join(dir,'mail',c.challenge_id+'.json'),'utf8'));return(await call('POST','/auth/email/verify',{challenge_id:c.challenge_id,code},'')).json().data.access_token;}owner=await login('owner@example.test');member=await login('member@example.test');waiting=await login('waiting@example.test');admin=await login('admin@example.test');sql(db=>db.prepare("UPDATE users SET role='admin' WHERE email='admin@example.test'").run());});
afterEach(async()=>{await app.close();rmSync(dir,{recursive:true,force:true});});
function sql<T>(job:(db:DatabaseSync)=>T){const db=new DatabaseSync(join(dir,'campus.sqlite'));try{return job(db);}finally{db.close();}}
function call(method:'GET'|'POST'|'PUT'|'PATCH'|'DELETE',path:string,payload?:object,token = admin){return app.inject({method,url:'/api/v1'+path,payload,headers:{...(token?{authorization:'Bearer '+token}:{}),'idempotency-key':randomUUID()}});}
async function create(changes:object={}){const r=await call('POST','/activities',{...draft,...changes},owner);expect(r.statusCode,r.body).toBe(201);return r.json().data;}
const edit=(version:number,changes:object)=>({version,action:'edit',reason:'Reviewed local fixture',changes});
async function detail(id:string,token = member){return(await call('GET','/activities/'+id,undefined,token)).json().data;}
it('requires current admin authority without granting ordinary organizer or roster privileges',async()=>{
 const a=await create({visibility:'members'}),base='/admin/activities/'+a.id;
 for(const path of ['/admin/activities',base,base+'/history']){expect((await call('GET',path,undefined,member)).statusCode).toBe(403);expect((await call('GET',path,undefined,'')).statusCode).toBe(401);}
 expect((await call('POST',base+'/maintain',edit(1,{title:'Other'}),owner)).statusCode).toBe(403);
 expect((await call('PATCH','/activities/'+a.id,{version:1,title:'Other'})).statusCode).toBe(403);
 expect((await call('GET','/activities/'+a.id+'/participants')).statusCode).toBe(403);
 const data=(await call('GET',base)).json().data;expect(data.mine).toBeNull();expect(JSON.stringify(data)).not.toContain('@example.test');expect(data.visibility).toBe('members');
 sql(db=>db.prepare("UPDATE users SET role='member' WHERE email='admin@example.test'").run());expect((await call('POST',base+'/maintain',edit(1,{title:'Other'}))).statusCode).toBe(403);
});
it('searches and paginates without duplicates and validates filters',async()=>{
 for(let i=0;i<3;i++)await create({title:'Searchable '+i});await create({title:'Different'});
 const first=(await call('GET','/admin/activities?q=Searchable&limit=2')).json().data;expect(first.items).toHaveLength(2);expect(first.next_cursor).toBeTruthy();const next=(await call('GET','/admin/activities?q=Searchable&limit=2&cursor='+first.next_cursor)).json().data;expect(next.items).toHaveLength(1);expect(new Set([...first.items,...next.items].map(x=>x.id)).size).toBe(3);expect(next.next_cursor).toBeNull();expect((await call('GET','/admin/activities?unknown=true')).statusCode).toBe(400);
});
it('shares promotion, opt-in calendar, reminder and organizer notice semantics with ordinary edits, then cancels atomically',async()=>{
 const a=await create(),path='/admin/activities/'+a.id+'/maintain';for(const token of [member,waiting]){expect((await call('POST','/activities/'+a.id+'/join',{activity_version:1,save_calendar:true},token)).statusCode).toBe(200);await call('PUT','/activities/'+a.id+'/preferences',{bookmarked:false,calendar_saved:true,remind_minutes:15},token);}
 const updated=await call('POST',path,edit(1,{location:'New room',starts_at:'2026-10-06T02:00:00Z',ends_at:'2026-10-06T03:00:00Z',capacity:2}));expect(updated.statusCode,updated.body).toBe(200);expect(updated.json().data.counts.confirmed).toBe(2);expect((await detail(a.id,waiting)).mine.participation.status).toBe('confirmed');
 const day=(await call('GET','/me/calendar?from=2026-10-06&to=2026-10-07',undefined,member)).json().data.days[0].events;expect(day[0].location).toBe('New room');
 for(const token of [owner,member,waiting])expect((await call('GET','/me/notifications',undefined,token)).json().data.items.some((n:any)=>n.kind==='activity_updated')).toBe(true);
 expect((await call('POST',path,edit(1,{title:'Stale'}))).statusCode).toBe(409);
 expect((await call('POST',path,{version:2,action:'cancel',reason:'Cancelled test fixture'})).statusCode).toBe(200);
 const mine=(await detail(a.id)).mine;expect(mine).toMatchObject({calendar_saved:false,remind_minutes:null,participation:{status:'cancelled'}});
 expect((await call('GET','/me/calendar?from=2026-10-06&to=2026-10-07',undefined,member)).json().data.days[0].events).toEqual([]);
 const reminders=(await call('GET','/me/reminders',undefined,member)).json().data;expect(JSON.stringify(reminders)).not.toContain(a.id);
 expect((await call('GET','/me/notifications',undefined,owner)).json().data.items.some((n:any)=>n.kind==='activity_cancelled')).toBe(true);
 expect((await call('POST',path,edit(3,{status:'open'}))).statusCode).toBe(409);
 const history=(await call('GET','/admin/activities/'+a.id+'/history')).json().data;expect(history).toHaveLength(2);expect(history[0]).toMatchObject({before_version:2,after_version:3,action:'cancel'});
 await app.close();app=createProductApp({dataDir:dir,now:()=>clock});expect((await detail(a.id)).status).toBe('cancelled');
});
it('preserves capacity, time, fixed visibility, close/reopen and moderation rules without audit for rejected writes',async()=>{
 const a=await create(),path='/admin/activities/'+a.id+'/maintain';
 for(const changes of [{visibility:'members'},{kind:'activity'},{starts_at:'2026-10-01T00:00:00Z'},{capacity:0},{}])expect((await call('POST',path,edit(1,changes))).statusCode).toBe(400);
 expect((await call('POST',path,{...edit(1,{location:'Elsewhere'}),reason:'x'})).statusCode).toBe(400);
 expect((await call('POST',path,edit(1,{status:'closed'}))).statusCode).toBe(200);expect((await call('POST','/activities/'+a.id+'/join',{activity_version:2},member)).statusCode).toBe(409);
 expect((await call('POST',path,edit(2,{status:'open',capacity:2}))).statusCode).toBe(200);for(const token of [member,waiting])await call('POST','/activities/'+a.id+'/join',{activity_version:3},token);
 expect((await call('POST',path,edit(3,{capacity:1}))).statusCode).toBe(409);
 sql(db=>db.prepare("UPDATE activities SET moderation_state='hidden' WHERE id=?").run(a.id));expect((await call('POST',path,edit(3,{location:'Elsewhere'}))).statusCode).toBe(409);
 expect((await call('GET','/admin/activities/'+a.id+'/history')).json().data).toHaveLength(2);
});
it('rolls back domain changes when audit persistence fails and retains no content snapshots after activity deletion',async()=>{
 const a=await create(),path='/admin/activities/'+a.id+'/maintain';sql(db=>db.exec("CREATE TRIGGER audit_failure BEFORE INSERT ON activity_maintenance_audit BEGIN SELECT RAISE(ABORT,'test failure'); END;"));
 expect((await call('POST',path,edit(1,{title:'Private replacement'}))).statusCode).toBe(500);expect((await detail(a.id)).version).toBe(1);expect((await call('GET','/me/notifications',undefined,owner)).json().data.items).toEqual([]);
 sql(db=>db.exec('DROP TRIGGER audit_failure;'));expect((await call('POST',path,edit(1,{title:'Private replacement'}))).statusCode).toBe(200);
 expect((await call('DELETE','/activities/'+a.id,{version:2},owner)).statusCode).toBe(200);
 const rows=sql(db=>db.prepare('SELECT * FROM activity_maintenance_audit').all());expect(rows).toHaveLength(1);expect(rows[0].activity_id).toBeNull();expect(JSON.stringify(rows)).not.toContain('Private replacement');expect(JSON.stringify(rows)).not.toContain(draft.title);
});

import {beforeEach,afterEach,it,expect} from 'vitest';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createProductApp} from '../src/product/app.js';
let dir:string,app:ReturnType<typeof createProductApp>,owner:string,a:string,b:string,clock:number;
const draft={kind:'study',title:'Quiet study',location:'Library',starts_at:'2026-10-05T02:00:00Z',ends_at:'2026-10-05T03:00:00Z',capacity:1,languages:['en'],interaction:'quiet',visibility:'public'};
beforeEach(async()=>{
 clock=Date.parse('2026-10-03T00:00:00Z');dir=mkdtempSync(join(tmpdir(),'campus-social-'));app=createProductApp({dataDir:dir,now:()=>clock});
 async function login(email:string){const c=(await app.inject({method:'POST',url:'/api/v1/auth/email/challenges',payload:{email}})).json().data;const {code}=JSON.parse(readFileSync(join(dir,'mail',c.challenge_id+'.json'),'utf8'));return(await app.inject({method:'POST',url:'/api/v1/auth/email/verify',payload:{challenge_id:c.challenge_id,code}})).json().data.access_token;}
 owner=await login('owner@example.test');a=await login('a@example.test');b=await login('b@example.test');
});
afterEach(async()=>{await app.close();rmSync(dir,{recursive:true,force:true});});
function call(method:'GET'|'POST'|'PUT'|'PATCH'|'DELETE',path:string,body?:object,token = owner,key = randomUUID()) {return app.inject({method,url:'/api/v1'+path,headers:{...(token?{authorization:'Bearer '+token}:{}),'idempotency-key':key},payload:body});}
async function create(changes:object={}){const r=await call('POST','/activities',{...draft,...changes});expect(r.statusCode,r.body).toBe(201);return r.json().data;}
async function detail(id:string,token = owner){return(await call('GET','/activities/'+id,undefined,token)).json().data;}
async function inbox(token:string){return(await call('GET','/me/notifications',undefined,token)).json().data.items;}
async function day(token:string,date='2026-10-05'){return(await call('GET',`/me/calendar?from=${date}&to=2026-10-07`,undefined,token)).json().data.days[0].events;}
it('persists published activities, private visibility, conditions and own exports without leaking email or roster',async()=>{
 const pub=await create(),hidden=await create({visibility:'members',title:'Members test'});
 expect((await call('GET','/activities',undefined,'')).json().data.items.map((x:any)=>x.id)).toEqual([pub.id]);
 expect((await call('GET','/activities/'+hidden.id,undefined,'')).statusCode).toBe(404);
 expect((await call('GET','/activities?mine=organized',undefined,'')).statusCode).toBe(401);
 expect((await call('GET','/activities?interaction=active',undefined,a)).json().data.items).toEqual([]);
 const visible=await detail(pub.id,'');expect(visible.is_demo).toBe(true);expect(visible.mine).toBeNull();expect(JSON.stringify(visible)).not.toContain('@example.test');
 await app.close();app=createProductApp({dataDir:dir,now:()=>clock});expect((await detail(pub.id)).title).toBe(draft.title);
 expect((await call('GET','/me/export')).json().data.social.activities).toHaveLength(2);expect((await call('GET','/me/export',undefined,a)).json().data.social.activities).toEqual([]);
});
it('allocates a last seat atomically, queues one person and promotes FIFO after a retry-safe withdrawal',async()=>{
 const event=await create();const joinKey=randomUUID();
 const [one,two]=await Promise.all([call('POST',`/activities/${event.id}/join`,{activity_version:1,save_calendar:true},a,joinKey),call('POST',`/activities/${event.id}/join`,{activity_version:1,save_calendar:true},b)]);
 expect([one.json().data.mine.participation.status,two.json().data.mine.participation.status].sort()).toEqual(['confirmed','waitlisted']);
 const confirmed=one.json().data.mine.participation.status==='confirmed'?a:b,waiting=confirmed===a?b:a;
 expect((await detail(event.id)).counts).toMatchObject({confirmed:1,waitlisted:1,remaining:0});
 const leaveKey=randomUUID(),body={participation_version:1};await call('POST',`/activities/${event.id}/withdraw`,body,confirmed,leaveKey);await call('POST',`/activities/${event.id}/withdraw`,body,confirmed,leaveKey);
 expect((await detail(event.id,waiting)).mine.participation).toMatchObject({status:'confirmed',version:2});expect((await inbox(waiting)).filter((m:any)=>m.kind==='promoted')).toHaveLength(1);
 expect(await day(confirmed)).toEqual([]);expect((await day(waiting))[0].activity_origin.participation).toBe('confirmed');
 if(confirmed===a){const retry=await call('POST',`/activities/${event.id}/join`,{activity_version:1,save_calendar:true},a,joinKey);expect(retry.json().data.mine.participation.status).toBe('withdrawn');}
 expect((await call('GET',`/activities/${event.id}/participants`,undefined,waiting)).statusCode).toBe(403);
 expect((await call('GET',`/activities/${event.id}/participants`)).json().data).toHaveLength(2);
});
it('binds retry keys to content and validates viewed version, ownership, state and capacity',async()=>{
 const key=randomUUID();const x=await call('POST','/activities',draft,owner,key);expect(x.statusCode).toBe(201);expect((await call('POST','/activities',draft,owner,key)).json().data.id).toBe(x.json().data.id);
 expect((await call('POST','/activities',{...draft,title:'Changed'},owner,key)).statusCode).toBe(409);
 const id=x.json().data.id;
 expect((await call('PATCH',`/activities/${id}`,{version:1,title:'Hack'},a)).statusCode).toBe(403);
 expect((await call('POST',`/activities/${id}/join`,{activity_version:1})).statusCode).toBe(409);
 await call('PATCH',`/activities/${id}`,{version:1,title:'Revised'});
 expect((await call('POST',`/activities/${id}/join`,{activity_version:1},a)).statusCode).toBe(409);
 await call('POST',`/activities/${id}/join`,{activity_version:2},a);await call('POST',`/activities/${id}/join`,{activity_version:2},b);
 expect((await call('PATCH',`/activities/${id}`,{version:2,capacity:2})).json().data.counts.confirmed).toBe(2);
 expect((await call('PATCH',`/activities/${id}`,{version:3,capacity:1})).statusCode).toBe(409);
 expect((await call('PATCH',`/activities/${id}`,{version:3,visibility:'members'})).statusCode).toBe(400);
});
it('projects only opt-in calendars, follows organizer changes and atomically cancels participation/messages/calendar',async()=>{
 const x=await create();await call('POST',`/activities/${x.id}/join`,{activity_version:1},a);expect(await day(a)).toEqual([]);
 await call('PUT',`/activities/${x.id}/preferences`,{bookmarked:true,calendar_saved:true,remind_minutes:15},a);
 expect((await day(a))[0]).toMatchObject({title:draft.title,remind_minutes:15,activity_origin:{id:x.id,participation:'confirmed'}});
 await call('PATCH',`/activities/${x.id}`,{version:1,starts_at:'2026-10-06T02:00:00Z',ends_at:'2026-10-06T03:00:00Z',location:'New room'});
 expect(await day(a)).toEqual([]);expect((await day(a,'2026-10-06'))[0].location).toBe('New room');expect((await inbox(a)).some((m:any)=>m.kind==='activity_updated')).toBe(true);
 const cancel=await call('POST',`/activities/${x.id}/cancel`,{version:2});expect(cancel.statusCode,cancel.body).toBe(200);
 expect(await day(a,'2026-10-06')).toEqual([]);expect((await detail(x.id,a)).mine).toMatchObject({calendar_saved:false,remind_minutes:null,participation:{status:'cancelled'}});
 expect((await call('POST',`/activities/${x.id}/join`,{activity_version:3},b)).statusCode).toBe(409);
 expect((await call('PATCH',`/activities/${x.id}`,{version:3,title:'Revive'})).statusCode).toBe(409);
});
it('marks waitlisted and saved-only calendar entries honestly and prevents manual editing of activity projections',async()=>{
 const x=await create();await call('POST',`/activities/${x.id}/join`,{activity_version:1},a);await call('POST',`/activities/${x.id}/join`,{activity_version:1,save_calendar:true},b);
 expect((await day(b))[0].activity_origin.participation).toBe('waitlisted');
 await call('PUT',`/activities/${x.id}/preferences`,{bookmarked:false,calendar_saved:true,remind_minutes:null});
 const projection=(await day(owner))[0];expect(projection.activity_origin.participation).toBe('organizer');
 expect((await call('PATCH',`/study/items/${x.id}`,{version:1,title:'Private hijack'},b)).statusCode).toBe(404);
});
it('persists comments and notification read state with strict author/recipient isolation',async()=>{
 const x=await create(),key=randomUUID();
 const comment=await call('POST',`/activities/${x.id}/comments`,{body:'Can beginners join?'},a,key);expect(comment.statusCode,comment.body).toBe(201);
 expect((await call('POST',`/activities/${x.id}/comments`,{body:'Can beginners join?'},a,key)).json().data.id).toBe(comment.json().data.id);
 expect((await call('GET',`/activities/${x.id}/comments`,undefined,'')).json().data.items).toHaveLength(1);
 const messages=await inbox(owner);expect(messages.filter((m:any)=>m.kind==='comment')).toHaveLength(1);
 expect((await call('PATCH',`/me/notifications/${messages[0].id}/read`,{},b)).statusCode).toBe(404);
 await call('PATCH',`/me/notifications/${messages[0].id}/read`,{});await app.close();app=createProductApp({dataDir:dir,now:()=>clock});expect((await inbox(owner))[0].read_at).not.toBeNull();
 expect((await call('DELETE',`/activities/${x.id}/comments/${comment.json().data.id}`,{version:1},b)).statusCode).toBe(404);
 await call('DELETE',`/activities/${x.id}/comments/${comment.json().data.id}`,{version:1},a);expect((await call('GET',`/activities/${x.id}/comments`)).json().data.items).toEqual([]);
});
it('deleting a participant account releases the seat; deleting the organizer removes content and private calendar references',async()=>{
 const x=await create();await call('POST',`/activities/${x.id}/join`,{activity_version:1},a);await call('POST',`/activities/${x.id}/join`,{activity_version:1,save_calendar:true},b);
 expect((await call('DELETE','/me',{confirmation:'DELETE'},a)).statusCode).toBe(200);expect((await detail(x.id,b)).mine.participation.status).toBe('confirmed');
 expect((await call('DELETE','/me',{confirmation:'DELETE'})).statusCode).toBe(200);
 expect((await call('GET',`/activities/${x.id}`,undefined,b)).statusCode).toBe(404);expect(await day(b)).toEqual([]);
 const m=await inbox(b);expect(m.some((n:any)=>n.kind==='activity_removed'&&n.activity===null)).toBe(true);expect(JSON.stringify(m)).not.toContain(draft.title);
});
it('closes signups without cancelling saved schedules and never promotes after start',async()=>{
 const x=await create();await call('POST',`/activities/${x.id}/join`,{activity_version:1,save_calendar:true},a);await call('POST',`/activities/${x.id}/join`,{activity_version:1},b);
 expect((await call('PATCH',`/activities/${x.id}`,{version:1,status:'closed'})).statusCode).toBe(200);expect((await day(a))).toHaveLength(1);
 // Direct store calls bypass expired development sessions to test the time boundary.
 const {openDatabase}=await import('../src/product/database.js'),{createSocialStore}=await import('../src/product/social/store.js');
 const aid=(await call('GET','/me',undefined,a)).json().data.id;const db=openDatabase(dir);clock=Date.parse(draft.starts_at);
 try{const store=createSocialStore(db,()=>clock);store.withdraw(aid,x.id,{participation_version:1},randomUUID());const rows=db.prepare('SELECT status FROM activity_participations WHERE activity_id=?').all(x.id);expect(rows.some(r=>r.status==='confirmed')).toBe(false);expect(rows.some(r=>r.status==='waitlisted')).toBe(true);}finally{db.close();}
});
it('rejects invalid fields, past starts and unapproved campus visibility without claiming school verification',async()=>{
 for(const changes of [{starts_at:'2026-02-30T00:00:00Z'},{starts_at:'2026-10-02T00:00:00Z'},{capacity:0},{ends_at:draft.starts_at},{visibility:'campus'},{organizer_id:'other'}])expect((await call('POST','/activities',{...draft,...changes})).statusCode).toBe(400);
 expect((await call('POST','/activities',draft,'')).statusCode).toBe(401);
});
it('serializes competing last-seat writers on independent SQLite connections',async()=>{
 const {Worker}=await import('node:worker_threads'),{pathToFileURL}=await import('node:url');
 const x=await create(),ids=await Promise.all([a,b].map(async credential => (await call('GET','/me',undefined,credential)).json().data.id));
 const workers:InstanceType<typeof Worker>[]=[];
 try{
  const jobs=ids.map(user=>{
   const worker=new Worker(`const {parentPort,workerData}=require('node:worker_threads');
    (async()=>{const {openDatabase}=await import(workerData.dbModule),{createSocialStore}=await import(workerData.storeModule);const db=openDatabase(workerData.dir);parentPort.postMessage({ready:true});parentPort.once('message',()=>{try{const store=createSocialStore(db,()=>workerData.clock);const result=store.join(workerData.user,workerData.id,{activity_version:1},workerData.key);parentPort.postMessage({status:result.mine.participation.status});}catch(e){parentPort.postMessage({error:String(e)});}finally{db.close();parentPort.close();}});})().catch(e=>{parentPort.postMessage({error:String(e)});parentPort.close();});`,{eval:true,workerData:{dir,clock,user,id:x.id,key:randomUUID(),dbModule:pathToFileURL(join(process.cwd(),'dist/product/database.js')).href,storeModule:pathToFileURL(join(process.cwd(),'dist/product/social/store.js')).href}});
   workers.push(worker);let readyResolve:()=>void=()=>{};const ready=new Promise<void>(resolve=>readyResolve=resolve);
   const result=new Promise<string>((resolve,reject)=>{worker.on('message',m=>{if(m.ready)readyResolve();else if(m.error){readyResolve();reject(new Error(m.error));}else resolve(m.status);});worker.on('error',e=>{readyResolve();reject(e);});});return {worker,ready,result};
  });
  await Promise.all(jobs.map(j=>j.ready));jobs.forEach(j=>j.worker.postMessage('join'));expect((await Promise.all(jobs.map(j=>j.result))).sort()).toEqual(['confirmed','waitlisted']);expect((await detail(x.id)).counts.confirmed).toBe(1);
 }finally{await Promise.all(workers.map(w=>w.terminate()));}
},10000);
it('removes hidden or banned-organizer content from lists, calendars, comments and notification previews',async()=>{
 const {DatabaseSync}=await import('node:sqlite');const x=await create();await call('POST',`/activities/${x.id}/join`,{activity_version:1,save_calendar:true},a);
 const db=new DatabaseSync(join(dir,'campus.sqlite'));try{db.prepare("UPDATE activities SET moderation_state='hidden' WHERE id=?").run(x.id);}finally{db.close();}
 expect((await call('GET','/activities',undefined,a)).json().data.items).toEqual([]);expect((await call('GET',`/activities/${x.id}/comments`,undefined,a)).statusCode).toBe(404);expect(await day(a)).toEqual([]);expect((await inbox(a)).every((m:any)=>m.activity===null)).toBe(true);
});
it('places a withdrawn and rejoining user at the back of the FIFO waitlist',async()=>{
 const challenge=(await call('POST','/auth/email/challenges',{email:'c@example.test'},'')).json().data;
 const {code}=JSON.parse(readFileSync(join(dir,'mail',challenge.challenge_id+'.json'),'utf8'));
 const c=(await call('POST','/auth/email/verify',{challenge_id:challenge.challenge_id,code},'')).json().data.access_token;
 const x=await create();for(const user of [a,b,c])await call('POST',`/activities/${x.id}/join`,{activity_version:1},user);
 await call('POST',`/activities/${x.id}/withdraw`,{participation_version:1},b);
 await call('POST',`/activities/${x.id}/join`,{activity_version:1},b);
 expect((await detail(x.id,b)).mine.participation.waitlist_position).toBe(2);
 await call('POST',`/activities/${x.id}/withdraw`,{participation_version:1},a);
 expect((await detail(x.id,c)).mine.participation.status).toBe('confirmed');expect((await detail(x.id,b)).mine.participation).toMatchObject({status:'waitlisted',waitlist_position:1});
});

it('keeps reconnection intent private across authenticated API users until both consent after the event',async()=>{
 const event=await create({capacity:2,starts_at:'2026-10-03T00:10:00Z',ends_at:'2026-10-03T00:20:00Z'});const joined=await call('POST',`/activities/${event.id}/join`,{activity_version:event.version},a);expect(joined.statusCode,joined.body).toBe(200);
 const ownerId=(await call('GET','/me')).json().data.id,peerId=(await call('GET','/me',undefined,a)).json().data.id;
 const path=`/activities/${event.id}/reconnections/${peerId}`;
 expect((await call('PUT',path,{version:0,willing:true,participated:true})).statusCode).toBe(404);
 clock=Date.parse('2026-10-03T00:25:00Z');
 const intent=await call('PUT',path,{version:0,willing:true,participated:true});expect(intent.statusCode,intent.body).toBe(200);expect(intent.json().data).toMatchObject({willing:true,mutual:false});
 expect((await call('GET','/me/reconnections',undefined,a)).json().data.items).toEqual([]);
 const reverse=`/activities/${event.id}/reconnections/${ownerId}`;
 expect((await call('GET',reverse,undefined,a)).json().data).toMatchObject({willing:false,version:0,mutual:false});
 expect((await call('PUT',reverse,{version:0,willing:true,participated:true},a)).json().data.mutual).toBe(true);
 expect((await call('GET',path)).json().data.mutual).toBe(true);
 const card=await call('PUT',path+'/contact-card',{version:0,text:'Signal: voluntary-handle'});expect(card.statusCode,card.body).toBe(200);
 expect((await call('GET',reverse+'/contact-card',undefined,a)).json().data.peer).toEqual({text:'Signal: voluntary-handle'});
 expect((await call('GET',reverse+'/contact-card',undefined,b)).json().data.peer).toBeNull();
 expect((await call('GET','/me/export',undefined,a)).json().data.reconnection_cards).toEqual([]);
 expect((await call('PUT',reverse,{version:1,willing:false,participated:false},a)).statusCode).toBe(200);
 expect((await call('GET',reverse+'/contact-card',undefined,a)).json().data.peer).toBeNull();
 expect((await call('GET',path+'/contact-card')).json().data.mine.text).toBe('');

 expect((await call('GET','/me/reconnections',undefined,b)).json().data.items).toEqual([]);
 expect((await call('GET','/me/export',undefined,a)).json().data.reconnections).toHaveLength(1);
});

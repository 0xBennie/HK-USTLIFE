import {beforeEach,afterEach,it,expect} from 'vitest';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {createProductApp} from '../src/product/app.js';
let dir:string,app:ReturnType<typeof createProductApp>,owner:string,a:string,b:string,admin:string,ownerId:string,aid:string;
const now=()=>Date.parse('2026-10-03T00:00:00Z');
beforeEach(async()=>{
 dir=mkdtempSync(join(tmpdir(),'campus-governance-'));app=createProductApp({dataDir:dir,now});
 async function login(email:string){const challenge=(await call('POST','/auth/email/challenges',{email},'')).json().data;const {code}=JSON.parse(readFileSync(join(dir,'mail',challenge.challenge_id+'.json'),'utf8'));return(await call('POST','/auth/email/verify',{challenge_id:challenge.challenge_id,code},'')).json().data.access_token;}
 owner=await login('owner@example.test');a=await login('a@example.test');b=await login('b@example.test');admin=await login('admin@example.test');
 ownerId=(await call('GET','/me')).json().data.id;aid=(await call('GET','/me',undefined,a)).json().data.id;
 const db=new DatabaseSync(join(dir,'campus.sqlite'));try{db.prepare("UPDATE users SET role='admin' WHERE email='admin@example.test'").run();}finally{db.close();}
});
afterEach(async()=>{await app.close();rmSync(dir,{recursive:true,force:true});});
function call(method:'GET'|'POST'|'PATCH'|'PUT'|'DELETE',path:string,body?:object,credential = owner,key = randomUUID()){return app.inject({method,url:'/api/v1'+path,headers:{...(credential?{authorization:'Bearer '+credential}:{}),'idempotency-key':key},payload:body});}
async function activity(){return(await call('POST','/activities',{kind:'study',title:'Study together',location:'Library',starts_at:'2026-10-05T02:00:00Z',ends_at:'2026-10-05T03:00:00Z',capacity:1,languages:['en'],interaction:'quiet',visibility:'public'})).json().data;}
async function post(){return(await call('POST','/posts',{kind:'help',title:'Question',body:'Test question',visibility:'public'})).json().data;}
async function report(kind:string,id:string,credential = a){const r=await call('POST','/reports',{target:{kind,id},reason:'other',details:'Please review this content.'},credential);expect(r.statusCode,r.body).toBe(201);return r.json().data;}
async function resolve(id:string,action:string){return call('POST',`/admin/reports/${id}/resolve`,{version:1,action,reason:'Reviewed the current content.'},admin);}
it('blocks both signed-in directions, atomically withdraws organizer-participant pairs and promotes waiting members',async()=>{
 const x=await activity(),p=await post();await call('POST',`/activities/${x.id}/join`,{activity_version:1,save_calendar:true},a);await call('POST',`/activities/${x.id}/join`,{activity_version:1,save_calendar:true},b);
 expect((await call('PUT',`/me/blocks/${ownerId}`,{},a)).statusCode).toBe(200);
 expect((await call('GET',`/activities/${x.id}`,undefined,a)).statusCode).toBe(404);
 expect((await call('GET','/activities',undefined,a)).json().data.items).toEqual([]);
 expect((await call('GET',`/posts/${p.id}`,undefined,a)).statusCode).toBe(404);
 expect((await call('GET',`/activities/${x.id}`,undefined,b)).json().data.mine.participation.status).toBe('confirmed');
 expect((await call('GET','/me/calendar?from=2026-10-05&to=2026-10-06',undefined,a)).json().data.days[0].events).toEqual([]);
 expect((await call('POST',`/activities/${x.id}/join`,{activity_version:1},a)).statusCode).toBe(404);
 expect((await call('GET',`/activities/${x.id}`,undefined,'')).statusCode).toBe(200);
 expect((await call('PUT',`/me/blocks/${ownerId}`,{},a)).statusCode).toBe(200);
 await app.close();app=createProductApp({dataDir:dir,now});expect((await call('GET','/me/blocks',undefined,a)).json().data).toHaveLength(1);
 expect((await call('DELETE',`/me/blocks/${ownerId}`,{},a)).statusCode).toBe(200);
 expect((await call('GET',`/activities/${x.id}`,undefined,a)).json().data.mine).toMatchObject({participation:{status:'withdrawn'},calendar_saved:false,bookmarked:false});
 expect((await call('PUT',`/me/blocks/${aid}`,{},a)).statusCode).toBe(400);
});
it('hides blocked replies and comments while preserving shared activity participation and suppressing new reply notices',async()=>{
 const x=await activity();await call('POST',`/activities/${x.id}/join`,{activity_version:1},a);await call('POST',`/activities/${x.id}/join`,{activity_version:1},b);
 const comment=(await call('POST',`/activities/${x.id}/comments`,{body:'One'},a)).json().data;
 await call('PUT',`/me/blocks/${aid}`,{},b);
 expect((await call('GET',`/activities/${x.id}/comments`,undefined,b)).json().data.items).toEqual([]);
 const before=(await call('GET','/me/notifications',undefined,b)).json().data.items.length;
 await call('POST',`/activities/${x.id}/comments`,{body:'Two'},a);
 expect((await call('GET','/me/notifications',undefined,b)).json().data.items).toHaveLength(before);
 expect((await call('GET',`/activities/${x.id}`,undefined,b)).json().data.mine.participation.status).toBe('waitlisted');
 expect((await call('POST','/reports',{target:{kind:'activity_comment',id:String(comment.id)},reason:'spam',details:''},b)).statusCode).toBe(404);
});
it('keeps reports private and retry-safe and requires admin role for review and resolution',async()=>{
 const p=await post(),body={target:{kind:'post',id:p.id},reason:'privacy',details:'Please remove the personal detail.'},key=randomUUID();
 const r=await call('POST','/reports',body,a,key);expect(r.statusCode,r.body).toBe(201);const id=r.json().data.id;
 expect((await call('POST','/reports',body,a,key)).json().data.id).toBe(id);
 expect((await call('POST','/reports',{...body,reason:'spam'},a,key)).statusCode).toBe(409);
 expect((await call('GET','/me/reports',undefined,b)).json().data.items).toEqual([]);
 expect((await call('GET','/admin/reports',undefined,b)).statusCode).toBe(403);
 expect((await call('POST',`/admin/reports/${id}/resolve`,{version:1,action:'hide_content',reason:'No'},b)).statusCode).toBe(403);
 expect((await resolve(id,'hide_content')).statusCode).toBe(200);
 expect((await call('GET',`/posts/${p.id}`,undefined,a)).statusCode).toBe(404);
 expect((await call('GET','/me/reports',undefined,a)).json().data.items[0].status).toBe('action_taken');
 expect((await resolve(id,'dismiss')).statusCode).toBe(409);
 const db=new DatabaseSync(join(dir,'campus.sqlite'));try{expect(db.prepare('SELECT action FROM moderation_audit').all()).toEqual([{action:'hide_content'}]);}finally{db.close();}
});
it('hiding reported activities cancels participation, clears calendars and suppresses previews',async()=>{
 const x=await activity();await call('POST',`/activities/${x.id}/join`,{activity_version:1,save_calendar:true},a);
 const r=await report('activity',x.id);expect((await resolve(r.id,'hide_content')).statusCode).toBe(200);
 expect((await call('GET','/me/calendar?from=2026-10-05&to=2026-10-06',undefined,a)).json().data.days[0].events).toEqual([]);
 const exported=(await call('GET','/me/export',undefined,a)).json().data;expect(exported.social.participations[0].status).toBe('cancelled');
 expect((await call('GET','/me/notifications',undefined,a)).json().data.items.every((n:any)=>n.activity===null)).toBe(true);
});
it('banning an author revokes sessions, hides authored content and releases their other seats atomically',async()=>{
 const x=await activity();await call('POST',`/activities/${x.id}/join`,{activity_version:1},a);await call('POST',`/activities/${x.id}/join`,{activity_version:1},b);
 const reply=(await call('POST',`/activities/${x.id}/comments`,{body:'Review me'},a)).json().data;
 const r=await report('activity_comment',String(reply.id),b);expect((await resolve(r.id,'ban_author')).statusCode).toBe(200);
 expect((await call('GET','/me',undefined,a)).statusCode).toBe(401);
 expect((await call('GET',`/activities/${x.id}`,undefined,b)).json().data.mine.participation.status).toBe('confirmed');
 expect((await call('GET',`/activities/${x.id}/comments`,undefined,b)).json().data.items).toEqual([]);
 const ap=(await call('POST','/posts',{kind:'wall',title:'Admin',body:'Admin post',visibility:'public'},admin)).json().data;
 const ar=await report('post',ap.id,b);expect((await resolve(ar.id,'ban_author')).statusCode).toBe(409);
 expect((await call('GET','/admin/reports',undefined,admin)).statusCode).toBe(200);
});
it('handles deleted report targets without retaining content snapshots; admins can dismiss and exports stay private',async()=>{
 const p=await post(),r=await report('post',p.id);await call('DELETE',`/posts/${p.id}`,{version:1});
 const queue=(await call('GET','/admin/reports',undefined,admin)).json().data.items;expect(queue[0].content).toBeNull();
 expect((await resolve(r.id,'hide_content')).statusCode).toBe(410);expect((await resolve(r.id,'dismiss')).statusCode).toBe(200);
 const exported=(await call('GET','/me/export',undefined,a)).json().data;expect(exported.governance.reports).toHaveLength(1);expect(JSON.stringify(exported.governance.reports)).not.toContain('Test question');
 expect((await call('GET','/me/export',undefined,b)).json().data.governance.reports).toEqual([]);
});
it('enforces parent visibility on reply reports and hides only the reported reply',async()=>{
 const p=await post();const reply=(await call('POST',`/posts/${p.id}/replies`,{body:'Reply for review'},a)).json().data;
 const r=await report('reply',String(reply.id),b);expect((await resolve(r.id,'hide_content')).statusCode).toBe(200);
 expect((await call('GET',`/posts/${p.id}`,undefined,b)).statusCode).toBe(200);expect((await call('GET',`/posts/${p.id}/replies`,undefined,b)).json().data.items).toEqual([]);
 expect((await call('POST','/reports',{target:{kind:'reply',id:String(reply.id)},reason:'other',details:''},b)).statusCode).toBe(404);
});
it('banning an organizer cancels their activities and wall previews; account deletion removes private governance records',async()=>{
 const x=await activity(),p=await post();await call('POST',`/activities/${x.id}/join`,{activity_version:1,save_calendar:true},a);
 await call('POST',`/posts/${p.id}/replies`,{body:'Helpful'},a);await call('PATCH',`/posts/${p.id}`,{version:1,status:'resolved'});
 const r=await report('post',p.id);expect((await resolve(r.id,'ban_author')).statusCode).toBe(200);
 expect((await call('GET','/activities',undefined,'')).json().data.items).toEqual([]);expect((await call('GET','/posts',undefined,'')).json().data.items).toEqual([]);
 const exported=(await call('GET','/me/export',undefined,a)).json().data;expect(exported.social.participations[0].status).toBe('cancelled');expect(exported.social.preferences[0].calendar_saved).toBe(0);
 expect((await call('GET','/me/notifications',undefined,a)).json().data.items.every((n:any)=>n.activity===null&&n.post===null)).toBe(true);
 await call('PUT',`/me/blocks/${ownerId}`,{},a);expect((await call('DELETE','/me',{confirmation:'DELETE'},a)).statusCode).toBe(200);
 const db=new DatabaseSync(join(dir,'campus.sqlite'));try{expect(db.prepare('SELECT COUNT(*) AS n FROM content_reports WHERE owner_id=?').get(aid)!.n).toBe(0);expect(db.prepare('SELECT COUNT(*) AS n FROM user_blocks WHERE owner_id=?').get(aid)!.n).toBe(0);expect(db.prepare('SELECT report_id FROM moderation_audit').get()!.report_id).toBeNull();}finally{db.close();}
});
async function sharedContact(){
 const x=await activity();await call('POST',`/activities/${x.id}/join`,{activity_version:1},a);
 const db=new DatabaseSync(join(dir,'campus.sqlite'));db.prepare('UPDATE activities SET starts_at=?,ends_at=? WHERE id=?').run(now()-60000,now()-1,x.id);db.close();
 const own=`/activities/${x.id}/reconnections/${aid}`,peer=`/activities/${x.id}/reconnections/${ownerId}`;
 await call('PUT',own,{version:0,willing:true,participated:true});await call('PUT',peer,{version:0,willing:true,participated:true},a);
 await call('PUT',own+'/contact-card',{version:0,text:'Voluntary test contact'});
 const card=(await call('GET',peer+'/contact-card',undefined,a)).json().data.peer;
 return {own,peer,target:{kind:'contact_card',id:card.report_id}};
}
it('allows only the recipient to report a visible contact card and routes it through restricted moderation',async()=>{
 const {own,peer,target}=await sharedContact();const body={target,reason:'privacy',details:'Please review'};const key=randomUUID();
 expect((await call('POST','/reports',body,b)).statusCode).toBe(404);
 expect((await call('POST','/reports',body,owner)).statusCode).toBe(404);
 const response=await call('POST','/reports',body,a,key);expect(response.statusCode,response.body).toBe(201);const report=response.json().data;
 expect((await call('POST','/reports',body,a,key)).json().data.id).toBe(report.id);
 expect((await call('GET','/admin/reports',undefined,a)).statusCode).toBe(403);
 expect((await call('GET','/admin/reports',undefined,admin)).json().data.items[0].content.body).toBe('Voluntary test contact');
 expect((await call('GET','/me/reports')).json().data.items).toEqual([]);
 expect((await resolve(report.id,'hide_content')).statusCode).toBe(200);
 expect((await call('GET',peer+'/contact-card',undefined,a)).json().data.peer).toBeNull();
 expect((await call('GET',own+'/contact-card')).json().data.mine).toMatchObject({text:'',version:2});
 expect((await call('POST','/reports',body,a,key)).json().data.id).toBe(report.id);
});
it('does not use an old contact-card report to remove a changed version or allow reporting after consent withdrawal',async()=>{
 const {own,peer,target}=await sharedContact();const r=await report(target.kind,target.id);
 await call('PUT',own+'/contact-card',{version:1,text:'Updated contact'});
 expect((await resolve(r.id,'hide_content')).statusCode).toBe(410);
 expect((await call('GET',peer+'/contact-card',undefined,a)).json().data.peer.text).toBe('Updated contact');
 expect((await call('GET','/admin/reports',undefined,admin)).json().data.items[0].content).toBeNull();
 const latest=(await call('GET',peer+'/contact-card',undefined,a)).json().data.peer.report_id;
 await call('PUT',peer,{version:1,willing:false,participated:false},a);
 expect((await call('POST','/reports',{target:{kind:'contact_card',id:latest},reason:'other'},a)).statusCode).toBe(404);
 expect((await resolve(r.id,'dismiss')).statusCode).toBe(200);
});
it('preserves existing reports and moderation audit when applying the contact-card migration',async()=>{
 const p=await post(),r=await report('post',p.id);await resolve(r.id,'dismiss');await app.close();
 // Reproduce the pre-v14 card schema and migration ledger on the isolated fixture.
 const db=new DatabaseSync(join(dir,'campus.sqlite'));
 db.exec('DROP INDEX reconnection_card_id; ALTER TABLE reconnection_cards DROP COLUMN id; DELETE FROM schema_migrations WHERE version=14;');db.close();
 app=createProductApp({dataDir:dir,now});
 expect((await call('GET','/me/reports',undefined,a)).json().data.items[0]).toMatchObject({id:r.id,status:'dismissed'});
 const verify=new DatabaseSync(join(dir,'campus.sqlite'));
 try{expect(verify.prepare('SELECT report_id FROM moderation_audit').get()?.report_id).toBe(r.id);expect(verify.prepare('PRAGMA foreign_key_check').all()).toEqual([]);}finally{verify.close();}
});

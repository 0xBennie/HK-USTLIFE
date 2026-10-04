import {it,expect,beforeEach,afterEach} from 'vitest';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createProductApp} from '../src/product/app.js';
import {openDatabase} from '../src/product/database.js';
// Monday 2026-10-05 08:00 HKT
const T0=Date.parse('2026-10-05T00:00:00Z');
let dir:string,app:ReturnType<typeof createProductApp>,a:string,b:string;
beforeEach(async()=>{
 dir=mkdtempSync(join(tmpdir(),'life-'));app=createProductApp({dataDir:dir,now:()=>T0});
 async function login(email:string){const challenge=(await app.inject({method:'POST',url:'/api/v1/auth/email/challenges',payload:{email}})).json().data;const mail=JSON.parse(readFileSync(join(dir,'mail',challenge.challenge_id+'.json'),'utf8'));return (await app.inject({method:'POST',url:'/api/v1/auth/email/verify',payload:{challenge_id:challenge.challenge_id,code:mail.code}})).json().data.access_token;}
 a=await login('life-a@example.test');b=await login('life-b@example.test');
});
afterEach(async()=>{await app.close();rmSync(dir,{recursive:true,force:true});});
const call=(method:'GET'|'POST'|'PUT'|'DELETE',path:string,token:string,body?:object)=>app.inject({method,url:'/api/v1'+path,payload:body,headers:{authorization:'Bearer '+token,'idempotency-key':'life-'+Math.random().toString(36).slice(2,14)}});

it('finds common free time from both calendars without revealing anyone\'s events',async()=>{
 // B has a private class Monday 10:00–12:00 HKT
 const ev=await call('POST','/study/items',b,{kind:'event',title:'Secret class',body:'',course_id:null,location:'Room 1',timezone:'Asia/Hong_Kong',all_day:false,starts_at:'2026-10-05T02:00:00Z',ends_at:'2026-10-05T04:00:00Z',status:'active',remind_minutes:null});
 expect(ev.statusCode,ev.body).toBe(201);
 const g=(await call('POST','/me/time-groups',a,{name:'COMP 2011 小组'})).json().data;
 expect(g.code).toMatch(/^[A-Z2-9]{6}$/);
 expect((await call('POST','/me/time-groups/join',b,{code:g.code})).statusCode).toBe(200);
 const r=await call('GET','/me/time-groups/'+g.id,a);expect(r.statusCode,r.body).toBe(200);
 const d=r.json().data;
 expect(d.members.map((m:{name:string})=>m.name)).toHaveLength(2);
 expect(r.body).not.toContain('Secret class');
 const monday=d.slots.filter((s:{start:string})=>s.start.startsWith('2026-10-05'));
 // No common slot may overlap 02:00–04:00Z
 expect(monday.some((s:{start:string;end:string})=>Date.parse(s.start)<Date.parse('2026-10-05T04:00:00Z')&&Date.parse(s.end)>Date.parse('2026-10-05T02:00:00Z'))).toBe(false);
 expect(monday.length).toBeGreaterThan(0);
 expect((await call('GET','/me/time-groups/'+g.id,await (async()=>b)())).statusCode).toBe(200);
});

it('hides grade distributions until at least ten students reported',async()=>{
 expect((await call('POST','/me/grades',a,{course:'comp2011',term:'2025-26 Fall',grade:'A'})).statusCode).toBe(200);
 const one=(await call('GET','/grades/COMP%202011',a)).json().data;
 expect(one).toMatchObject({course:'COMP 2011',sample:1,enough:false,bars:null});
 expect((await call('POST','/me/grades',a,{course:'COMP 2011',term:'2025-26 Fall',grade:'Z'})).statusCode).toBe(400);
});

it('follows clubs and RSVPs to employer talks for the signed-in student only',async()=>{
 const list=(await call('GET','/clubs',a)).json().data;expect(list.length).toBeGreaterThan(60);expect(list.find((c:{id:string})=>c.id==='su-72')).toMatchObject({category:'department',url:'https://hkustsu.hkust.edu.hk/societies/about/72'});
 const f=(await call('PUT','/me/clubs/su-72',a,{following:true})).json().data;expect(f).toMatchObject({following:true,followers:1});
 expect((await call('GET','/clubs',b)).json().data.find((c:{id:string})=>c.id==='su-72')).toMatchObject({following:false,followers:1});
 // A fresh database has no placeholder employers.
 expect((await call('GET','/employers',a)).json().data).toEqual([]);
 const db=openDatabase(dir);
 db.prepare("INSERT INTO employers(id,name,tagline,verified,is_sample,created_at) VALUES ('acme','Acme Test Co','test fixture',1,0,0)").run();
 db.prepare("INSERT INTO employer_jobs(id,employer_id,title,detail,apply_url,sort) VALUES ('acme-job','acme','Intern','Summer','https://example.test/apply',1)").run();
 db.prepare("INSERT INTO employer_talks(id,employer_id,title,venue,starts_at) VALUES ('acme-talk','acme','Info session','LT-A',?)").run(T0+864e5);db.close();
 const t=(await call('PUT','/me/talks/acme-talk',a,{going:true})).json().data;expect(t).toMatchObject({rsvp:true,going:1});
 expect((await call('GET','/employers/acme',a)).json().data).toMatchObject({sample:false,verified:true,jobs:[{id:'acme-job'}]});
});

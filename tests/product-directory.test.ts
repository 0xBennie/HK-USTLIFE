import {beforeEach,afterEach,it,expect} from 'vitest';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createProductApp} from '../src/product/app.js';
let dir:string,app:ReturnType<typeof createProductApp>,alice:string,bob:string;
beforeEach(async()=>{
 dir=mkdtempSync(join(tmpdir(),'campus-directory-'));app=createProductApp({dataDir:dir});
 async function login(email:string){const challenge=(await app.inject({method:'POST',url:'/api/v1/auth/email/challenges',payload:{email}})).json().data;const {code}=JSON.parse(readFileSync(join(dir,'mail',challenge.challenge_id+'.json'),'utf8'));return(await app.inject({method:'POST',url:'/api/v1/auth/email/verify',payload:{challenge_id:challenge.challenge_id,code}})).json().data.access_token;}
 alice=await login('alice@example.test');bob=await login('bob@example.test');
});
afterEach(async()=>{await app.close();rmSync(dir,{recursive:true,force:true});});
function call(method:'GET'|'POST'|'PUT'|'DELETE',url:string,body?:object,token = alice,key=randomUUID()){return app.inject({method,url:'/api/v1'+url,headers:{...(token?{authorization:'Bearer '+token}:{}),'idempotency-key':key},payload:body});}
const target={target_kind:'place',target_id:'postal-counter'};
it('offers reviewed bilingual public directory search and explicit unknown operating status',async()=>{
 const list=await call('GET','/campus/places',undefined,'');expect(list.statusCode).toBe(200);expect(list.json().data).toHaveLength(9);
 expect((await call('GET','/campus/places?q='+encodeURIComponent('邮务'),undefined,'')).json().data[0].id).toBe('postal-counter');
 expect((await call('GET','/campus/places?q=LG3&category=service',undefined,'')).json().data).toHaveLength(3);
 expect((await call('GET','/campus/places/postal-counter',undefined,'')).json().data).toMatchObject({open_now:'unknown',availability:'unknown',location:{en:'Room 2615, 2/F, near lifts 31/32'}});
 expect((await call('GET','/campus/places/missing',undefined,'')).statusCode).toBe(404);
 expect((await call('GET','/campus/places?category=invalid',undefined,'')).statusCode).toBe(400);
});
it('persists private bookmarks across restart with duplicate-safe save, account isolation and removal',async()=>{
 expect((await call('PUT','/me/campus/bookmarks',target,'')).statusCode).toBe(401);
 await call('PUT','/me/campus/bookmarks',target);await call('PUT','/me/campus/bookmarks',target);
 await call('PUT','/me/campus/bookmarks',{target_kind:'shuttle',target_id:'hang-hau-to-campus'});
 await app.close();app=createProductApp({dataDir:dir});
 expect((await call('GET','/me/campus/bookmarks')).json().data).toHaveLength(2);expect((await call('GET','/me/campus/bookmarks',undefined,bob)).json().data).toEqual([]);
 await call('DELETE','/me/campus/bookmarks',target, bob);expect((await call('GET','/me/campus/bookmarks')).json().data).toHaveLength(2);
 await call('DELETE','/me/campus/bookmarks',target);expect((await call('GET','/me/campus/bookmarks')).json().data).toHaveLength(1);
 expect((await call('PUT','/me/campus/bookmarks',{...target,target_id:'invalid'})).statusCode).toBe(404);
});
it('deduplicates pending corrections, keeps public content unchanged and exports only owner history',async()=>{
 const key=randomUUID(),body={...target,message:'The posted holiday hours need review.'};
 const first=await call('POST','/campus/corrections',body,alice,key),second=await call('POST','/campus/corrections',body,alice,key);
 expect(first.statusCode,first.body).toBe(201);expect(second.json().data.id).toBe(first.json().data.id);expect(second.json().data.status).toBe('pending');
 expect((await call('POST','/campus/corrections',{...body,message:'different content'},alice,key)).statusCode).toBe(409);
 const entry=(await call('GET','/campus/places/postal-counter')).json().data;expect(JSON.stringify(entry)).not.toContain(body.message);
 await app.close();app=createProductApp({dataDir:dir});
 expect((await call('GET','/me/campus/corrections')).json().data).toHaveLength(1);expect((await call('GET','/me/campus/corrections',undefined,bob)).json().data).toEqual([]);
 expect((await call('GET','/me/export')).json().data.campus.corrections[0].message).toBe(body.message);
 expect((await call('GET','/me/export',undefined,bob)).json().data.campus).toEqual({bookmarks:[],corrections:[]});
});
it('rejects forged owner fields and cascades private campus data on account deletion',async()=>{
 expect((await call('PUT','/me/campus/bookmarks',{...target,owner_id:'someone'})).statusCode).toBe(400);
 expect((await call('POST','/campus/corrections',{...target,message:'test correction',owner_id:'someone'})).statusCode).toBe(400);
 await call('PUT','/me/campus/bookmarks',target);await call('POST','/campus/corrections',{...target,message:'Delete my correction too'});
 expect((await call('DELETE','/me',{confirmation:'DELETE'})).statusCode).toBe(200);expect((await call('GET','/me/campus/bookmarks')).statusCode).toBe(401);
 const {DatabaseSync}=await import('node:sqlite');const db=new DatabaseSync(join(dir,'campus.sqlite'));try{expect(db.prepare('SELECT COUNT(*) AS n FROM campus_bookmarks').get()?.n).toBe(0);expect(db.prepare('SELECT COUNT(*) AS n FROM campus_corrections').get()?.n).toBe(0);}finally{db.close();}
});
it('marks stale directory facts without inventing current opening or availability',async()=>{
 await app.close();app=createProductApp({dataDir:dir,now:()=>Date.parse('2027-01-01T00:00:00Z')});
 const result=await call('GET','/campus/places/fusion',undefined,'');expect(result.statusCode).toBe(200);expect(result.json().data).toMatchObject({freshness:'stale',open_now:'unknown',availability:'unknown'});expect(result.json().data.published_hours.en).toContain('term break');
});

import {it,expect,beforeEach,afterEach} from 'vitest';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createProductApp} from '../src/product/app.js';
import {openDatabase} from '../src/product/database.js';
import {createAffairsStore} from '../src/product/affairs/store.js';
let dir:string,app:ReturnType<typeof createProductApp>,a:string,b:string;
beforeEach(async()=>{
 dir=mkdtempSync(join(tmpdir(),'affairs-api-'));app=createProductApp({dataDir:dir});
 const db=openDatabase(dir);createAffairsStore(db,Date.now).publish({template_id:'test-affair',revision:1,school_id:'hkust',title:{zh:'测试事务',en:'Test affair'},summary:{zh:'测试',en:'Test'},conditions:[],materials:[],steps:[{id:'one',text:{zh:'核对',en:'Check'},source_id:'source'}],sources:[{id:'source',url:'https://library.hkust.edu.hk/'}],reviewed_at:new Date(Date.now()-1000).toISOString(),review_due_at:new Date(Date.now()+86400000).toISOString(),source_health:'verified',deadline:{kind:'none'},change_reason:'Test-only fixture'},'test-maintainer');db.close();
 async function login(email:string){const challenge=(await app.inject({method:'POST',url:'/api/v1/auth/email/challenges',payload:{email}})).json().data;const mail=JSON.parse(readFileSync(join(dir,'mail',challenge.challenge_id+'.json'),'utf8'));return (await app.inject({method:'POST',url:'/api/v1/auth/email/verify',payload:{challenge_id:challenge.challenge_id,code:mail.code}})).json().data.access_token;}
 a=await login('affair-a@example.test');b=await login('affair-b@example.test');
});
afterEach(async()=>{await app.close();rmSync(dir,{recursive:true,force:true});});
const call=(method:'GET'|'POST'|'PATCH'|'DELETE',path:string,body?:object,token = a)=>app.inject({method,url:'/api/v1'+path,payload:body,headers:{...(token?{authorization:'Bearer '+token}:{}),'idempotency-key':'test-api-create'}});
it('allows public source reads but requires auth for private creation and never exposes another owner',async()=>{
 expect((await call('GET','/affairs/templates',undefined,'')).statusCode).toBe(200);
 expect((await call('POST','/me/affairs',{template_id:'test-affair',revision:1},'')).statusCode).toBe(401);
 const c=await call('POST','/me/affairs',{template_id:'test-affair',revision:1});expect(c.statusCode,c.body).toBe(201);const id=c.json().data.id;
 expect((await call('GET','/me/affairs/'+id,undefined,b)).statusCode).toBe(404);
 expect((await call('PATCH','/me/affairs/'+id,{version:1,official_status:'confirmed'})).statusCode).toBe(400);
 expect((await call('GET','/me/affairs?owner_id=other')).statusCode).toBe(400);
 expect((await call('GET','/me/affairs',undefined,b)).json().data.items).toEqual([]);
 expect((await call('GET','/me/export')).json().data.affairs[0].id).toBe(id);
 expect((await call('DELETE','/me/affairs/'+id,{version:1},b)).statusCode).toBe(404);
 expect((await call('DELETE','/me/affairs/'+id,{version:1})).statusCode).toBe(200);
 expect((await call('POST','/me/affairs',{template_id:'test-affair',revision:1})).statusCode).toBe(410);
});
it('paginates private instances without leaking another account and rejects invalid cursors',async()=>{
 const c=await call('POST','/me/affairs',{template_id:'test-affair',revision:1});const id=c.json().data.id;
 expect((await call('GET','/me/affairs?limit=1')).json().data).toMatchObject({items:[{id}],next_cursor:null});
 expect((await call('GET','/me/affairs?cursor=bad')).statusCode).toBe(400);
 expect((await call('PATCH','/me/affairs/'+id,{version:1,archived:true})).statusCode).toBe(200);
 expect((await call('GET','/me/affairs')).json().data.items).toEqual([]);
 expect((await call('GET','/me/affairs?state=archived')).json().data.items[0].id).toBe(id);
});

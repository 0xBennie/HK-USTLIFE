import {it,expect,beforeEach,afterEach} from 'vitest';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createProductApp} from '../src/product/app.js';
let dir:string,app:ReturnType<typeof createProductApp>,a:string,b:string;
beforeEach(async()=>{
 dir=mkdtempSync(join(tmpdir(),'api-tokens-'));app=createProductApp({dataDir:dir});
 async function login(email:string){const challenge=(await app.inject({method:'POST',url:'/api/v1/auth/email/challenges',payload:{email}})).json().data;const mail=JSON.parse(readFileSync(join(dir,'mail',challenge.challenge_id+'.json'),'utf8'));return (await app.inject({method:'POST',url:'/api/v1/auth/email/verify',payload:{challenge_id:challenge.challenge_id,code:mail.code}})).json().data.access_token;}
 a=await login('token-a@example.test');b=await login('token-b@example.test');
});
afterEach(async()=>{await app.close();rmSync(dir,{recursive:true,force:true});});
const call=(method:'GET'|'POST'|'PATCH'|'DELETE',path:string,token:string,body?:object)=>app.inject({method,url:'/api/v1'+path,payload:body,headers:{authorization:'Bearer '+token,'idempotency-key':'tok-'+Math.random().toString(36).slice(2,14)}});

it('creates a personal read-only token that can read own planning data but cannot write',async()=>{
 const c=await call('POST','/me/tokens',a,{name:'Claude'});expect(c.statusCode,c.body).toBe(200);
 const {token,id}=c.json().data;expect(token).toMatch(/^ustl_[A-Za-z0-9_-]{43}$/);
 expect((await call('GET','/me/calendar?from=2026-10-05&to=2026-10-06&timezone=Asia%2FHong_Kong',token)).statusCode).toBe(200);
 expect((await call('GET','/me',token)).json().data.email).toBe('token-a@example.test');
 expect((await call('POST','/study/items',token,{kind:'note',title:'x',body:'y',course_id:null})).statusCode).toBe(403);
 expect((await call('POST','/me/tokens',token,{name:'nested'})).statusCode).toBe(403);
 expect((await call('GET','/me/export',token)).statusCode).toBe(403);
 const list=(await call('GET','/me/tokens',a)).json().data;expect(list).toHaveLength(1);expect(list[0]).not.toHaveProperty('token');expect(list[0].last_used_at).not.toBeNull();
 expect((await call('DELETE','/me/tokens/'+id,b)).statusCode).toBe(404);
 expect((await call('DELETE','/me/tokens/'+id,a)).statusCode).toBe(200);
 expect((await call('GET','/me',token)).statusCode).toBe(401);
});

it('caps tokens at five per student',async()=>{
 for(let i=0;i<5;i++)expect((await call('POST','/me/tokens',a,{name:'t'+i})).statusCode).toBe(200);
 expect((await call('POST','/me/tokens',a,{name:'t5'})).statusCode).toBe(409);
});

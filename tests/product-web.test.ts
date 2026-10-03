import {beforeEach,afterEach,it,expect} from 'vitest';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {createProductApp} from '../src/product/app.js';
import {createProductWeb} from '../apps/hub/lib/product-web.js';
let app:ReturnType<typeof createProductApp>,dir:string,apiBase:string,web:ReturnType<typeof createProductWeb>;
const origin='http://127.0.0.1:3000';
type Client={cookies:Map<string,string>;csrf:string};
const client=():Client=>({cookies:new Map(),csrf:''});
beforeEach(async()=>{dir=mkdtempSync(join(tmpdir(),'campus-web-'));app=createProductApp({dataDir:dir,sourceFetch:async()=>new Response('Official source fixture',{status:200})});apiBase=(await app.listen({host:'127.0.0.1',port:0}))+'/api/v1';web=createProductWeb({origin,apiBase,enabled:true});});
afterEach(async()=>{await app.close();rmSync(dir,{recursive:true,force:true});});
async function call(c:Client,method:string,path:string,body?:unknown,extra:Record<string,string>={}){
 const r=await web(new Request(origin+'/api/campus'+path,{method,headers:{host:new URL(origin).host,origin,cookie:[...c.cookies].map(([k,v])=>k+'='+v).join('; '),'x-csrf-token':c.csrf,'content-type':'application/json',...extra},body:body===undefined?undefined:JSON.stringify(body)}));
 for(const cookie of r.headers.getSetCookie()){const [first]=cookie.split(';'),at=first.indexOf('=');c.cookies.set(first.slice(0,at),first.slice(at+1));}
 const json=await r.json();if(json.data?.csrf)c.csrf=json.data.csrf;return {r,json};
}
async function login(c:Client,email:string,admin=false){
 await call(c,'GET','/session');const challenge=(await call(c,'POST','/challenge',{email})).json.data;
 if(admin){const db=new DatabaseSync(join(dir,'campus.sqlite'));try{db.prepare("INSERT INTO users(id,email,display_name,role,created_at) VALUES (?,?,?,'admin',?)").run(randomUUID(),email,'Local admin',Date.now());}finally{db.close();}}
 const {code}=JSON.parse(readFileSync(join(dir,'mail',challenge.challenge_id+'.json'),'utf8'));
 return call(c,'POST','/verify',{challenge_id:challenge.challenge_id,code});
}
it('requires explicit local configuration, exact host/origin and CSRF even before login',async()=>{
 const c=client();expect((await call(c,'POST','/challenge',{email:'test@example.test'})).r.status).toBe(403);
 await call(c,'GET','/session');
 for(const extra of [{origin:'https://evil.test'},{origin:''},{host:'evil.test'},{'x-csrf-token':'wrong'},{'sec-fetch-site':'cross-site'}])expect((await call(c,'POST','/challenge',{email:'test@example.test'},extra)).r.status).toBe(403);
 const disabled=createProductWeb({origin,apiBase,enabled:false});expect((await disabled(new Request(origin+'/api/campus/session',{headers:{host:'127.0.0.1:3000'}}))).status).toBe(503);
 expect(()=>createProductWeb({origin:'https://remote.test',apiBase,enabled:true})).toThrow();
 expect(()=>createProductWeb({origin,apiBase:'http://example.com/api/v1',enabled:true})).toThrow();
});
it('stores admin login only in HttpOnly cookie, rotates CSRF and persists across browser reload',async()=>{
 const c=client(),result=await login(c,'admin@example.test',true);expect(result.r.status,JSON.stringify(result.json)).toBe(200);
 expect(JSON.stringify(result.json)).not.toContain('access_token');expect(result.r.headers.getSetCookie().some(v=>v.startsWith('campus_admin_session=')&&v.includes('HttpOnly')&&v.includes('SameSite=Strict'))).toBe(true);
 const reloaded={cookies:new Map(c.cookies),csrf:''};const restored=await call(reloaded,'GET','/session');expect(restored.json.data.user.role).toBe('admin');
 expect((await call(reloaded,'GET','/admin/reports')).r.status).toBe(200);
 const previous=new Map(reloaded.cookies);expect((await call(reloaded,'POST','/logout',{})).r.status).toBe(200);
 expect((await call({cookies:previous,csrf:''},'GET','/admin/reports')).r.status).toBe(401);
});
it('rejects normal users at login, arbitrary proxy routes and bearer headers from browser input',async()=>{
 const c=client();expect((await login(c,'student@example.test')).r.status).toBe(403);expect(c.cookies.get('campus_admin_session')??'').toBe('');
 expect((await call(c,'GET','/admin/reports',undefined,{authorization:'Bearer fabricated'})).r.status).toBe(401);
 expect((await call(c,'GET','/me/export')).r.status).toBe(404);expect((await call(c,'POST','/admin/status',{})).r.status).toBe(404);
});
it('executes real report resolution, denies expired roles and survives backend restart',async()=>{
 const c=client();await login(c,'admin@example.test',true);
 async function native(email:string){const challenge=(await app.inject({method:'POST',url:'/api/v1/auth/email/challenges',payload:{email}})).json().data;const {code}=JSON.parse(readFileSync(join(dir,'mail',challenge.challenge_id+'.json'),'utf8'));return(await app.inject({method:'POST',url:'/api/v1/auth/email/verify',payload:{challenge_id:challenge.challenge_id,code}})).json().data.access_token;}
 const owner=await native('owner@example.test'),reporter=await native('reporter@example.test');
 const post=(await app.inject({method:'POST',url:'/api/v1/posts',headers:{authorization:'Bearer '+owner,'idempotency-key':randomUUID()},payload:{kind:'wall',title:'Review this',body:'Example content',visibility:'public'}})).json().data;
 const report=(await app.inject({method:'POST',url:'/api/v1/reports',headers:{authorization:'Bearer '+reporter,'idempotency-key':randomUUID()},payload:{target:{kind:'post',id:post.id},reason:'other',details:''}})).json().data;
 expect((await call(c,'GET','/admin/reports')).json.data.items[0].content.title).toBe('Review this');
 const action={version:1,action:'hide_content',reason:'Reviewed local test.'};expect((await call(c,'POST',`/admin/reports/${report.id}/resolve`,action)).r.status).toBe(200);
 expect((await call(c,'POST',`/admin/reports/${report.id}/resolve`,action)).r.status).toBe(409);
 expect((await app.inject({url:'/api/v1/posts/'+post.id})).statusCode).toBe(404);
 const oldPort=new URL(apiBase).port;await app.close();app=createProductApp({dataDir:dir});await app.listen({host:'127.0.0.1',port:Number(oldPort)});
 let restored=await call(c,'GET','/admin/reports');
 // A pooled socket may close during restart; the browser explicitly retries an unavailable read.
 if(restored.r.status===503)restored=await call(c,'GET','/admin/reports');
 expect(restored.r.status,JSON.stringify(restored.json)).toBe(200);expect(restored.json.data.items[0].status).toBe('action_taken');
 const db=new DatabaseSync(join(dir,'campus.sqlite'));try{db.prepare("UPDATE users SET role='member' WHERE email='admin@example.test'").run();}finally{db.close();}
 expect((await call(c,'GET','/admin/reports')).r.status).toBe(403);
});
it('rejects oversized bodies and malformed JSON without upstream writes; reports upstream outages explicitly',async()=>{
 const c=client();await call(c,'GET','/session');expect((await call(c,'POST','/challenge',{email:'x'.repeat(40000)})).r.status).toBe(413);
 const bad=await web(new Request(origin+'/api/campus/challenge',{method:'POST',headers:{host:'127.0.0.1:3000',origin,cookie:[...c.cookies].map(([k,v])=>k+'='+v).join('; '),'x-csrf-token':c.csrf,'content-type':'application/json'},body:'{'}));expect(bad.status).toBe(400);
 await app.close();const unavailable=await call(c,'POST','/challenge',{email:'gone@example.test'});expect(unavailable.r.status).toBe(503);expect(unavailable.json.error.code).toBe('BACKEND_UNAVAILABLE');
});
it('protects campus writes with browser CSRF and publishes only reviewed versioned data',async()=>{
 const c=client();await login(c,'maintenance@example.test',true);
 const place=(await call(c,'GET','/admin/campus/places')).json.data.find((p:{id:string})=>p.id==='postal-counter');
 const target={target_kind:'place',target_id:'postal-counter'};
 const correction=(await app.inject({method:'POST',url:'/api/v1/campus/corrections',headers:{authorization:'Bearer '+c.cookies.get('campus_admin_session'),'idempotency-key':randomUUID()},payload:{...target,message:'Local maintenance review fixture'}})).json().data;
 const writePaths=['/admin/campus/shuttle/holidays','/admin/campus/shuttle/routes/hang-hau-to-campus','/admin/campus/shuttle/routes/hang-hau-to-campus/preview','/admin/campus/source-checks','/admin/campus/places/postal-counter',`/admin/campus/corrections/${correction.id}/resolve`];
 for(const path of writePaths){
  expect((await call(c,'POST',path,{}, {'x-csrf-token':'wrong'})).r.status).toBe(403);
  expect((await call(c,'POST',path,{}, {origin:'https://other.test'})).r.status).toBe(403);
 }
 const evidence=(await call(c,'POST','/admin/campus/source-checks',target)).json.data;
 expect((await call(c,'GET','/admin/campus/places')).json.data.find((p:{id:string})=>p.id===place.id).version).toBe(place.version);
 const {name,location,description,published_hours,map_url,action_url}=place;
 const body={version:place.version,source_check_id:evidence.id,reason:'Reviewed source fixture',fields:{name,location,description,published_hours,map_url,action_url}};
 const saved=await call(c,'POST','/admin/campus/places/postal-counter',body);expect(saved.r.status).toBe(200);expect(saved.json.data.version).toBe(place.version+1);
 expect((await call(c,'POST','/admin/campus/places/postal-counter',body)).r.status).toBe(409);
 const result=await call(c,'POST',`/admin/campus/corrections/${correction.id}/resolve`,{version:1,status:'resolved',source_check_id:evidence.id,resolution:'Reviewed the official fixture.'});expect(result.r.status).toBe(200);
 const audit=await call(c,'GET','/admin/campus/history?target_kind=place&target_id=postal-counter');expect(audit.r.status).toBe(200);expect(audit.json.data.map((r:{action:string})=>r.action)).toEqual(['correction_resolved','edit_place']);
 expect((await call(c,'GET','/admin/campus/corrections?status=resolved')).json.data.items[0].id).toBe(correction.id);
});

it('routes a versioned shuttle edit and preview through the authenticated browser gateway',async()=>{
 const c=client();await login(c,'shuttle@example.test',true);const before=await call(c,'GET','/admin/campus/shuttle');expect(before.r.status).toBe(200);
 const {id,source,refresh_due_at,...fields}=before.json.data.catalog.routes[0];const check=await call(c,'POST','/admin/campus/source-checks',{target_kind:'shuttle_timetable',target_id:'catalog'});expect(check.r.status).toBe(200);
 const preview=await call(c,'POST','/admin/campus/shuttle/routes/'+id+'/preview',{revision:1,fields,at:'2026-10-05T08:00:00+08:00'});expect(preview.r.status).toBe(200);
 const saved=await call(c,'POST','/admin/campus/shuttle/routes/'+id,{revision:1,fields,source_check_id:check.json.data.id,reason:'Reviewed gateway fixture'});expect(saved.r.status).toBe(200);expect(saved.json.data.revision).toBe(2);
});

it('protects activity maintenance and audit through the fixed browser gateway',async()=>{
 const c=client();await login(c,'activities@example.test',true);const token = c.cookies.get('campus_admin_session');
 const a=(await app.inject({method:'POST',url:'/api/v1/activities',headers:{authorization:'Bearer '+token,'idempotency-key':randomUUID()},payload:{kind:'study',title:'Gateway fixture',location:'Library',starts_at:new Date(Date.now()+86400000).toISOString(),ends_at:new Date(Date.now()+90000000).toISOString(),capacity:2,languages:['en'],interaction:'quiet',visibility:'public'}})).json().data;
 const path='/admin/activities/'+a.id;expect((await call(c,'GET','/admin/activities?q=Gateway')).json.data.items).toHaveLength(1);expect((await call(c,'GET',path)).json.data.version).toBe(1);
 const body={version:1,action:'edit',reason:'Reviewed local fixture',changes:{location:'Room B'}};
 for(const headers of [{'x-csrf-token':'wrong'},{origin:'https://other.test'}])expect((await call(c,'POST',path+'/maintain',body,headers)).r.status).toBe(403);
 expect((await call(c,'POST',path+'/maintain',body)).r.status).toBe(200);expect((await call(c,'GET',path+'/history')).json.data).toHaveLength(1);
 expect((await call(c,'GET',path+'/participants')).r.status).toBe(404);expect((await call(c,'POST',path+'/delete',{})).r.status).toBe(404);
});

it('allows protected sign-out after session expiry without reviving or requiring the retired cookie',async()=>{
 const c=client();await login(c,'expiry-admin@example.test',true);
 const oldCredential=c.cookies.get('campus_admin_session')!;
 await app.inject({method:'POST',url:'/api/v1/auth/logout',headers:{authorization:'Bearer '+oldCredential},payload:{}});
 const session=await call(c,'GET','/session');expect(session.json.data.user).toBeNull();expect(c.cookies.get('campus_admin_session')).toBe('');
 expect((await call(c,'POST','/logout',{}, {'x-csrf-token':'wrong'})).r.status).toBe(403);
 expect((await call(c,'POST','/logout',{}, {origin:'https://other.test'})).r.status).toBe(403);
 const result=await call(c,'POST','/logout',{});expect(result.r.status).toBe(200);expect(result.json.data.signed_out).toBe(true);
 expect((await call(c,'POST','/logout',{})).r.status).toBe(200);
 expect((await call(c,'GET','/admin/reports')).r.status).toBe(401);
 const retired=await app.inject({url:'/api/v1/me',headers:{authorization:'Bearer '+oldCredential}});expect(retired.statusCode).toBe(401);
});

it('binds retained browser editors to their original administrator across account changes',async()=>{
 const first=client(),second=client();
 const firstLogin=await login(first,'first-editor@example.test',true),secondLogin=await login(second,'second-editor@example.test',true);
 const firstId=firstLogin.json.data.user.id,secondId=secondLogin.json.data.user.id;
 // A different tab signs in; the old editor still sends its original identity.
 expect((await call(second,'GET','/admin/reports',undefined,{'x-campus-admin-id':firstId})).r.status).toBe(403);
 const denied=await call(second,'POST','/admin/campus/source-checks',{target_kind:'place',target_id:'postal-counter'},{'x-campus-admin-id':firstId});
 expect(denied.r.status).toBe(403);expect(denied.json.error.code).toBe('ACCOUNT_CHANGED');
 expect((await call(second,'GET','/admin/campus/history?target_kind=place&target_id=postal-counter',undefined,{'x-campus-admin-id':secondId})).json.data).toEqual([]);
 expect((await call(second,'GET','/admin/reports',undefined,{'x-campus-admin-id':secondId})).r.status).toBe(200);
 expect((await call(first,'GET','/admin/reports',undefined,{'x-campus-admin-id':firstId})).r.status).toBe(200);
});

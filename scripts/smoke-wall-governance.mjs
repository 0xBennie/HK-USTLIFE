import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {createProductApp} from '../dist/product/app.js';
const dir=mkdtempSync(join(tmpdir(),'campus-wall-smoke-')),now=()=>Date.parse('2026-10-03T00:00:00Z');
let app,base;
const checks=[];
async function start(){app=createProductApp({dataDir:dir,now});base=await app.listen({port:0,host:'127.0.0.1'});}
async function call(method,path,body,credential,expected=200,key=randomUUID()){
 const response=await fetch(base+'/api/v1'+path,{method,headers:{...(credential?{authorization:'Bearer '+credential}:{}),...(body?{'content-type':'application/json'}:{}),'idempotency-key':key},...(body?{body:JSON.stringify(body)}:{})});
 const result=await response.json();assert.equal(response.status,expected,JSON.stringify(result));return result.data;
}
async function login(email){const challenge=await call('POST','/auth/email/challenges',{email},null,202),{code}=JSON.parse(readFileSync(join(dir,'mail',challenge.challenge_id+'.json'),'utf8'));return(await call('POST','/auth/email/verify',{challenge_id:challenge.challenge_id,code})).access_token;}
try{
 await start();const owner=await login('owner@example.test'),alice=await login('alice@example.test'),bob=await login('bob@example.test'),admin=await login('admin@example.test');
 const db=new DatabaseSync(join(dir,'campus.sqlite'));try{db.prepare("UPDATE users SET role='admin' WHERE email='admin@example.test'").run();}finally{db.close();}
 const post=await call('POST','/posts',{kind:'help',title:'[DEMO] Where to study?',body:'Local smoke test question.',visibility:'members'},owner,201);
 await call('GET','/posts/'+post.id,undefined,null,404);await call('GET','/posts/'+post.id,undefined,alice);checks.push('signed-in visibility and guest denial');
 const replyKey=randomUUID(),path=`/posts/${post.id}/replies`,reply=await call('POST',path,{body:'[DEMO] Quiet room'},alice,201,replyKey);
 assert.equal((await call('POST',path,{body:'[DEMO] Quiet room'},alice,201,replyKey)).id,reply.id);
 await call('PATCH','/posts/'+post.id,{version:1,status:'resolved'},owner);
 await call('POST',path,{body:'Late reply'},bob,409);assert.equal((await call('GET','/me/notifications',undefined,alice)).items[0].post.id,post.id);checks.push('reply deduplication, solve state and private inbox');
 await app.close();await start();assert.equal((await call('GET','/posts/'+post.id,undefined,alice)).status,'resolved');checks.push('server/database restart persistence');
 const report=await call('POST','/reports',{target:{kind:'reply',id:String(reply.id)},reason:'other',details:'Local test review.'},bob,201);
 await call('GET','/admin/reports',undefined,bob,403);
 await call('POST',`/admin/reports/${report.id}/resolve`,{version:1,action:'hide_content',reason:'Local test action.'},admin);
 assert.equal((await call('GET',path,undefined,owner)).items.length,0);checks.push('private report, admin denial and audited reply hiding');
 const event=await call('POST','/activities',{kind:'study',title:'[DEMO] Quiet study',location:'Library',starts_at:'2026-10-05T02:00:00Z',ends_at:'2026-10-05T03:00:00Z',capacity:1,languages:['en'],interaction:'quiet',visibility:'public'},owner,201);
 for(const credential of [alice,bob])await call('POST',`/activities/${event.id}/join`,{activity_version:1,save_calendar:true},credential);
 await call('PUT',`/me/blocks/${post.author.id}`,{},alice);await call('GET',`/activities/${event.id}`,undefined,alice,404);
 assert.equal((await call('GET',`/activities/${event.id}`,undefined,bob)).mine.participation.status,'confirmed');assert.equal((await call('GET','/me/calendar?from=2026-10-05&to=2026-10-06',undefined,alice)).days[0].events.length,0);checks.push('blocking withdraws, clears calendar and promotes waitlist');
 await call('DELETE',`/me/blocks/${post.author.id}`,{},alice);assert.equal((await call('GET',`/activities/${event.id}`,undefined,alice)).mine.participation.status,'withdrawn');
 await call('DELETE',`/posts/${post.id}`,{version:2},owner);assert.equal((await call('GET','/me/notifications',undefined,alice)).items.filter(n=>n.kind==='post_resolved')[0].post,null);checks.push('unblocking never rejoins; deletion removes notification previews');
 const result={verified_at:new Date().toISOString(),mode:'local-development',transport:'real local HTTP',database:'temporary SQLite, closed/reopened',checks,ios_runtime_verified:false};
 if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
}finally{if(app)await app.close();rmSync(dir,{recursive:true,force:true});}

import {beforeEach,afterEach,it,expect} from 'vitest';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {createProductApp} from '../src/product/app.js';
let dir:string,app:ReturnType<typeof createProductApp>,owner:string,alice:string,bob:string;
const now=()=>Date.parse('2026-10-03T00:00:00Z');
const draft={kind:'help',title:'Where is the quiet study room?',body:'Looking for a quiet place near the library.',visibility:'public'};
beforeEach(async()=>{
 dir=mkdtempSync(join(tmpdir(),'campus-wall-'));app=createProductApp({dataDir:dir,now});
 async function login(email:string){const challenge=(await call('POST','/auth/email/challenges',{email},'')).json().data;const {code}=JSON.parse(readFileSync(join(dir,'mail',challenge.challenge_id+'.json'),'utf8'));return(await call('POST','/auth/email/verify',{challenge_id:challenge.challenge_id,code},'')).json().data.access_token;}
 owner=await login('wall-owner@example.test');alice=await login('alice@example.test');bob=await login('bob@example.test');
});
afterEach(async()=>{await app.close();rmSync(dir,{recursive:true,force:true});});
function call(method:'GET'|'POST'|'PATCH'|'DELETE',path:string,body?:object,credential = owner,key = randomUUID()){return app.inject({method,url:'/api/v1'+path,headers:{...(credential?{authorization:'Bearer '+credential}:{}),'idempotency-key':key},payload:body});}
async function create(changes:object={}){const result=await call('POST','/posts',{...draft,...changes});expect(result.statusCode,result.body).toBe(201);return result.json().data;}
async function inbox(credential:string){return(await call('GET','/me/notifications',undefined,credential)).json().data.items;}
it('persists public and signed-in posts with owner-only exports and no implied school verification',async()=>{
 const pub=await create(),member=await create({visibility:'members'});
 expect((await call('GET','/posts',undefined,'')).json().data.items.map((p:any)=>p.id)).toEqual([pub.id]);
 expect((await call('GET','/posts/'+member.id,undefined,'')).statusCode).toBe(404);
 expect((await call('GET','/posts/'+member.id,undefined,alice)).json().data.is_mine).toBe(false);
 expect((await call('GET','/posts?mine=true',undefined,'')).statusCode).toBe(401);
 expect((await call('GET','/posts?mine=true',undefined,alice)).json().data.items).toEqual([]);
 expect(JSON.stringify(pub)).not.toContain('@example.test');expect(pub.is_demo).toBe(true);
 await app.close();app=createProductApp({dataDir:dir,now});expect((await call('GET','/posts/'+pub.id)).json().data.title).toBe(draft.title);
 expect((await call('GET','/me/export')).json().data.wall.posts).toHaveLength(2);expect((await call('GET','/me/export',undefined,alice)).json().data.wall.posts).toEqual([]);
});
it('binds create and reply retry keys, rejects forged authors and isolates mutations',async()=>{
 const key=randomUUID();const result=await call('POST','/posts',draft,owner,key),post=result.json().data;expect(result.statusCode).toBe(201);
 expect((await call('POST','/posts',draft,owner,key)).json().data.id).toBe(post.id);
 expect((await call('POST','/posts',{...draft,title:'changed'},owner,key)).statusCode).toBe(409);
 expect((await call('POST','/posts',{...draft,author_id:'forged'})).statusCode).toBe(400);
 expect((await call('POST','/posts',draft,'')).statusCode).toBe(401);
 expect((await call('PATCH','/posts/'+post.id,{version:1,title:'takeover'},alice)).statusCode).toBe(403);
 const replyKey=randomUUID(),path='/posts/'+post.id+'/replies';const response=await call('POST',path,{body:'Try the library.'},alice,replyKey);expect(response.statusCode).toBe(201);
 expect((await call('POST',path,{body:'Try the library.'},alice,replyKey)).json().data.id).toBe(response.json().data.id);
 expect((await call('POST',path,{body:'different'},alice,replyKey)).statusCode).toBe(409);
 expect((await call('DELETE',path+'/'+response.json().data.id,{version:1},bob)).statusCode).toBe(404);
 expect((await inbox(owner)).filter((n:any)=>n.kind==='post_reply')).toHaveLength(1);
});
it('resolves and reopens help, closes wall discussions, and persists private notification reads',async()=>{
 const post=await create();await call('POST',`/posts/${post.id}/replies`,{body:'I can help.'},alice);
 const updated=await call('PATCH',`/posts/${post.id}`,{version:1,status:'resolved'});expect(updated.statusCode,updated.body).toBe(200);
 expect((await call('POST',`/posts/${post.id}/replies`,{body:'late'},bob)).statusCode).toBe(409);
 expect((await call('PATCH',`/posts/${post.id}`,{version:1,title:'stale'})).statusCode).toBe(409);
 const messages=await inbox(alice);expect(messages[0]).toMatchObject({kind:'post_resolved',post:{id:post.id,title:draft.title},activity:null});
 expect((await call('PATCH',`/me/notifications/${messages[0].id}/read`,{},bob)).statusCode).toBe(404);
 await call('PATCH',`/me/notifications/${messages[0].id}/read`,{},alice);
 await app.close();app=createProductApp({dataDir:dir,now});expect((await inbox(alice))[0].read_at).not.toBeNull();
 expect((await call('PATCH',`/posts/${post.id}`,{version:2,status:'open'})).statusCode).toBe(200);
 expect((await call('POST',`/posts/${post.id}/replies`,{body:'open again'},bob)).statusCode).toBe(201);
 const wall=await create({kind:'wall'});expect((await call('PATCH',`/posts/${wall.id}`,{version:1,status:'resolved'})).statusCode).toBe(400);
 expect((await call('PATCH',`/posts/${wall.id}`,{version:1,status:'closed'})).statusCode).toBe(200);
 expect((await call('POST',`/posts/${wall.id}/replies`,{body:'closed'},alice)).statusCode).toBe(409);
});
it('deletes replies and posts, clears notification previews and rejects replay of removed content',async()=>{
 const key=randomUUID(),post=(await call('POST','/posts',draft,owner,key)).json().data,path=`/posts/${post.id}/replies`;
 const r=(await call('POST',path,{body:'My reply'},alice)).json().data;
 expect((await call('DELETE',path+'/'+r.id,{version:2},alice)).statusCode).toBe(409);
 expect((await call('DELETE',path+'/'+r.id,{version:1},alice)).statusCode).toBe(200);
 expect((await call('GET',path)).json().data.items).toEqual([]);
 await call('POST',path,{body:'Another'},bob);await call('PATCH',`/posts/${post.id}`,{version:1,status:'resolved'});
 expect((await call('DELETE',`/posts/${post.id}`,{version:2},alice)).statusCode).toBe(403);
 expect((await call('DELETE',`/posts/${post.id}`,{version:2})).statusCode).toBe(200);
 expect((await call('GET',path,undefined,bob)).statusCode).toBe(404);
 expect((await inbox(bob))[0].post).toBeNull();expect(JSON.stringify(await inbox(bob))).not.toContain(draft.title);
 expect((await call('POST','/posts',draft,owner,key)).statusCode).toBe(410);
 expect((await call('GET','/me/export',undefined,bob)).json().data.wall.replies).toEqual([]);
});
it('filters hidden, banned and bilaterally blocked authors before pagination and hides previews',async()=>{
 const post=await create();await call('POST',`/posts/${post.id}/replies`,{body:'reply'},alice);await call('PATCH',`/posts/${post.id}`,{version:1,status:'resolved'});
 const aid=(await call('GET','/me',undefined,alice)).json().data.id;
 const db=new DatabaseSync(join(dir,'campus.sqlite'));
 try{
  db.prepare('INSERT INTO user_blocks VALUES (?,?,?)').run(post.author.id,aid,now());
  expect((await call('GET','/posts',undefined,alice)).json().data.items).toEqual([]);
  expect((await call('GET',`/posts/${post.id}`,undefined,alice)).statusCode).toBe(404);
  expect((await call('GET',`/posts/${post.id}/replies`)).json().data.items).toEqual([]);
  expect((await inbox(alice))[0].post).toBeNull();
  expect((await call('GET',`/posts/${post.id}`,undefined,'')).statusCode).toBe(200);
  db.prepare("UPDATE wall_posts SET moderation_state='hidden' WHERE id=?").run(post.id);
  expect((await call('GET','/posts',undefined,'')).json().data.items).toEqual([]);
  db.prepare("UPDATE wall_posts SET moderation_state='visible' WHERE id=?").run(post.id);
  db.prepare('UPDATE users SET banned_at=? WHERE id=?').run(now(),post.author.id);
  expect((await call('GET',`/posts/${post.id}/replies`,undefined,bob)).statusCode).toBe(404);
 }finally{db.close();}
});
it('uses stable tied-timestamp pagination, validates cursors and searches only visible posts',async()=>{
 // Insert through actual stores with separated creation days to respect the published daily cap.
 const {openDatabase}=await import('../src/product/database.js'),{createWallStore}=await import('../src/product/social/wall.js');
 const uid=(await call('GET','/me')).json().data.id,db=openDatabase(dir);let time=now()-3*86400000;
 try{const wall=createWallStore(db,()=>time);for(let i=0;i<25;i++){if(i%9===0)time+=86400000;wall.create(uid,{...draft,title:'Room '+i},randomUUID());}}finally{db.close();}
 const first=(await call('GET','/posts')).json().data;expect(first.items).toHaveLength(20);expect(first.next_cursor).toBeTruthy();
 const second=(await call('GET','/posts?cursor='+first.next_cursor)).json().data;expect(second.items).toHaveLength(5);expect(second.next_cursor).toBeNull();
 expect(new Set([...first.items,...second.items].map(p=>p.id)).size).toBe(25);
 expect((await call('GET','/posts?q=Room%2024')).json().data.items).toHaveLength(1);
 expect((await call('GET','/posts?cursor=bad')).statusCode).toBe(400);
});
it('account deletion cascades authored posts and replies without retaining content in other inboxes',async()=>{
 const post=await create();await call('POST',`/posts/${post.id}/replies`,{body:'help'},alice);await call('PATCH',`/posts/${post.id}`,{version:1,status:'resolved'});
 expect((await call('DELETE','/me',{confirmation:'DELETE'})).statusCode).toBe(200);
 expect((await call('GET',`/posts/${post.id}`,undefined,alice)).statusCode).toBe(404);
 expect((await inbox(alice))[0].post).toBeNull();expect((await call('GET','/me/export',undefined,alice)).json().data.wall.replies).toEqual([]);
});

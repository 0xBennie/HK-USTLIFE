import {mkdtempSync,readFileSync,rmSync,mkdirSync,writeFileSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {createProductApp} from '../src/product/app.js';
import {createRequire} from 'node:module';
// The Expo workspace is CommonJS to Node; tsx resolves its TypeScript imports.
const require=createRequire(import.meta.url);
const {ApiClient,ApiFailure}=require('../apps/mobile/src/api.ts') as typeof import('../apps/mobile/src/api.js');
const {InboxController}=require('../apps/mobile/src/social/inbox-controller.ts') as typeof import('../apps/mobile/src/social/inbox-controller.js');
import type {RequestOptions} from '../apps/mobile/src/api.js';
import type {ActivityNotification,NotificationRead} from '../src/product/social/types.js';

const report=process.argv[2]??'docs/progress/evidence/native-inbox-continuity/http-smoke.json';
const dir=mkdtempSync(join(tmpdir(),'campus-inbox-http-'));
let app=createProductApp({dataDir:dir});
const evidence:{started:string;checks:string[];result?:string;read_at?:string}={started:new Date().toISOString(),checks:[]};
try{
 const origin=await app.listen({host:'127.0.0.1',port:0}),api=new ApiClient(origin+'/api/v1');
 async function login(email:string){const challenge=await api.request<{challenge_id:string}>('/auth/email/challenges',{method:'POST',body:{email}});const {code}=JSON.parse(readFileSync(join(dir,'mail',challenge.challenge_id+'.json'),'utf8'));return(await api.request<{access_token:string}>('/auth/email/verify',{method:'POST',body:{challenge_id:challenge.challenge_id,code}})).access_token;}
 const owner=await login('owner@example.test'),member=await login('member@example.test');
 const post=await api.request<{id:string;version:number}>('/posts',{method:'POST',token:owner,idempotencyKey:randomUUID(),body:{kind:'help',title:'[DEMO] Inbox continuity HTTP acceptance',body:'Temporary local test, not real student content.',visibility:'public'}});
 await api.request(`/posts/${post.id}/replies`,{method:'POST',token:member,idempotencyKey:randomUUID(),body:{body:'Temporary local test reply.'}});
 let writes=0;
 const inbox=new InboxController(async<T,>(path:string,options?:RequestOptions)=>{const result=await api.request<T>(path,{...options,token:owner});if(options?.method==='PATCH'&&++writes===1)throw new ApiFailure(0,'NETWORK_ERROR','Simulated lost delivery after real server acknowledgement');return result;});
 assert.equal(await inbox.refresh(),true);const notification=inbox.snapshot().items[0];assert.equal(notification.post?.id,post.id);assert.equal(inbox.snapshot().unread,1);evidence.checks.push('Real HTTP post/reply produced an owned inbox notification and current post destination.');
 await assert.rejects(api.request(`/me/notifications/${notification.id}/read`,{method:'PATCH',token:member,body:{}}),(error:unknown)=>error instanceof ApiFailure&&error.status===404);evidence.checks.push('Other account could not mark the notification read.');
 assert.equal(await inbox.markRead(notification.id),false);assert.equal(inbox.snapshot().pendingRead,notification.id);assert.equal(inbox.snapshot().unread,1);assert.equal(inbox.snapshot().items[0].read_at,null);evidence.checks.push('Injected lost acknowledgement retained uncertain UI state without optimistic read/count change.');
 const committed=await api.request<{items:ActivityNotification[]}>('/me/notifications',{token:owner});const originalRead=committed.items[0].read_at;assert.ok(originalRead);
 const port=Number(new URL(origin).port);await app.close();app=createProductApp({dataDir:dir});await app.listen({host:'127.0.0.1',port});
 // A pooled socket can close during restart. The explicit retry remains the same idempotent mark.
 let retried=await inbox.markRead(notification.id);if(!retried){assert.equal(inbox.snapshot().pendingRead,notification.id);retried=await inbox.markRead(notification.id);}
 assert.equal(retried,true);assert.equal(inbox.snapshot().items[0].read_at,originalRead);assert.equal(inbox.snapshot().unread,0);assert.equal(inbox.snapshot().items[0].post?.id,post.id);evidence.checks.push('Restart retained original read time; explicit retry reconciled in place with authoritative unread count.');
 const ack=await api.request<NotificationRead>(`/me/notifications/${notification.id}/read`,{method:'PATCH',token:owner,body:{}});assert.deepEqual(ack,{id:notification.id,read:true,read_at:originalRead,unread:0});
 await api.request(`/posts/${post.id}`,{method:'DELETE',token:owner,body:{version:post.version}});assert.equal(await inbox.refresh(),true);assert.equal(inbox.snapshot().items[0].post,null);evidence.checks.push('Deleted post disappeared from the message destination after authoritative refresh.');
 evidence.read_at=originalRead;evidence.result='passed';
}finally{
 await app.close();rmSync(dir,{recursive:true,force:true});mkdirSync(dirname(report),{recursive:true});writeFileSync(report,JSON.stringify(evidence,null,2)+'\n');
}
console.log(`Inbox HTTP acceptance ${evidence.result}: ${evidence.checks.length} checks. Report: ${report}`);

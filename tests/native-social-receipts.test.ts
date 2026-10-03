import {beforeEach,afterEach,it,expect} from 'vitest';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createProductApp} from '../src/product/app';
import {ApiFailure,type RequestOptions} from '../apps/mobile/src/api';
import {writeReceipt,ensureReplayable,writeRejected,reviewRequired,SAFE_REPLAY_MS,type WriteReceipt} from '../apps/mobile/src/write-receipt';
let dir:string,app:ReturnType<typeof createProductApp>,token:string,clock:number;
async function request(path:string,options:RequestOptions={}){const r=await app.inject({method:(options.method??'GET') as 'GET'|'POST'|'PATCH',url:'/api/v1'+path,payload:options.body as object|undefined,headers:{authorization:'Bearer '+token,...(options.idempotencyKey?{'idempotency-key':options.idempotencyKey}:{})}});const j=r.json();if(r.statusCode>=400)throw new ApiFailure(r.statusCode,j.error.code,j.error.message);return j.data;}
async function login(){const c=await request('/auth/email/challenges',{method:'POST',body:{email:'social@example.test'}});const {code}=JSON.parse(readFileSync(join(dir,'mail',c.challenge_id+'.json'),'utf8'));token = (await request('/auth/email/verify',{method:'POST',body:{challenge_id:c.challenge_id,code}})).access_token;}
beforeEach(async()=>{dir=mkdtempSync(join(tmpdir(),'native-social-receipts-'));clock=Date.parse('2026-10-03T00:00:00Z');app=createProductApp({dataDir:dir,now:()=>clock});await login();});
afterEach(async()=>{await app.close();rmSync(dir,{recursive:true,force:true});});
async function send(path:string,receipt:WriteReceipt){ensureReplayable(receipt,'POST',clock);return request(path,{method:'POST',body:receipt.body,idempotencyKey:receipt.key});}
const activityBody=()=>({kind:'study',title:'Quiet session',location:'Library',starts_at:'2026-10-12T02:00:00Z',ends_at:'2026-10-12T03:00:00Z',capacity:4,languages:['en'],interaction:'quiet',visibility:'public'});
it('replays committed activity/post/comment/reply requests after a lost response and restart without duplication',async()=>{
 const activityReceipt=writeReceipt(activityBody(),randomUUID(),clock),postReceipt=writeReceipt({kind:'help',title:'Where is the room?',body:'Please share directions.',visibility:'public'},randomUUID(),clock);
 const activity=await send('/activities',activityReceipt),post=await send('/posts',postReceipt);
 const commentBody={body:'Original comment'},commentReceipt=writeReceipt(commentBody,randomUUID(),clock),replyReceipt=writeReceipt({body:'Original reply'},randomUUID(),clock);
 const comment=await send(`/activities/${activity.id}/comments`,commentReceipt),reply=await send(`/posts/${post.id}/replies`,replyReceipt);commentBody.body='Changed after send';
 // Responses above model writes committed before transport loss; no receipt is cleared client-side.
 await app.close();app=createProductApp({dataDir:dir,now:()=>clock});
 expect((await send('/activities',activityReceipt)).id).toBe(activity.id);expect((await send('/posts',postReceipt)).id).toBe(post.id);
 expect((await send(`/activities/${activity.id}/comments`,commentReceipt)).id).toBe(comment.id);expect((await send(`/posts/${post.id}/replies`,replyReceipt)).id).toBe(reply.id);
 expect((await request(`/activities/${activity.id}/comments`)).items).toHaveLength(1);expect((await request(`/posts/${post.id}/replies`)).items).toHaveLength(1);expect(commentReceipt.body.body).toBe('Original comment');
});
it('blocks the same social creation after server receipt expiration rather than generating a duplicate',async()=>{
 const receipt=writeReceipt({kind:'wall',title:'One post',body:'One original message',visibility:'public'},randomUUID(),clock);const post=await send('/posts',receipt);
 clock+=25*60*60*1000;await login();
 // A new legitimate write purges expired server receipts, reproducing the dangerous boundary.
 await send('/posts',writeReceipt({kind:'wall',title:'Unrelated post',body:'A different action',visibility:'public'},randomUUID(),clock));
 await expect(send('/posts',receipt)).rejects.toMatchObject({code:'RECEIPT_REVIEW_REQUIRED'});
 const page=await request('/posts');expect(page.items.filter((p:{title:string})=>p.title==='One post')).toHaveLength(1);expect(page.items.some((p:{id:string})=>p.id===post.id)).toBe(true);
});
it('keeps review-required and transport failures uncertain while allowing a real validation rejection to be corrected',async()=>{
 const receipt=writeReceipt({kind:'wall',title:'',body:'Needs title',visibility:'public'},randomUUID(),clock);let error:unknown;try{await send('/posts',receipt);}catch(e){error=e;}expect(writeRejected(error)).toBe(true);
 expect(writeRejected(new ApiFailure(0,'NETWORK_ERROR','Lost response'))).toBe(false);expect(writeRejected(new TypeError('Connection closed'))).toBe(false);
 try{ensureReplayable(receipt,'POST',clock+SAFE_REPLAY_MS);}catch(e){expect(reviewRequired(e)).toBe(true);expect(writeRejected(e)).toBe(false);}
 const corrected=await send('/posts',writeReceipt({...receipt.body,title:'Corrected title'},randomUUID(),clock));expect(corrected.title).toBe('Corrected title');
});

it('requires review when the device clock moves backwards instead of extending a POST receipt indefinitely',()=>{
 const receipt=writeReceipt({body:'Uncertain request'},randomUUID(),10000);
 expect(()=>ensureReplayable(receipt,'POST',9999)).toThrow(/Retry window ended/);
 expect(()=>ensureReplayable(receipt,'POST',10000+SAFE_REPLAY_MS-1)).not.toThrow();
});

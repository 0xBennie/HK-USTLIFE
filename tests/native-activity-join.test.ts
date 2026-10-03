import {beforeEach,afterEach,it,expect} from 'vitest';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createProductApp} from '../src/product/app';
import {ActivityJoinController} from '../apps/mobile/src/social/activity-join';
import {ApiFailure,type RequestOptions} from '../apps/mobile/src/api';
import type {Activity} from '../src/product/social/types';
let dir:string,app:ReturnType<typeof createProductApp>,owner:string,member:string,other:string,activity:Activity;
const requests:RequestOptions[]=[];
async function request<T>(token:string,path:string,options:RequestOptions={}):Promise<T>{
 const response=await app.inject({method:(options.method??'GET') as 'GET'|'POST'|'PATCH',url:'/api/v1'+path,headers:{authorization:'Bearer '+token,...(options.idempotencyKey?{'idempotency-key':options.idempotencyKey}:{})},payload:options.body as object|undefined});
 const body=response.json();if(response.statusCode>=400)throw new ApiFailure(response.statusCode,body.error.code,body.error.message);return body.data;
}
beforeEach(async()=>{
 dir=mkdtempSync(join(tmpdir(),'campus-native-join-'));app=createProductApp({dataDir:dir,now:()=>Date.parse('2026-10-03T00:00:00Z')});requests.length=0;
 async function login(email:string){const challenge=(await app.inject({method:'POST',url:'/api/v1/auth/email/challenges',payload:{email}})).json().data;const {code}=JSON.parse(readFileSync(join(dir,'mail',challenge.challenge_id+'.json'),'utf8'));return (await app.inject({method:'POST',url:'/api/v1/auth/email/verify',payload:{challenge_id:challenge.challenge_id,code}})).json().data.access_token;}
 owner=await login('host@example.test');member=await login('member@example.test');other=await login('other@example.test');
 activity=await request<Activity>(owner,'/activities',{method:'POST',idempotencyKey:randomUUID(),body:{kind:'study',title:'Quiet study',location:'Library',starts_at:'2026-10-05T02:00:00Z',ends_at:'2026-10-05T03:00:00Z',capacity:1,languages:['en'],interaction:'quiet',visibility:'public'}});
 activity=await request<Activity>(member,`/activities/${activity.id}`);
});
afterEach(async()=>{await app.close();rmSync(dir,{recursive:true,force:true});});
const controller=(transport=<T>(path:string,options?:RequestOptions)=>request<T>(member,path,options))=>new ActivityJoinController(transport,randomUUID);
it('waits for the real server result and rejects simultaneous taps',async()=>{
 let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});
 const flow=controller(async<T>(path:string,options?:RequestOptions)=>{requests.push(options!);await gate;return request<T>(member,path,options);});
 flow.review(activity);flow.setCalendar(true);const first=flow.submit();await flow.submit();expect(requests).toHaveLength(1);expect(flow.snapshot().phase).toBe('submitting');expect(flow.snapshot().activity?.mine?.participation).toBeNull();release();await first;
 expect(flow.snapshot().activity?.mine?.participation?.status).toBe('confirmed');expect(flow.snapshot().activity?.mine?.calendar_saved).toBe(true);expect(flow.snapshot().phase).toBe('result');
});
it('retries a lost committed response with the same payload/key and shows later cancellation',async()=>{
 let drop=true;
 const flow=controller(async<T>(path:string,options?:RequestOptions)=>{requests.push(options!);const result=await request<T>(member,path,options);if(drop){drop=false;throw new ApiFailure(0,'NETWORK_ERROR','Response lost after commit');}return result;});
 flow.review(activity);flow.setCalendar(true);await flow.submit();expect(flow.snapshot().phase).toBe('uncertain');
 const committed=await request<Activity>(member,`/activities/${activity.id}`);expect(committed.mine?.participation?.status).toBe('confirmed');
 flow.setCalendar(false);flow.review({...activity,version:999});
 await request(owner,`/activities/${activity.id}/cancel`,{method:'POST',body:{version:activity.version}});await flow.submit();
 expect(requests[1].idempotencyKey).toBe(requests[0].idempotencyKey);expect(requests[1].body).toEqual({activity_version:1,save_calendar:true});expect(flow.snapshot().phase).toBe('result');expect(flow.snapshot().activity?.mine?.participation?.status).toBe('cancelled');expect(flow.snapshot().activity?.mine?.calendar_saved).toBe(false);
});
it('shows authoritative waitlist rather than optimistic last-place confirmation',async()=>{
 await request(other,`/activities/${activity.id}/join`,{method:'POST',body:{activity_version:1},idempotencyKey:randomUUID()});
 const flow=controller();flow.review(activity);await flow.submit();expect(flow.snapshot().activity?.mine?.participation?.status).toBe('waitlisted');expect(flow.snapshot().activity?.mine?.participation?.waitlist_position).toBe(1);expect(flow.snapshot().activity?.mine?.calendar_saved).toBe(false);
});
it('requires refreshed review after a version conflict and issues a new receipt',async()=>{
 const flow=controller(async<T>(path:string,options?:RequestOptions)=>{requests.push(options!);return request<T>(member,path,options);});flow.review(activity);
 await request(owner,`/activities/${activity.id}`,{method:'PATCH',body:{version:1,location:'New room'}});await flow.submit();expect(flow.snapshot().phase).toBe('rejected');await flow.submit();expect(requests).toHaveLength(1);
 flow.review(await request<Activity>(member,`/activities/${activity.id}`));expect(flow.snapshot().activity?.location).toBe('New room');await flow.submit();expect(flow.snapshot().phase).toBe('result');expect(requests[1].idempotencyKey).not.toBe(requests[0].idempotencyKey);expect(requests[1].body).toEqual({activity_version:2,save_calendar:false});
});

it('stops expired signup replay and reads authoritative withdrawal without rejoining',async()=>{
 let now=0,calls=0;const flow=new ActivityJoinController(async<T>(path:string,options?:RequestOptions)=>{calls++;const value=await request<T>(member,path,options);if(options?.method==='POST')throw new ApiFailure(0,'NETWORK_ERROR','Lost response');return value;},randomUUID,()=>now);
 flow.review(activity);await flow.submit();const joined=await request<Activity>(member,`/activities/${activity.id}`);
 await request(member,`/activities/${activity.id}/withdraw`,{method:'POST',body:{participation_version:joined.mine!.participation!.version},idempotencyKey:randomUUID()});
 now=23*3600000;await flow.submit();expect(calls).toBe(1);expect(flow.snapshot()).toMatchObject({phase:'uncertain',error:{code:'RECEIPT_REVIEW_REQUIRED'}});
 await flow.checkCurrent();expect(calls).toBe(2);expect(flow.snapshot()).toMatchObject({phase:'result',activity:{mine:{participation:{status:'withdrawn'}}}});
 await flow.submit();expect(calls).toBe(2);
});
it('keeps failed status recovery read-only and requires explicit new review when no signup exists',async()=>{
 let now=0,calls=0,failRead=true;const methods:string[]=[];const flow=new ActivityJoinController(async<T>(path:string,options?:RequestOptions)=>{calls++;methods.push(options?.method??'GET');if(options?.method==='POST'||failRead)throw new ApiFailure(0,'NETWORK_ERROR','Offline');return request<T>(member,path,options);},randomUUID,()=>now);
 flow.review(activity);await flow.submit();now=23*3600000;await flow.submit();await flow.checkCurrent();expect(flow.snapshot().phase).toBe('uncertain');
 failRead=false;await flow.checkCurrent();expect(methods).toEqual(['POST','GET','GET']);expect(flow.snapshot().phase).toBe('review');expect(flow.snapshot().activity?.mine?.participation).toBeNull();expect(calls).toBe(3);
});
it('does not interpret a malformed recovery response as no participation or a successful signup',async()=>{
 let now=0,reads=0;const flow=new ActivityJoinController(async<T>(_path:string,options?:RequestOptions)=>{if(options?.method==='POST')throw new ApiFailure(0,'NETWORK_ERROR','Offline');reads++;return {...activity,mine:{calendar_saved:false}} as T;},randomUUID,()=>now);
 flow.review(activity);await flow.submit();now=23*3600000;await flow.submit();await flow.checkCurrent();expect(reads).toBe(1);expect(flow.snapshot()).toMatchObject({phase:'uncertain',error:{code:'RECEIPT_REVIEW_REQUIRED'}});
});

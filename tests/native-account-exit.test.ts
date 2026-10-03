import {afterEach,beforeEach,describe,expect,it} from 'vitest';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createProductApp} from '../src/product/app';
import {ApiClient,ApiFailure} from '../apps/mobile/src/api';
import {SessionController} from '../apps/mobile/src/session';
import {NavigationProtections} from '../apps/mobile/src/navigation/protection';
import {AccountExitController,type AccountExitKind} from '../apps/mobile/src/navigation/account-exit';

describe('account exit across retained native scenes',()=>{
 let app:ReturnType<typeof createProductApp>,api:ApiClient,session:SessionController;
 let dir:string,saved:string|null,access:string,guards:NavigationProtections,exits:AccountExitController;
 let operations:AccountExitKind[];
 async function login(email='exit@example.test'){
  const challenge=await api.request<{challenge_id:string}>('/auth/email/challenges',{method:'POST',body:{email}});
  const {code}=JSON.parse(readFileSync(join(dir,'mail',`${challenge.challenge_id}.json`),'utf8'));
  const response=await api.request<{access_token:string}>('/auth/email/verify',{method:'POST',body:{challenge_id:challenge.challenge_id,code}});
  await session.signIn(response.access_token);return response.access_token;
 }
 function propose(kind:AccountExitKind='sign-out'){
  const result=exits.prepare(kind);if(result.status!=='ready')throw new Error(result.status);return result.proposal;
 }
 beforeEach(async()=>{
  dir=mkdtempSync(join(tmpdir(),'campus-account-exit-'));saved=null;operations=[];
  app=createProductApp({dataDir:dir});const url=await app.listen({host:'127.0.0.1',port:0});api=new ApiClient(`${url}/api/v1`);
  session=new SessionController(api,{get:async()=>saved,set:async value=>{saved=value;},clear:async()=>{saved=null;}});
  access=await login();guards=new NavigationProtections();
  exits=new AccountExitController(()=>session.snapshot().profile?.id??null,()=>guards.status(),async kind=>{
   operations.push(kind);if(kind==='delete')await session.deleteAccount();else await session.signOut();
  });
 });
 afterEach(async()=>{await app.close();rmSync(dir,{recursive:true,force:true});});

 it('keeps hidden study and profile drafts on cancel, then revokes only after confirmation',async()=>{
  guards.register(0,'draft');guards.register(4,'draft');
  const first=propose();expect(first.requiresConfirmation).toBe(true);
  expect(await exits.commit(first)).toBe(false);exits.cancel(first);
  expect(await exits.commit(first,true)).toBe(false);
  expect(operations).toEqual([]);expect(guards.status()).toBe('draft');
  expect((await session.request<{email:string}>('/me')).email).toBe('exit@example.test');
  expect(await exits.commit(propose(),true)).toBe(true);
  expect(saved).toBeNull();expect(session.snapshot().status).toBe('guest');
  await expect(api.request('/me',{token:access})).rejects.toMatchObject({status:401});
 });

 it('waits for a hidden write instead of invalidating its successful response',async()=>{
  const draft=guards.register(0,'draft'),busy=guards.register(2,'busy');
  let release!:()=>void,arrived!:()=>void;
  const ready=new Promise<void>(resolve=>{arrived=resolve;});const original=api.request.bind(api);
  api.request=async<T>(path:string,options?:Parameters<ApiClient['request']>[1])=>{
   const result=await original<T>(path,options);
   if(path==='/study/items'&&options?.method==='POST'){arrived();await new Promise<void>(resolve=>{release=resolve;});}
   return result;
  };
  const writing=session.request<{id:string}>('/study/items',{method:'POST',body:{kind:'task',title:'Retained scene task'},idempotencyKey:'exit-protection-task-001'});
  await ready;expect(exits.prepare('sign-out')).toEqual({status:'busy'});expect(exits.prepare('delete')).toEqual({status:'busy'});
  expect(operations).toEqual([]);release();expect((await writing).id).toBeTruthy();busy();
  expect(guards.status()).toBe('draft');draft();expect(guards.status()).toBe('clear');
  expect(await exits.commit(propose())).toBe(true);
 });

 it('requires review when a new pending operation appears behind an existing dialog',async()=>{
  guards.register(0,'draft');const old=propose();const work=guards.register(2,'busy');
  expect(await exits.commit(old,true)).toBe(false);expect(operations).toEqual([]);
  work();const uncertain=guards.register(2,'uncertain');
  const next=propose();expect(next.protection).toBe('uncertain');expect(await exits.commit(next)).toBe(false);
  expect(await exits.commit(next,true)).toBe(true);uncertain();
 });

 it('never applies an old account confirmation to the newly signed-in account',async()=>{
  guards.register(4,'draft');const old=propose('delete');
  const next=await login('next-exit@example.test');
  expect(await exits.commit(old,true)).toBe(false);expect(operations).toEqual([]);
  expect((await api.request<{email:string}>('/me',{token:next})).email).toBe('next-exit@example.test');
  exits.reset();expect(exits.snapshot().error).toBeNull();
 });

 it('does not let a replaced or cancelled confirmation consume the latest decision',async()=>{
  const old=propose('delete'),current=propose('sign-out');
  exits.cancel(old);expect(await exits.commit(old,true)).toBe(false);
  expect(await exits.commit(current)).toBe(true);expect(operations).toEqual(['sign-out']);
 });

 it('requires deletion confirmation and serializes repeated taps while HTTP is delayed',async()=>{
  const proposal=propose('delete');expect(await exits.commit(proposal)).toBe(false);
  let release!:()=>void,arrived!:()=>void;const ready=new Promise<void>(resolve=>{arrived=resolve;});
  const original=api.request.bind(api);
  api.request=async<T>(path:string,options?:Parameters<ApiClient['request']>[1])=>{
   if(path==='/me'&&options?.method==='DELETE'){arrived();await new Promise<void>(resolve=>{release=resolve;});}
   return original<T>(path,options);
  };
  const deleting=exits.commit(proposal,true);await ready;
  expect(exits.snapshot().busy).toBe(true);expect(await exits.commit(proposal,true)).toBe(false);
  expect(exits.prepare('sign-out')).toEqual({status:'busy'});release();expect(await deleting).toBe(true);
  expect(operations).toEqual(['delete']);expect(saved).toBeNull();
  await expect(api.request('/me',{token:access})).rejects.toMatchObject({status:401});
 });

 it('retains the account and reports failed logout, allowing an explicit fresh retry',async()=>{
  const original=api.request.bind(api);let offline=true;
  api.request=async<T>(path:string,options?:Parameters<ApiClient['request']>[1])=>{
   if(path==='/auth/logout'&&offline)throw new ApiFailure(0,'NETWORK_ERROR','Simulated network failure');
   return original<T>(path,options);
  };
  expect(await exits.commit(propose())).toBe(false);
  expect(exits.snapshot()).toMatchObject({busy:false,error:{code:'NETWORK_ERROR'}});
  expect(saved).toBe(access);expect(session.snapshot().status).toBe('authenticated');
  offline=false;expect(await exits.commit(propose())).toBe(true);expect(exits.snapshot().error).toBeNull();
 });

 it('invalidates a confirmation after leaving and re-entering the same account',async()=>{
  const old=propose('delete');exits.reset();
  expect(await exits.commit(old,true)).toBe(false);expect(operations).toEqual([]);
  const current=propose('delete');expect(await exits.commit(current,true)).toBe(true);
 });
});

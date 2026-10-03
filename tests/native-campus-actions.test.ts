import {beforeEach,afterEach,it,expect} from 'vitest';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createProductApp} from '../src/product/app';
import {CampusActionsController,type CampusTarget} from '../apps/mobile/src/campus/action-controller';
import {ApiFailure,type RequestOptions} from '../apps/mobile/src/api';
import {NavigationProtections} from '../apps/mobile/src/navigation/protection';
let dir:string,app:ReturnType<typeof createProductApp>,token:string;
const target:CampusTarget={target_kind:'place',target_id:'postal-counter'};
const offline=()=>new ApiFailure(0,'NETWORK_ERROR','Simulated loss');
async function request(path:string,options:RequestOptions={}){
 const response=await app.inject({method:(options.method??'GET') as 'GET'|'POST'|'PUT'|'DELETE',url:'/api/v1'+path,headers:{authorization:'Bearer '+token,...(options.idempotencyKey?{'idempotency-key':options.idempotencyKey}:{})},payload:options.body as object|undefined});
 const body=response.json();if(response.statusCode>=400)throw new ApiFailure(response.statusCode,body.error.code,body.error.message);return body.data;
}
async function login(email:string){const challenge=(await app.inject({method:'POST',url:'/api/v1/auth/email/challenges',payload:{email}})).json().data;const {code}=JSON.parse(readFileSync(join(dir,'mail',challenge.challenge_id+'.json'),'utf8'));return(await app.inject({method:'POST',url:'/api/v1/auth/email/verify',payload:{challenge_id:challenge.challenge_id,code}})).json().data.access_token;}
beforeEach(async()=>{dir=mkdtempSync(join(tmpdir(),'campus-personal-'));app=createProductApp({dataDir:dir});token = await login('campus-actions@example.test');});
afterEach(async()=>{await app.close();rmSync(dir,{recursive:true,force:true});});

it('freezes a lost correction acknowledgement, preserves its key across refresh/restart and creates one record',async()=>{
 let lost=true;const keys:string[]=[];
 const c=new CampusActionsController(target,async(path,options)=>{const value=await request(path,options);if(options?.method==='POST'){keys.push(options.idempotencyKey!);if(lost){lost=false;throw offline();}}return value;},randomUUID);
 await c.refresh();c.edit('  The published hours need checking.  ');expect(c.protection()).toBe('draft');
 expect(await c.submitCorrection()).toBe(false);expect(c.protection()).toBe('uncertain');
 c.edit('Replacement input must not become another request');expect(c.snapshot().draft).toBe('  The published hours need checking.  ');
 expect(await c.submitCorrection()).toBe(false);expect(await c.toggleBookmark()).toBe(false);
 await app.close();app=createProductApp({dataDir:dir});
 expect(await c.refresh()).toBe(true);expect(c.snapshot().pending?.kind).toBe('correction');
 expect(await c.retry()).toBe(true);expect(keys).toHaveLength(2);expect(keys[1]).toBe(keys[0]);
 expect(c.snapshot()).toMatchObject({draft:'',pending:null,notice:'correction-saved',stale:false});
 expect(await request('/me/campus/corrections')).toHaveLength(1);
});
it('registers cross-scene draft/uncertain/busy risks and blocks synchronous duplicate actions',async()=>{
 const started=Promise.withResolvers<void>(),release=Promise.withResolvers<void>();let writes=0;
 const c=new CampusActionsController(target,async(path,options)=>{if(options?.method==='POST'){writes++;started.resolve();await release.promise;}return request(path,options);},randomUUID);
 const guards=new NavigationProtections();let cleanup=guards.register(1,c.protection());
 const unsubscribe=c.subscribe(()=>{cleanup();cleanup=guards.register(1,c.protection());});
 await c.refresh();c.edit('Location needs review');expect(guards.status()).toBe('draft');
 const saving=c.submitCorrection();await started.promise;expect(guards.status()).toBe('busy');
 expect(await c.submitCorrection()).toBe(false);expect(await c.retry()).toBe(false);expect(await c.refresh()).toBe(false);
 release.resolve();expect(await saving).toBe(true);expect(writes).toBe(1);expect(guards.status()).toBe('clear');
 unsubscribe();cleanup();
});
it('keeps confirmed correction data and reports a failed subsequent read separately',async()=>{
 let failRead=false;const c=new CampusActionsController(target,async(path,options)=>{if(failRead&&path==='/me/campus/corrections')throw offline();const value=await request(path,options);if(options?.method==='POST')failRead=true;return value;},randomUUID);
 await c.refresh();c.edit('Please check the posted hours');expect(await c.submitCorrection()).toBe(true);
 expect(c.snapshot()).toMatchObject({draft:'',pending:null,notice:'correction-saved',stale:true});expect(c.snapshot().requests).toHaveLength(1);
 failRead=false;expect(await c.refresh()).toBe(true);expect(c.snapshot().requests).toHaveLength(1);
});
it('keeps an explicit bookmark decision after a lost acknowledgement instead of toggling it back',async()=>{
 let lost=true;const c=new CampusActionsController(target,async(path,options)=>{const value=await request(path,options);if(options?.method==='PUT'&&lost){lost=false;throw offline();}return value;},randomUUID);
 await c.refresh();expect(await c.toggleBookmark()).toBe(false);expect(c.snapshot().saved).toBe(false);
 await c.refresh();expect(c.snapshot().saved).toBe(true);expect(await c.toggleBookmark()).toBe(false);
 expect(await c.retry()).toBe(true);expect(c.snapshot().saved).toBe(true);expect(await request('/me/campus/bookmarks')).toHaveLength(1);
 expect(await c.toggleBookmark()).toBe(true);expect(c.snapshot().saved).toBe(false);
});
it('rejects malformed bookmark/correction acknowledgements without clearing the draft',async()=>{
 let corrupt=true;const c=new CampusActionsController(target,async(path,options)=>{const value=await request(path,options);return corrupt&&options?.method?{...value,target_id:'wrong-target'}:value;},randomUUID);
 await c.refresh();expect(await c.toggleBookmark()).toBe(false);expect(c.snapshot().pending?.kind).toBe('bookmark');
 corrupt=false;expect(await c.retry()).toBe(true);
 corrupt=true;c.edit('Review the holiday timetable');expect(await c.submitCorrection()).toBe(false);
 expect(c.snapshot()).toMatchObject({draft:'Review the holiday timetable',error:{code:'INVALID_CAMPUS_RESPONSE'}});
 corrupt=false;expect(await c.retry()).toBe(true);expect(await request('/me/campus/corrections')).toHaveLength(1);
});
it('allows correction of rejected input but never changes uncertain input',async()=>{
 const c=new CampusActionsController(target,request,randomUUID);await c.refresh();c.edit('tiny');
 expect(await c.submitCorrection()).toBe(false);expect(c.snapshot()).toMatchObject({pending:null,draft:'tiny'});
 c.edit('Corrected details with a source');expect(await c.submitCorrection()).toBe(true);expect(c.snapshot().requests).toHaveLength(1);
});
it('retains the previous complete snapshot if one refresh leg fails',async()=>{
 await request('/me/campus/bookmarks',{method:'PUT',body:target});let failRead=false;
 const c=new CampusActionsController(target,async(path,options)=>{if(failRead&&path==='/me/campus/corrections')return {};return request(path,options);},randomUUID);
 await c.refresh();c.edit('Retain this draft through refresh');
 await request('/me/campus/bookmarks',{method:'DELETE',body:target});failRead=true;
 expect(await c.refresh()).toBe(false);expect(c.snapshot()).toMatchObject({saved:true,stale:true,draft:'Retain this draft through refresh'});
 failRead=false;await c.refresh();expect(c.snapshot()).toMatchObject({saved:false,stale:false,draft:'Retain this draft through refresh'});
});
it('ignores a delayed completion after unmount and isolates the next account controller',async()=>{
 const arrived=Promise.withResolvers<void>(),release=Promise.withResolvers<void>();
 const c=new CampusActionsController(target,async(path,options)=>{const value=await request(path,options);if(options?.method==='POST'){arrived.resolve();await release.promise;}return value;},randomUUID);
 await c.refresh();c.edit('A private correction');const saving=c.submitCorrection();await arrived.promise;c.invalidate();
 token = await login('next-campus@example.test');const next=new CampusActionsController(target,request,randomUUID);await next.refresh();release.resolve();
 expect(await saving).toBe(false);expect(c.snapshot().notice).toBeNull();expect(next.snapshot()).toMatchObject({draft:'',requests:[],saved:false});
});
it('allows typing and leaving during a read-only refresh without losing the current draft',async()=>{
 const started=Promise.withResolvers<void>(),release=Promise.withResolvers<void>();
 const c=new CampusActionsController(target,async(path,options)=>{const value=await request(path,options);if(path==='/me/campus/corrections'){started.resolve();await release.promise;}return value;},randomUUID);
 const refreshing=c.refresh();await started.promise;
 expect(c.protection()).toBe('clear');c.edit('A draft written while records load');expect(c.protection()).toBe('draft');
 release.resolve();expect(await refreshing).toBe(true);expect(c.snapshot().draft).toBe('A draft written while records load');
});

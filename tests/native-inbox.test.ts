import {beforeEach,afterEach,it,expect} from 'vitest';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {createProductApp} from '../src/product/app';
import {InboxController,type InboxPage} from '../apps/mobile/src/social/inbox-controller';
import {ApiFailure,type RequestOptions} from '../apps/mobile/src/api';
import type {NotificationRead} from '../src/product/social/types';
let app:ReturnType<typeof createProductApp>,dir:string,clock:number,first:string,second:string,owner:string,otherOwner:string;
function client(credential:string){return async<T=any>(path:string,options:RequestOptions={}):Promise<T>=>{
 const r=await app.inject({method:(options.method??'GET') as 'GET'|'POST'|'PATCH'|'DELETE',url:'/api/v1'+path,headers:{authorization:'Bearer '+credential,'idempotency-key':options.idempotencyKey??randomUUID()},payload:options.body as object|undefined});
 const j=r.json();if(r.statusCode>=400)throw new ApiFailure(r.statusCode,j.error.code,j.error.message);return j.data;
};}
async function login(email:string){const challenge=(await app.inject({method:'POST',url:'/api/v1/auth/email/challenges',payload:{email}})).json().data;const {code}=JSON.parse(readFileSync(join(dir,'mail',challenge.challenge_id+'.json'),'utf8'));return(await app.inject({method:'POST',url:'/api/v1/auth/email/verify',payload:{challenge_id:challenge.challenge_id,code}})).json().data.access_token;}
function seed(count:number,user=owner){const db=new DatabaseSync(join(dir,'campus.sqlite'));try{const statement=db.prepare("INSERT INTO notifications(owner_id,kind,created_at) VALUES (?,'activity_removed',?)");for(let i=0;i<count;i++)statement.run(user,clock+i);}finally{db.close();}}
beforeEach(async()=>{dir=mkdtempSync(join(tmpdir(),'campus-inbox-'));clock=Date.now();app=createProductApp({dataDir:dir,now:()=>clock});first=await login('inbox-a@example.test');second=await login('inbox-b@example.test');owner=(await client(first)('/me')).id;otherOwner=(await client(second)('/me')).id;});
afterEach(async()=>{await app.close();rmSync(dir,{recursive:true,force:true});});

it('marks an older loaded notification in place using server time/count, without refetching or dropping pages',async()=>{
 seed(105);let reads=0;const api=client(first),c=new InboxController((p,o)=>{if(!o?.method)reads++;return api(p,o);});
 await c.refresh();await c.more();const before=c.snapshot(),ids=before.items.map(x=>x.id),id=ids[77];
 expect(before.items).toHaveLength(100);expect(await c.markRead(id)).toBe(true);
 expect(c.snapshot().items.map(x=>x.id)).toEqual(ids);expect(c.snapshot().cursor).toBe(before.cursor);expect(c.snapshot().unread).toBe(104);expect(reads).toBe(2);
 expect(c.snapshot().items.find(x=>x.id===id)?.read_at).toBe(new Date(clock).toISOString());
 await c.more();expect(c.snapshot().items).toHaveLength(105);expect(c.snapshot().cursor).toBeNull();
});

it('retains loaded page depth on refresh, and publishes no partial data when a later page fails',async()=>{
 seed(105);const api=client(first);let fail=false;
 const c=new InboxController((p,o)=>{if(fail&&p.includes('cursor='))throw new ApiFailure(0,'NETWORK_ERROR','Offline');return api(p,o);});
 await c.refresh();await c.more();const before=c.snapshot();seed(1);fail=true;
 expect(await c.refresh()).toBe(false);expect(c.snapshot().items).toBe(before.items);expect(c.snapshot().cursor).toBe(before.cursor);expect(c.snapshot().unread).toBe(105);expect(c.snapshot().stale).toBe(true);expect(await c.more()).toBe(false);
 fail=false;expect(await c.refresh()).toBe(true);expect(c.snapshot().items).toHaveLength(100);expect(c.snapshot().unread).toBe(106);expect(c.snapshot().stale).toBe(false);expect(c.snapshot().items[0].id).toBeGreaterThan(before.items[0].id);
});

it('retains pagination cursor after a load-more failure and retries the same older range once',async()=>{
 seed(55);const api=client(first);let fail=true;const c=new InboxController((p,o)=>{if(fail&&p.includes('cursor='))throw new ApiFailure(0,'NETWORK_ERROR','Offline');return api(p,o);});
 await c.refresh();const before=c.snapshot();expect(await c.more()).toBe(false);expect(c.snapshot().items).toBe(before.items);expect(c.snapshot().cursor).toBe(before.cursor);
 fail=false;expect(await c.more()).toBe(true);expect(new Set(c.snapshot().items.map(x=>x.id)).size).toBe(55);expect(c.snapshot().cursor).toBeNull();
});

it('suppresses double taps and overlapping refreshes while a read acknowledgement is pending',async()=>{
 seed(2);const api=client(first),started=Promise.withResolvers<void>(),release=Promise.withResolvers<void>();let writes=0;
 const c=new InboxController(async(p,o)=>{if(o?.method==='PATCH'){writes++;started.resolve();await release.promise;}return api(p,o);});
 await c.refresh();const id=c.snapshot().items[0].id;const work=c.markRead(id);await started.promise;
 expect(await c.markRead(id)).toBe(false);expect(await c.refresh()).toBe(false);expect(await c.more()).toBe(false);expect(c.snapshot().unread).toBe(2);
 release.resolve();expect(await work).toBe(true);expect(writes).toBe(1);expect(c.snapshot().unread).toBe(1);
});

it('retries a lost read acknowledgement idempotently after restart without changing the first read timestamp',async()=>{
 seed(2);const api=client(first);let writes=0;const c=new InboxController(async(p,o)=>{const result=await api(p,o);if(o?.method==='PATCH'&&++writes===1)throw new ApiFailure(0,'NETWORK_ERROR','Lost acknowledgement');return result;});
 await c.refresh();const id=c.snapshot().items[0].id,other=c.snapshot().items[1].id,originalTime=new Date(clock).toISOString();
 expect(await c.markRead(id)).toBe(false);expect(c.snapshot().pendingRead).toBe(id);expect(c.snapshot().items[0].read_at).toBeNull();expect(c.snapshot().unread).toBe(2);expect(await c.markRead(other)).toBe(false);
 await app.close();clock+=1000;app=createProductApp({dataDir:dir,now:()=>clock});
 expect(await c.markRead(id)).toBe(true);expect(c.snapshot().items[0].read_at).toBe(originalTime);expect(c.snapshot().unread).toBe(1);expect(c.snapshot().pendingRead).toBeNull();expect(writes).toBe(2);
});

it('can reconcile an uncertain read through GET-only refresh without replaying the write',async()=>{
 seed(1);const api=client(first);let writes=0;const c=new InboxController(async(p,o)=>{const result=await api(p,o);if(o?.method==='PATCH'){writes++;throw new ApiFailure(0,'NETWORK_ERROR','Lost acknowledgement');}return result;});
 await c.refresh();const id=c.snapshot().items[0].id;await c.markRead(id);expect(c.snapshot().pendingRead).toBe(id);
 expect(await c.refresh()).toBe(true);expect(c.snapshot()).toMatchObject({pendingRead:null,unread:0,notice:'checked'});expect(c.snapshot().items[0].read_at).not.toBeNull();expect(writes).toBe(1);
});

it('rejects malformed successful read/page payloads instead of inventing read status or discarding records',async()=>{
 seed(55);const api=client(first);let malformed=false;
 const c=new InboxController(async<T,>(p:string,o?:RequestOptions):Promise<T>=>{const result=await api(p,o);if(o?.method==='PATCH')return {...result,id:result.id+1} as T;if(malformed)return {...result,next_cursor:999999} as T;return result;});
 await c.refresh();const before=c.snapshot();expect(await c.markRead(before.items[0].id)).toBe(false);expect(c.snapshot().items).toBe(before.items);expect(c.snapshot().error).toMatchObject({code:'INVALID_READ_RESPONSE'});
 malformed=true;expect(await c.refresh()).toBe(false);expect(c.snapshot().items).toBe(before.items);expect(c.snapshot().pendingRead).toBe(before.items[0].id);
 malformed=false;expect(await c.refresh()).toBe(true);expect(c.snapshot().items[0].read_at).not.toBeNull();
});

it('keeps authoritative read acknowledgements owner-scoped and repeated reads stable',async()=>{
 seed(2);seed(1,otherOwner);const api=client(first),other=client(second);const page=await api<InboxPage>('/me/notifications'),id=page.items[0].id;
 await expect(other(`/me/notifications/${id}/read`,{method:'PATCH',body:{}})).rejects.toMatchObject({status:404});
 expect((await api<InboxPage>('/me/notifications')).unread).toBe(2);
 const saved=await api<NotificationRead>(`/me/notifications/${id}/read`,{method:'PATCH',body:{}});clock+=5000;
 expect(await api(`/me/notifications/${id}/read`,{method:'PATCH',body:{}})).toEqual(saved);expect(saved).toMatchObject({id,read:true,unread:1});expect((await other<InboxPage>('/me/notifications')).unread).toBe(1);
});

it('marks every owned notification read in one step without touching other accounts',async()=>{
 seed(3);seed(2,otherOwner);const c=new InboxController(client(first));
 await c.refresh();expect(c.snapshot().unread).toBe(3);
 expect(await c.markAll()).toBe(true);expect(c.snapshot().unread).toBe(0);expect(c.snapshot().items.every(x=>x.read_at!==null)).toBe(true);
 expect(await c.markAll()).toBe(false);
 expect((await client(first)<InboxPage>('/me/notifications')).unread).toBe(0);expect((await client(second)<InboxPage>('/me/notifications')).unread).toBe(2);
});

it('ignores late callbacks after the account-bound controller is invalidated',async()=>{
 seed(2);const api=client(first),release=Promise.withResolvers<void>(),started=Promise.withResolvers<void>();
 const c=new InboxController(async(p,o)=>{if(o?.method==='PATCH'){started.resolve();await release.promise;}return api(p,o);});
 await c.refresh();const work=c.markRead(c.snapshot().items[0].id);await started.promise;c.invalidate();const afterUnmount=c.snapshot();
 const next=new InboxController(client(second));await next.refresh();expect(next.snapshot().items).toEqual([]);
 release.resolve();expect(await work).toBe(false);expect(c.snapshot()).toBe(afterUnmount);expect(next.snapshot().unread).toBe(0);
});

it('refreshes message destinations from authoritative visibility after the linked post is removed',async()=>{
 const api=client(first),other=client(second);const post=await api('/posts',{method:'POST',body:{kind:'help',title:'Local inbox test',body:'Local test question',visibility:'public'}});
 await other(`/posts/${post.id}/replies`,{method:'POST',body:{body:'Local test reply'}});
 const c=new InboxController(api);await c.refresh();expect(c.snapshot().items[0].post?.id).toBe(post.id);
 await api(`/posts/${post.id}`,{method:'DELETE',body:{version:post.version}});expect(await c.refresh()).toBe(true);expect(c.snapshot().items[0].post).toBeNull();expect(c.snapshot().items[0].activity).toBeNull();
});

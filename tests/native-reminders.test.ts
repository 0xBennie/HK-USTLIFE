import {it,expect,vi} from 'vitest';
import {ReminderController,type NotificationPort,type ReminderContext} from '../apps/mobile/src/reminders/controller';
import type {Reminder,ReminderFeed} from '../src/product/reminders/projection';
import {reminderTarget} from '../apps/mobile/src/reminders/target';
const time=Date.parse('2026-10-03T00:00:00Z');
const item:Reminder={id:'task-1',fires_at:'2026-10-03T01:00:00Z',target_at:'2026-10-03T01:10:00Z',kind:'task',title:'Private task',target:{kind:'study',id:'task-1'}};
function fixture(){
 let context:ReminderContext|null={owner:'alice',language:'en'};
 const pending=new Map<string,{owned:boolean;item?:Reminder}>();
 const prefs=new Map<string,boolean>([['alice',true],['bob',false]]);
 let feed:ReminderFeed={owner_id:'alice',generated_at:new Date(time).toISOString(),through:'2026-10-17T00:00:00Z',limit:60,deferred:0,items:[item],import_issues:[]};
 const os:NotificationPort={list:vi.fn(async()=>[...pending].map(([id,x])=>({id,owned:x.owned}))),cancel:vi.fn(async id=>{pending.delete(id);}),dismissOwned:vi.fn(async()=>{}),permission:vi.fn(async()=> 'granted'),schedule:vi.fn(async (item,owner)=>{const id=owner.owner+':'+item.id;pending.set(id,{owned:true,item});return id;})};
 const fetch=vi.fn(async()=>feed);
 const controller=new ReminderController({os,context:()=>context,fetch,read:async owner=>prefs.get(owner)??false,write:async(owner,value)=>{prefs.set(owner,value);},now:()=>time});
 return {controller,os,pending,prefs,fetch,setContext:(next:ReminderContext|null)=>{context=next;},setFeed:(next:ReminderFeed)=>{feed=next;},feed};
}
it('replaces moved reminders and removes cancelled ones without touching unrelated schedules',async()=>{
 const f=fixture();f.pending.set('other',{owned:false});await f.controller.refresh();expect(f.pending.get('alice:task-1')?.item?.fires_at).toBe(item.fires_at);
 f.setFeed({...f.feed,items:[{...item,fires_at:'2026-10-03T02:00:00Z'}]});await f.controller.refresh();expect(f.pending.get('alice:task-1')?.item?.fires_at).toBe('2026-10-03T02:00:00Z');
 f.setFeed({...f.feed,items:[]});await f.controller.refresh();expect([...f.pending.keys()]).toEqual(['other']);expect(f.controller.snapshot()).toMatchObject({phase:'ready',scheduled:0});
});
it('does not request permission or fetch private reminders until explicitly enabled',async()=>{
 const f=fixture();f.prefs.set('alice',false);await f.controller.refresh();expect(f.os.permission).not.toHaveBeenCalled();expect(f.fetch).not.toHaveBeenCalled();
 await f.controller.refresh('enable');expect(f.os.permission).toHaveBeenCalledWith(true);expect(f.controller.snapshot().scheduled).toBe(1);
 await f.controller.refresh('disable');expect(f.prefs.get('alice')).toBe(false);expect(f.pending.size).toBe(0);
 vi.mocked(f.os.permission).mockResolvedValue('denied');await f.controller.refresh('enable');expect(f.controller.snapshot()).toMatchObject({phase:'denied',enabled:false,scheduled:0});
});
it('cannot recreate reminders after logout while a server result is in flight',async()=>{
 const f=fixture();let resolve!:(value:ReminderFeed)=>void;
 const started=Promise.withResolvers<void>();f.fetch.mockImplementationOnce(()=>{started.resolve();return new Promise(r=>{resolve=r;});});
 const first=f.controller.refresh();await started.promise;
 f.setContext(null);const logout=f.controller.refresh();resolve(f.feed);await Promise.all([first,logout]);
 expect(f.os.schedule).not.toHaveBeenCalled();expect(f.pending.size).toBe(0);expect(f.controller.snapshot().phase).toBe('disabled');
});
it('cancels an OS schedule that finishes after switching to another account',async()=>{
 const f=fixture();const started=Promise.withResolvers<void>(),release=Promise.withResolvers<void>();
 vi.mocked(f.os.schedule).mockImplementationOnce(async(item,owner)=>{started.resolve();await release.promise;const id=owner.owner+':'+item.id;f.pending.set(id,{owned:true,item});return id;});
 const first=f.controller.refresh();await started.promise;f.setContext({owner:'bob',language:'en'});const switched=f.controller.refresh();release.resolve();await Promise.all([first,switched]);
 expect(f.pending.size).toBe(0);expect(f.controller.snapshot()).toMatchObject({phase:'disabled',enabled:false});
});
it('cleans partial queues on failure and exposes unsuccessful cleanup rather than claiming success',async()=>{
 const f=fixture();await f.controller.refresh();f.fetch.mockRejectedValueOnce(new Error('Offline'));await f.controller.refresh('invalidate');expect(f.pending.size).toBe(0);expect(f.controller.snapshot()).toMatchObject({phase:'error',cleanupPending:false,stale:false});
 f.pending.set('old',{owned:true});vi.mocked(f.os.cancel).mockRejectedValue(new Error('OS unavailable'));await f.controller.refresh('invalidate');expect(f.controller.snapshot()).toMatchObject({phase:'error',cleanupPending:true});expect(f.pending.has('old')).toBe(true);
});
it('leaves room for unrelated pending notifications and reports unscheduled reminders',async()=>{
 const f=fixture();for(let i=0;i<63;i++)f.pending.set('other-'+i,{owned:false});
 f.setFeed({...f.feed,items:[item,{...item,id:'task-2'}]});await f.controller.refresh();expect(f.controller.snapshot()).toMatchObject({scheduled:1,deferred:1});expect(f.pending.size).toBe(64);
});
it('rejects a feed belonging to another account',async()=>{
 const f=fixture();f.setFeed({...f.feed,owner_id:'bob'});await f.controller.refresh();expect(f.os.schedule).not.toHaveBeenCalled();expect(f.controller.snapshot().phase).toBe('error');
});
it('keeps an opt-out when OS cancellation fails, so a later sync cannot enable it again',async()=>{
 const f=fixture();await f.controller.refresh();
 vi.mocked(f.os.cancel).mockRejectedValue(new Error('OS unavailable'));
 await f.controller.refresh('disable');expect(f.prefs.get('alice')).toBe(false);expect(f.controller.snapshot()).toMatchObject({enabled:false,cleanupPending:true});
 vi.mocked(f.os.cancel).mockImplementation(async id=>{f.pending.delete(id);});
 await f.controller.refresh();expect(f.controller.snapshot()).toMatchObject({phase:'disabled',scheduled:0});expect(f.pending.size).toBe(0);
});
it('does not report success if the OS silently discards a requested reminder',async()=>{
 const f=fixture();vi.mocked(f.os.schedule).mockResolvedValue('missing');
 await f.controller.refresh();expect(f.controller.snapshot()).toMatchObject({phase:'error',scheduled:0});
});
it('notification taps cannot route into another account or an arbitrary URL',()=>{
 const data={owner:'alice',target:item.target,target_at:'2026-10-03T23:00:00Z'};
 expect(reminderTarget(data,'alice')).toEqual({kind:'study',id:'task-1',date:'2026-10-04'});
 expect(reminderTarget(data,'bob')).toBeNull();expect(reminderTarget(data,null)).toBeNull();
 expect(reminderTarget({...data,target:{kind:'url',id:'https://example.test'}},'alice')).toBeNull();
 expect(reminderTarget({...data,target_at:'invalid'},'alice')).toBeNull();
});

it('preserves the last queue when an ordinary foreground refresh is offline, but marks it stale',async()=>{
 const f=fixture();await f.controller.refresh();
 f.fetch.mockRejectedValueOnce(new Error('Offline'));await f.controller.refresh();
 expect(f.pending.has('alice:task-1')).toBe(true);expect(f.controller.snapshot()).toMatchObject({phase:'error',stale:true,scheduled:1});
});

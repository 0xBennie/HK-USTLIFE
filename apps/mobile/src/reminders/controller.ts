import type {Reminder,ReminderFeed} from '../../../../src/product/reminders/projection';
export type ReminderContext={owner:string;language:'zh'|'en'};
export type Permission='granted'|'denied'|'undetermined';
export type NotificationPort={
 list():Promise<{id:string;owned:boolean}[]>;
 cancel(id:string):Promise<void>;
 dismissOwned():Promise<void>;
 permission(request:boolean):Promise<Permission>;
 schedule(item:Reminder,context:ReminderContext):Promise<string>;
};
export type ReminderState={phase:'idle'|'syncing'|'disabled'|'denied'|'ready'|'error';enabled:boolean;scheduled:number;deferred:number;warnings:number;through:string|null;lastSync:string|null;cleanupPending:boolean;stale:boolean};
/** Serial OS writes and generation checks prevent an obsolete account/feed from scheduling. */
export class ReminderController {
 private revision=0;
 private lastOwner:string|null=null;
 private invalidated=new Set<string>();
 private tail:Promise<void>=Promise.resolve();
 private listeners=new Set<()=>void>();
 private state:ReminderState={phase:'idle',enabled:false,scheduled:0,deferred:0,warnings:0,through:null,lastSync:null,cleanupPending:false,stale:false};
 constructor(private dependencies:{os:NotificationPort;context:()=>ReminderContext|null;fetch:()=>Promise<ReminderFeed>;read:(owner:string)=>Promise<boolean>;write:(owner:string,value:boolean)=>Promise<void>;now?:()=>number}){}
 snapshot=()=>this.state;
 subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
 private publish(change:Partial<ReminderState>){this.state={...this.state,...change};for(const listener of this.listeners)listener();}
 refresh=(mode:'sync'|'enable'|'disable'|'invalidate'='sync')=>{
  const revision=++this.revision,context=this.dependencies.context();
  if(context&&mode==='invalidate')this.invalidated.add(context.owner);
  this.publish({phase:'syncing',cleanupPending:false});
  const run=this.tail.then(()=>this.reconcile(revision,context,mode));
  this.tail=run.catch(()=>{});return run;
 };
 private async clear(){
  const items=await this.dependencies.os.list();
  for(const item of items)if(item.owned)await this.dependencies.os.cancel(item.id);
  await this.dependencies.os.dismissOwned();
  return items.filter(item=>!item.owned).length;
 }
 private async reconcile(revision:number,context:ReminderContext|null,mode:'sync'|'enable'|'disable'|'invalidate'){
  const current=()=>revision===this.revision&&context?.owner===this.dependencies.context()?.owner;
  if(!current())return;
  const {os}=this.dependencies;
  let changedQueue=false;
  const clearQueue=async()=>{changedQueue=true;return this.clear();};
  try {
   // Persist the opt-out before touching OS state so a failed cancellation cannot re-enable it.
   if(context&&mode==='disable'){
    await this.dependencies.write(context.owner,false);if(!current())return;
    this.publish({enabled:false});
   }
   let unrelated=0;
   // Identity changes and known writes invalidate old schedules; ordinary offline refreshes do not.
   const purge=!context||mode==='disable'||this.lastOwner!==context.owner||this.invalidated.has(context.owner);
   if(purge){unrelated=await clearQueue();if(!current())return;this.lastOwner=context?.owner??null;if(context)this.invalidated.delete(context.owner);this.publish({scheduled:0,deferred:0,warnings:0,through:null,stale:false});}
   if(!context){this.publish({phase:'disabled',enabled:false});return;}
   let enabled=await this.dependencies.read(context.owner);if(!current())return;
   if(mode==='disable'){this.publish({phase:'disabled',enabled:false});return;}
   if(mode==='enable')enabled=true;
   if(!enabled){if(!changedQueue)await clearQueue();if(!current())return;this.publish({phase:'disabled',enabled:false,scheduled:0,stale:false});return;}
   const permission=await os.permission(mode==='enable');if(!current())return;
   if(permission!=='granted'){if(!changedQueue)await clearQueue();if(!current())return;this.publish({phase:'denied',enabled:false,scheduled:0,stale:false});return;}
   if(mode==='enable'){await this.dependencies.write(context.owner,true);if(!current())return;}
   this.publish({enabled:true});
   const feed=await this.dependencies.fetch();if(!current())return;
   if(feed.owner_id!==context.owner||!Array.isArray(feed.items))throw new Error('Invalid reminder owner');
   if(!changedQueue){unrelated=await clearQueue();if(!current())return;}
   const now=(this.dependencies.now??Date.now)();
   const capacity=Math.max(0,Math.min(60,64-unrelated));
   const future=feed.items.filter(item=>Date.parse(item.fires_at)>now);
   const scheduled:{id:string;fires:number}[]=[];
   for(const item of future.slice(0,capacity)){
    if(!current())return;
    if(Date.parse(item.fires_at)<=(this.dependencies.now??Date.now)())continue;
    const id=await os.schedule(item,context);
    if(!current()){await os.cancel(id);return;}
    scheduled.push({id,fires:Date.parse(item.fires_at)});
   }
   const accepted=new Set((await os.list()).map(item=>item.id));if(!current())return;
   const pending=scheduled.filter(item=>item.fires>(this.dependencies.now??Date.now)());
   if(pending.some(item=>!accepted.has(item.id)))throw new Error('OS did not retain the requested queue');
   this.publish({phase:'ready',scheduled:pending.length,deferred:feed.deferred+Math.max(0,future.length-capacity),warnings:feed.import_issues.length+(feed.school_issues?.length??0),through:feed.through,lastSync:feed.generated_at,cleanupPending:false,stale:false});
  }catch{
   let cleanupPending=false;
   if(changedQueue){try{await this.clear();}catch{cleanupPending=true;}}
   if(current())this.publish({phase:'error',...(changedQueue?{scheduled:0}:{}),cleanupPending,stale:!changedQueue&&this.state.scheduled>0});
  }
 }
}

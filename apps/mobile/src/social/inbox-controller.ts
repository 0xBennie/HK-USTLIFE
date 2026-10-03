import {ApiFailure,type RequestOptions} from '../api';
import type {ActivityNotification,NotificationRead} from '../../../../src/product/social/types';

export type InboxPage={items:ActivityNotification[];next_cursor:number|null;unread:number};
export type InboxSnapshot={
 items:ActivityNotification[];cursor:number|null;unread:number;
 phase:'idle'|'refreshing'|'loading-more'|'marking';
 error:unknown;stale:boolean;loaded:boolean;pendingRead:number|null;
 notice:'read'|'checked'|null;
};
const integer=(n:unknown):n is number=>typeof n==='number'&&Number.isSafeInteger(n)&&n>=0;
const timestamp=(value:unknown):value is string=>typeof value==='string'&&Number.isFinite(Date.parse(value));
function pageValid(page:InboxPage,before?:number){
 if(!page||!Array.isArray(page.items)||!integer(page.unread)||!(page.next_cursor===null||integer(page.next_cursor)&&page.next_cursor>0))return false;
 let previous=before??Number.MAX_SAFE_INTEGER;
 for(const item of page.items){
  if(!item||!integer(item.id)||item.id===0||item.id>=previous||!timestamp(item.created_at)||!(item.read_at===null||timestamp(item.read_at)))return false;
  previous=item.id;
 }
 return page.next_cursor===null||page.items.length>0&&page.next_cursor===previous;
}

/** Account-scoped list state. Only server acknowledgements change read status. */
export class InboxController {
 private state:InboxSnapshot={items:[],cursor:null,unread:0,phase:'idle',error:null,stale:false,loaded:false,pendingRead:null,notice:null};
 private pages=0;
 private epoch=0;
 private listeners=new Set<()=>void>();
 constructor(private request:<T>(path:string,options?:RequestOptions)=>Promise<T>){}
 snapshot=()=>this.state;
 subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
 private set(patch:Partial<InboxSnapshot>){this.state={...this.state,...patch};this.listeners.forEach(listener=>listener());}
 /** Reject late callbacks after unmount; the next account gets a new instance. */
 invalidate(){this.epoch++;this.set({phase:'idle'});}
 private async page(before?:number){
  const result=await this.request<InboxPage>('/me/notifications'+(before===undefined?'':`?cursor=${before}`));
  if(!pageValid(result,before))throw new ApiFailure(502,'INVALID_INBOX_RESPONSE','Invalid notification page.');
  return result;
 }
 async refresh(){
  if(this.state.phase!=='idle')return false;
  const epoch=++this.epoch,targetPages=Math.max(1,this.pages);
  this.set({phase:'refreshing',error:null,notice:null});
  try{
   const items:ActivityNotification[]=[];let cursor:number|null=null,unread=0,readPages=0;
   // Keep the loaded depth on return. Publish only after every page succeeds.
   for(let i=0;i<targetPages;i++){
    const page=await this.page(cursor??undefined);if(epoch!==this.epoch)return false;
    items.push(...page.items);cursor=page.next_cursor;unread=page.unread;readPages++;
    if(cursor===null)break;
   }
   const pending=this.state.pendingRead,checked=pending!==null&&items.some(x=>x.id===pending);
   this.pages=readPages;
   this.set({items,cursor,unread,loaded:true,stale:false,error:null,pendingRead:checked?null:pending,notice:checked?'checked':null});return true;
  }catch(error){if(epoch===this.epoch)this.set({error,stale:this.state.loaded});return false;}
  finally{if(epoch===this.epoch)this.set({phase:'idle'});}
 }
 async more(){
  if(this.state.phase!=='idle'||this.state.cursor===null||this.state.stale)return false;
  const epoch=++this.epoch,cursor=this.state.cursor;
  this.set({phase:'loading-more',error:null,notice:null});
  try{
   const page=await this.page(cursor);if(epoch!==this.epoch)return false;
   this.pages++;this.set({items:[...this.state.items,...page.items],cursor:page.next_cursor,unread:page.unread});return true;
  }catch(error){if(epoch===this.epoch)this.set({error});return false;}
  finally{if(epoch===this.epoch)this.set({phase:'idle'});}
 }
 async markRead(id:number){
  if(this.state.phase!=='idle'||this.state.pendingRead!==null&&this.state.pendingRead!==id)return false;
  const record=this.state.items.find(item=>item.id===id);
  if(this.state.pendingRead!==id&&(!record||record.read_at!==null))return false;
  const epoch=++this.epoch;
  this.set({phase:'marking',pendingRead:id,error:null,notice:null});
  try{
   const ack=await this.request<NotificationRead>(`/me/notifications/${id}/read`,{method:'PATCH',body:{}});
   if(epoch!==this.epoch)return false;
   if(ack?.id!==id||ack.read!==true||!timestamp(ack.read_at)||!integer(ack.unread))throw new ApiFailure(502,'INVALID_READ_RESPONSE','Missing notification read acknowledgement.');
   this.set({items:this.state.items.map(item=>item.id===id?{...item,read_at:ack.read_at}:item),unread:ack.unread,pendingRead:null,notice:'read'});return true;
  }catch(error){
   if(epoch===this.epoch){const rejected=error instanceof ApiFailure&&error.status>=400&&error.status<500;this.set({error,pendingRead:rejected?null:id});}
   return false;
  }finally{if(epoch===this.epoch)this.set({phase:'idle'});}
 }
}

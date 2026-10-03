import {ApiFailure,type RequestOptions} from '../api';
import {protectionFor} from '../navigation/protection';
export type CampusTarget={target_kind:'place'|'shuttle';target_id:string};
export type CampusCorrection=CampusTarget&{id:string;message:string;status:'pending'|'resolved'|'rejected';resolution:string;version:number};
type Pending={kind:'bookmark';saved:boolean}|{kind:'correction';message:string;key:string};
type Snapshot={saved:boolean;loaded:boolean;stale:boolean;busy:boolean;writing:boolean;draft:string;requests:CampusCorrection[];pending:Pending|null;error:unknown;notice:'bookmark-saved'|'correction-saved'|null};
const object=(v:unknown):v is Record<string,unknown>=>Boolean(v)&&typeof v==='object'&&!Array.isArray(v);
const targetValid=(v:unknown):v is CampusTarget&Record<string,unknown>=>object(v)&&['place','shuttle'].includes(String(v.target_kind))&&typeof v.target_id==='string'&&v.target_id.length>0;
const correctionValid=(v:unknown):v is CampusCorrection=>targetValid(v)&&object(v)&&typeof v.id==='string'&&v.id.length>0&&typeof v.message==='string'&&['pending','resolved','rejected'].includes(String(v.status))&&typeof v.resolution==='string'&&Number.isSafeInteger(v.version)&&Number(v.version)>0;
const invalid=()=>new ApiFailure(502,'INVALID_CAMPUS_RESPONSE','Personal campus record could not be confirmed.');

/** One mounted account + target. Draft and pending receipt are memory-only. */
export class CampusActionsController {
 private state:Snapshot={saved:false,loaded:false,stale:false,busy:false,writing:false,draft:'',requests:[],pending:null,error:null,notice:null};
 private epoch=0;
 private listeners=new Set<()=>void>();
 constructor(private target:CampusTarget,private request:(path:string,options?:RequestOptions)=>Promise<unknown>,private newKey:()=>string){}
 snapshot=()=>this.state;
 subscribe=(fn:()=>void)=>{this.listeners.add(fn);return()=>{this.listeners.delete(fn);};};
 private set(patch:Partial<Snapshot>){this.state={...this.state,...patch};this.listeners.forEach(fn=>fn());}
 protection=()=>protectionFor(Boolean(this.state.draft),this.state.writing,Boolean(this.state.pending));
 invalidate(){this.epoch++;this.set({busy:false,writing:false});}
 edit(value:string){if(!this.state.writing&&!this.state.pending)this.set({draft:value,notice:null,error:null});}
 private same(v:CampusTarget){return v.target_kind===this.target.target_kind&&v.target_id===this.target.target_id;}
 private async read(){
  const [marks,history]=await Promise.all([this.request('/me/campus/bookmarks'),this.request('/me/campus/corrections')]);
  if(!Array.isArray(marks)||!marks.every(targetValid)||!Array.isArray(history)||!history.every(correctionValid))throw invalid();
  return {saved:marks.some(v=>this.same(v)),requests:history.filter(v=>this.same(v)),loaded:true,stale:false};
 }
 async refresh(){
  if(this.state.busy)return false;const epoch=++this.epoch;this.set({busy:true,error:null});
  try{const value=await this.read();if(epoch!==this.epoch)return false;this.set(value);return true;}
  catch(error){if(epoch===this.epoch)this.set({error,stale:true});return false;}
  finally{if(epoch===this.epoch)this.set({busy:false});}
 }
 async toggleBookmark(){
  if(!this.state.loaded||this.state.stale||this.state.pending||this.state.busy)return false;
  return this.write({kind:'bookmark',saved:!this.state.saved});
 }
 async submitCorrection(){
  if(this.state.pending||this.state.busy)return false;
  return this.write({kind:'correction',message:this.state.draft.trim(),key:this.newKey()});
 }
 async retry(){if(this.state.busy||!this.state.pending)return false;return this.write(this.state.pending);}
 private async write(pending:Pending){
  const epoch=++this.epoch;let accepted=false;
  this.set({busy:true,writing:true,pending,error:null,notice:null});
  try{
   const value=pending.kind==='bookmark'?await this.request('/me/campus/bookmarks',{method:pending.saved?'PUT':'DELETE',body:this.target}):
    await this.request('/campus/corrections',{method:'POST',body:{...this.target,message:pending.message},idempotencyKey:pending.key});
   if(epoch!==this.epoch)return false;
   if(pending.kind==='bookmark'){
    if(!targetValid(value)||!this.same(value)||!object(value)||value.saved!==pending.saved)throw invalid();
    this.set({saved:pending.saved,pending:null,notice:'bookmark-saved'});
   }else{
    if(!correctionValid(value)||!this.same(value)||value.message!==pending.message)throw invalid();
    this.set({draft:'',requests:[value,...this.state.requests.filter(v=>v.id!==value.id)],pending:null,notice:'correction-saved'});
   }
   accepted=true;
   const fresh=await this.read();if(epoch!==this.epoch)return false;this.set(fresh);return true;
  }catch(error){
   if(epoch!==this.epoch)return false;
   const rejected=!accepted&&error instanceof ApiFailure&&error.status>=400&&error.status<500;
   this.set({error,stale:true,...(rejected?{pending:null}:{})});
   return accepted;
  }finally{if(epoch===this.epoch)this.set({busy:false,writing:false});}
 }
}

import {ApiFailure,type RequestOptions} from '../api';
type State={phase:'ready'|'saving'|'uncertain'|'error'|'saved';id:string|null;error:unknown};
/** Retry key is retained for this deliberate create action; never rotated after timeout. */
export class CreateAffairController{
 private state:State={phase:'ready',id:null,error:null};private disposed=false;private epoch=0;private listeners=new Set<()=>void>();
 constructor(private template:string,private revision:number,private key:string,private request:(path:string,options?:RequestOptions)=>Promise<unknown>){}
 snapshot=()=>this.state;subscribe=(fn:()=>void)=>{this.listeners.add(fn);return()=>{this.listeners.delete(fn);};};
 private set(p:Partial<State>){this.state={...this.state,...p};this.listeners.forEach(fn=>fn());}
 dispose(){this.disposed=true;this.epoch++;this.set({phase:'ready',id:null,error:null});this.listeners.clear();}
 async save(){if(this.disposed||!['ready','uncertain'].includes(this.state.phase))return false;const epoch=++this.epoch;this.set({phase:'saving',error:null});
 try{const result=await this.request('/me/affairs',{method:'POST',body:{template_id:this.template,revision:this.revision},idempotencyKey:this.key});if(epoch!==this.epoch)return false;
 const v=result as {id?:unknown;template_id?:unknown;accepted_revision?:unknown;official_status?:{status?:unknown;reason?:unknown}};
 if(!v||typeof v.id!=='string'||!v.id||v.template_id!==this.template||!Number.isSafeInteger(v.accepted_revision)||Number(v.accepted_revision)<this.revision||v.official_status?.status!=='unknown'||v.official_status.reason!=='not_connected')throw new ApiFailure(502,'INVALID_AFFAIR_RESPONSE','Unconfirmed create result');
 this.set({phase:'saved',id:v.id});return true;
 }catch(error){if(epoch!==this.epoch)return false;this.set({phase:error instanceof ApiFailure&&error.status>=400&&error.status<500?'error':'uncertain',error});return false;}}
}

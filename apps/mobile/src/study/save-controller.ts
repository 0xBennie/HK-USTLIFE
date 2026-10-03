import {ApiFailure,type RequestOptions} from '../api';
import {ensureReplayable,writeRejected,writeReceipt} from '../write-receipt';
import {validStudySave} from './save-response';
export type StudyWrite={path:string;method:'POST'|'PATCH';body:Record<string,unknown>};
export type StudySaveState={phase:'idle'|'submitting'|'uncertain'|'rejected'|'saved';error:unknown};
/** Freeze the original request across uncertain network responses and synchronous double taps. */
export class StudySaveController {
 private state:StudySaveState={phase:'idle',error:null};
 private pending:(StudyWrite&{key:string;createdAt:number})|null=null;
 private listeners=new Set<()=>void>();
 constructor(private request:(path:string,options:RequestOptions)=>Promise<unknown>,private newKey:()=>string,private now:()=>number=Date.now){}
 snapshot=()=>this.state;
 subscribe=(fn:()=>void)=>{this.listeners.add(fn);return()=>{this.listeners.delete(fn);};};
 private publish(state:StudySaveState){this.state=state;this.listeners.forEach(fn=>fn());}
 async submit(write?:StudyWrite):Promise<boolean>{
  if(this.state.phase==='submitting'||this.state.phase==='saved')return false;
  if(!this.pending){if(!write)return false;this.pending={...write,...writeReceipt(write.body,this.newKey(),this.now())};}
  const receipt=this.pending;
  // Server creation receipts live for 24 hours. Stop before expiry rather than silently create again.
  try{ensureReplayable(receipt,receipt.method,this.now());}catch(error){this.publish({phase:'uncertain',error});return false;}
  this.publish({phase:'submitting',error:null});
  try{
   const result=await this.request(receipt.path,{method:receipt.method,body:receipt.body,idempotencyKey:receipt.key});
   if(!validStudySave(receipt,result))throw new ApiFailure(502,'INVALID_RESPONSE','The saved record could not be confirmed.');
   this.pending=null;this.publish({phase:'saved',error:null});return true;
  }catch(error){
   const rejected=writeRejected(error);
   if(rejected)this.pending=null;
   this.publish({phase:rejected?'rejected':'uncertain',error});return false;
  }
 }
}

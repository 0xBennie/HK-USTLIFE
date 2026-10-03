import {writeReceipt,ensureReplayable,writeRejected,reviewRequired,type WriteReceipt} from '../write-receipt';
import type {Activity} from '../../../../src/product/social/types';
import {ApiFailure,type RequestOptions} from '../api';
export type JoinSnapshot = {
 phase:'idle'|'review'|'submitting'|'uncertain'|'rejected'|'result';
 activity:Activity|null; saveCalendar:boolean; error:unknown;
};
type Receipt=WriteReceipt<{activity_version:number;save_calendar:boolean}>;
/** Keeps the reviewed payload and retry key together. No optimistic participation. */
export class ActivityJoinController {
 private state:JoinSnapshot={phase:'idle',activity:null,saveCalendar:false,error:null};
 private receipt:Receipt|null=null;
 private listeners=new Set<()=>void>();
 constructor(private request:<T>(path:string,options?:RequestOptions)=>Promise<T>,private newKey:()=>string,private now:()=>number=Date.now){}
 snapshot=()=>this.state;
 subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
 private set(patch:Partial<JoinSnapshot>){this.state={...this.state,...patch};this.listeners.forEach(listener=>listener());}
 review(activity:Activity){if(this.receipt||this.state.phase==='submitting')return;this.set({phase:'review',activity,saveCalendar:activity.mine?.calendar_saved??false,error:null});}
 setCalendar(value:boolean){if(this.state.phase==='review')this.set({saveCalendar:value});}
 async submit(){
  const {activity,phase,saveCalendar}=this.state;
  if(!activity||(phase!=='review'&&phase!=='uncertain'))return;
  this.receipt??=writeReceipt({activity_version:activity.version,save_calendar:saveCalendar},this.newKey(),this.now());
  const receipt=this.receipt;
  this.set({phase:'submitting',error:null});
  try{
   ensureReplayable(receipt,'POST',this.now());
   const result=await this.request<Activity>(`/activities/${activity.id}/join`,{method:'POST',body:receipt.body,idempotencyKey:receipt.key});
   const status=result?.mine?.participation?.status;
   if(result?.id!==activity.id||!status||!['confirmed','waitlisted','withdrawn','cancelled'].includes(status))throw new ApiFailure(502,'INVALID_JOIN_RESPONSE','Missing authoritative participation result.');
   this.receipt=null;this.set({phase:'result',activity:result,error:null});
  }catch(error){
   const rejected=writeRejected(error);
   if(rejected)this.receipt=null;
   this.set({phase:rejected?'rejected':'uncertain',error});
  }
 }
 /** Read-only recovery after the retry window. Never silently signs the user up again. */
 async checkCurrent(){
  if(this.state.phase!=='uncertain'||!reviewRequired(this.state.error)||!this.state.activity)return;
  const id=this.state.activity.id;this.set({phase:'submitting',error:null});
  try{
   const result=await this.request<Activity>(`/activities/${id}`);
   if(result?.id!==id||!result.mine||typeof result.mine!=='object'||typeof result.mine.calendar_saved!=='boolean'||!('participation' in result.mine)||!Number.isInteger(result.version))throw new ApiFailure(502,'INVALID_JOIN_RESPONSE','Missing authoritative activity result.');
   const status=result.mine.participation?.status;
   if(result.mine.participation!==null&&(!status||!['confirmed','waitlisted','withdrawn','cancelled'].includes(status)))throw new ApiFailure(502,'INVALID_JOIN_RESPONSE','Unknown participation state.');
   this.receipt=null;this.set({phase:status?'result':'review',activity:result,saveCalendar:result.mine.calendar_saved,error:null});
  }catch(error){
   // Keep the cutoff state so the next action remains a GET, never an old POST.
   this.set({phase:'uncertain',error:new ApiFailure(error instanceof ApiFailure?error.status:0,'RECEIPT_REVIEW_REQUIRED','Could not read current participation. Retry checking status, not signup.')});
  }
 }

}

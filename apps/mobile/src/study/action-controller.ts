import {ApiFailure,type RequestOptions} from '../api';
export type StudyAction={path:string;method:'PATCH'|'DELETE';body:Record<string,unknown>;label:string};
export type StudyActionPhase='idle'|'submitting'|'saved'|'refresh-needed'|'uncertain'|'rejected'|'checking'|'reviewed';
export type StudyActionState={phase:StudyActionPhase;label:string;error:unknown};
/** Mutations are never replayed implicitly. Recovery reads the current collection for user review. */
export class StudyActionController {
 private state:StudyActionState={phase:'idle',label:'',error:null};
 private listeners=new Set<()=>void>();
 private recovery:'refresh-needed'|'uncertain'|null=null;
 constructor(private request:(path:string,options:RequestOptions)=>Promise<unknown>,private refresh:()=>Promise<boolean>){}
 snapshot=()=>this.state;
 subscribe=(fn:()=>void)=>{this.listeners.add(fn);return()=>{this.listeners.delete(fn);};};
 private publish(phase:StudyActionPhase,error:unknown=null,label=this.state.label){this.state={phase,error,label};this.listeners.forEach(fn=>fn());}
 async submit(action:StudyAction):Promise<boolean>{
  if(this.recovery||this.state.phase==='submitting'||this.state.phase==='checking')return false;
  const original={...action,body:JSON.parse(JSON.stringify(action.body))};
  this.publish('submitting',null,original.label);
  try{
   const value=await this.request(original.path,{method:original.method,body:original.body});
   const result=value&&typeof value==='object'?value as Record<string,unknown>:null;
   const segments=original.path.split('/'),id=segments[3];
   const occurrence=segments[1]==='calendar',school=segments[1]==='school'&&segments[2]==='records'&&segments[4]==='personal';
   const personal=result?.personal as Record<string,unknown>|undefined;
   const connection=result?.connection as Record<string,unknown>|undefined;
   const revoke=segments[1]==='school'&&segments[2]==='connections'&&original.method==='DELETE';
   const fields=['notes','completed','remind_minutes'].filter(field=>Object.prototype.hasOwnProperty.call(original.body,field));
   const valid=revoke?connection?.provider===id&&connection?.state==='revoked'&&Number.isInteger(connection?.version)&&Number(connection?.version)>Number(original.body.version)&&typeof original.body.delete_cached_data==='boolean'&&result?.cache===(original.body.delete_cached_data?'deleted':'retained')&&result?.upstream_revocation==='not_attempted':
    school?original.method==='PATCH'&&result?.id===id&&Number.isInteger(personal?.version)&&Number(personal?.version)>Number(original.body.version)&&fields.length>0&&fields.every(field=>personal?.[field]===original.body[field]):original.method==='DELETE'?result?.deleted===true&&result.id===id:
    result&&Number.isInteger(result.version)&&Number(result.version)>Number(original.body.version)&&
    (occurrence?result.series_id===id&&result.recurrence_id===original.body.recurrence_id&&(result.event as Record<string,unknown>|null)?.status===original.body.status:result.id===id&&result.status===original.body.status);
   if(!valid)throw new ApiFailure(502,'INVALID_RESPONSE','Write response could not be confirmed.');
  }
  catch(error){
   //409means the displayed record is no longer authoritative; review before another action.
   const known=error instanceof ApiFailure&&error.status>=400&&error.status<500&&error.status!==409;
   if(!known)this.recovery='uncertain';
   this.publish(known?'rejected':'uncertain',error);return false;
  }
  this.recovery='refresh-needed';
  // A read failure must never turn an accepted write into an apparent failed save.
  let fresh=false;try{fresh=await this.refresh();}catch{}
  if(fresh){this.recovery=null;this.publish('saved');return true;}
  this.publish('refresh-needed');return false;
 }
 async check():Promise<boolean>{
  if(!this.recovery||this.state.phase==='submitting'||this.state.phase==='checking')return false;
  const original=this.recovery;this.publish('checking');
  let fresh=false;try{fresh=await this.refresh();}catch{}
  if(!fresh){this.publish(original);return false;}
  this.recovery=null;this.publish(original==='refresh-needed'?'saved':'reviewed');return true;
 }
}

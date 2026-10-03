import {ApiFailure} from '../api';
import type {NavigationProtection} from './protection';
export type AccountExitKind='sign-out'|'delete';
export type ExitProposal=Readonly<{owner:string;kind:AccountExitKind;protection:NavigationProtection;requiresConfirmation:boolean}>;
export type ExitPreparation={status:'busy'}|{status:'signed-out'}|{status:'ready';proposal:ExitProposal};
/** Proposals are bound to the current account and all retained scenes, then rechecked at commit. */
export class AccountExitController {
 private state:{busy:boolean;error:unknown}={busy:false,error:null};
 private pending:ExitProposal|null=null;
 private listeners=new Set<()=>void>();
 constructor(private owner:()=>string|null,private protection:()=>NavigationProtection,private exit:(kind:AccountExitKind)=>Promise<void>){}
 snapshot=()=>this.state;
 subscribe=(fn:()=>void)=>{this.listeners.add(fn);return()=>{this.listeners.delete(fn);};};
 private set(patch:Partial<typeof this.state>){this.state={...this.state,...patch};this.listeners.forEach(fn=>fn());}
 prepare(kind:AccountExitKind):ExitPreparation{
  if(this.state.busy||this.protection()==='busy')return {status:'busy'};
  const owner=this.owner();if(!owner)return {status:'signed-out'};
  const protection=this.protection();
  const proposal=Object.freeze({owner,kind,protection,requiresConfirmation:kind==='delete'||protection!=='clear'});
  this.pending=proposal;this.set({error:null});return {status:'ready',proposal};
 }
 cancel(proposal:ExitProposal){if(this.pending===proposal)this.pending=null;}
 reset(){this.pending=null;this.set({error:null});}
 async commit(proposal:ExitProposal,confirmed=false){
  if(this.state.busy)return false;
  if(this.pending!==proposal||this.owner()!==proposal.owner||this.protection()!==proposal.protection||this.protection()==='busy'){
   if(this.pending===proposal)this.pending=null;
   this.set({error:new ApiFailure(409,'EXIT_REVIEW_REQUIRED','Account or pending work changed. Review before leaving.')});return false;
  }
  if(proposal.requiresConfirmation&&!confirmed)return false;
  this.pending=null;this.set({busy:true,error:null});
  try{await this.exit(proposal.kind);return true;}
  catch(error){if(this.owner()===proposal.owner)this.set({error});return false;}
  finally{this.set({busy:false});}
 }
}

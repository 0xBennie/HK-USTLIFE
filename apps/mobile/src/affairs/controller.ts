import {ApiFailure,type RequestOptions} from '../api';
import {protectionFor} from '../navigation/protection';
import type {createAffairsStore} from '../../../../src/product/affairs/store';
export type AffairDetail=ReturnType<ReturnType<typeof createAffairsStore>['get']>;
export type AffairPatch=Partial<Pick<AffairDetail,'label'|'note'|'step_checks'|'submission'|'self_reported_outcome'|'archived'|'personal_due'|'calendar_saved'|'remind_minutes'>>;
type Phase='idle'|'loading'|'ready'|'dirty'|'saving'|'uncertain'|'review'|'error'|'gone';
type State={phase:Phase;value:AffairDetail|null;draft:AffairPatch;error:unknown};
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const canonical=(v:unknown):string=>Array.isArray(v)?`[${v.map(canonical).join(',')}]`:object(v)?`{${Object.entries(v).sort(([a],[b])=>a.localeCompare(b)).map(([k,x])=>`${k}:${canonical(x)}`).join(',')}}`:JSON.stringify(v);
const matches=(a:unknown,b:unknown)=>canonical(a)===canonical(b);
function matchesField(key:string,actual:unknown,wanted:unknown){
 if(key==='personal_due'&&object(actual)&&object(wanted)&&actual.kind==='time'&&wanted.kind==='time')return actual.timezone===wanted.timezone&&typeof actual.at==='string'&&typeof wanted.at==='string'&&Number.isFinite(Date.parse(actual.at))&&Date.parse(actual.at)===Date.parse(wanted.at);
 return matches(actual,wanted);
}
const clone=<T>(v:T):T=>JSON.parse(JSON.stringify(v));
function valid(value:unknown,id:string):value is AffairDetail{
 if(!object(value)||value.id!==id||!Number.isSafeInteger(value.version)||Number(value.version)<1)return false;
 if(!object(value.official_status)||value.official_status.status!=='unknown'||value.official_status.reason!=='not_connected')return false;
 return typeof value.note==='string'&&typeof value.label==='string'&&object(value.step_checks)&&Object.values(value.step_checks).every(v=>typeof v==='boolean')&&typeof value.archived==='boolean'&&typeof value.calendar_saved==='boolean'&&typeof value.requires_review==='boolean'&&Number.isSafeInteger(value.accepted_revision)&&Number.isSafeInteger(value.current_revision)&&object(value.template)&&object(value.template.title)&&Array.isArray(value.template.steps)&&object(value.current_template)&&['not_reported','self_reported'].includes(String(value.submission))&&['unknown','received','approved','rejected','completed'].includes(String(value.self_reported_outcome));
}
/** One account and instance per controller. Dispose on account change/unmount. */
export class AffairController{
 private state:State={phase:'idle',value:null,draft:{},error:null};private epoch=0;private disposed=false;
 private listeners=new Set<()=>void>();
 constructor(private id:string,private request:(path:string,options?:RequestOptions)=>Promise<unknown>){}
 snapshot=()=>this.state;
 subscribe=(fn:()=>void)=>{this.listeners.add(fn);return()=>{this.listeners.delete(fn);};};
 private set(patch:Partial<State>){this.state={...this.state,...patch};this.listeners.forEach(fn=>fn());}
 private busy(){return this.state.phase==='loading'||this.state.phase==='saving';}
 protection=()=>protectionFor(Object.keys(this.state.draft).length>0,this.busy(),this.state.phase==='uncertain'||this.state.phase==='review');
 dispose(){this.disposed=true;this.epoch++;this.set({phase:'idle',value:null,draft:{},error:null});this.listeners.clear();}
 edit(patch:AffairPatch){if(this.disposed||!['ready','dirty'].includes(this.state.phase))return;const draft={...this.state.draft,...clone(patch)};if(patch.step_checks)draft.step_checks={...this.state.draft.step_checks,...patch.step_checks};this.set({draft,phase:'dirty',error:null});}
 async refresh(){
  if(this.disposed||this.busy())return false;const epoch=++this.epoch,previous=this.state.phase;this.set({phase:'loading',error:null});
  try{const value=await this.request('/me/affairs/'+this.id);if(epoch!==this.epoch)return false;if(!valid(value,this.id))throw new ApiFailure(502,'INVALID_AFFAIR_RESPONSE','Could not confirm the affair.');
   this.set({value:clone(value),phase:Object.keys(this.state.draft).length||previous==='uncertain'||previous==='review'?'review':'ready'});return true;
  }catch(error){if(epoch!==this.epoch)return false;
   const gone=error instanceof ApiFailure&&error.status===404;
   this.set({phase:gone?'gone':previous==='uncertain'||previous==='review'?'uncertain':'error',error,...(gone?{value:null}:{})});return false;
  }finally{if(epoch===this.epoch&&this.state.phase==='loading')this.set({phase:'error'});}
 }
 resolve(choice:'use-server'|'keep-draft'){
  if(this.disposed||this.state.phase!=='review'||!this.state.value)return;
  this.set({phase:choice==='use-server'?'ready':'dirty',...(choice==='use-server'?{draft:{}}:{}),error:null});
 }
 async save(){
  if(this.disposed||this.state.phase!=='dirty'||!this.state.value||!Object.keys(this.state.draft).length)return false;
  const epoch=++this.epoch,version=this.state.value.version,draft=clone(this.state.draft);this.set({phase:'saving',error:null});
  try{const value=await this.request('/me/affairs/'+this.id,{method:'PATCH',body:{version,...draft}});if(epoch!==this.epoch)return false;
   if(!valid(value,this.id)||value.version!==version+1||!Object.entries(draft).every(([k,v])=>k==='step_checks'?Object.entries(v as Record<string,boolean>).every(([step,checked])=>value.step_checks[step]===checked):matchesField(k,value[k as keyof AffairDetail],v)))throw new ApiFailure(502,'INVALID_AFFAIR_RESPONSE','Write result could not be confirmed.');
   this.set({phase:'ready',value:clone(value),draft:{},error:null});return true;
  }catch(error){if(epoch!==this.epoch)return false;
   const rejected=error instanceof ApiFailure&&error.status>=400&&error.status<500&&error.status!==409;
   this.set({phase:rejected?'error':'uncertain',error});return false;
  }
 }
}

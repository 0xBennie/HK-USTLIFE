import {ApiFailure,type RequestOptions} from '../api';
export type Reconnection={activity_id:string;target_id:string;willing:boolean;version:number;mutual:boolean;expired:boolean;expires_at:string|null};
type State={phase:'idle'|'loading'|'ready'|'saving'|'uncertain'|'error';value:Reconnection|null};
export class ReconnectionController{
 private state:State={phase:'idle',value:null};private listeners=new Set<()=>void>();private locked=false;
 constructor(private activity:string,private target:string,private request:(path:string,options?:RequestOptions)=>Promise<unknown>){}
 snapshot=()=>this.state;subscribe=(fn:()=>void)=>{this.listeners.add(fn);return()=>{this.listeners.delete(fn);};};
 private publish(phase:State['phase'],value=this.state.value){this.state={phase,value};this.listeners.forEach(fn=>fn());}
 private path(){return `/activities/${this.activity}/reconnections/${this.target}`;}
 private valid(value:unknown):value is Reconnection{if(!value||typeof value!=='object')return false;const v=value as Reconnection;return v.activity_id===this.activity&&v.target_id===this.target&&Number.isInteger(v.version)&&v.version>=0&&typeof v.willing==='boolean'&&typeof v.mutual==='boolean'&&typeof v.expired==='boolean'&&(v.expires_at===null||typeof v.expires_at==='string'&&Number.isFinite(Date.parse(v.expires_at)));}
 async refresh(){if(this.locked)return false;this.locked=true;const uncertain=this.state.phase==='uncertain';this.publish('loading');try{const value=await this.request(this.path());if(!this.valid(value))throw Error('Invalid response');this.publish('ready',value);return true;}catch{this.publish(uncertain?'uncertain':'error');return false;}finally{this.locked=false;}}
 async choose(willing:boolean){if(this.locked||this.state.phase!=='ready'||!this.state.value)return false;this.locked=true;const version=this.state.value.version;this.publish('saving');try{const value=await this.request(this.path(),{method:'PUT',body:{version,willing,participated:willing}});if(!this.valid(value)||value.version<=version||value.willing!==willing)throw Error('Unconfirmed response');this.publish('ready',value);return true;}catch(error){this.publish(error instanceof ApiFailure&&error.status>=400&&error.status<500&&error.status!==409?'error':'uncertain');return false;}finally{this.locked=false;}}
}

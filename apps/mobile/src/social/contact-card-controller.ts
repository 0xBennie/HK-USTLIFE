import {ApiFailure,type RequestOptions} from '../api';
export type ContactCards={activity_id:string;target_id:string;mine:{text:string;version:number};peer:{text:string;report_id:string}|null};
type State={phase:'idle'|'loading'|'ready'|'saving'|'uncertain'|'error';value:ContactCards|null;draft:string;dirty:boolean};
export class ContactCardController{
 private state:State={phase:'idle',value:null,draft:'',dirty:false};private listeners=new Set<()=>void>();private locked=false;private visibility=0;private hidden=false;
 constructor(private activity:string,private target:string,private request:(path:string,options?:RequestOptions)=>Promise<unknown>){}
 snapshot=()=>this.state;subscribe=(fn:()=>void)=>{this.listeners.add(fn);return()=>{this.listeners.delete(fn);};};
 private publish(next:Partial<State>){this.state={...this.state,...next};this.listeners.forEach(fn=>fn());}
 private path(){return `/activities/${this.activity}/reconnections/${this.target}/contact-card`;}
 private valid(raw:unknown):raw is ContactCards{const v=raw as ContactCards|undefined;return !!v&&v.activity_id===this.activity&&v.target_id===this.target&&!!v.mine&&typeof v.mine.text==='string'&&v.mine.text.length<=300&&Number.isInteger(v.mine.version)&&v.mine.version>=0&&(v.peer===null||!!v.peer&&typeof v.peer.text==='string'&&v.peer.text.length<=300&&typeof v.peer.report_id==='string'&&/^[a-f0-9]{32}\.[1-9]\d{0,14}$/.test(v.peer.report_id));}
 private withoutPeer(){return this.state.value?{...this.state.value,peer:null}:null;}
 edit(text:string){if(this.locked||text.length>300)return;this.publish({draft:text,dirty:text!==(this.state.value?.mine.text??'')});}
 useSaved(){if(this.locked||!this.state.value)return;this.publish({draft:this.state.value.mine.text,dirty:false});}
 hide(){this.hidden=true;this.visibility++;this.publish({value:this.withoutPeer()});}
 show(){this.hidden=false;return this.refresh();}
 async refresh(){if(this.locked)return false;this.locked=true;const uncertain=this.state.phase==='uncertain',epoch=this.visibility;this.publish({phase:'loading',value:this.withoutPeer()});try{const value=await this.request(this.path());if(!this.valid(value))throw Error('Invalid contact response');const draft=this.state.dirty?this.state.draft:value.mine.text;this.publish({phase:'ready',value:this.hidden||epoch!==this.visibility?{...value,peer:null}:value,draft,dirty:draft!==value.mine.text});return true;}catch{this.publish({phase:uncertain?'uncertain':'error',value:this.withoutPeer()});return false;}finally{this.locked=false;}}
 async save(expectedText:string){if(this.hidden||this.locked||this.state.phase!=='ready'||!this.state.value||expectedText!==this.state.draft.trim()||!this.state.dirty)return false;this.locked=true;const version=this.state.value.mine.version,epoch=this.visibility;this.publish({phase:'saving',value:this.withoutPeer()});try{const value=await this.request(this.path(),{method:'PUT',body:{version,text:expectedText}});if(!this.valid(value)||value.mine.version<=version||value.mine.text!==expectedText)throw Error('Unconfirmed contact write');this.publish({phase:'ready',value:this.hidden||epoch!==this.visibility?{...value,peer:null}:value,draft:value.mine.text,dirty:false});return true;}catch(error){this.publish({phase:error instanceof ApiFailure&&error.status>=400&&error.status<500&&error.status!==409?'error':'uncertain',value:this.withoutPeer()});return false;}finally{this.locked=false;}}
}

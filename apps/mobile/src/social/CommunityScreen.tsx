import {useEffect,useState} from 'react';
import {Text,View} from 'react-native';
import {CircleButton,TopBar,usePenColors} from '../ui/Pen';
import type {Language} from '../strings';
import {DiscoverScreen} from './DiscoverScreen';
import {WallScreen} from './WallScreen';
export type DiscoveryTarget={kind:'activity'|'post';id:string};
// Pen boards "V3 / 校园墙" (wall-first tab) and "V3 / 发现" (activities, entered from the 活动 topic).
export function CommunityScreen({language,dark,onLogin,initialTarget,onDismissTarget,onNavigate,name,onMe}:{language:Language;dark:boolean;onLogin:()=>void;initialTarget:DiscoveryTarget|null;onDismissTarget:()=>void;onNavigate:()=>void;name?:string;onMe?:()=>void}){
 const zh=language==='zh',c=usePenColors();
 const [nested,setNested]=useState(initialTarget!==null);
 const [mode,setMode]=useState<DiscoveryTarget['kind']>(initialTarget?.kind??'post');
 const [createRequest,setCreateRequest]=useState(0);
 useEffect(()=>{if(initialTarget)setMode(initialTarget.kind);},[initialTarget]);
 useEffect(onNavigate,[mode,onNavigate]);
 // Keep feed switching out of nested forms so their pending-write/back checks run.
 const shared={language,dark,onLogin,onDismissTarget,onNavigate,onDepthChange:setNested,createRequest};
 return <View style={{gap:18}}>
  {!nested?(mode==='post'?<TopBar name={name} onAvatar={onMe} title={zh?'校园墙':'Campus wall'} right={<CircleButton icon="pen-line" label={zh?'发帖':'New post'} onPress={()=>setCreateRequest(v=>v+1)}/>}/>
   :<View style={{flexDirection:'row',alignItems:'center',gap:10}}><CircleButton icon="chevron-left" label={zh?'返回校园墙':'Back to wall'} onPress={()=>{onDismissTarget();setMode('post');}}/><Text style={{flex:1,textAlign:'center',fontSize:17,fontWeight:'700',color:c.text}}>{zh?'活动与组队':'Activities'}</Text><CircleButton icon="plus" label={zh?'发起活动':'Start an activity'} onPress={()=>setCreateRequest(v=>v+1)}/></View>):null}
  {mode==='activity'?<DiscoverScreen {...shared} initialId={initialTarget?.kind==='activity'?initialTarget.id:null}/>:<WallScreen {...shared} onActivities={()=>setMode('activity')} initialId={initialTarget?.kind==='post'?initialTarget.id:null}/>}
 </View>;
}

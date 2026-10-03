import {useEffect,useState} from 'react';
import {View} from 'react-native';
import { SegmentedControl } from '../ui/Primitives';
import type {Language} from '../strings';
import {styles} from '../theme';
import {DiscoverScreen} from './DiscoverScreen';
import {WallScreen} from './WallScreen';
export type DiscoveryTarget={kind:'activity'|'post';id:string};
export function CommunityScreen({language,dark,onLogin,initialTarget,onDismissTarget,onNavigate}:{language:Language;dark:boolean;onLogin:()=>void;initialTarget:DiscoveryTarget|null;onDismissTarget:()=>void;onNavigate:()=>void}){
 const [nested,setNested]=useState(initialTarget!==null);
 const [mode,setMode]=useState<DiscoveryTarget['kind']>(initialTarget?.kind??'activity');
 useEffect(()=>{if(initialTarget)setMode(initialTarget.kind);},[initialTarget]);
 useEffect(onNavigate,[mode,onNavigate]);
 // Keep feed switching out of nested forms so their pending-write/back checks run.
 const shared={language,dark,onLogin,onDismissTarget,onNavigate,onDepthChange:setNested};
 return <View style={styles.stack}>
  {!nested?<SegmentedControl value={mode} label={language==='zh'?'发现内容类型':'Discovery content'} options={[{value:'activity',label:language==='zh'?'活动与组队':'Activities'},{value:'post',label:language==='zh'?'校园墙':'Campus wall'}]} onChange={value=>{onDismissTarget();setMode(value);}}/>:null}
  {mode==='activity'?<DiscoverScreen {...shared} initialId={initialTarget?.kind==='activity'?initialTarget.id:null}/>:<WallScreen {...shared} initialId={initialTarget?.kind==='post'?initialTarget.id:null}/>}
 </View>;
}

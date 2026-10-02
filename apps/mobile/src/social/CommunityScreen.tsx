import {useEffect,useState} from 'react';
import {View} from 'react-native';
import {Button} from 'heroui-native/button';
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
  {!nested?<><Button variant={mode==='activity'?'primary':'secondary'} onPress={()=>{onDismissTarget();setMode('activity');}}>{language==='zh'?'活动与学习组队':'Activities and study groups'}</Button>
  <Button variant={mode==='post'?'primary':'secondary'} onPress={()=>{onDismissTarget();setMode('post');}}>{language==='zh'?'校园墙与求助':'Campus wall and help'}</Button></>:null}
  {mode==='activity'?<DiscoverScreen {...shared} initialId={initialTarget?.kind==='activity'?initialTarget.id:null}/>:<WallScreen {...shared} initialId={initialTarget?.kind==='post'?initialTarget.id:null}/>}
 </View>;
}

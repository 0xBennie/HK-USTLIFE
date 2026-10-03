import {useEffect,useMemo,useSyncExternalStore} from 'react';
import {Alert,Text,View} from 'react-native';
import {Button} from '../ui/Primitives';
import {useNavigationProtection} from '../navigation/InputProtection';
import {session} from '../runtime';
import {palette,styles} from '../theme';
import type {Language} from '../strings';
import {ReconnectionController} from './reconnection-controller';
export function ReconnectionScreen({activityId,peer,language,dark,onBack}:{activityId:string;peer:{id:string;display_name:string};language:Language;dark:boolean;onBack:()=>void}){
 const zh=language==='zh',c=palette[dark?'dark':'light'];
 const controller=useMemo(()=>new ReconnectionController(activityId,peer.id,(p,o)=>session.request(p,o)),[activityId,peer.id]);
 const state=useSyncExternalStore(controller.subscribe,controller.snapshot),v=state.value,busy=state.phase==='saving'||state.phase==='loading';
 const protect=useNavigationProtection(busy?'busy':state.phase==='uncertain'?'uncertain':'clear',zh);
 useEffect(()=>{void controller.refresh();},[controller]);
 function consent(){Alert.alert(zh?'确认这次参与与意愿':'Confirm your participation and choice',zh?'我实际参加过这场活动，并愿意再次与这位同学同行。单方选择不通知对方，双方同意不代表已报名新活动。':'I attended this activity and would like to meet this person again. My one-sided choice is private; mutual consent does not book another event.',[{text:zh?'暂时不选':'Not now',style:'cancel'},{text:zh?'我参加过，愿意再次同行':'I attended and would like to meet again',onPress:()=>void controller.choose(true)}]);}
 return <View style={styles.stack}>
  <Button variant="ghost" isDisabled={busy} onPress={()=>protect(onBack)}>{zh?'返回活动':'Back to activity'}</Button>
  <Text style={[styles.title,{color:c.text}]}>{zh?'再次同行':'Meet again'}</Text>
  <Text style={[styles.heading,{color:c.text}]}>{peer.display_name}</Text>
  <Text style={[styles.body,{color:c.muted}]}>{zh?'这是你自己的私密选择。只有双方都愿意才显示双向同意；不显示对方的单方意愿或拒绝。选择在活动结束后七天到期，可随时撤回。':'This is your private choice. Mutual consent appears only when both agree; unilateral intent or refusal is not shown. Choices expire seven days after the activity and can be withdrawn.'}</Text>
  {busy?<Text accessibilityLiveRegion="polite" style={{color:c.muted}}>{zh?'正在核对…':'Checking…'}</Text>:null}
  {state.phase==='uncertain'?<Text accessibilityRole="alert" style={{color:c.danger}}>{zh?'结果尚未确认，请先读取当前选择，不要重复提交。':'Result unconfirmed. Read your current choice before another action.'}</Text>:null}
  {state.phase==='error'?<Text accessibilityRole="alert" style={{color:c.danger}}>{zh?'暂时无法完成。请刷新核对；活动状态或参与资格可能已变化。':'Unable to complete. Refresh to check; activity or participation eligibility may have changed.'}</Text>:null}
  {v?<View style={[styles.card,{backgroundColor:c.surface}]}><Text accessibilityLiveRegion="polite" style={[styles.heading,{color:c.text}]}>{v.expired?(zh?'这次选择已到期':'This choice has expired'):v.mutual?(zh?'双方都愿意':'You both agreed'):v.willing?(zh?'已保存你的意愿':'Your choice is saved'):(zh?'你尚未表达意愿':'You have not expressed interest')}</Text>{v.expires_at?<Text style={{color:c.muted}}>{zh?'到期时间：':'Expires: '}{v.expires_at}</Text>:null}</View>:null}
  <Button variant="secondary" isDisabled={busy} onPress={()=>void controller.refresh()}>{zh?'读取当前选择':'Read current choice'}</Button>
  {state.phase==='ready'&&v&&!v.willing&&!v.expired?<Button onPress={consent}>{zh?'我愿意再次同行':'I would like to meet again'}</Button>:null}
  {state.phase==='ready'&&v?.willing?<Button variant="ghost" onPress={()=>void controller.choose(false)}>{zh?'撤回我的意愿':'Withdraw my choice'}</Button>:null}
  <Text style={[styles.caption,{color:c.muted}]}>{zh?'当前版本尚未开放私聊，不会公开联系方式、自动拉群或自动报名。':'Private messaging is not available yet. Contact details remain private; no automatic groups or signups.'}</Text>
 </View>;
}

import {reviewRequired} from '../write-receipt';
import {useSceneFocus} from '../navigation/TabScene';
import {Modal,ScrollView,Switch,Text,View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useAppearance} from '../ui/Appearance';
import {Button,ContentTransition} from '../ui/Primitives';
import {Icon} from '../ui/Icon';
import {palette,styles} from '../theme';
import type {Language} from '../strings';
import type {ActivityJoinController,JoinSnapshot} from './activity-join';
import {dateTimeInZone} from '../study/dates';
import {participationLabel,socialError} from './shared';
export function JoinActivitySheet({visible,controller,state,language,dark,onClose,onRefresh}:{visible:boolean;controller:ActivityJoinController;state:JoinSnapshot;language:Language;dark:boolean;onClose:()=>void;onRefresh:()=>void}){
 const sceneActive=useSceneFocus();
 const {reduceMotion}=useAppearance(),c=palette[dark?'dark':'light'],zh=language==='zh',a=state.activity;
 if(!a)return null;
 const expired=reviewRequired(state.error);
 const busy=state.phase==='submitting',result=state.phase==='result',part=a.mine?.participation;
 const title=result?participationLabel(part?.status??'',zh):state.phase==='uncertain'?(zh?'操作结果待确认':'Result unconfirmed'):state.phase==='rejected'?(zh?'请重新核对安排':'Review the updated plan'):(zh?'确认这次安排':'Review your plan');
 return <Modal visible={visible&&sceneActive} presentationStyle="pageSheet" animationType={reduceMotion?'none':'slide'} onRequestClose={onClose}>
  <SafeAreaView edges={['top','bottom']} style={{flex:1,backgroundColor:c.background}}>
   <View style={[styles.row,{paddingHorizontal:20,paddingTop:8}]}><Text style={[styles.caption,{color:c.muted}]}>{zh?'本地开发活动':'Local development activity'}</Text><Button variant="ghost" onPress={onClose}>{zh?'关闭':'Close'}</Button></View>
   <ScrollView contentContainerStyle={{padding:24,gap:24,paddingBottom:40}} keyboardShouldPersistTaps="handled">
    <Text accessibilityRole="header" style={[styles.title,{color:c.text}]}>{title}</Text>
    <Text style={[styles.heading,{color:c.text}]}>{a.title}</Text>
    {result?<ContentTransition changeKey={part?.status??''}><View style={{alignSelf:'flex-start',padding:16,borderRadius:30,backgroundColor:c.tint}}><Icon name={part?.status==='confirmed'?'check':part?.status==='waitlisted'?'people':'inbox'} color={c.accent} size={32}/></View><Text accessibilityRole="alert" style={[styles.body,{color:c.text}]}>{part?.status==='confirmed'?(zh?'你的名额已确认。':'Your place is confirmed.'):part?.status==='waitlisted'?(zh?`目前候补第 ${part.waitlist_position??'—'} 位；尚未获得名额。`:`Waitlist position ${part.waitlist_position??'—'}; a place is not confirmed.`):(zh?'这条报名记录已变更，以当前状态为准。':'This participation has changed. The current status is shown.')}</Text><Text style={[styles.caption,{color:c.muted}]}>{a.mine?.calendar_saved?(zh?'已保存到个人日程。':'Saved to your personal calendar.'):(zh?'未保存个人日程。':'Not saved to your calendar.')}</Text></ContentTransition>:null}
    <View style={[styles.card,{backgroundColor:c.surface,gap:18}]}>
     <View style={styles.smallStack}><Text style={[styles.caption,{color:c.muted}]}>{zh?'香港时间':'Hong Kong time'}</Text><Text style={[styles.body,{color:c.text}]}>{dateTimeInZone(a.starts_at,'Asia/Hong_Kong')} → {dateTimeInZone(a.ends_at,'Asia/Hong_Kong')}</Text></View>
     <View style={styles.smallStack}><Text style={[styles.caption,{color:c.muted}]}>{zh?'集合地点':'Meeting place'}</Text><Text style={[styles.body,{color:c.text}]}>{a.location}</Text></View>
     <View style={styles.smallStack}><Text style={[styles.caption,{color:c.muted}]}>{zh?'名额与费用':'Places and cost'}</Text><Text style={[styles.body,{color:c.text}]}>{a.counts.confirmed}/{a.capacity} · {a.cost_minor===0?(zh?'免费':'Free'):`HK$ ${(a.cost_minor/100).toFixed(2)}`}</Text></View>
    </View>
    {a.requirements?<View style={styles.smallStack}><Text style={[styles.heading,{color:c.text}]}>{zh?'参与须知':'Requirements'}</Text><Text style={[styles.body,{color:c.text}]}>{a.requirements}</Text></View>:null}
    {!result?<>
     <View style={[styles.card,{backgroundColor:c.surface,flexDirection:'row',alignItems:'center',gap:16}]}><View style={{flex:1,gap:6}}><Text style={[styles.body,{color:c.text}]}>{a.mine?.calendar_saved?(zh?'已在个人日程中':'Already in your calendar'):(zh?'同时保存到个人日程':'Also save to my calendar')}</Text><Text style={[styles.caption,{color:c.muted}]}>{a.mine?.calendar_saved?(zh?'保留现有日程；可在活动详情移除。':'Keeps your existing calendar entry; remove it from activity details.'):(zh?'不公开课表；此处不启用设备提醒。':'Your timetable stays private; this does not enable device reminders.')}</Text></View><Switch accessibilityLabel={zh?'同时保存到个人日程':'Also save to my calendar'} value={state.saveCalendar} disabled={state.phase!=='review'||a.mine?.calendar_saved===true} onValueChange={value=>controller.setCalendar(value)} trackColor={{true:c.accent}}/></View>
     <Text style={[styles.caption,{color:c.muted}]}>{zh?'以提交时实际名额为准。满员时加入候补；候补按加入顺序递补，可随时退出。':'Capacity is checked when submitted. Full activities use a first-in waitlist; you can withdraw anytime.'}</Text>
    </>:null}
    {state.error?<Text accessibilityRole="alert" style={[styles.body,{color:c.danger}]}>{socialError(state.error,language)}</Text>:null}
    {state.phase==='uncertain'&&!expired?<Text style={[styles.caption,{color:c.muted}]}>{zh?'重试会核对同一笔操作，不会重复占用名额。关闭后可在详情继续核对。':'Retry checks the same request without taking another place. You can close and continue from the detail page.'}</Text>:null}
    {expired?<Button onPress={()=>void controller.checkCurrent()}>{zh?'读取当前报名状态':'Check current participation'}</Button>:result?<Button onPress={onClose}>{zh?'查看活动安排':'View the activity'}</Button>:state.phase==='rejected'?<Button onPress={onRefresh}>{zh?'刷新活动，再确认':'Refresh and review'}</Button>:<Button isDisabled={busy} onPress={()=>void controller.submit()}>{busy?(zh?'正在确认…':'Confirming…'):state.phase==='uncertain'?(zh?'重试确认结果':'Retry to confirm'):a.counts.remaining?(zh?'确认报名':'Confirm signup'):(zh?'确认加入候补':'Join waitlist')}</Button>}
   </ScrollView>
  </SafeAreaView>
 </Modal>;
}

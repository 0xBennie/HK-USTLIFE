// Pen "V6 / 确认报名（面板）" (brKH6): the plan in one card, a calendar switch and one primary action.
// Success closes the sheet so the registration card shows the new state; failures stay here with the real reason.
import {reviewRequired} from '../write-receipt';
import {useSceneFocus} from '../navigation/TabScene';
import {useEffect,useRef} from 'react';
import {Image,Pressable,ScrollView,Switch,Text,View} from 'react-native';
import {BottomSheet} from '../ui/BottomSheet';
import {PenIcon,PrimaryButton,usePenColors,type PenIconName} from '../ui/Pen';
import {feel} from '../ui/feel';
import {ApiFailure} from '../api';
import type {Language} from '../strings';
import type {ActivityJoinController,JoinSnapshot} from './activity-join';
import {activityCover} from './covers';
import {costText,dayTitle,timeSpan} from './activity-time';
import {socialError} from './shared';

/** Server join rejections (src/product/social/store.ts join) in plain words; anything else uses the shared message. */
function rejectReason(error:unknown,language:Language){
 const zh=language==='zh',code=error instanceof ApiFailure?error.code:'';
 if(code==='SIGNUPS_CLOSED')return zh?'报名已截止：发起人暂停了报名，或活动已经开始':'Signups are closed: the host paused them or the activity has started';
 if(code==='WAITLIST_FULL')return zh?'候补也满了（最多 100 人）':'The waitlist is full (100 people)';
 if(code==='ALREADY_ORGANIZER')return zh?'你是发起人，不占参与名额':'You are the host and don’t take a place';
 if(code==='PARTICIPATION_LIMIT')return zh?'这个活动的报名记录已达上限':'This activity has reached its signup record limit';
 return socialError(error,language);
}

export function JoinActivitySheet({visible,controller,state,language,onClose,onRefresh}:{visible:boolean;controller:ActivityJoinController;state:JoinSnapshot;language:Language;dark?:boolean;onClose:()=>void;onRefresh:()=>void}){
 const sceneActive=useSceneFocus();
 const c=usePenColors(),zh=language==='zh',a=state.activity;
 const close=useRef(onClose);close.current=onClose;
 useEffect(()=>{if(visible&&state.phase==='result'){feel.success();close.current();}},[visible,state.phase]);
 if(!a)return null;
 const expired=reviewRequired(state.error),busy=state.phase==='submitting',code=state.error instanceof ApiFailure?state.error.code:'';
 const left=a.counts.remaining,reviewing=state.phase==='review'||(busy&&!expired);
 const status:{icon:PenIconName;color:string;title:string;sub:string;action:string;onPress:()=>void;soft?:boolean}|null=
  state.phase==='uncertain'?(expired
   ?{icon:'search',color:c.accent,title:zh?'先核对你现在的报名状态':'Check your current status first',sub:zh?'为了不重复报名，这次只读取，不会再提交':'To avoid a double signup this only reads, it does not submit again',action:zh?'读取当前报名状态':'Check current status',onPress:()=>void controller.checkCurrent()}
   :{icon:'loader',color:c.accent,title:zh?'报名结果还没确认':'Signup not confirmed yet',sub:zh?'重试只会核对同一次报名，不会多占名额':'Retrying checks the same signup and never takes a second place',action:zh?'再试一次':'Try again',onPress:()=>void controller.submit()})
  :state.phase==='rejected'?(code==='VERSION_CONFLICT'
   ?{icon:'refresh-cw',color:c.orange,title:zh?'活动安排有更新':'The plan was updated',sub:zh?'发起人刚改了这次活动，请再看一眼':'The host just changed this activity; please take another look',action:zh?'刷新后再确认':'Refresh and review',onPress:onRefresh}
   :{icon:'info',color:c.muted,title:zh?'报名没有完成':'Signup not completed',sub:rejectReason(state.error,language),action:zh?'知道了':'OK',onPress:onRefresh,soft:true})
  :null;
 const rows:[PenIconName,string,string][]=[
  ['calendar',`${dayTitle(a.starts_at,zh)} · ${timeSpan(a.starts_at,a.ends_at,zh)}`,zh?'香港时间':'Hong Kong time'],
  ['map-pin',a.location,zh?'集合地点':'Meeting point'],
  ['users',left?(zh?`还剩 ${left} 个名额 · ${costText(a.cost_minor,zh)}`:`${left} places left · ${costText(a.cost_minor,zh)}`):(zh?`已满 · ${costText(a.cost_minor,zh)}`:`Full · ${costText(a.cost_minor,zh)}`),left?(zh?'满员时加入候补，按顺序递补':'When full you join the waitlist, in order'):(zh?'现在报名会加入候补，有人退出按顺序递补':'You will join the waitlist and move up in order')],
 ];
 return <BottomSheet visible={visible&&sceneActive} onClose={onClose} closeLabel={zh?'关闭':'Close'} header={<View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:16,height:44}}>
   <Pressable accessibilityRole="button" hitSlop={10} onPress={onClose}><Text style={{fontSize:17,color:c.accent}}>{zh?'取消':'Cancel'}</Text></Pressable>
   <Text accessibilityRole="header" style={{fontSize:17,fontWeight:'700',color:c.text}}>{zh?'确认报名':'Confirm signup'}</Text>
   <Text style={{fontSize:17,color:'transparent'}}>{zh?'取消':'Cancel'}</Text>
  </View>}>
   <ScrollView style={{flexGrow:0,flexShrink:1}} contentContainerStyle={{paddingHorizontal:16,paddingTop:8,paddingBottom:16,gap:16}} keyboardShouldPersistTaps="handled">
    <View style={{flexDirection:'row',alignItems:'center',gap:12}}>
     <Image source={activityCover(a)} accessible={false} style={{width:56,height:56,borderRadius:14}}/>
     <View style={{flex:1,gap:2}}><Text style={{fontSize:17,fontWeight:'700',color:c.text}}>{a.title}</Text><Text style={{fontSize:13,color:c.muted}}>{zh?`由 ${a.organizer.display_name} 发起`:`Hosted by ${a.organizer.display_name}`}</Text></View>
    </View>
    {status?<View style={{gap:14,padding:16,borderRadius:20,backgroundColor:c.surface}}>
     <View style={{flexDirection:'row',alignItems:'center',gap:12}}>
      <View style={{width:40,height:40,borderRadius:20,alignItems:'center',justifyContent:'center',backgroundColor:status.color+'1F'}}><PenIcon name={status.icon} size={20} color={status.color}/></View>
      <View style={{flex:1,gap:2}}><Text accessibilityRole="alert" style={{fontSize:17,fontWeight:'700',color:c.text}}>{status.title}</Text><Text style={{fontSize:13,lineHeight:18,color:c.muted}}>{status.sub}</Text></View>
     </View>
     {status.soft?<Pressable accessibilityRole="button" onPress={()=>{feel.tap();status.onPress();}} style={({pressed})=>({height:46,borderRadius:23,alignItems:'center',justifyContent:'center',backgroundColor:c.fill,opacity:pressed?0.7:1})}><Text style={{fontSize:15,fontWeight:'600',color:c.text}}>{status.action}</Text></Pressable>
     :<View style={{flexDirection:'row'}}><PrimaryButton label={busy?(zh?'正在核对…':'Checking…'):status.action} disabled={busy} onPress={status.onPress}/></View>}
    </View>:null}
    <View style={{borderRadius:20,overflow:'hidden',backgroundColor:c.surface}}>
     {rows.map(([icon,title,sub],i)=><View key={icon} style={{flexDirection:'row',alignItems:'center',gap:12,paddingVertical:12,paddingHorizontal:16,borderTopWidth:i?0.5:0,borderTopColor:c.border}}>
      <PenIcon name={icon} size={20} color={c.muted}/>
      <View style={{flex:1,gap:2}}><Text style={{fontSize:16,fontWeight:'500',color:c.text}}>{title}</Text><Text style={{fontSize:13,color:c.muted}}>{sub}</Text></View>
     </View>)}
    </View>
    {a.requirements?<View style={{gap:4,paddingHorizontal:4}}><Text style={{fontSize:13,fontWeight:'600',color:c.muted}}>{zh?'参与须知':'Before you join'}</Text><Text selectable style={{fontSize:15,lineHeight:22,color:c.text}}>{a.requirements}</Text></View>:null}
    {reviewing?<View style={{flexDirection:'row',alignItems:'center',gap:12,paddingVertical:12,paddingHorizontal:16,borderRadius:20,backgroundColor:c.surface}}>
     <View style={{flex:1,gap:2}}><Text style={{fontSize:16,fontWeight:'500',color:c.text}}>{zh?'同时加入日历':'Also add to calendar'}</Text><Text style={{fontSize:13,color:c.muted}}>{a.mine?.calendar_saved?(zh?'已经在你的日历里':'Already in your calendar'):(zh?'只保存这场活动，不公开你的课表':'Saves only this activity; your timetable stays private')}</Text></View>
     <Switch accessibilityLabel={zh?'同时加入日历':'Also add to calendar'} value={state.saveCalendar} disabled={state.phase!=='review'||a.mine?.calendar_saved===true} onValueChange={value=>{feel.select();controller.setCalendar(value);}} trackColor={{true:c.accent}}/>
    </View>:null}
   </ScrollView>
   {reviewing?<View style={{paddingHorizontal:16,paddingTop:8,paddingBottom:8,gap:4}}>
    <View style={{flexDirection:'row'}}><PrimaryButton label={busy?(zh?'正在确认…':'Confirming…'):left?(zh?'确认报名':'Confirm signup'):(zh?'确认加入候补':'Join the waitlist')} disabled={busy} onPress={()=>void controller.submit()}/></View>
    <Pressable accessibilityRole="button" disabled={busy} onPress={onClose} style={({pressed})=>({height:40,alignItems:'center',justifyContent:'center',opacity:busy?0.4:pressed?0.6:1})}><Text style={{fontSize:15,fontWeight:'600',color:c.muted}}>{zh?'再想一想':'Not now'}</Text></Pressable>
   </View>:null}
 </BottomSheet>;
}

// Pen "V6 / 再次同行" (pdYON): after an activity, a private choice to meet someone again. Only mutual consent is
// shown; the other person's one-sided choice or refusal never is. Withdrawing after both agreed clears both
// contact cards for good, so it asks first.
import {useEffect,useMemo,useState,useSyncExternalStore} from 'react';
import {Alert,Pressable,Text,View} from 'react-native';
import {useNavigationProtection} from '../navigation/InputProtection';
import {session} from '../runtime';
import type {Language} from '../strings';
import {NavRow,Notice,PenIcon,PrimaryButton,Skeleton,usePenColors,type PenIconName} from '../ui/Pen';
import {feel} from '../ui/feel';
import {dateTimeInZone} from '../study/dates';
import {GradientAvatar} from './wall-ui';
import {ContactCardScreen} from './ContactCardScreen';
import {ReconnectionController} from './reconnection-controller';

const monthDay=(iso:string,zh:boolean)=>{const d=dateTimeInZone(iso,'Asia/Hong_Kong');return zh?`${Number(d.slice(5,7))} 月 ${Number(d.slice(8,10))} 日`:new Date(d.slice(0,10)+'T00:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'short',timeZone:'UTC'});};

function ReconnectionChoice({activityId,activityTitle,peer,language,onBack,onContact,backLabel}:{activityId:string;activityTitle?:string;peer:{id:string;display_name:string};language:Language;onBack:()=>void;backLabel?:string;onContact:()=>void}){
 const zh=language==='zh',c=usePenColors(),name=peer.display_name;
 const controller=useMemo(()=>new ReconnectionController(activityId,peer.id,(p,o)=>session.request(p,o)),[activityId,peer.id]);
 const state=useSyncExternalStore(controller.subscribe,controller.snapshot),v=state.value,busy=state.phase==='saving'||state.phase==='loading';
 const protect=useNavigationProtection(busy?'busy':state.phase==='uncertain'?'uncertain':'clear',zh);
 useEffect(()=>{void controller.refresh();},[controller]);
 const until=v?.expires_at?monthDay(v.expires_at,zh):null;
 function consent(){Alert.alert(zh?'你参加过这场活动？':'Did you attend this activity?',zh?`只有 ${name} 也愿意时，你们才会看到彼此的意愿。`:`You’ll only see each other’s choice if ${name} agrees too.`,[{text:zh?'暂时不选':'Not now',style:'cancel'},{text:zh?'愿意':'Yes',onPress:()=>{feel.select();void controller.choose(true);}}]);}
 function withdraw(){
  if(!v?.mutual){feel.select();void controller.choose(false);return;}
  Alert.alert(zh?'撤回意愿？':'Withdraw?',zh?'双方的联系卡片会一起消失，之后也不会恢复。':'Both contact cards disappear and won’t come back.',[{text:zh?'保留':'Keep',style:'cancel'},{text:zh?'撤回':'Withdraw',style:'destructive',onPress:()=>void controller.choose(false)}]);
 }
 const quiet=(label:string,onPress:()=>void)=><Pressable accessibilityRole="button" disabled={busy} hitSlop={8} onPress={onPress} style={{alignSelf:'center',paddingVertical:4,opacity:busy?0.5:1}}><Text style={{fontSize:13,fontWeight:'500',color:c.muted}}>{label}</Text></Pressable>;
 const status=(icon:PenIconName,color:string,title:string,body:string,children?:React.ReactNode)=><View accessibilityLiveRegion="polite" style={{gap:10,padding:16,borderRadius:20,borderCurve:'continuous',backgroundColor:c.surface}}>
  <View style={{flexDirection:'row',alignItems:'center',gap:10}}><View style={{width:32,height:32,borderRadius:16,alignItems:'center',justifyContent:'center',backgroundColor:color+'1F'}}><PenIcon name={icon} size={17} color={color}/></View><Text style={{fontSize:17,fontWeight:'700',color:c.text}}>{title}</Text></View>
  <Text style={{fontSize:14,lineHeight:21,color:c.muted}}>{body}</Text>
  {children}
 </View>;
 const facts:[PenIconName,string][]=[['lock',zh?'只有双方都愿意才会显示':'Shown only if you both agree'],['calendar-clock',until?(zh?`${until}前有效，随时可以撤回`:`Valid until ${until}; withdraw any time`):(zh?'活动结束后 7 天内有效，随时可以撤回':'Valid for 7 days after the activity; withdraw any time')],['user-x',zh?'不是报名，不拉群，也不公开邮箱':'Not a sign-up, no group chat, no email shared']];
 return <View style={{gap:14}}>
  <NavRow title={zh?'再次同行':'Meet again'} backLabel={backLabel??(zh?'返回':'Back')} onBack={()=>protect(onBack)}/>
  <View style={{flexDirection:'row',alignItems:'center',gap:12,padding:16,borderRadius:20,borderCurve:'continuous',backgroundColor:c.surface}}>
   <GradientAvatar name={name} size={44}/>
   <View style={{flex:1,gap:2}}><Text style={{fontSize:17,fontWeight:'700',color:c.text}}>{name}</Text><Text style={{fontSize:13,lineHeight:18,color:c.muted}}>{activityTitle?(zh?`一起参加过「${activityTitle}」`:`You both joined “${activityTitle}”`):(zh?'一起参加过同一场活动':'You joined the same activity')}</Text></View>
  </View>
  {state.phase==='uncertain'?<Notice tone="warning" text={zh?'结果还没确认，重试只会核对同一次。':'Not confirmed yet; retrying only checks the same request.'} action={zh?'重试':'Retry'} onAction={()=>void controller.refresh()}/>:null}
  {state.phase==='error'?<Notice tone="error" text={zh?'暂时打不开，请检查网络后重试。':'Couldn’t load. Check your connection and try again.'} action={zh?'重试':'Retry'} onAction={()=>void controller.refresh()}/>:null}
  {!v?(state.phase==='error'?null:<Skeleton height={220} radius={20}/>)
   :v.expired?status('calendar-clock',c.muted,zh?'这次选择已到期':'This choice has expired',zh?'活动结束 7 天后自动失效。':'Choices end 7 days after the activity.')
   :v.mutual?status('users',c.green,zh?'双方都愿意':'You both agreed',zh?'可以再一起做点小事。分享联系方式完全自愿。':'You can do something small together again. Sharing contact details is up to you.',<>
     <View style={{flexDirection:'row'}}><PrimaryButton label={zh?'分享联系方式':'Share contact details'} disabled={busy} onPress={onContact}/></View>
     {quiet(zh?'撤回我的意愿':'Withdraw my choice',withdraw)}
    </>)
   :v.willing?status('hourglass',c.accent,zh?'已保存你的意愿':'Your choice is saved',zh?`如果 ${name} 也愿意，这里会显示「双方都愿意」。${until?`${until}前有效。`:''}`:`If ${name} agrees too, this shows “You both agreed”.${until?` Valid until ${until}.`:''}`,quiet(zh?'撤回我的意愿':'Withdraw my choice',withdraw))
   :<>
    <Text style={{fontSize:22,lineHeight:30,fontWeight:'700',color:c.text}}>{zh?`想和 ${name} 再一起做点事吗？`:`Meet ${name} again?`}</Text>
    <Text style={{fontSize:15,lineHeight:22,color:c.muted}}>{zh?'这是你自己的选择。只有你们都愿意，才会互相看到；对方不会知道你没选。':'This is your own choice. You only see each other if you both agree; they never learn if you don’t.'}</Text>
    <View style={{borderRadius:20,overflow:'hidden',backgroundColor:c.surface}}>{facts.map(([icon,text],i)=><View key={icon} style={{flexDirection:'row',alignItems:'center',gap:12,paddingVertical:12,paddingHorizontal:16,borderTopWidth:i?0.5:0,borderTopColor:c.border}}><PenIcon name={icon} size={18} color={c.accent}/><Text style={{flex:1,fontSize:15,lineHeight:21,color:c.text}}>{text}</Text></View>)}</View>
    <View style={{flexDirection:'row'}}><PrimaryButton label={zh?'我参加过，愿意再次同行':'I attended — I’d meet again'} disabled={busy||state.phase!=='ready'} onPress={consent}/></View>
   </>}
 </View>;
}

export function ReconnectionScreen(props:{activityId:string;activityTitle?:string;peer:{id:string;display_name:string};language:Language;dark:boolean;onBack:()=>void;backLabel?:string}){
 const [contact,setContact]=useState(false);
 return contact?<ContactCardScreen {...props} onBack={()=>setContact(false)}/>:<ReconnectionChoice {...props} onContact={()=>setContact(true)}/>;
}

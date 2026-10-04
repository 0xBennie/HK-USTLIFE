// Pen "V6 / 联系方式" (P3c5M): after mutual consent, each person may share a short card with only the other person.
// The other card is read only while this page is in front and is dropped when it goes to the background.
import {useEffect,useLayoutEffect,useMemo,useState,useSyncExternalStore} from 'react';
import {Alert,AppState,Pressable,Text,TextInput,View} from 'react-native';
import {useNavigationProtection,useSceneNavigation} from '../navigation/InputProtection';
import {session} from '../runtime';
import type {Language} from '../strings';
import {useSceneFocus} from '../navigation/TabScene';
import {NavRow,Notice,PrimaryButton,Skeleton,usePenColors} from '../ui/Pen';
import {feel} from '../ui/feel';
import {SafetyActions} from './SafetyActions';
import {ContactCardController} from './contact-card-controller';
export function ContactCardScreen({activityId,peer,language,dark,onBack}:{activityId:string;peer:{id:string;display_name:string};language:Language;dark:boolean;onBack:()=>void}){
 const focused=useSceneFocus();
 const [safetyPending,setSafetyPending]=useState(false);
 const zh=language==='zh',c=usePenColors(),name=peer.display_name;
 const controller=useMemo(()=>new ContactCardController(activityId,peer.id,(p,o)=>session.request(p,o)),[activityId,peer.id]);
 const s=useSyncExternalStore(controller.subscribe,controller.snapshot),busy=s.phase==='loading'||s.phase==='saving';
 useNavigationProtection(busy?'busy':s.phase==='uncertain'?'uncertain':s.dirty?'draft':'clear',zh);
 const protect=useSceneNavigation(zh);
 useLayoutEffect(()=>{if(focused&&AppState.currentState==='active')void controller.show();else controller.hide();},[controller,focused]);
 useEffect(()=>{const sub=AppState.addEventListener('change',state=>{if(state==='active'&&focused)void controller.show();else controller.hide();});return()=>sub.remove();},[controller,focused]);
 useEffect(()=>()=>controller.hide(),[controller]);
 function confirm(){
  const text=s.draft.trim();
  if(text)Alert.alert(zh?`分享给 ${name}？`:`Share with ${name}?`,`${text}\n${zh?'对方看过或复制的内容无法收回。':'Anything they’ve seen or copied can’t be taken back.'}`,[{text:zh?'继续编辑':'Keep editing',style:'cancel'},{text:zh?'分享':'Share',onPress:()=>{feel.success();void controller.save(text);}}]);
  else Alert.alert(zh?'清空我的分享？':'Clear my card?',zh?`${name} 将不再看到你的联系方式。`:`${name} will no longer see your contact details.`,[{text:zh?'继续编辑':'Keep editing',style:'cancel'},{text:zh?'清空':'Clear',style:'destructive',onPress:()=>void controller.save('')}]);
 }
 const label=(t:string)=><Text style={{paddingHorizontal:4,paddingTop:4,fontSize:13,fontWeight:'600',color:c.muted}}>{t}</Text>;
 const card={gap:8,padding:16,borderRadius:20,borderCurve:'continuous' as const,backgroundColor:c.surface};
 const peerText=focused&&s.phase==='ready'?s.value?.peer?.text??null:undefined;
 return <View style={{gap:12}}>
  <NavRow title={zh?'联系方式':'Contact details'} backLabel={zh?'返回再次同行':'Back to meet again'} disabled={busy} onBack={()=>protect(onBack)}/>
  <Text style={{paddingHorizontal:4,fontSize:13,lineHeight:19,color:c.muted}}>{zh?`只分享给 ${name}。不会自动填学校邮箱，对方也不必回分享。`:`Only ${name} sees it. Your school email is never filled in, and they don’t have to share back.`}</Text>
  {label(zh?'我分享的':'What I share')}
  <View style={[card,{minHeight:130}]}>
   <TextInput accessibilityLabel={zh?'我分享的联系方式':'My contact details'} multiline maxLength={300} autoCorrect={false} autoCapitalize="none" editable={!busy} value={s.draft} onChangeText={text=>controller.edit(text)} placeholder={zh?'例如 Signal、WhatsApp 或 Instagram 帐号':'e.g. a Signal, WhatsApp or Instagram handle'} placeholderTextColor={c.tertiary} style={{flex:1,minHeight:80,fontSize:16,lineHeight:23,color:c.text,textAlignVertical:'top',padding:0}}/>
   <Text style={{alignSelf:'flex-end',fontSize:12,color:c.tertiary,fontVariant:['tabular-nums']}}>{s.draft.length}/300</Text>
  </View>
  {s.phase==='uncertain'?<Notice tone="warning" text={zh?'还没确认是否分享成功，草稿保留着。':'Not confirmed yet; your draft is kept.'} action={zh?'核对':'Check'} onAction={()=>void controller.refresh()}/>:null}
  {s.phase==='error'?<Notice tone="error" text={zh?'暂时打不开，请检查网络后重试。':'Couldn’t load. Check your connection and try again.'} action={zh?'重试':'Retry'} onAction={()=>void controller.refresh()}/>:null}
  <View style={{flexDirection:'row'}}><PrimaryButton label={s.dirty&&!s.draft.trim()?(zh?'确认清空':'Clear my card'):(zh?'确认分享':'Share')} disabled={safetyPending||s.phase!=='ready'||!s.dirty} onPress={confirm}/></View>
  {s.dirty&&s.value?.mine.text?<Pressable accessibilityRole="button" disabled={busy} hitSlop={8} onPress={()=>{feel.select();controller.useSaved();}} style={{alignSelf:'center',paddingVertical:4}}><Text style={{fontSize:13,fontWeight:'500',color:c.muted}}>{zh?'改回已保存的内容':'Go back to what’s saved'}</Text></Pressable>:null}
  {label(zh?`${name} 分享的`:`${name} shares`)}
  {peerText===undefined?(s.phase==='error'?null:<Skeleton height={56} radius={20}/>):<View style={card}><Text selectable style={{fontSize:16,lineHeight:23,color:peerText?c.text:c.muted}}>{peerText||(zh?`${name} 还没有分享。`:`${name} hasn’t shared anything.`)}</Text></View>}
  <Text style={{paddingHorizontal:4,fontSize:12,lineHeight:17,color:c.muted}}>{zh?'撤回意愿、屏蔽或到期后，双方的卡片都会消失，也不会恢复。':'Withdrawing, blocking or expiry removes both cards for good.'}</Text>
  <SafetyActions target={s.value?.peer?.report_id?{kind:'contact_card',id:s.value.peer.report_id}:null} author={peer} language={language} dark={dark} disabled={busy} onPendingChange={setSafetyPending} onChanged={()=>{controller.hide();onBack();}}/>
 </View>;
}

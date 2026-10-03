import {useEffect,useLayoutEffect,useMemo,useState,useSyncExternalStore} from 'react';
import {Alert,AppState,Text,View} from 'react-native';
import {Button,Input} from '../ui/Primitives';
import {useNavigationProtection,useSceneNavigation} from '../navigation/InputProtection';
import {session} from '../runtime';
import {palette,styles} from '../theme';
import type {Language} from '../strings';
import {useSceneFocus} from '../navigation/TabScene';
import {SafetyActions} from './SafetyActions';
import {ContactCardController} from './contact-card-controller';
export function ContactCardScreen({activityId,peer,language,dark,onBack}:{activityId:string;peer:{id:string;display_name:string};language:Language;dark:boolean;onBack:()=>void}){
 const focused=useSceneFocus();
 const [safetyPending,setSafetyPending]=useState(false);
 const zh=language==='zh',c=palette[dark?'dark':'light'];
 const controller=useMemo(()=>new ContactCardController(activityId,peer.id,(p,o)=>session.request(p,o)),[activityId,peer.id]);
 const s=useSyncExternalStore(controller.subscribe,controller.snapshot),busy=s.phase==='loading'||s.phase==='saving';
 useNavigationProtection(busy?'busy':s.phase==='uncertain'?'uncertain':s.dirty?'draft':'clear',zh);
 const protect=useSceneNavigation(zh);
 useLayoutEffect(()=>{if(focused&&AppState.currentState==='active')void controller.show();else controller.hide();},[controller,focused]);
 useEffect(()=>{const sub=AppState.addEventListener('change',state=>{if(state==='active'&&focused)void controller.show();else controller.hide();});return()=>sub.remove();},[controller,focused]);
 useEffect(()=>()=>controller.hide(),[controller]);
 function preview(){const text=s.draft.trim();Alert.alert(text?(zh?'确认分享给这位同学':'Confirm sharing with this person'):(zh?'清空我的分享':'Clear my shared card'),`${peer.display_name}\n\n${text||(zh?'你的联系方式将不再显示。':'Your contact card will no longer be shown.')}\n\n${zh?'无法收回已被对方看到或复制的内容。':'Previously viewed or copied details cannot be recalled.'}`,[{text:zh?'继续编辑':'Keep editing',style:'cancel'},{text:zh?'确认':'Confirm',onPress:()=>void controller.save(text)}]);}
 return <View style={styles.stack}>
  <Button variant="ghost" isDisabled={busy} onPress={()=>protect(onBack)}>{zh?'返回再次同行':'Back to meet again'}</Button>
  <Text style={[styles.title,{color:c.text}]}>{zh?'联系方式':'Contact card'}</Text>
  <Text style={[styles.heading,{color:c.text}]}>{peer.display_name}</Text>
  <Text style={[styles.body,{color:c.muted}]}>{zh?'只分享你愿意提供的联系方式。不会自动填入学校邮箱；双方同意不要求双方都分享。':'Share only the contact details you choose. Your school email is never filled in automatically, and neither person is obliged to share.'}</Text>
  <View style={[styles.card,{backgroundColor:c.surface}]}>
   <Text style={[styles.heading,{color:c.text}]}>{zh?'我想分享的内容':'What I choose to share'}</Text>
   <Input accessibilityLabel={zh?'自愿分享的联系方式':'Contact details to share voluntarily'} multiline maxLength={300} autoCorrect={false} autoCapitalize="none" editable={!busy} value={s.draft} onChangeText={text=>controller.edit(text)} placeholder={zh?'填写你选择的联系渠道':'Enter a contact channel you choose'} style={{minHeight:110,textAlignVertical:'top'}}/>
   <Text style={[styles.caption,{color:c.muted}]}>{s.draft.length}/300 · {zh?'清空后确认即可移除分享':'Clear and confirm to remove sharing'}</Text>
  </View>
  {busy?<Text accessibilityLiveRegion="polite" style={{color:c.muted}}>{zh?'正在核对…':'Checking…'}</Text>:null}
  {s.phase==='uncertain'||s.phase==='error'?<Text accessibilityRole="alert" style={{color:c.danger}}>{s.phase==='uncertain'?(zh?'保存结果待确认。草稿仍在，请先读取当前分享。':'Save result unconfirmed. Your draft is kept; read the current card first.'):(zh?'无法核对。请重试；双方意愿或活动状态可能已变化。':'Unable to check. Retry; consent or activity eligibility may have changed.')}</Text>:null}
  <Button isDisabled={safetyPending||s.phase!=='ready'||!s.dirty} onPress={preview}>{s.draft.trim()?(zh?'预览并确认分享':'Preview and confirm sharing'):(zh?'确认清空分享':'Confirm clearing')}</Button>
  <Button variant="secondary" isDisabled={busy} onPress={()=>void controller.refresh()}>{zh?'读取当前分享':'Read current card'}</Button>
  {s.dirty&&s.value?<Button variant="ghost" isDisabled={busy} onPress={()=>Alert.alert(zh?'使用已保存内容？':'Use saved content?',zh?'这会放弃当前草稿。':'This discards your current draft.',[{text:zh?'保留草稿':'Keep draft',style:'cancel'},{text:zh?'使用已保存内容':'Use saved content',onPress:()=>controller.useSaved()}])}>{zh?'使用已保存内容':'Use saved content'}</Button>:null}
  {focused&&s.phase==='ready'?<View style={[styles.card,{backgroundColor:c.surface}]}><Text style={[styles.heading,{color:c.text}]}>{zh?'本次读取的对方分享':'Their card from this check'}</Text><Text selectable style={[styles.body,{color:c.text}]}>{s.value?.peer?.text??(zh?'当前没有可查看的联系方式。':'No contact details are currently available.')}</Text></View>:null}
  <SafetyActions target={s.value?.peer?.report_id?{kind:'contact_card',id:s.value.peer.report_id}:null} author={peer} language={language} dark={dark} disabled={busy} onPendingChange={setSafetyPending} onChanged={()=>{controller.hide();onBack();}}/>
  <Text style={[styles.caption,{color:c.muted}]}>{zh?'撤回意愿、屏蔽或到期后，旧卡片不会恢复。你也可以只参加活动，不交换联系方式。':'Withdrawal, blocking or expiry will not restore old cards. You can take part without exchanging contact details.'}</Text>
 </View>;
}

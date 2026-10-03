import {AccountExitController,type AccountExitKind} from './src/navigation/account-exit';
import {NavigationProtections} from './src/navigation/protection';
import {InputProtectionContext,confirmNavigation} from './src/navigation/InputProtection';
import {TabScene} from './src/navigation/TabScene';
import * as Notifications from 'expo-notifications';
import {isCampusReminder} from './src/reminders/device';
import {reminderTarget} from './src/reminders/target';
import {ReminderSettings} from './src/reminders/ReminderControls';
import {GovernanceScreen} from './src/social/GovernanceScreen';
import {CommunityScreen,type DiscoveryTarget} from './src/social/CommunityScreen';
import {InboxScreen} from './src/social/InboxScreen';
import { CampusScreen } from './src/campus/CampusScreen';
import './global.css';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AppState, ActivityIndicator, Alert, Keyboard, KeyboardAvoidingView, Pressable, Text, useColorScheme, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { HeroUINativeProvider } from 'heroui-native/provider';
import { Button, NavigationRow } from './src/ui/Primitives';
import { AppearanceProvider, useAppearance } from './src/ui/Appearance';
import { Aurora, FloatingTabBar, ListGroup, ListRow, type PenIconName } from './src/ui/Pen';
import { SceneOverlayStore, useOverlayPresent } from './src/navigation/SceneOverlay';
import { StatusBar } from 'expo-status-bar';
import { session,reminders } from './src/runtime';
import { LoginScreen, ProfileScreen } from './src/screens/AccountScreen';
import { strings, type Language } from './src/strings';
import { palette, styles } from './src/theme';
import { StudyScreen } from './src/study/StudyScreen';
import { GuestHome } from './src/study/TodayHome';

function CampusApp() {
  const state = useSyncExternalStore(session.subscribe, session.snapshot);
  const [language, setLanguage] = useState<Language>('zh');
  const [tab, setTab] = useState(0);
  // Pen "Component / Tab bar" lucide glyphs.
  const icons:PenIconName[]=['calendar-days','map','messages-square','inbox','user-round'];
  const insets=useSafeAreaInsets();
  const overlays=useRef([0,1,2,3,4].map(()=>new SceneOverlayStore())).current;
  const pushed=useOverlayPresent(overlays[tab]);
  const [studyTarget,setStudyTarget]=useState<{id:string;date:string;owner:string}|null>(null);
  const [safetyOpen,setSafetyOpen]=useState(false);
  const guards=useRef(new NavigationProtections()).current;
  const exits=useRef(new AccountExitController(()=>session.snapshot().profile?.id??null,()=>guards.status(),kind=>kind==='delete'?session.deleteAccount():session.signOut())).current;
  const exitState=useSyncExternalStore(exits.subscribe,exits.snapshot);
  useEffect(()=>exits.reset(),[state.profile?.id,exits]);
  function requestAccountExit(kind:AccountExitKind){
    const decision=exits.prepare(kind),zh=language==='zh',labels=strings[language];
    if(decision.status==='signed-out')return;
    if(decision.status==='busy'){Alert.alert(zh?'正在保存或处理':'Work is in progress',zh?'其他页面或账户操作尚未完成，请等待结果后再退出。':'A page or account operation is still in progress. Wait for its result before leaving.');return;}
    const {proposal}=decision;
    if(!proposal.requiresConfirmation){void exits.commit(proposal);return;}
    const draft=proposal.protection==='uncertain'?(zh?'有操作结果尚未确认，内容可能已保存。离开后请先核对服务器记录，避免重复创建。':'An operation is unconfirmed and may already be saved. Check server records before creating another.'):
      proposal.protection==='draft'?(zh?'其他页面或账户资料中有未保存的输入，退出或删除会清除这些草稿。':'There is unsaved input in this account or another page. Signing out or deleting the account clears those drafts.') : '';
    Alert.alert(kind==='delete'?labels.delete:labels.signOut,[kind==='delete'?labels.deleteBody:'',draft].filter(Boolean).join('\n\n'),[
      {text:labels.cancel,style:'cancel',onPress:()=>exits.cancel(proposal)},
      {text:kind==='delete'?labels.delete:labels.signOut,style:'destructive',onPress:()=>void exits.commit(proposal,true)},
    ]);
  }
  const [targetRevision,setTargetRevision]=useState(0);
  const [queuedReminder,setQueuedReminder]=useState<(NonNullable<ReturnType<typeof reminderTarget>>&{owner:string})|null>(null);
  const [activityTarget,setActivityTarget]=useState<(DiscoveryTarget&{owner:string|null;returnTab?:0|3})|null>(null);
  const pages=useRef<((()=>void)|null)[]>([]);
  const scrollToTop=useCallback(()=>{requestAnimationFrame(()=>pages.current[2]?.());},[]);
  useEffect(()=>{Keyboard.dismiss();},[tab]);
  useEffect(()=>{pages.current[4]?.();},[safetyOpen]);
  function guardedOpen(scene:number,proceed:()=>void){
    const owner=state.profile?.id??null;
    confirmNavigation(guards.status(scene),language==='zh',()=>{if((session.snapshot().profile?.id??null)===owner)proceed();});
  }
  const openActivity=(id:string)=>guardedOpen(2,()=>{setTargetRevision(v=>v+1);setActivityTarget({id,kind:'activity',owner:state.profile?.id??null,returnTab:tab===0||tab===3?tab:undefined});setTab(2);});
  const openPost=(id:string)=>guardedOpen(2,()=>{setTargetRevision(v=>v+1);setActivityTarget({id,kind:'post',owner:state.profile?.id??null,returnTab:tab===0||tab===3?tab:undefined});setTab(2);});
  const dark = useColorScheme() === 'dark';
  const colors = palette[dark ? 'dark' : 'light'], t = strings[language];
  useEffect(() => { void session.restore(); }, []);
  useEffect(()=>{
    const refresh=()=>void reminders.refresh();
    let identity='';
    const unsubscribe=session.subscribe(()=>{const value=session.snapshot();const next=value.status+':'+value.profile?.id+':'+value.profile?.language;if(next!==identity){identity=next;refresh();}});
    const unsubscribeWrites=session.subscribeMutations(()=>void reminders.refresh('invalidate'));
    const foreground=AppState.addEventListener('change',value=>{if(value==='active')refresh();});
    const timer=setInterval(()=>{if(AppState.currentState==='active')refresh();},300_000);
    refresh();return()=>{unsubscribe();unsubscribeWrites();foreground.remove();clearInterval(timer);};
  },[]);
  useEffect(()=>{setActivityTarget(null);setStudyTarget(null);setSafetyOpen(false);setQueuedReminder(null);},[state.profile?.id]);
  useEffect(()=>{
    if(state.status==='loading')return;
    const receive=(response:Notifications.NotificationResponse)=>{
      const request=response.notification.request;
      if(!isCampusReminder(request.identifier))return;
      const owner=session.snapshot().profile?.id??null;
      const target=reminderTarget(request.content.data,owner);
      Notifications.clearLastNotificationResponse();
      if(!target||!owner)return;
      const destination=target.kind==='activity'?2:0;
      if(guards.status(destination)!=='clear'){setQueuedReminder({...target,owner});return;}
      if(target.kind==='activity'){setTargetRevision(v=>v+1);setActivityTarget({kind:'activity',id:target.id,owner});setTab(2);}
      else{setStudyTarget({id:target.id,date:target.date,owner});setTab(0);}
    };
    const last=Notifications.getLastNotificationResponse();if(last)receive(last);
    const subscription=Notifications.addNotificationResponseReceivedListener(receive);
    return()=>subscription.remove();
  },[state.status,state.profile?.id]);
  useEffect(() => { if (state.profile) setLanguage(state.profile.language); }, [state.profile?.id]);
  return <SafeAreaView edges={['left','right']} style={[styles.flex, { backgroundColor: colors.background }]}>
    <StatusBar style={dark ? 'light' : 'dark'} />
    <Aurora/>
    {queuedReminder&&queuedReminder.owner===state.profile?.id?<View style={[styles.smallStack,{paddingTop:insets.top,paddingHorizontal:16}]}><Text style={[styles.caption,{color:colors.muted}]}>{language==='zh'?'提醒已保留，当前输入没有被覆盖。':'Reminder kept. Your current input is unchanged.'}</Text><Button variant="secondary" onPress={()=>guardedOpen(queuedReminder.kind==='activity'?2:0,()=>{
      const owner=state.profile?.id;if(!owner)return;
      if(queuedReminder.kind==='activity'){setTargetRevision(v=>v+1);setActivityTarget({kind:'activity',id:queuedReminder.id,owner});setTab(2);}
      else{setStudyTarget({id:queuedReminder.id,date:queuedReminder.date,owner});setTab(0);}
      setQueuedReminder(null);
    })}>{language==='zh'?'查看这条提醒':'Open this reminder'}</Button><Button variant="ghost" onPress={()=>setQueuedReminder(null)}>{language==='zh'?'忽略':'Dismiss'}</Button></View>:null}
    <KeyboardAvoidingView behavior="padding" style={styles.flex}>
      <View key={state.profile?.id??state.status} style={styles.flex}>
      {[0,1,2,3,4].map(index=><InputProtectionContext.Provider key={index} value={{guards,scene:index}}><TabScene active={tab===index} pageRef={value=>{pages.current[index]=value;}} contentContainerStyle={styles.page} overlay={overlays[index]}>
        {index === 4 ? state.status === 'loading' ? <View style={styles.stack}><ActivityIndicator color={colors.accent} /><Text style={{ color: colors.text }}>{t.loading}</Text></View>
          : state.status === 'error' ? <View style={styles.stack}><Text accessibilityRole="alert" style={[styles.body, { color: colors.danger }]}>{t.errors[state.error ?? ''] ?? t.network}</Text><Button onPress={() => session.restore()}>{t.retry}</Button></View>
          : state.profile ? safetyOpen?<GovernanceScreen key={state.profile.id} language={language} dark={dark} onBack={()=>setSafetyOpen(false)}/>:<ProfileScreen key={state.profile.id} profile={state.profile} language={language} dark={dark} exitBusy={exitState.busy} exitError={exitState.error} onExit={requestAccountExit} onLanguage={()=>setLanguage(language==='zh'?'en':'zh')} onSafety={()=>guardedOpen(4,()=>setSafetyOpen(true))} onActivity={openActivity}/>
          : <LoginScreen language={language} dark={dark} onGuest={()=>setTab(1)}/>
          : index === 0 ? state.profile ? <StudyScreen key={state.profile.id} name={state.profile.display_name||state.profile.email} onMe={()=>setTab(4)} language={language} dark={dark} onActivity={openActivity} onPost={openPost} onCampus={()=>setTab(1)} onInbox={()=>setTab(3)} initialReminder={studyTarget?.owner===state.profile.id?studyTarget:null} />
          : <GuestHome language={language} title={t.tabs[0]} onLogin={()=>setTab(4)} onCampus={()=>setTab(1)}/>
          : index === 1 ? <CampusScreen key={state.profile?.id??'visitor'} language={language} dark={dark} onLogin={()=>setTab(4)} name={state.profile?.display_name||state.profile?.email} onMe={()=>setTab(4)}/>
          : index === 2 ? <CommunityScreen key={`${state.profile?.id??'visitor'}:${targetRevision}`} language={language} dark={dark} onLogin={()=>setTab(4)} initialTarget={activityTarget?.owner===(state.profile?.id??null)?activityTarget:null} name={state.profile?.display_name||state.profile?.email} onMe={()=>setTab(4)} onDismissTarget={()=>{const target=activityTarget;setActivityTarget(null);if(target?.owner===(state.profile?.id??null)&&target.returnTab!==undefined)setTab(target.returnTab);}} onNavigate={scrollToTop}/>
          : state.profile ? <InboxScreen key={state.profile.id} name={state.profile.display_name||state.profile.email} onMe={()=>setTab(4)} language={language} dark={dark} onActivity={openActivity} onPost={openPost}/>
          : <GuestHome language={language} title={t.tabs[3]} inbox onLogin={()=>setTab(4)} onCampus={()=>setTab(1)}/>}
      </TabScene></InputProtectionContext.Provider>)}
      </View>
    </KeyboardAvoidingView>
    {!pushed?<FloatingTabBar tabs={t.tabs.map((label,index)=>({label,icon:icons[index]}))} selected={tab} onSelect={setTab}/>:null}
  </SafeAreaView>;
}
export default function App() {
  return <GestureHandlerRootView style={styles.flex}><SafeAreaProvider><HeroUINativeProvider><AppearanceProvider><CampusApp /></AppearanceProvider></HeroUINativeProvider></SafeAreaProvider></GestureHandlerRootView>;
}

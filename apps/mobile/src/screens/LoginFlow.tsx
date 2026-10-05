// Pen "V6 / 登录 · 欢迎页（学校邮箱）" (E3oiE): the brand over Clear Water Bay and one way in, a school email.
// The sheet is "V6 / 登录 · 学校邮箱（面板）" (mvCEP), then "V6 / 登录 · 输入验证码（面板）" (YLGFD); the first sign-in
// registers the account. Right after signing in, "V6 / 登录后 · 连接学校数据" (n26RV, Ly7By) comes before the tabs.
// Flow: "V6 / 登录流程（学校邮箱 → 连接 → 今天）" (ETOdn).
import {useEffect,useRef,useState} from 'react';
import {ActivityIndicator,Image,Keyboard,Pressable,ScrollView,StyleSheet,Text,TextInput,View,useWindowDimensions} from 'react-native';
import Svg,{Defs,LinearGradient,Rect,Stop} from 'react-native-svg';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {StatusBar} from 'expo-status-bar';
import {BottomSheet} from '../ui/BottomSheet';
import {Notice,PenIcon,PrimaryButton,usePenColors,type PenIconName} from '../ui/Pen';
import {useAppearance} from '../ui/Appearance';
import {feel} from '../ui/feel';
import {api,session} from '../runtime';
import {strings,type Language} from '../strings';
import {styles} from '../theme';
import {SchoolSourcesScreen} from '../study/SchoolSourcesScreen';
import {useAction} from './AccountScreen';

const bay=require('../../assets/covers/1596701751324-f4e90ad56d6f.jpg');
/** Welcome colours from E3oiE: always the deep navy brand, in light and dark mode alike. */
const navy={top:'#0B1A33',bottom:'#132A52',fade:'#0F2142',mid:'#11264A',ink:'#182F59'};
// One whole address: a name, then the school domain (local example.test accounts only in development builds).
const schoolEmail=(v:string)=>/^[^\s@]+@(connect\.)?ust\.hk$/i.test(v.trim())||(__DEV__&&/^[^\s@]+@example\.test$/i.test(v.trim()));
type Challenge={id:string;expiresAt:string;localInbox:boolean};

export function WelcomeLogin({language,onSignedIn}:{language:Language;onSignedIn:()=>void}){
 const t=strings[language],zh=language==='zh',c=usePenColors(),insets=useSafeAreaInsets(),{height}=useWindowDimensions(),{reduceMotion}=useAppearance();
 const [open,setOpen]=useState(false),[email,setEmail]=useState(''),[challenge,setChallenge]=useState<Challenge|null>(null),[code,setCode]=useState(''),[wait,setWait]=useState(0);
 const boxes=useRef<(TextInput|null)[]>([]),[focused,setFocused]=useState(-1);
 useEffect(()=>{if(!wait)return;const timer=setTimeout(()=>setWait(w=>Math.max(0,w-1)),1000);return()=>clearTimeout(timer);},[wait]);
 const action=useAction(language);
 // A request makes the field read-only, which drops the keyboard; put it back whenever the code step is idle again.
 useEffect(()=>{if(challenge&&!action.busy&&code.length<6)boxes.current[code.length]?.focus();},[challenge,action.busy]);
 const send=()=>action.run(async()=>{
  const result=await api.request<{challenge_id:string;expires_at:string;delivery?:string;retry_after_seconds?:number}>('/auth/email/challenges',{method:'POST',body:{email:email.trim()}});
  if(action.isCurrent()){setChallenge({id:result.challenge_id,expiresAt:result.expires_at,localInbox:result.delivery==='local_development_inbox'});setCode('');setWait(result.retry_after_seconds??60);}
 });
 const verify=()=>action.run(async()=>{
  if(!challenge)return;
  const result=await api.request<{access_token:string}>('/auth/email/verify',{method:'POST',body:{challenge_id:challenge.id,code}});
  if(action.isCurrent()){onSignedIn();await session.signIn(result.access_token);}
 });
 const back=()=>{setChallenge(null);setCode('');action.setMessage('');};
 const minutes=challenge?Math.max(1,Math.round((Date.parse(challenge.expiresAt)-Date.now())/60000)):0;
 const photo=Math.round(height*0.58);
 const header=<View style={{flexDirection:'row',alignItems:'center',paddingHorizontal:16,height:44}}>
  <Pressable accessibilityRole="button" hitSlop={10} disabled={action.busy} onPress={challenge?back:()=>setOpen(false)} style={{width:72}}><Text style={{fontSize:17,color:c.accent}}>{challenge?(zh?'‹ 返回':'‹ Back'):(zh?'取消':'Cancel')}</Text></Pressable>
  <Text accessibilityRole="header" style={{flex:1,textAlign:'center',fontSize:17,fontWeight:'700',color:c.text}}>{challenge?(zh?'输入验证码':'Enter the code'):(zh?'学校邮箱登录':'School email')}</Text>
  <View style={{width:72}}/>
 </View>;
 const emailStep=<View style={{paddingHorizontal:16,paddingTop:8,paddingBottom:8,gap:16}}>
  <View style={{gap:6}}>
   <Text style={{fontSize:13,fontWeight:'600',color:c.muted}}>{t.email}</Text>
   <View style={{height:52,justifyContent:'center',paddingHorizontal:16,borderRadius:14,borderCurve:'continuous',borderWidth:1.5,borderColor:c.accent,backgroundColor:c.surface}}>
    <TextInput accessibilityLabel={t.email} value={email} onChangeText={setEmail} editable={!action.busy} autoFocus keyboardType="email-address" autoCapitalize="none" autoCorrect={false} textContentType="emailAddress" autoComplete="email" returnKeyType="send" onSubmitEditing={()=>{if(schoolEmail(email))send();}} placeholder="name@connect.ust.hk" placeholderTextColor={c.tertiary} style={{fontSize:17,color:c.text,padding:0}}/>
   </View>
   <Text style={{fontSize:12,lineHeight:17,color:c.muted}}>{zh?'只接受 @connect.ust.hk 和 @ust.hk。第一次登录会自动注册。':'Only @connect.ust.hk and @ust.hk. Your first sign-in creates the account.'}</Text>
  </View>
  {action.message?<Notice tone="error" text={action.message}/>:null}
  <View style={{flexDirection:'row'}}><PrimaryButton label={action.busy?t.loading:t.sendCode} disabled={action.busy||!schoolEmail(email)} onPress={send}/></View>
 </View>;
 const codeStep=<View style={{paddingHorizontal:16,paddingTop:8,paddingBottom:8,gap:16}}>
  <Text style={{fontSize:15,lineHeight:22,color:c.muted}}>{challenge?.localInbox?(zh?'开发版不会发真实邮件，验证码在本机开发收件箱里。':'Development build: no real email is sent; the code is in the local development inbox.'):(zh?`验证码已发到 ${email.trim()}，${minutes} 分钟内有效。`:`Code sent to ${email.trim()}; valid for ${minutes} min.`)}</Text>
  {/* Six real fields: typing moves on, backspace goes back, and a pasted or auto-filled code spreads across. */}
  <View style={{flexDirection:'row',gap:8}}>
   {[0,1,2,3,4,5].map(i=><TextInput key={i} ref={el=>{boxes.current[i]=el;}} accessibilityLabel={zh?`验证码第 ${i+1} 位`:`Code digit ${i+1}`} value={code[i]??''} editable={!action.busy} autoFocus={i===0} keyboardType="number-pad" textContentType={i===0?'oneTimeCode':'none'} autoComplete={i===0?'one-time-code':'off'} selectTextOnFocus
    onFocus={()=>{if(i>code.length){boxes.current[Math.min(code.length,5)]?.focus();return;}setFocused(i);}} onBlur={()=>setFocused(f=>f===i?-1:f)}
    onChangeText={v=>{const d=v.replace(/\D/g,'');if(!d){setCode(code.slice(0,i));return;}const next=(code.slice(0,i)+d).slice(0,6);setCode(next);if(next.length===6)Keyboard.dismiss();else boxes.current[next.length]?.focus();}}
    onKeyPress={e=>{if(e.nativeEvent.key==='Backspace'&&!code[i]&&i>0){setCode(code.slice(0,i-1));boxes.current[i-1]?.focus();}}}
    style={{flex:1,height:58,borderRadius:12,borderCurve:'continuous',textAlign:'center',fontSize:26,fontWeight:'700',fontVariant:['tabular-nums'],color:c.text,backgroundColor:c.surface,borderWidth:focused===i?2:0,borderColor:c.accent,padding:0}}/>)}
  </View>
  {action.message?<Notice tone="error" text={action.message}/>:null}
  <View style={{flexDirection:'row'}}><PrimaryButton label={action.busy?t.loading:t.signIn} disabled={action.busy||code.length!==6} onPress={verify}/></View>
  <View style={{flexDirection:'row',justifyContent:'center',gap:24}}>
   <Pressable accessibilityRole="button" accessibilityState={{disabled:action.busy||wait>0}} disabled={action.busy||wait>0} hitSlop={8} onPress={send}><Text style={{fontSize:15,fontWeight:'600',color:wait>0?c.muted:c.accent,fontVariant:['tabular-nums']}}>{wait>0?(zh?`重新获取 · ${wait} 秒`:`Resend · ${wait}s`):t.resend}</Text></Pressable>
   <Pressable accessibilityRole="button" disabled={action.busy} hitSlop={8} onPress={back}><Text style={{fontSize:15,fontWeight:'600',color:c.accent}}>{t.changeEmail}</Text></Pressable>
  </View>
 </View>;
 return <View style={{flex:1,backgroundColor:navy.top}}>
  <StatusBar style="light"/>
  <Svg pointerEvents="none" style={StyleSheet.absoluteFill}><Defs><LinearGradient id="welcome" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={navy.top}/><Stop offset="1" stopColor={navy.bottom}/></LinearGradient></Defs><Rect width="100%" height="100%" fill="url(#welcome)"/></Svg>
  <Image source={bay} resizeMode="cover" accessible={false} style={{position:'absolute',left:0,right:0,bottom:0,width:'100%',height:photo}}/>
  <Svg pointerEvents="none" style={{position:'absolute',left:0,right:0,bottom:0,width:'100%',height:photo}}><Defs><LinearGradient id="bay" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={navy.fade} stopOpacity={1}/><Stop offset="0.38" stopColor={navy.fade} stopOpacity={0}/><Stop offset="0.68" stopColor={navy.mid} stopOpacity={0.33}/><Stop offset="1" stopColor={navy.bottom} stopOpacity={0.96}/></LinearGradient></Defs><Rect width="100%" height="100%" fill="url(#bay)"/></Svg>
  <View style={{paddingTop:insets.top+76,paddingHorizontal:24,alignItems:'center',gap:10}}>
   <Text style={{fontSize:13,fontWeight:'700',letterSpacing:3,color:'#FFFFFF99'}}>HKUST</Text>
   <Text accessibilityRole="header" style={{fontSize:54,lineHeight:62,fontWeight:'800',letterSpacing:-1.5,color:'#FFFFFF'}}>USTLIFE</Text>
   <Text style={{fontSize:24,lineHeight:34,fontWeight:'600',textAlign:'center',color:'#FFFFFFC7'}}>{zh?'大学生活，\n从容一点。':'Campus life,\na little calmer.'}</Text>
  </View>
  <View style={{flex:1}}/>
  <View style={{paddingHorizontal:24,paddingBottom:Math.max(insets.bottom,16)+20,gap:16,alignItems:'center'}}>
   <Pressable accessibilityRole="button" onPress={()=>{feel.tap();action.setMessage('');setOpen(true);}} style={({pressed})=>({alignSelf:'stretch',height:56,borderRadius:28,borderCurve:'continuous',flexDirection:'row',alignItems:'center',justifyContent:'center',gap:10,backgroundColor:'#FFFFFF',boxShadow:'0 8px 24px #00000033',opacity:pressed?0.85:1,transform:[{scale:pressed&&!reduceMotion?0.98:1}]})}>
    <PenIcon name="mail" size={20} color={navy.ink}/><Text style={{fontSize:17,fontWeight:'700',color:navy.ink}}>{zh?'使用学校邮箱登录':'Sign in with school email'}</Text>
   </Pressable>
   <Text style={{fontSize:12,lineHeight:17,textAlign:'center',color:'#FFFFFFA6'}}>{zh?'只接受 @connect.ust.hk 和 @ust.hk 邮箱\n第一次登录会自动注册':'Only @connect.ust.hk and @ust.hk addresses\nYour first sign-in creates the account'}</Text>
  </View>
  <BottomSheet visible={open} onClose={()=>{if(!action.busy)setOpen(false);}} closeLabel={zh?'关闭':'Close'} header={header}>{challenge?codeStep:emailStep}</BottomSheet>
 </View>;
}

type Linked={canvas:boolean;calendar:boolean};
/** Pen "V6 / 登录后 · 连接学校数据" (n26RV) and, once something is linked, "（已连接）" (Ly7By). Shown right after
 *  signing in when neither Canvas nor a school calendar is connected; anyone already connected goes straight in. */
export function ConnectStep({language,dark,onDone}:{language:Language;dark:boolean;onDone:()=>void}){
 const zh=language==='zh',c=usePenColors(),insets=useSafeAreaInsets();
 const [linked,setLinked]=useState<Linked|null>(null),[connecting,setConnecting]=useState(false);
 const done=useRef(onDone);done.current=onDone;
 const check=async(first:boolean)=>{
  // A failed read counts as "not connected": the student can still connect or go on, nothing is claimed.
  const [connections,subscriptions]=await Promise.all([session.request<{provider:string;state:string}[]>('/school/connections').catch(()=>[]),session.request<unknown[]>('/calendar/subscriptions').catch(()=>[])]);
  const next={canvas:connections.some(x=>x.provider==='canvas'&&(x.state==='connected'||x.state==='partial')),calendar:subscriptions.length>0};
  if(first&&(next.canvas||next.calendar))done.current();else setLinked(next);
 };
 useEffect(()=>{void check(true);},[]);
 if(connecting)return <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.page,{paddingTop:insets.top+8,paddingBottom:insets.bottom+32}]}>
  <SchoolSourcesScreen language={language} dark={dark} onBack={()=>{setConnecting(false);void check(false);}}/>
 </ScrollView>;
 if(!linked)return <View style={{flex:1,alignItems:'center',justifyContent:'center'}}><ActivityIndicator color={c.accent}/></View>;
 const any=linked.canvas||linked.calendar;
 const chip=(label:string,tone:'ok'|'done'|'wait')=>{const col=tone==='ok'?c.green:tone==='wait'?c.orange:c.accent;return <View style={{flexDirection:'row',alignItems:'center',gap:4,paddingVertical:3,paddingHorizontal:9,borderRadius:99,backgroundColor:col+'1F'}}>
  {tone==='done'?<PenIcon name="check" size={12} color={col}/>:null}<Text style={{fontSize:12,fontWeight:'600',color:col}}>{label}</Text>
 </View>;};
 const row=(icon:PenIconName,title:string,detail:string,status:React.ReactNode)=><View style={{flexDirection:'row',alignItems:'center',gap:12,paddingVertical:14,borderBottomWidth:0.5,borderBottomColor:c.border}}>
  <PenIcon name={icon} size={20} color={c.accent}/>
  <View style={{flex:1,gap:3}}><Text style={{fontSize:16,lineHeight:23,color:c.text}}>{title}</Text><Text style={{fontSize:13,lineHeight:19,color:c.muted}}>{detail}</Text></View>
  {status}
 </View>;
 const ready=zh?'可用':'Ready',on=zh?'已连接':'Connected';
 return <ScrollView contentContainerStyle={{paddingTop:insets.top+16,paddingHorizontal:16,paddingBottom:insets.bottom+24,gap:16}}>
  <View style={{gap:5}}>
   <Text style={{fontSize:12,lineHeight:17,fontWeight:'600',color:c.accent}}>{zh?'登录成功 · 最后一步':'Signed in · last step'}</Text>
   <Text accessibilityRole="header" style={{fontSize:32,lineHeight:46,fontWeight:'700',color:c.text}}>{any?(zh?'连好了，\n今天的事会自动进来':'Connected.\nYour day will fill in.'):(zh?'连接一次，\n今天的事都在这里':'Connect once.\nYour day in one place.')}</Text>
   <Text style={{fontSize:15,lineHeight:22,color:c.muted}}>{any?(zh?'已连接的数据会自动同步。之后在「我的 → 学校连接」里随时增加或断开。':'Connected sources sync on their own. Add or disconnect any time in Me → School connections.'):(zh?'连接 Canvas 和学校日历后，作业、截止和课程会自动同步。':'Connect Canvas and your school calendar and deadlines and classes sync automatically.')}</Text>
  </View>
  <View style={{gap:8}}>
   <Text style={{fontSize:19,lineHeight:28,fontWeight:'600',color:c.text}}>{zh?'可以连接的':'What you can connect'}</Text>
   <View>
    {row('calendar-days',zh?'学校日历':'School calendar',zh?'Outlook、Google、iCloud 的日历链接 · 课程和会议自动进来':'Outlook, Google or iCloud calendar link · classes and meetings flow in',linked.calendar?chip(on,'done'):chip(ready,'ok'))}
    {row('graduation-cap',zh?'Canvas 作业与截止':'Canvas deadlines',zh?'粘贴 Canvas 令牌 · 截止日期自动进来':'Paste a Canvas token · due dates flow in',linked.canvas?chip(on,'done'):chip(ready,'ok'))}
    {row('mail',zh?'课表、成绩、学校邮箱':'Timetable, grades, mail',zh?'SIS 与 Microsoft 365 需要学校授权':'SIS and Microsoft 365 need HKUST approval',chip(zh?'待学校开放':'Awaiting HKUST','wait'))}
   </View>
  </View>
  <View style={{flexDirection:'row'}}><PrimaryButton label={any?(zh?'进入今天':'Go to Today'):(zh?'连接 Canvas 和日历':'Connect Canvas & calendar')} onPress={()=>{if(any)done.current();else setConnecting(true);}}/></View>
  <View style={{alignItems:'center',gap:18}}>
   {!any||!(linked.canvas&&linked.calendar)?<Pressable accessibilityRole="button" hitSlop={8} onPress={()=>{feel.tap();if(any)setConnecting(true);else done.current();}} style={({pressed})=>({opacity:pressed?0.6:1})}><Text style={{fontSize:15,fontWeight:'600',color:c.accent}}>{any?(zh?'继续连接':'Connect more'):(zh?'稍后再说，先进入 App':'Not now — open the app')}</Text></Pressable>:null}
   <View style={{flexDirection:'row',gap:8}}><PenIcon name="lock" size={14} color={c.muted}/><Text style={{flex:1,fontSize:12,lineHeight:17,color:c.muted}}>{zh?'Canvas 令牌加密保存，只用来读取作业；随时可以在「我的 → 学校连接」里断开并删除。':'Your Canvas token is stored encrypted and only reads assignments; disconnect and delete it any time in Me → School connections.'}</Text></View>
  </View>
 </ScrollView>;
}

import { useEffect,useRef,useState } from 'react';
import {useNavigationProtection} from '../navigation/InputProtection';
import {protectionFor} from '../navigation/protection';
import type {AccountExitKind} from '../navigation/account-exit';
import { ActionSheetIOS, Alert, Image, Pressable, Share, Text, TextInput, View } from 'react-native';
import Svg,{Defs,LinearGradient,Rect,Stop} from 'react-native-svg';
import { ApiFailure } from '../api';
import { api, session } from '../runtime';
import type { Profile } from '../session';
import { strings, type Language } from '../strings';
import {NumberFlow} from 'number-flow-react-native';
import {DataApiScreen} from '../life/SocialExtras';
import {usePageTop} from '../navigation/TabScene';
import {CircleButton,GradientCircle,EmptyState,FormField,FormGroup,IconTile,LargeTitle,ListGroup,ListRow,Notice,PageHeader,PenIcon,PrimaryButton,Section,Skeleton,Stagger,Surface,usePenColors} from '../ui/Pen';
import {ReminderSettings} from '../reminders/ReminderControls';
import {SchoolSourcesScreen} from '../study/SchoolSourcesScreen';
import type {Activity} from '../../../../src/product/social/types';
import {activityCover,cardDateTime} from '../social/covers';
import {participationLabel} from '../social/shared';
import {dueWithinWeek} from '../study/dates';
import {feel} from '../ui/feel';

type Props = { language: Language; dark: boolean };
function useAction(language: Language) {
  const [busy, setBusy] = useState(false);
  const locked=useRef(false),alive=useRef(true);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  async function run(action: () => Promise<void>) {
    if (locked.current||!alive.current) return;
    locked.current=true;setBusy(true); setMessage(''); setFailed(false);
    try { await action(); }
    catch (error) { if(alive.current){setFailed(true); setMessage(strings[language].errors[error instanceof ApiFailure ? error.code : 'REQUEST_FAILED'] ?? strings[language].errors.REQUEST_FAILED);} }
    finally { locked.current=false;if(alive.current)setBusy(false); }
  }
  return { busy, message, failed, run, isCurrent:()=>alive.current, setMessage:(value:string)=>{if(alive.current)setMessage(value);} };
}

// Pen "V6 / 登录入口（学校邮箱）" (Nlb7d): a school email is the only way in; the first sign-in registers the
// account. The code step says where the code went (the server reports a local development inbox when no real
// email is sent) and when it can be requested again.
const schoolEmail=(v:string)=>/@(connect\.)?ust\.hk$/i.test(v.trim())||(__DEV__&&/@example\.test$/i.test(v.trim()));
type Challenge={id:string;expiresAt:string;localInbox:boolean};
export function LoginScreen({ language }: Props) {
  const t = strings[language], c = usePenColors(), zh=language==='zh';
  const [email, setEmail] = useState('');
  const [challenge, setChallenge] = useState<Challenge|null>(null);
  const [code, setCode] = useState('');
  const [wait, setWait] = useState(0);
  useEffect(()=>{if(!wait)return;const timer=setTimeout(()=>setWait(w=>Math.max(0,w-1)),1000);return()=>clearTimeout(timer);},[wait]);
  const action = useAction(language);
  const send = () => action.run(async () => {
    const result = await api.request<{ challenge_id: string; expires_at: string; delivery?: string; retry_after_seconds?: number }>('/auth/email/challenges', { method: 'POST', body: { email: email.trim() } });
    if(action.isCurrent()){setChallenge({id:result.challenge_id,expiresAt:result.expires_at,localInbox:result.delivery==='local_development_inbox'});setCode('');setWait(result.retry_after_seconds??60);}
  });
  const minutes=challenge?Math.max(1,Math.round((Date.parse(challenge.expiresAt)-Date.now())/60000)):0;
  const row=(icon:string,title:string,body:string)=><View style={{flexDirection:'row',alignItems:'center',gap:12,paddingVertical:14,borderBottomWidth:0.5,borderBottomColor:c.border}}>
    <View style={{flex:1,gap:3}}><Text style={{fontSize:16,lineHeight:23,color:c.text}}>{title}</Text><Text style={{fontSize:13,lineHeight:19,color:c.muted}}>{body}</Text></View>
    <PenIcon name={icon} size={20} color={c.accent}/>
  </View>;
  const field=(label:string,input:React.ReactNode,footer?:string)=><View style={{gap:6}}>
    <Text style={{fontSize:13,fontWeight:'600',color:c.muted}}>{label}</Text>
    <View style={{height:52,justifyContent:'center',paddingHorizontal:16,borderRadius:16,borderCurve:'continuous',borderWidth:1,borderColor:c.border,backgroundColor:c.surface}}>{input}</View>
    {footer?<Text style={{fontSize:12,lineHeight:17,color:c.muted}}>{footer}</Text>:null}
  </View>;
  const input={fontSize:17,color:c.text,padding:0};
  return <View style={{gap:16}}>
    <View style={{gap:5}}>
      <Text style={{fontSize:12,lineHeight:17,fontWeight:'600',color:c.accent}}>USTLIFE · HKUST</Text>
      <Text accessibilityRole="header" style={{fontSize:32,lineHeight:46,fontWeight:'700',color:c.text}}>{zh?'大学生活，\n从容一点。':'Campus life,\na little calmer.'}</Text>
      <Text style={{fontSize:15,lineHeight:22,color:c.muted}}>{zh?'截止、课表、校巴和活动，都在一个地方。':'Deadlines, classes, shuttles and plans in one place.'}</Text>
    </View>
    <View style={{gap:8}}>
      <Text style={{fontSize:19,lineHeight:28,fontWeight:'600',color:c.text}}>{zh?'从今天开始':'Start today'}</Text>
      <View>
        {row('calendar-days',zh?'截止不再漏':'Never miss a deadline',zh?'今天要交什么，一眼看到':'See what is due today at a glance')}
        {row('map',zh?'下一班车几点':'When is the next ride',zh?'校巴时刻表和小巴实时到站':'Shuttle timetables and live minibuses')}
        {row('users',zh?'找人一起做点小事':'Do small things together',zh?'自习、散步、复习小组，想参加再参加':'Study, walk or review together — only if you want')}
      </View>
    </View>
    {field(t.email,<TextInput accessibilityLabel={t.email} value={email} onChangeText={setEmail} editable={!challenge&&!action.busy} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} textContentType="emailAddress" placeholder="name@connect.ust.hk" placeholderTextColor={c.tertiary} style={[input,challenge?{color:c.muted}:null]}/>,challenge?undefined:(zh?'只接受 @connect.ust.hk 和 @ust.hk。第一次登录会自动注册。':'HKUST emails only (@connect.ust.hk, @ust.hk). Your first sign-in creates the account.'))}
    {challenge?field(zh?'验证码':'Code',<TextInput accessibilityLabel={zh?'六位验证码':'Six-digit code'} value={code} onChangeText={v=>setCode(v.replace(/\D/g,''))} editable={!action.busy} keyboardType="number-pad" textContentType="oneTimeCode" maxLength={6} autoFocus placeholder={zh?'六位验证码':'Six-digit code'} placeholderTextColor={c.tertiary} style={[input,{fontVariant:['tabular-nums']}]}/>,
      challenge.localInbox?(zh?'开发版不会发真实邮件，验证码在本机开发收件箱里。':'Development build: no real email is sent; the code is in the local development inbox.'):(zh?`验证码已发到 ${email.trim()}，${minutes} 分钟内有效。`:`Code sent to ${email.trim()}; valid for ${minutes} min.`)):null}
    {action.message?<Notice tone="error" text={action.message}/>:null}
    {challenge?<View style={{gap:14}}>
      <View style={{flexDirection:'row'}}><PrimaryButton label={action.busy?t.loading:t.signIn} disabled={action.busy||code.length!==6} onPress={() => action.run(async () => {
        const result = await api.request<{ access_token: string }>('/auth/email/verify', { method: 'POST', body: { challenge_id: challenge.id, code } });
        if(action.isCurrent())await session.signIn(result.access_token);
      })}/></View>
      <View style={{flexDirection:'row',justifyContent:'center',gap:24}}>
        <Pressable accessibilityRole="button" accessibilityState={{disabled:action.busy||wait>0}} disabled={action.busy||wait>0} hitSlop={8} onPress={send}><Text style={{fontSize:15,fontWeight:'600',color:wait>0?c.muted:c.accent,fontVariant:['tabular-nums']}}>{wait>0?(zh?`重新获取 · ${wait} 秒`:`Resend · ${wait}s`):t.resend}</Text></Pressable>
        <Pressable accessibilityRole="button" disabled={action.busy} hitSlop={8} onPress={() => {setChallenge(null);setCode('');action.setMessage('');}}><Text style={{fontSize:15,fontWeight:'600',color:c.accent}}>{t.changeEmail}</Text></Pressable>
      </View>
    </View>:<View style={{flexDirection:'row'}}><PrimaryButton label={action.busy ? t.loading : t.sendCode} disabled={action.busy || !schoolEmail(email)} onPress={send}/></View>}
  </View>;
}

type MePage='home'|'profile'|'reminders'|'school'|'activities'|'saved'|'ai';
// Pen "V3 / 我的" (OsfrE): profile card, grouped rows with color tiles, account actions last.
export function ProfileScreen({ profile, language, dark,exitBusy,exitError,onExit,onLanguage,onSafety,onActivity,onCampus }: Props & { profile: Profile;exitBusy:boolean;exitError:unknown;onExit:(kind:AccountExitKind)=>void;onLanguage:(language:Language)=>void;onSafety:()=>void;onActivity:(id:string)=>void;onCampus:(target:{kind:'place'|'route';id:string})=>void }) {
  const t = strings[language], c = usePenColors(), zh=language==='zh';
  const [page,setPage]=useState<MePage>('home');
  const action = useAction(language);
  const busy=action.busy||exitBusy;
  usePageTop(page);
  const [stats,setStats]=useState<{joined:number;saved:number;week:number;linked:'school'|'canvas'|null}|null>(null);
  useEffect(()=>{if(page!=='home')return;let live=true;
    Promise.all([session.request<{items:unknown[]}>('/activities?limit=50&mine=participating'),session.request<{items:unknown[]}>('/activities?limit=50&mine=saved'),session.request<{items:{kind:string;status?:string;due_at?:string|null;due_date?:string|null}[]}>('/study/items?limit=100'),session.request<{connections:{provider:string;state:string}[]}>('/school/records?limit=1').catch(()=>({connections:[]})),session.request<unknown[]>('/me/campus/bookmarks').catch(()=>[])])
     .then(([a,b,items,school,marks])=>{if(live)setStats({joined:a.items.length,saved:b.items.length+marks.length,week:dueWithinWeek(items.items),linked:school.connections.some(x=>x.provider==='sis'&&(x.state==='connected'||x.state==='partial'))?'school':school.connections.some(x=>x.provider==='canvas'&&(x.state==='connected'||x.state==='partial'))?'canvas':null});}).catch(()=>{});
    return()=>{live=false;};},[page]);
  if(page==='ai')return <DataApiScreen zh={zh} onBack={()=>setPage('home')}/>;
  if(page==='profile')return <ProfileEditor profile={profile} language={language} onBack={()=>setPage('home')}/>;
  if(page==='school')return <SchoolSourcesScreen language={language} dark={dark} onBack={()=>setPage('home')}/>;
  if(page==='reminders')return <View style={{gap:18}}><PageHeader onBack={()=>setPage('home')} backLabel={zh?'我的':'Me'} title={zh?'自动提醒':'Reminders'}/><ReminderSettings language={language} dark={dark}/></View>;
  if(page==='activities'||page==='saved')return <MyActivities language={language} mode={page==='activities'?'participating':'saved'} onBack={()=>setPage('home')} onActivity={onActivity} onCampus={onCampus}/>;
  const shownName=profile.display_name.trim()||profile.email.split('@')[0];
  const initials=[...shownName].slice(0,2).join('').toUpperCase();
  return <View style={{gap:22}}>
    <View style={{flexDirection:'row',alignItems:'center',minHeight:48}}><View style={{width:44}}/><Text style={{flex:1,textAlign:'center',fontSize:17,fontWeight:'600',color:c.text}}>{t.tabs[4]}</Text><CircleButton icon="settings" label={zh?'编辑资料':'Edit profile'} onPress={()=>setPage('profile')}/></View>
    <Stagger index={0}><View style={{alignItems:'center',gap:10}}>
      <GradientCircle size={104}><Text style={{fontSize:42,fontWeight:'700',color:'#FFFFFF'}}>{initials.slice(0,1)}</Text></GradientCircle>
      <Text numberOfLines={1} style={{fontSize:32,fontWeight:'700',letterSpacing:-0.5,color:c.text}}>{shownName}</Text>
      <Pressable accessibilityRole="button" onPress={()=>setPage('school')} style={({pressed})=>({flexDirection:'row',alignItems:'center',gap:7,paddingVertical:9,paddingHorizontal:16,borderRadius:99,backgroundColor:c.surface,borderWidth:1,borderColor:c.glassBorder,opacity:pressed?0.7:1})}>
        <View style={{width:7,height:7,borderRadius:4,backgroundColor:stats?.linked?c.green:c.orange}}/>
        <Text style={{fontSize:14,fontWeight:'600',color:c.muted}}>{stats?.linked==='school'?(zh?'HKUST · 学校账号已连接':'HKUST · school account linked'):stats?.linked==='canvas'?(zh?'HKUST · Canvas 已连接':'HKUST · Canvas linked'):(zh?'HKUST · 连接学校账号':'HKUST · link school account')}</Text>
      </Pressable>
    </View></Stagger>
    <Stagger index={1}><View style={{flexDirection:'row',gap:10}}>{([[stats?.joined,zh?'参与的活动':'Joined',()=>setPage('activities')],[stats?.saved,zh?'收藏':'Saved',()=>setPage('saved')],[stats?.week,zh?'7 天内截止':'Due in 7 days',undefined]] as [number|undefined,string,(()=>void)|undefined][]).map(([n,l,on])=><Pressable key={l} disabled={!on} accessibilityRole={on?'button':undefined} onPress={on} style={({pressed})=>({flex:1,alignItems:'center',gap:4,paddingVertical:16,borderRadius:22,borderCurve:'continuous',backgroundColor:c.surface,borderWidth:1,borderColor:c.glassBorder,opacity:pressed?0.7:1})}>
      {n===undefined?<Text style={{fontSize:28,fontWeight:'700',color:c.tertiary}}>–</Text>:<NumberFlow value={n} style={{fontSize:28,fontWeight:'700',color:c.text,fontFamily:'ui-rounded'}}/>}
      <Text style={{fontSize:12,fontWeight:'600',color:c.muted}}>{l}</Text>
    </Pressable>)}</View></Stagger>
    <Stagger index={1}><ListGroup>
      <ListRow icon="ticket" tile="#A9824C" title={zh?'我的参与':'My activities'} subtitle={zh?'报名、候补与发起的活动':'Joined, waitlisted and hosted'} chevron onPress={()=>setPage('activities')}/>
      <ListRow icon="bookmark" tile="#D98A1C" title={zh?'我的收藏':'Saved'} subtitle={zh?'活动与地点':'Activities and places'} chevron onPress={()=>setPage('saved')}/>
      <ListRow icon="graduation-cap" tile="#24467F" title={zh?'学校连接':'School connection'} subtitle={zh?'SIS 课表 · Canvas 截止 · 学校邮箱':'SIS · Canvas · school mail'} chevron onPress={()=>setPage('school')}/>
    </ListGroup></Stagger>
    <Stagger index={2}><ListGroup>
      <ListRow icon="sparkles" tile="#24467F" title={zh?'用 AI 管理生活':'AI for campus life'} subtitle={zh?'把课表、截止交给 ChatGPT / Claude':'Connect ChatGPT, Claude, Shortcuts'} chevron onPress={()=>setPage('ai')}/>
      <ListRow icon="bell" tile="#E5484D" title={zh?'提醒':'Reminders'} chevron onPress={()=>setPage('reminders')}/>
      <ListRow icon="hand" tile="#24467F" title={zh?'隐私与安全':'Privacy & safety'} subtitle={zh?'课表默认私密 · 举报与屏蔽':'Private by default · reports & blocks'} chevron onPress={onSafety}/>
      {/* Pen "V6 / 语言（系统菜单）" (biMye): appearance follows the system; the chosen language is saved to the account. */}
      <ListRow icon="languages" tile="#56647D" title={zh?'语言':'Language'} value={zh?'中文':'English'} chevron onPress={()=>ActionSheetIOS.showActionSheetWithOptions({title:zh?'App 语言':'App language',options:[zh?'中文（当前）':'中文',zh?'English':'English (current)',zh?'取消':'Cancel'],cancelButtonIndex:2},i=>{const next:Language|null=i===0?'zh':i===1?'en':null;if(!next||next===language)return;feel.select();onLanguage(next);void session.updateProfile({language:next}).catch(()=>{});})}/>
    </ListGroup></Stagger>
    {action.message?<Notice tone={action.failed?'error':'success'} text={action.message}/>:null}
    {exitError?<Notice tone="error" text={exitError instanceof ApiFailure&&exitError.code==='EXIT_REVIEW_REQUIRED'?(zh?'账户或未保存状态已变化，请重新检查后操作。':'The account or unsaved state changed. Review it before trying again.'):t.errors[exitError instanceof ApiFailure?exitError.code:'REQUEST_FAILED']??t.errors.REQUEST_FAILED}/>:null}
    <Stagger index={3}><ListGroup>
      <ListRow icon="download" tile="#2E9E5B" title={t.export} disabled={busy} onPress={() => action.run(async () => { const data = await session.request('/me/export'); if(action.isCurrent())await Share.share({ message: JSON.stringify(data, null, 2), title: t.export }); })}/>
      <ListRow icon="log-out" tile={c.gray} title={t.signOut} disabled={busy} onPress={() => onExit('sign-out')}/>
      <ListRow icon="trash" tile={c.danger} title={t.delete} titleColor={c.danger} disabled={busy} onPress={() => onExit('delete')}/>
    </ListGroup></Stagger>
    <Text style={{textAlign:'center',fontSize:12,color:c.muted}}>{t.privacy}</Text>
  </View>;
}
// Pen "V6 / 你的校园名片" (r3fvkB): only what the server lets you change (your name); the school email is locked.
// Saving returns to Me, where the new name is the feedback.
function ProfileEditor({profile,language,onBack}:{profile:Profile;language:Language;onBack:()=>void}){
  const t=strings[language],zh=language==='zh',c=usePenColors();
  const [name,setName]=useState(profile.display_name);
  const action=useAction(language);
  const protect=useNavigationProtection(protectionFor(name!==profile.display_name,action.busy,false),zh);
  return <View style={{gap:18}}>
    <PageHeader onBack={()=>protect(onBack)} backLabel={zh?'我的':'Me'} title={zh?'你的校园名片':'Your profile'} subtitle={zh?'公开资料由你选择，学号和课表始终私密。':'You choose what is public. Student ID and timetable stay private.'}/>
    <FormGroup footer={zh?'学校邮箱用来登录，不能改。':'Your school email is how you sign in; it can’t be changed.'}>
      <FormField label={t.name} value={name} onChangeText={setName} maxLength={80} editable={!action.busy}/>
      <FormField label={t.email} value={profile.email} onChangeText={()=>{}} editable={false}/>
    </FormGroup>
    {action.failed&&action.message?<Notice tone="error" text={action.message}/>:null}
    <View style={{flexDirection:'row'}}><PrimaryButton label={action.busy?t.loading:t.save} disabled={action.busy||!name.trim()||name===profile.display_name} onPress={() => action.run(async () => { await session.updateProfile({ display_name: name, language }); if(action.isCurrent()){feel.success();onBack();} })}/></View>
  </View>;
}
// Pen "V6 / 我的收藏（活动、地点与路线）" (UemvP): saved activities plus saved campus places and shuttle routes, which
// open in Campus; "我的参与" uses the same cards, and an activity that has ended says so.
type Saved={key:string;kind:'place'|'route';id:string;title:string;subtitle:string;icon:string;tile:string};
function MyActivities({language,mode,onBack,onActivity,onCampus}:{language:Language;mode:'participating'|'saved';onBack:()=>void;onActivity:(id:string)=>void;onCampus:(target:{kind:'place'|'route';id:string})=>void}){
  const zh=language==='zh',c=usePenColors();
  const [items,setItems]=useState<Activity[]|null>(null),[hosted,setHosted]=useState<Activity[]>([]),[saved,setSaved]=useState<Saved[]>([]),[error,setError]=useState('');
  useEffect(()=>{let live=true;
    Promise.all([session.request<{items:Activity[]}>(`/activities?limit=50&mine=${mode}`),mode==='participating'?session.request<{items:Activity[]}>('/activities?limit=50&mine=organized'):Promise.resolve({items:[]})]).then(([a,b])=>{if(live){setItems(a.items);setHosted(b.items);}}).catch(()=>{if(live)setError(zh?'暂时打不开，请检查网络后重试。':'Couldn’t load. Check your connection and try again.');});
    if(mode==='saved')void Promise.all([session.request<{target_kind:string;target_id:string}[]>('/me/campus/bookmarks'),session.request<{id:string;name:{zh:string;en:string};location:{zh:string;en:string};category:string}[]>('/campus/places'),session.request<{routes:{id:string;name:{zh:string;en:string}}[]}>('/transport/routes')]).then(([marks,places,catalog])=>{if(!live)return;
      setSaved(marks.flatMap<Saved>(m=>{
        if(m.target_kind==='place'){const p=places.find(x=>x.id===m.target_id);return p?[{key:'p'+p.id,kind:'place',id:p.id,title:p.name[language],subtitle:`${zh?'地点':'Place'} · ${p.location[language]}`,icon:p.category==='study'?'book-open':p.category==='shop'?'shopping-bag':'package',tile:p.category==='study'?c.indigo:p.category==='shop'?'#A9824C':c.orange}]:[];}
        if(m.target_kind==='shuttle'){const r=catalog.routes.find(x=>x.id===m.target_id);return r?[{key:'r'+r.id,kind:'route',id:r.id,title:r.name[language],subtitle:zh?'校巴路线':'Shuttle route',icon:'bus',tile:'#4F6F8C'}]:[];}
        return [];
      }));
    }).catch(()=>{});
    return()=>{live=false;};},[mode]);
  const row=(a:Activity)=>{const p=a.mine?.participation;const chip=a.ended?{text:zh?'已结束':'Ended',color:c.gray}:p?{text:participationLabel(p.status,zh).replace('报名','').slice(0,6)||participationLabel(p.status,zh),color:p.status==='confirmed'?c.green:p.status==='waitlisted'?c.orange:c.gray}:a.mine?.is_organizer?{text:zh?'组织者':'Organizer',color:c.accent}:null;
   return <Surface key={a.id} padding={12} onPress={()=>onActivity(a.id)} label={a.title}><View style={{flexDirection:'row',alignItems:'center',gap:12}}>
    <Image source={activityCover(a)} style={{width:56,height:56,borderRadius:12}}/>
    <View style={{flex:1,gap:3}}><Text numberOfLines={1} style={{fontSize:16,fontWeight:'600',color:c.text}}>{a.title}</Text><Text numberOfLines={1} style={{fontSize:13,color:c.muted}}>{cardDateTime(a.starts_at,zh)} · {a.location}</Text></View>
    {chip?<View style={{paddingVertical:4,paddingHorizontal:9,borderRadius:99,backgroundColor:chip.color+'1F'}}><Text style={{fontSize:12,fontWeight:'600',color:chip.color}}>{chip.text}</Text></View>:null}
  </View></Surface>;};
  const nothing=items&&!items.length&&!hosted.length&&!saved.length;
  return <View style={{gap:18}}>
    <PageHeader onBack={onBack} backLabel={zh?'我的':'Me'} title={mode==='participating'?(zh?'我的参与':'My activities'):(zh?'我的收藏':'Saved')}/>
    {error?<Notice tone="error" text={error}/>:null}
    {items===null&&!error?<><Skeleton/><Skeleton/></>:null}
    {nothing?<EmptyState icon={mode==='saved'?'bookmark':'ticket'} title={mode==='saved'?(zh?'还没有收藏':'Nothing saved'):(zh?'还没有参与活动':'No activities yet')} body={zh?'去「校园墙 → 活动」看看大家在做什么。':'See what people are doing in Wall → Activities.'}/>:null}
    {items?.length?<Section title={mode==='participating'?(zh?'参加的':'Joined'):(zh?'活动':'Activities')}>{items.map(row)}</Section>:null}
    {hosted.length?<Section title={zh?'我发起的':'Hosted'}>{hosted.map(row)}</Section>:null}
    {saved.length?<Section title={zh?'地点与路线':'Places & routes'}><ListGroup>{saved.map(x=><ListRow key={x.key} icon={x.icon} tile={x.tile} title={x.title} subtitle={x.subtitle} chevron onPress={()=>onCampus({kind:x.kind,id:x.id})}/>)}</ListGroup><Text style={{paddingHorizontal:4,fontSize:12,color:c.muted}}>{zh?'点地点或路线会打开「校园」里的那一页。':'Places and routes open in Campus.'}</Text></Section>:null}
  </View>;
}

import {useEffect,useMemo,useRef,useState,useSyncExternalStore} from 'react';
import {ActionSheetIOS,Alert,Linking,Text,TextInput,View} from 'react-native';
import {feel} from '../ui/feel';
import Svg,{Defs,LinearGradient,Rect,Stop} from 'react-native-svg';
import {CircleButton,GlassCapsule,ListGroup,ListRow,NavRow,Notice,PenIcon,PrimaryButton,Section,Surface,ViewAll,usePenColors} from '../ui/Pen';
import {session} from '../runtime';
import {palette,styles} from '../theme';
import type {Language} from '../strings';
import {StudyActionController} from './action-controller';
import {useNavigationProtection} from '../navigation/InputProtection';
import {ReminderPicker} from '../reminders/ReminderControls';
import {dateTimeInZone} from './dates';
type Connection={provider:'sis'|'canvas';state:string;version:number;last_success_at:string|null;scopes:{id:string;state:string;last_success_at:string|null}[]};
type RecordItem={id:string;provider:'sis'|'canvas';source_state:string;source_seen_at:string|null;payload:{kind?:string;title:string;starts_at?:string|null;due_at?:string|null;all_day?:boolean};personal:{version:number;notes:string;completed:boolean;remind_minutes:number|null}};
type Props={language:Language;dark:boolean;onBack:()=>void};
const labels:Record<string,[string,string]>={approval_required:['待批准','Pending approval'],not_connected:['未连接','Not connected'],syncing:['同步中','Syncing'],connected:['已同步','Synced'],partial:['部分同步','Partially synced'],reauth_required:['需要重新授权','Authorization expired'],revoked:['已撤销','Revoked'],error:['同步失败','Sync failed']};
const stateText=(state:string,zh:boolean)=>labels[state]?.[zh?0:1]??(zh?'状态待确认':'Status unknown');
/** "10 月 5 日 12:30" in Hong Kong time (the server sends UTC instants). */
const syncedAt=(iso:string,zh:boolean)=>{const d=dateTimeInZone(iso,'Asia/Hong_Kong');return zh?`${Number(d.slice(5,7))} 月 ${Number(d.slice(8,10))} 日 ${d.slice(11,16)}`:`${new Date(d.slice(0,10)+'T00:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'short',timeZone:'UTC'})} ${d.slice(11,16)}`;};
export function SchoolSourcesScreen({language,dark,onBack}:Props){
 const zh=language==='zh',c=palette[dark?'dark':'light'];
 const [connections,setConnections]=useState<Connection[]>([]),[records,setRecords]=useState<RecordItem[]>([]),[cursor,setCursor]=useState<string|null>(null),[editing,setEditing]=useState<RecordItem|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState('');
 const alive=useRef(true),readLock=useRef(false);
 async function load(more=false){
  if(readLock.current)return false;readLock.current=true;setLoading(true);setError('');
  try{const result=await session.request<{connections:Connection[];items:RecordItem[];next_cursor:string|null}>(`/school/records?limit=20${more&&cursor?`&cursor=${encodeURIComponent(cursor)}`:''}`);
   if(!alive.current)return false;setConnections(result.connections);setRecords(old=>more?[...old,...result.items.filter(row=>!old.some(v=>v.id===row.id))]:result.items);setCursor(result.next_cursor);return true;
  }catch{if(alive.current)setError(zh?'未能读取最新状态，请重试。':'Could not read the latest state. Try again.');return false;}
  finally{readLock.current=false;if(alive.current)setLoading(false);}
 }
 const refresh=useRef(load);refresh.current=load;
 const controller=useMemo(()=>new StudyActionController((p,o)=>session.request(p,o),()=>refresh.current()),[]);
 const action=useSyncExternalStore(controller.subscribe,controller.snapshot);
 const busy=loading||action.phase==='submitting'||action.phase==='checking',review=action.phase==='uncertain'||action.phase==='refresh-needed';
 const protect=useNavigationProtection(busy?'busy':review?'uncertain':'clear',zh);
 useEffect(()=>{alive.current=true;void load();return()=>{alive.current=false;};},[]);
 function revoke(connection:Connection,erase:boolean){
  Alert.alert(zh?(erase?(connection.state==='revoked'?'删除保留的缓存？':'撤销并删除缓存？'):'撤销并保留缓存？'):(erase?'Delete school cache?':'Revoke this connection?'),zh?(erase?'学校缓存和其中的私人备注、提醒设置都会删除。独立的手动安排保留。':'学校记录将退出今天与提醒。缓存和私人备注仍可在这里查看和导出。'):(erase?'School cache and its private notes and preferences will be deleted. Independent manual plans remain.':'School records leave Today and reminders. Cached records and private notes remain available here and in export.'),[
   {text:zh?'取消':'Cancel',style:'cancel'},
   {text:zh?(erase?'确认删除缓存':'确认撤销'):(erase?'Delete cache':'Confirm revoke'),style:'destructive',onPress:()=>{if(readLock.current)return;void controller.submit({path:`/school/connections/${connection.provider}`,method:'DELETE',body:{version:connection.version,delete_cached_data:erase},label:connection.provider.toUpperCase()});}},
  ]);
 }
 // Pen board "V5 / 学校连接": navy hero (HKUST sign-in promise), sync sources list, honest status chips.
 const pc=usePenColors();
 const sis=connections.find(x=>x.provider==='sis'),canvas=connections.find(x=>x.provider==='canvas');
 // The HKUST account card reflects the school sign-in (SIS) only; Canvas uses a personal token and is not the
 // school account (Pen "V5 / 学校连接 · 连接状态", lTrEk).
 const anyLinked=sis?.state==='connected'||sis?.state==='partial';
 const heroState=anyLinked?(zh?'已连接':'Connected'):sis?.state==='reauth_required'?(zh?'需要重新登录':'Sign in again'):(zh?'等待学校开放授权':'Waiting for school approval');
 const [canvasOpen,setCanvasOpen]=useState(false),[canvasToken,setCanvasToken]=useState(''),[canvasBusy,setCanvasBusy]=useState(false),[canvasMsg,setCanvasMsg]=useState('');
 async function connectCanvas(){setCanvasBusy(true);setCanvasMsg('');try{const r=await session.request<{canvas_name:string|null;sync:{state:string}}>('/school/canvas/connect',{method:'POST',body:{token:canvasToken.trim()}});feel.success();setCanvasToken('');setCanvasOpen(false);setCanvasMsg(zh?`已连接${r.canvas_name?`（${r.canvas_name}）`:''}，作业已同步到“今天”。`:'Connected. Assignments synced to Today.');await load();}catch(e){const code=(e as {code?:string})?.code;setCanvasMsg(code==='CANVAS_TOKEN_REJECTED'?(zh?'Canvas 不接受这个令牌，请重新生成。':'Canvas rejected this token.'):code==='CANVAS_TOKEN_INVALID'?(zh?'格式不对，请复制完整的令牌。':'Copy the full token.'):(zh?'连不上 Canvas，请稍后再试。':'Canvas unreachable.'));}finally{setCanvasBusy(false);}}
 const [subs,setSubs]=useState<{id:string;name:string;host:string;last_success_at:string|null;last_error:string|null}[]>([]),[icsOpen,setIcsOpen]=useState(false),[icsUrl,setIcsUrl]=useState('');
 const loadSubs=()=>session.request<typeof subs>('/calendar/subscriptions').then(setSubs).catch(()=>{});
 useEffect(()=>{void loadSubs();},[]);
 async function subscribe(){setCanvasBusy(true);setCanvasMsg('');try{const r=await session.request<{events:number}>('/calendar/subscriptions',{method:'POST',body:{name:'Outlook',url:icsUrl.trim()}});feel.success();setIcsUrl('');setIcsOpen(false);setCanvasMsg(zh?`已连接 Outlook 日历，导入 ${r.events} 个日程。`:`Outlook calendar connected (${r.events} events).`);void loadSubs();}catch(e){const code=(e as {code?:string})?.code;setCanvasMsg(code==='CALENDAR_HOST_UNSUPPORTED'||code==='CALENDAR_URL_INVALID'?(zh?'请粘贴 Outlook 发布的 ICS 链接（以 .ics 结尾）。':'Paste the published ICS link.'):(zh?'读取失败，确认日历已发布后重试。':'Could not read the calendar.'));}finally{setCanvasBusy(false);}}
 const manageSub=(x:typeof subs[number])=>ActionSheetIOS.showActionSheetWithOptions({options:[zh?'立即刷新':'Refresh now',zh?'断开':'Disconnect',zh?'取消':'Cancel'],destructiveButtonIndex:1,cancelButtonIndex:2},i=>{if(i===0)void session.request('/calendar/subscriptions/refresh',{method:'POST',body:{}}).then(()=>{feel.success();void loadSubs();});if(i===1)void session.request(`/calendar/subscriptions/${x.id}`,{method:'DELETE'}).then(()=>void loadSubs());});
 async function syncCanvas(){setCanvasBusy(true);setCanvasMsg('');try{await session.request('/school/canvas/sync',{method:'POST',body:{}});feel.success();setCanvasMsg(zh?'已重新同步。':'Synced.');await load();}catch{setCanvasMsg(zh?'同步失败，请稍后再试。':'Sync failed.');}finally{setCanvasBusy(false);}}
 const manage=(connection:Connection)=>{if(connection.provider==='canvas'&&(connection.state==='not_connected'||connection.state==='reauth_required'||connection.state==='revoked'||connection.version<=0)){setCanvasOpen(true);return;}if(busy||review||connection.version<=0)return;const opts=[...(connection.provider==='canvas'?[zh?'立即同步':'Sync now']:[]),...(connection.state!=='revoked'?[zh?'断开（保留缓存）':'Disconnect, keep cache']:[]),connection.state==='revoked'?(zh?'删除保留的缓存与备注':'Delete retained cache and notes'):(zh?'断开并删除缓存':'Disconnect and delete cache'),zh?'取消':'Cancel'];ActionSheetIOS.showActionSheetWithOptions({options:opts,destructiveButtonIndex:opts.length-2,cancelButtonIndex:opts.length-1},i=>{if(i===opts.length-1)return;if(connection.provider==='canvas'&&i===0){void syncCanvas();return;}revoke(connection,i===opts.length-2);});};
 const row=(icon:string,tile:string,title:string,sub:string,connection?:Connection,planned?:boolean)=><ListRow key={title} icon={icon} tile={tile} title={title} subtitle={connection?.last_success_at?`${sub} · ${zh?'最近同步':'last sync'} ${syncedAt(connection.last_success_at,zh)}`:sub} value={planned?(zh?'规划中':'Planned'):connection?.provider==='canvas'&&(connection.state==='not_connected'||connection.version<=0)?(zh?'连接':'Connect'):connection?stateText(connection.state,zh):(zh?'读取中':'Loading')} chevron={!!connection&&(connection.version>0||connection.provider==='canvas')} valueColor={connection?.provider==='canvas'&&connection.state!=='connected'&&connection.state!=='partial'?'#24467F':undefined} onPress={connection&&(connection.version>0||connection.provider==='canvas')?()=>manage(connection):undefined}/>;
 if(editing)return <SchoolPersonalEditor key={editing.id} record={editing} language={language} dark={dark} onBack={()=>setEditing(null)} onSaved={()=>{setEditing(null);void load();}}/>;
 return <View style={{gap:18}}>
  <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}><CircleButton icon="chevron-left" label={zh?'返回':'Back'} disabled={busy} onPress={()=>protect(onBack)}/><CircleButton icon="refresh-cw" label={zh?'刷新状态':'Refresh'} disabled={busy||review} onPress={()=>void load()}/></View>
  <View style={{gap:6,paddingHorizontal:4}}><Text accessibilityRole="header" style={{fontSize:30,lineHeight:37,fontWeight:'700',color:pc.text}}>{zh?'学校连接':'School connection'}</Text><Text style={{fontSize:15,lineHeight:22,color:pc.muted}}>{zh?'连接 Canvas 和学校日历，作业、截止和课程自动同步。':'Connect Canvas and your school calendar; deadlines and classes sync automatically.'}</Text></View>
  <View style={{borderRadius:28,borderCurve:'continuous',overflow:'hidden',backgroundColor:'#1C3766',boxShadow:'0 14px 30px #1B356640'}}>
   <Svg preserveAspectRatio="none" viewBox="0 0 100 100" style={{position:'absolute',top:0,left:0,right:0,bottom:0}}><Defs><LinearGradient id="school" x1="0" y1="0" x2="0.6" y2="1"><Stop offset="0" stopColor="#2C5291"/><Stop offset="1" stopColor="#142A52"/></LinearGradient></Defs><Rect x="0" y="0" width="100" height="100" fill="url(#school)"/></Svg>
   <View style={{padding:20,gap:12}}>
    <View style={{flexDirection:'row',alignItems:'center',gap:10}}><View style={{width:44,height:44,borderRadius:22,backgroundColor:'#FFFFFF26',alignItems:'center',justifyContent:'center'}}><PenIcon name="graduation-cap" size={22} color="#FFFFFF"/></View><View style={{gap:2}}><Text style={{fontSize:18,fontWeight:'700',color:'#FFFFFF'}}>{zh?'HKUST 账号':'HKUST account'}</Text><Text style={{fontSize:13,color:'#FFFFFFB3'}}>{zh?'ITSO 统一登录 · Duo 验证':'ITSO sign-in · Duo'}</Text></View></View>
    <View style={{alignSelf:'flex-start',flexDirection:'row',alignItems:'center',gap:6,paddingVertical:6,paddingHorizontal:12,borderRadius:99,backgroundColor:'#FFFFFF26'}}><View style={{width:7,height:7,borderRadius:4,backgroundColor:anyLinked?'#5BE38F':'#E0A040'}}/><Text style={{fontSize:13,fontWeight:'600',color:'#FFFFFF'}}>{heroState}</Text></View>
    <Text style={{fontSize:14,lineHeight:21,color:'#FFFFFFD9'}}>{anyLinked?(zh?'课表会自动同步。密码只在学校页面输入，我们不会看到或保存。':'Your timetable syncs automatically. Your password stays on the school page; we never see or store it.'):(zh?'开放后点一下就能连接。密码只在学校页面输入，我们不会看到或保存。':'Once open, connect with one tap. Your password stays on the school page; we never see or store it.')}</Text>
   </View>
  </View>
  {error?<Notice tone="error" text={error} action={zh?'重试':'Retry'} onAction={()=>void load()}/>:null}
  {review?<Notice tone="warning" text={zh?'还没确认是否已断开，先核对再操作。':'Not confirmed yet; check before trying again.'} action={zh?'核对':'Check'} onAction={()=>void controller.check()}/>:null}
  {action.phase==='rejected'?<Notice tone="error" text={zh?'没完成，请刷新后再试。':'Not done. Refresh and try again.'}/>:null}
  {canvasMsg?<Notice tone={/失败|不接受|不对|连不上|failed|rejected|unreachable|full/i.test(canvasMsg)?'error':'success'} text={canvasMsg}/>:null}
  {canvasOpen?<Surface style={{gap:12}}>
   <View style={{flexDirection:'row',alignItems:'center',gap:10}}><View style={{width:36,height:36,borderRadius:18,backgroundColor:'#E5484D1F',alignItems:'center',justifyContent:'center'}}><PenIcon name="circle-check" size={18} color="#E5484D"/></View><Text style={{flex:1,fontSize:17,fontWeight:'700',color:pc.text}}>{zh?'连接 Canvas':'Connect Canvas'}</Text><CircleButton icon="x" label={zh?'关闭':'Close'} onPress={()=>setCanvasOpen(false)}/></View>
   <Text style={{fontSize:14,lineHeight:21,color:pc.muted}}>{zh?'1. 打开 Canvas → 账户 → 设置\n2. 点「+ 新建访问许可证」，用途填 USTLIFE\n3. 复制生成的令牌，粘贴到下面':'1. Canvas → Account → Settings\n2. "+ New access token", purpose USTLIFE\n3. Paste the token below'}</Text>
   <PrimaryButton tone="soft" icon="external-link" label={zh?'打开 Canvas 设置':'Open Canvas settings'} onPress={()=>void Linking.openURL('https://canvas.ust.hk/profile/settings')}/>
   <GlassCapsule radius={16}><TextInput accessibilityLabel={zh?'Canvas 访问令牌':'Canvas access token'} value={canvasToken} onChangeText={setCanvasToken} placeholder={zh?'粘贴令牌':'Paste token'} placeholderTextColor={pc.muted} autoCapitalize="none" autoCorrect={false} secureTextEntry style={{height:48,paddingHorizontal:16,fontSize:16,color:pc.text}}/></GlassCapsule>
   <PrimaryButton label={canvasBusy?(zh?'正在连接…':'Connecting…'):(zh?'连接并同步':'Connect & sync')} disabled={canvasBusy||canvasToken.trim().length<20} onPress={()=>void connectCanvas()}/>
   <Text style={{fontSize:12,lineHeight:18,color:pc.muted}}>{zh?'令牌只读取你的作业和截止，加密保存在服务器；随时可以在这里断开，或在 Canvas 里删除令牌。':'Read-only use of assignments; stored encrypted; revoke anytime.'}</Text>
  </Surface>:null}
  {icsOpen?<Surface style={{gap:12}}>
   <View style={{flexDirection:'row',alignItems:'center',gap:10}}><View style={{width:36,height:36,borderRadius:18,backgroundColor:'#24467F1F',alignItems:'center',justifyContent:'center'}}><PenIcon name="calendar-range" size={18} color="#24467F"/></View><Text style={{flex:1,fontSize:17,fontWeight:'700',color:pc.text}}>{zh?'连接 Outlook 日历':'Connect Outlook calendar'}</Text><CircleButton icon="x" label={zh?'关闭':'Close'} onPress={()=>setIcsOpen(false)}/></View>
   <Text style={{fontSize:14,lineHeight:21,color:pc.muted}}>{zh?'1. 网页版 Outlook → 设置 → 日历 → 共享日历\n2. 「发布日历」选你的日历，权限选「可查看所有详细信息」\n3. 复制 ICS 链接，粘贴到下面':'1. Outlook web → Settings → Calendar → Shared calendars\n2. Publish your calendar\n3. Copy the ICS link and paste it below'}</Text>
   <PrimaryButton tone="soft" icon="external-link" label={zh?'打开 Outlook 日历设置':'Open Outlook settings'} onPress={()=>void Linking.openURL('https://outlook.office.com/calendar/options/calendar/SharedCalendars')}/>
   <GlassCapsule radius={16}><TextInput accessibilityLabel={zh?'日历发布链接':'Calendar link'} value={icsUrl} onChangeText={setIcsUrl} placeholder="https://outlook.office365.com/…/calendar.ics" placeholderTextColor={pc.muted} autoCapitalize="none" autoCorrect={false} keyboardType="url" style={{height:48,paddingHorizontal:16,fontSize:15,color:pc.text}}/></GlassCapsule>
   <PrimaryButton label={canvasBusy?(zh?'正在导入…':'Importing…'):(zh?'连接并导入':'Connect & import')} disabled={canvasBusy||!/^(https|webcal)s?:\/\//i.test(icsUrl.trim())} onPress={()=>void subscribe()}/>
   <Text style={{fontSize:12,lineHeight:18,color:pc.muted}}>{zh?'也支持 Google、iCloud 的公开日历链接。打开 App 时自动刷新。':'Google and iCloud links work too. Refreshes when you open the app.'}</Text>
  </Surface>:null}
  <Section title={zh?'同步内容':'What syncs'}><ListGroup>
   {row('calendar-days','#24467F',zh?'SIS 课表':'SIS timetable',zh?'每学期自动导入，课室变更随时更新':'Imported each term, room changes stay current',sis)}
   {row('circle-check','#E5484D',zh?'Canvas 截止':'Canvas deadlines',zh?'作业与测验，提前提醒':'Assignments and quizzes, reminded early',canvas)}
   {subs.length?subs.map(x=><ListRow key={x.id} icon="calendar-range" tile="#24467F" title={zh?`${x.name} 日历`:`${x.name} calendar`} subtitle={x.last_error?(zh?'上次刷新失败，点开重试':'Last refresh failed'):x.last_success_at?`${zh?'已同步':'Synced'} ${syncedAt(x.last_success_at,zh)}`:x.host} value={x.last_error?(zh?'需处理':'Fix'):(zh?'已连接':'On')} valueColor={x.last_error?'#E5484D':'#2E9E5B'} chevron onPress={()=>manageSub(x)}/>)
    :<ListRow icon="calendar-range" tile="#24467F" title={zh?'Outlook 日历':'Outlook calendar'} subtitle={zh?'粘贴发布链接，学校会议和日程自动同步':'Paste the published link to sync'} value={zh?'连接':'Connect'} valueColor="#24467F" chevron onPress={()=>setIcsOpen(true)}/>}
   {row('mail','#D98A1C',zh?'Outlook 邮件':'Outlook mail',zh?'需要学校开放 Microsoft 365 授权':'Needs HKUST Microsoft 365 approval',undefined,true)}
  </ListGroup></Section>
  {records.length?<Section title={zh?'已同步的记录':'Synced records'}><ListGroup>{records.map(r=>{const due=r.payload.due_at??(!r.payload.all_day?r.payload.starts_at??null:null),gone=r.source_state==='removed'||r.source_state==='cancelled';return <ListRow key={r.id} icon={r.provider==='sis'?'calendar-days':'circle-check'} tile={gone?'#8E8E93':r.provider==='sis'?'#24467F':'#E5484D'} title={r.payload.title} subtitle={[r.provider==='sis'?'SIS':'Canvas',gone?(zh?'学校已撤下':'Withdrawn by the school'):due?`${syncedAt(due,zh)} ${r.payload.due_at?(zh?'截止':'due'):(zh?'开始':'starts')}`:'',r.personal.notes?(zh?'有备注':'has notes'):''].filter(Boolean).join(' · ')} chevron onPress={()=>setEditing(r)}/>;})}{cursor?<ViewAll label={zh?'加载更多':'Load more'} onPress={()=>void load(true)}/>:null}</ListGroup></Section>:null}
  <Text style={{paddingHorizontal:4,fontSize:12,lineHeight:18,color:pc.muted}}>{zh?'随时可以在这里断开；断开后学校数据会从“今天”移除。这里断开不代表学校端授权已撤销，请在官方账户核对。':'Disconnect anytime; school data leaves Today. This does not revoke the grant at the school — check your official account.'}</Text>
 </View>;
}
// Pen "V6 / 学校记录（私人笔记与提醒）" (LfGB3): private notes and a reminder on a synced school item. It never changes
// the school's requirement; after an unconfirmed save the latest saved copy is read back and the draft is kept.
function SchoolPersonalEditor({record,language,onBack,onSaved}:Props&{record:RecordItem;onSaved:()=>void}){
 const zh=language==='zh',c=usePenColors();
 const [current,setCurrent]=useState(record),[notes,setNotes]=useState(record.personal.notes),[minutes,setMinutes]=useState(record.personal.remind_minutes);
 const alive=useRef(true);useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 const controller=useMemo(()=>new StudyActionController((p,o)=>session.request(p,o),async()=>{try{const latest=await session.request<RecordItem>(`/school/records/${record.id}`);if(!alive.current)return false;setCurrent(latest);return true;}catch{return false;}}),[record.id]);
 const action=useSyncExternalStore(controller.subscribe,controller.snapshot),busy=action.phase==='submitting'||action.phase==='checking',review=action.phase==='uncertain'||action.phase==='refresh-needed';
 const dirty=notes!==current.personal.notes||minutes!==current.personal.remind_minutes;
 const protect=useNavigationProtection(busy?'busy':review?'uncertain':dirty?'draft':'clear',zh);
 const at=current.payload.due_at??(!current.payload.all_day?current.payload.starts_at??null:null),timed=Boolean(at);
 const gone=current.source_state==='removed'||current.source_state==='cancelled';
 const source=current.source_state==='removed'?(zh?'学校已移除这一项':'Removed by the school'):current.source_state==='cancelled'?(zh?'学校已取消这一项':'Cancelled by the school'):at?`${syncedAt(at,zh)} ${current.payload.due_at?(zh?'截止':'due'):(zh?'开始':'starts')}`:'';
 const tint=gone?c.muted:current.provider==='sis'?'#24467F':'#E5484D';
 const label=(t:string)=><Text style={{paddingHorizontal:4,paddingTop:4,fontSize:13,fontWeight:'600',color:c.muted}}>{t}</Text>;
 return <View style={{gap:12}}>
  <NavRow title={zh?'学校记录':'School record'} backLabel={zh?'返回学校连接':'Back to school connection'} disabled={busy} onBack={()=>protect(onBack)}/>
  <View style={{flexDirection:'row',alignItems:'center',gap:12,padding:16,borderRadius:20,borderCurve:'continuous',backgroundColor:c.surface}}>
   <View style={{width:40,height:40,borderRadius:20,alignItems:'center',justifyContent:'center',backgroundColor:tint+'1F'}}><PenIcon name={current.provider==='sis'?'calendar-days':'circle-check'} size={20} color={tint}/></View>
   <View style={{flex:1,gap:3}}><Text style={{fontSize:17,lineHeight:23,fontWeight:'700',color:c.text}}>{current.payload.title}</Text><Text style={{fontSize:13,color:c.muted}}>{current.provider==='sis'?'SIS':'Canvas'}{source?` · ${source}`:''}</Text></View>
  </View>
  <Text style={{paddingHorizontal:4,fontSize:13,lineHeight:19,color:c.muted}}>{zh?'只改你自己的笔记和提醒，不会改学校的要求，也不代表已经提交。':'Only your own notes and reminder change — not the school’s requirement, and it doesn’t mark anything submitted.'}</Text>
  {label(zh?'私人笔记':'Private notes')}
  <View style={{minHeight:130,padding:16,borderRadius:20,borderCurve:'continuous',backgroundColor:c.surface}}>
   <TextInput accessibilityLabel={zh?'私人笔记':'Private notes'} multiline maxLength={10000} editable={!busy&&!review} value={notes} onChangeText={setNotes} placeholder={zh?'只有你自己看得到':'Only you can see this'} placeholderTextColor={c.tertiary} style={{minHeight:98,fontSize:16,lineHeight:23,color:c.text,textAlignVertical:'top',padding:0}}/>
  </View>
  {label(zh?'提醒':'Reminder')}
  {timed&&!gone?<ReminderPicker value={minutes} onChange={setMinutes} language={language} disabled={busy||review}/>:<Text style={{paddingHorizontal:4,fontSize:14,lineHeight:20,color:c.muted}}>{gone?(zh?'学校已撤下这一项，不再提醒。':'The school withdrew this item; no reminders.'):(zh?'这条没有具体时间，不能设提醒。':'This item has no set time, so it can’t remind you.')}</Text>}
  {review?<Notice tone="warning" text={zh?'还没确认是否保存，输入保留着。':'Not confirmed yet; your input is kept.'} action={zh?'核对':'Check'} onAction={()=>void controller.check()}/>:null}
  {action.phase==='rejected'?<Notice tone="error" text={zh?'没保存，请检查输入后再试。':'Not saved. Check your input and try again.'}/>:null}
  <View style={{flexDirection:'row'}}><PrimaryButton label={busy?(zh?'正在保存…':'Saving…'):(zh?'保存':'Save')} disabled={busy||review||!dirty} onPress={()=>void controller.submit({path:`/school/records/${current.id}/personal`,method:'PATCH',body:{version:current.personal.version,notes,remind_minutes:timed&&!gone?minutes:null},label:current.payload.title}).then(saved=>{if(saved&&alive.current)onSaved();})}/></View>
 </View>;
}

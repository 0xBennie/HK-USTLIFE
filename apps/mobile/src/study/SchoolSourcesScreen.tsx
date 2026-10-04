import {useEffect,useMemo,useRef,useState,useSyncExternalStore} from 'react';
import {ActionSheetIOS,Alert,Linking,Text,TextInput,View} from 'react-native';
import {feel} from '../ui/feel';
import Svg,{Defs,LinearGradient,Rect,Stop} from 'react-native-svg';
import {CircleButton,GlassCapsule,ListGroup,ListRow,Notice,PenIcon,PrimaryButton,Section,Surface,ViewAll,usePenColors} from '../ui/Pen';
import {Button,Card,Input} from '../ui/Primitives';
import {session} from '../runtime';
import {palette,styles} from '../theme';
import type {Language} from '../strings';
import {StudyActionController} from './action-controller';
import {useNavigationProtection} from '../navigation/InputProtection';
import {ReminderPicker} from '../reminders/ReminderControls';
type Connection={provider:'sis'|'canvas';state:string;version:number;last_success_at:string|null;scopes:{id:string;state:string;last_success_at:string|null}[]};
type RecordItem={id:string;provider:'sis'|'canvas';source_state:string;source_seen_at:string|null;payload:{kind?:string;title:string;starts_at?:string|null;due_at?:string|null;all_day?:boolean};personal:{version:number;notes:string;completed:boolean;remind_minutes:number|null}};
type Props={language:Language;dark:boolean;onBack:()=>void};
const labels:Record<string,[string,string]>={approval_required:['待批准','Pending approval'],not_connected:['未连接','Not connected'],syncing:['同步中','Syncing'],connected:['已同步','Synced'],partial:['部分同步','Partially synced'],reauth_required:['需要重新授权','Authorization expired'],revoked:['已撤销','Revoked'],error:['同步失败','Sync failed']};
const stateText=(state:string,zh:boolean)=>labels[state]?.[zh?0:1]??(zh?'状态待确认':'Status unknown');
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
 if(editing)return <SchoolPersonalEditor key={editing.id} record={editing} language={language} dark={dark} onBack={()=>setEditing(null)} onSaved={()=>{setEditing(null);void load();}}/>;
 // Pen board "V5 / 学校连接": navy hero (HKUST sign-in promise), sync sources list, honest status chips.
 const pc=usePenColors();
 const sis=connections.find(x=>x.provider==='sis'),canvas=connections.find(x=>x.provider==='canvas');
 const anyLinked=connections.some(x=>x.state==='connected'||x.state==='partial');
 const heroState=anyLinked?(zh?'已连接':'Connected'):connections.some(x=>x.state==='reauth_required')?(zh?'需要重新登录':'Sign in again'):(zh?'等待学校开放授权':'Waiting for school approval');
 const [canvasOpen,setCanvasOpen]=useState(false),[canvasToken,setCanvasToken]=useState(''),[canvasBusy,setCanvasBusy]=useState(false),[canvasMsg,setCanvasMsg]=useState('');
 async function connectCanvas(){setCanvasBusy(true);setCanvasMsg('');try{const r=await session.request<{canvas_name:string|null;sync:{state:string}}>('/school/canvas/connect',{method:'POST',body:{token:canvasToken.trim()}});feel.success();setCanvasToken('');setCanvasOpen(false);setCanvasMsg(zh?`已连接${r.canvas_name?`（${r.canvas_name}）`:''}，作业已同步到"今天"。`:'Connected. Assignments synced to Today.');await load();}catch(e){const code=(e as {code?:string})?.code;setCanvasMsg(code==='CANVAS_TOKEN_REJECTED'?(zh?'Canvas 不接受这个令牌，请重新生成。':'Canvas rejected this token.'):code==='CANVAS_TOKEN_INVALID'?(zh?'格式不对，请复制完整的令牌。':'Copy the full token.'):(zh?'连不上 Canvas，请稍后再试。':'Canvas unreachable.'));}finally{setCanvasBusy(false);}}
 async function syncCanvas(){setCanvasBusy(true);setCanvasMsg('');try{await session.request('/school/canvas/sync',{method:'POST',body:{}});feel.success();setCanvasMsg(zh?'已重新同步。':'Synced.');await load();}catch{setCanvasMsg(zh?'同步失败，请稍后再试。':'Sync failed.');}finally{setCanvasBusy(false);}}
 const manage=(connection:Connection)=>{if(connection.provider==='canvas'&&(connection.state==='not_connected'||connection.state==='reauth_required'||connection.state==='revoked'||connection.version<=0)){setCanvasOpen(true);return;}if(busy||review||connection.version<=0)return;const opts=[...(connection.provider==='canvas'?[zh?'立即同步':'Sync now']:[]),...(connection.state!=='revoked'?[zh?'断开（保留缓存）':'Disconnect, keep cache']:[]),connection.state==='revoked'?(zh?'删除保留的缓存与备注':'Delete retained cache and notes'):(zh?'断开并删除缓存':'Disconnect and delete cache'),zh?'取消':'Cancel'];ActionSheetIOS.showActionSheetWithOptions({options:opts,destructiveButtonIndex:opts.length-2,cancelButtonIndex:opts.length-1},i=>{if(i===opts.length-1)return;if(connection.provider==='canvas'&&i===0){void syncCanvas();return;}revoke(connection,i===opts.length-2);});};
 const row=(icon:string,tile:string,title:string,sub:string,connection?:Connection,planned?:boolean)=><ListRow key={title} icon={icon} tile={tile} title={title} subtitle={connection?.last_success_at?`${sub} · ${zh?'最近同步':'last sync'} ${connection.last_success_at.slice(5,16).replace('T',' ')}`:sub} value={planned?(zh?'规划中':'Planned'):connection?.provider==='canvas'&&(connection.state==='not_connected'||connection.version<=0)?(zh?'连接':'Connect'):connection?stateText(connection.state,zh):(zh?'读取中':'Loading')} chevron={!!connection&&(connection.version>0||connection.provider==='canvas')} valueColor={connection?.provider==='canvas'&&connection.state!=='connected'&&connection.state!=='partial'?'#24467F':undefined} onPress={connection&&(connection.version>0||connection.provider==='canvas')?()=>manage(connection):undefined}/>;
 return <View style={{gap:18}}>
  <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}><CircleButton icon="chevron-left" label={zh?'返回':'Back'} disabled={busy} onPress={()=>protect(onBack)}/><CircleButton icon="refresh-cw" label={zh?'刷新状态':'Refresh'} disabled={busy||review} onPress={()=>void load()}/></View>
  <View style={{gap:6,paddingHorizontal:4}}><Text accessibilityRole="header" style={{fontSize:30,lineHeight:37,fontWeight:'700',color:pc.text}}>{zh?'学校连接':'School connection'}</Text><Text style={{fontSize:15,lineHeight:22,color:pc.muted}}>{zh?'登录一次 HKUST 账号，课表、截止和邮件自动同步。':'Sign in once with HKUST — timetable, deadlines and mail sync automatically.'}</Text></View>
  <View style={{borderRadius:28,borderCurve:'continuous',overflow:'hidden',backgroundColor:'#1C3766',boxShadow:'0 14px 30px #1B356640'}}>
   <Svg preserveAspectRatio="none" viewBox="0 0 100 100" style={{position:'absolute',top:0,left:0,right:0,bottom:0}}><Defs><LinearGradient id="school" x1="0" y1="0" x2="0.6" y2="1"><Stop offset="0" stopColor="#2C5291"/><Stop offset="1" stopColor="#142A52"/></LinearGradient></Defs><Rect x="0" y="0" width="100" height="100" fill="url(#school)"/></Svg>
   <View style={{padding:20,gap:12}}>
    <View style={{flexDirection:'row',alignItems:'center',gap:10}}><View style={{width:44,height:44,borderRadius:22,backgroundColor:'#FFFFFF26',alignItems:'center',justifyContent:'center'}}><PenIcon name="graduation-cap" size={22} color="#FFFFFF"/></View><View style={{gap:2}}><Text style={{fontSize:18,fontWeight:'700',color:'#FFFFFF'}}>{zh?'HKUST 账号':'HKUST account'}</Text><Text style={{fontSize:13,color:'#FFFFFFB3'}}>{zh?'ITSO 统一登录 · Duo 验证':'ITSO sign-in · Duo'}</Text></View></View>
    <View style={{alignSelf:'flex-start',flexDirection:'row',alignItems:'center',gap:6,paddingVertical:6,paddingHorizontal:12,borderRadius:99,backgroundColor:'#FFFFFF26'}}><View style={{width:7,height:7,borderRadius:4,backgroundColor:anyLinked?'#5BE38F':'#E0A040'}}/><Text style={{fontSize:13,fontWeight:'600',color:'#FFFFFF'}}>{heroState}</Text></View>
    <Text style={{fontSize:14,lineHeight:21,color:'#FFFFFFD9'}}>{zh?'开放后点一下就能连接。密码只在学校页面输入，我们不会看到或保存。':'Once open, connect with one tap. Your password stays on the school page; we never see or store it.'}</Text>
   </View>
  </View>
  {error?<Notice tone="error" text={error} action={zh?'重试':'Retry'} onAction={()=>void load()}/>:null}
  {review?<Notice tone="warning" text={zh?'操作可能已生效，请先核对当前状态，不要重复断开。':'The change may have applied. Check the current state first.'} action={zh?'核对':'Check'} onAction={()=>void controller.check()}/>:null}
  {action.phase==='rejected'?<Notice tone="error" text={zh?'操作被拒绝，请刷新后核对权限。':'Request rejected. Refresh and check permissions.'}/>:null}
  {action.phase==='saved'||action.phase==='reviewed'?<Notice tone="success" text={zh?'已更新，请核对下方状态。':'Updated. Review the status below.'}/>:null}
  {canvasMsg?<Notice tone={/失败|不接受|不对|连不上|failed|rejected|unreachable|full/i.test(canvasMsg)?'error':'success'} text={canvasMsg}/>:null}
  {canvasOpen?<Surface style={{gap:12}}>
   <View style={{flexDirection:'row',alignItems:'center',gap:10}}><View style={{width:36,height:36,borderRadius:18,backgroundColor:'#E5484D1F',alignItems:'center',justifyContent:'center'}}><PenIcon name="circle-check" size={18} color="#E5484D"/></View><Text style={{flex:1,fontSize:17,fontWeight:'700',color:pc.text}}>{zh?'连接 Canvas':'Connect Canvas'}</Text><CircleButton icon="x" label={zh?'关闭':'Close'} onPress={()=>setCanvasOpen(false)}/></View>
   <Text style={{fontSize:14,lineHeight:21,color:pc.muted}}>{zh?'1. 打开 Canvas → 账户 → 设置\n2. 点「+ 新建访问许可证」，用途填 USTLIFE\n3. 复制生成的令牌，粘贴到下面':'1. Canvas → Account → Settings\n2. "+ New access token", purpose USTLIFE\n3. Paste the token below'}</Text>
   <PrimaryButton tone="soft" icon="external-link" label={zh?'打开 Canvas 设置':'Open Canvas settings'} onPress={()=>void Linking.openURL('https://canvas.ust.hk/profile/settings')}/>
   <GlassCapsule radius={16}><TextInput accessibilityLabel={zh?'Canvas 访问令牌':'Canvas access token'} value={canvasToken} onChangeText={setCanvasToken} placeholder={zh?'粘贴令牌':'Paste token'} placeholderTextColor={pc.muted} autoCapitalize="none" autoCorrect={false} secureTextEntry style={{height:48,paddingHorizontal:16,fontSize:16,color:pc.text}}/></GlassCapsule>
   <PrimaryButton label={canvasBusy?(zh?'正在连接…':'Connecting…'):(zh?'连接并同步':'Connect & sync')} disabled={canvasBusy||canvasToken.trim().length<20} onPress={()=>void connectCanvas()}/>
   <Text style={{fontSize:12,lineHeight:18,color:pc.muted}}>{zh?'令牌只读取你的作业和截止，加密保存在服务器；随时可以在这里断开，或在 Canvas 里删除令牌。':'Read-only use of assignments; stored encrypted; revoke anytime.'}</Text>
  </Surface>:null}
  <Section title={zh?'同步内容':'What syncs'}><ListGroup>
   {row('calendar-days','#24467F',zh?'SIS 课表':'SIS timetable',zh?'每学期自动导入，课室变更随时更新':'Imported each term, room changes stay current',sis)}
   {row('circle-check','#E5484D',zh?'Canvas 截止':'Canvas deadlines',zh?'作业与测验，提前提醒':'Assignments and quizzes, reminded early',canvas)}
   {row('mail','#D98A1C',zh?'Outlook 邮件':'Outlook mail',zh?'从邮件里提取截止和通知':'Deadlines and notices pulled from mail',undefined,true)}
  </ListGroup></Section>
  {records.length?<Section title={zh?'已同步的记录':'Synced records'}><ListGroup>{records.map(r=><ListRow key={r.id} icon={r.provider==='sis'?'calendar-days':'circle-check'} tile={r.provider==='sis'?'#24467F':'#E5484D'} title={r.payload.title} subtitle={`${r.provider.toUpperCase()}${r.personal.notes?` · ${zh?'有备注':'has notes'}`:''}`} chevron onPress={()=>setEditing(r)}/>)}{cursor?<ViewAll label={zh?'加载更多':'Load more'} onPress={()=>void load(true)}/>:null}</ListGroup></Section>:null}
  <Text style={{paddingHorizontal:4,fontSize:12,lineHeight:18,color:pc.muted}}>{zh?'随时可以在这里断开；断开后学校数据会从"今天"移除。这里断开不代表学校端授权已撤销，请在官方账户核对。':'Disconnect anytime; school data leaves Today. This does not revoke the grant at the school — check your official account.'}</Text>
 </View>;
}
function SchoolPersonalEditor({record,language,dark,onBack,onSaved}:Props&{record:RecordItem;onSaved:()=>void}){
 const zh=language==='zh',c=palette[dark?'dark':'light'];
 const [current,setCurrent]=useState(record),[notes,setNotes]=useState(record.personal.notes),[minutes,setMinutes]=useState(record.personal.remind_minutes);
 const alive=useRef(true);useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 const controller=useMemo(()=>new StudyActionController((p,o)=>session.request(p,o),async()=>{try{const latest=await session.request<RecordItem>(`/school/records/${record.id}`);if(!alive.current)return false;setCurrent(latest);return true;}catch{return false;}}),[record.id]);
 const action=useSyncExternalStore(controller.subscribe,controller.snapshot),busy=action.phase==='submitting'||action.phase==='checking',review=action.phase==='uncertain'||action.phase==='refresh-needed';
 const dirty=notes!==current.personal.notes||minutes!==current.personal.remind_minutes;
 const protect=useNavigationProtection(busy?'busy':review?'uncertain':dirty?'draft':'clear',zh);
 const timed=Boolean(current.payload.due_at||(!current.payload.all_day&&current.payload.starts_at));
 return <View style={styles.stack}>
  <Button variant="ghost" isDisabled={busy} onPress={()=>protect(onBack)}>{zh?'返回学校记录':'Back to school records'}</Button>
  <Text style={[styles.title,{color:c.text}]}>{current.payload.title}</Text>
  <Text style={[styles.caption,{color:c.muted}]}>{current.provider.toUpperCase()} · {current.source_state} · {current.source_seen_at}</Text>
  <Text style={[styles.body,{color:c.muted}]}>{zh?'只修改自己的笔记和提醒，不修改学校要求，也不代表作业已提交。已撤销或失效来源不会生成新提醒。':'These private settings do not change school requirements or submit work. Revoked or stale sources do not generate new reminders.'}</Text>
  <Text style={[styles.heading,{color:c.text}]}>{zh?'私人笔记':'Private notes'}</Text>
  <Input accessibilityLabel={zh?'私人笔记':'Private notes'} multiline maxLength={10000} editable={!busy&&!review} value={notes} onChangeText={setNotes} style={{minHeight:140,textAlignVertical:'top'}}/>
  {timed?<ReminderPicker value={minutes} onChange={setMinutes} language={language} dark={dark} disabled={busy||review}/>:<Text style={{color:c.muted}}>{zh?'这条记录没有可用的具体时间，无法安排提醒。':'No timed deadline is available for a reminder.'}</Text>}
  {review?<><Text accessibilityRole="alert" style={{color:c.danger}}>{zh?'保存结果需要核对，输入已保留。':'Review the save result. Your input is kept.'}</Text><Button isDisabled={busy} onPress={()=>void controller.check()}>{zh?'读取已保存内容':'Read saved content'}</Button></>:null}
  {action.phase==='reviewed'||action.phase==='saved'?<Card style={[styles.card,{backgroundColor:c.surface}]}><Text style={{color:c.text}}>{zh?'服务器当前笔记：':'Current saved notes: '}{current.personal.notes||'—'}</Text><Text style={{color:c.muted}}>{zh?'提前提醒分钟：':'Reminder minutes: '}{current.personal.remind_minutes??'—'}</Text><Button variant="secondary" onPress={()=>{setNotes(current.personal.notes);setMinutes(current.personal.remind_minutes);}}>{zh?'采用已保存内容':'Use saved content'}</Button></Card>:null}
  {action.phase==='rejected'?<Text accessibilityRole="alert" style={{color:c.danger}}>{zh?'保存被拒绝，请检查输入或返回刷新。':'Save rejected. Check input or return and refresh.'}</Text>:null}
  <Button isDisabled={busy||review||!dirty} onPress={()=>void controller.submit({path:`/school/records/${current.id}/personal`,method:'PATCH',body:{version:current.personal.version,notes,remind_minutes:timed?minutes:null},label:current.payload.title}).then(saved=>{if(saved&&alive.current)onSaved();})}>{busy?(zh?'处理中…':'Working…'):(zh?'保存私人设置':'Save private settings')}</Button>
 </View>;
}

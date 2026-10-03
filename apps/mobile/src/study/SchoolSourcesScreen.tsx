import {useEffect,useMemo,useRef,useState,useSyncExternalStore} from 'react';
import {Alert,Text,View} from 'react-native';
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
const labels:Record<string,[string,string]>={approval_required:['尚待学校批准','School approval required'],not_connected:['尚未连接','Not connected'],syncing:['同步中','Syncing'],connected:['已同步','Synced'],partial:['部分同步','Partially synced'],reauth_required:['需要重新授权','Authorization expired'],revoked:['已撤销','Revoked'],error:['同步失败','Sync failed']};
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
 return <View style={styles.stack}>
  <Button variant="ghost" isDisabled={busy} onPress={()=>protect(onBack)}>{zh?'返回今天':'Back to Today'}</Button>
  <Text style={[styles.title,{color:c.text}]}>{zh?'学校连接':'School connections'}</Text>
  <Text style={[styles.body,{color:c.muted}]}>{zh?'学校身份登录与 SIS、Canvas 数据权限分别授权。目前尚未接通官方授权；这里不会收取学校密码。':'School sign-in, SIS and Canvas need separate authorization. Official authorization is not connected yet; we never collect your school password here.'}</Text>
  <Button variant="secondary" isDisabled={busy||review} onPress={()=>void load()}>{zh?'刷新状态':'Refresh status'}</Button>
  {loading?<Text accessibilityLiveRegion="polite" style={{color:c.muted}}>{zh?'读取最新状态…':'Reading current state…'}</Text>:null}
  {error?<Text accessibilityRole="alert" style={{color:c.danger}}>{error}</Text>:null}
  {review?<><Text accessibilityRole="alert" style={{color:c.danger}}>{zh?'操作可能已生效。请读取当前状态核对，不要重复撤销。':'The change may have applied. Read the current state before another action.'}</Text><Button isDisabled={busy} onPress={()=>void controller.check()}>{zh?'核对当前状态':'Check current state'}</Button></>:null}
  {action.phase==='rejected'?<Text accessibilityRole="alert" style={{color:c.danger}}>{zh?'操作被拒绝，请刷新后核对权限。':'Request rejected. Refresh and check permissions.'}</Text>:null}
  {action.phase==='saved'||action.phase==='reviewed'?<Text accessibilityLiveRegion="polite" style={{color:c.muted}}>{zh?'当前状态已更新，请核对下方内容。':'Current state loaded. Review it below.'}</Text>:null}
  {connections.map(connection=><Card key={connection.provider} style={[styles.card,{backgroundColor:c.surface}]}>
   <Text style={[styles.heading,{color:c.text}]}>{connection.provider.toUpperCase()} · {stateText(connection.state,zh)}</Text>
   <Text style={[styles.caption,{color:c.muted}]}>{zh?'最近成功读取：':'Last successful read: '}{connection.last_success_at??(zh?'尚无记录':'None')}</Text>
   {connection.scopes.map(scope=><Text key={scope.id} style={[styles.caption,{color:c.muted}]}>{scope.id} · {stateText(scope.state,zh)}</Text>)}
   {connection.version>0?<>{connection.state!=='revoked'?<Button variant="secondary" isDisabled={busy||review} onPress={()=>revoke(connection,false)}>{zh?'撤销并保留缓存':'Revoke and keep cache'}</Button>:null}<Button variant="ghost" isDisabled={busy||review} onPress={()=>revoke(connection,true)}>{connection.state==='revoked'?(zh?'删除保留的缓存与备注':'Delete retained cache and notes'):(zh?'撤销并删除缓存与备注':'Revoke and delete cache and notes')}</Button></>:null}
  </Card>)}
  <Text style={[styles.caption,{color:c.muted}]}>{zh?'本产品的撤销不代表学校端授权已经撤销；请在官方账户核对。':'Revocation here does not confirm revocation at the school. Check your official account.'}</Text>
  <Text style={[styles.heading,{color:c.text}]}>{zh?'缓存记录与私人设置':'Cached records and private settings'}</Text>
  {!loading&&!records.length&&!error?<Text style={{color:c.muted}}>{zh?'还没有学校记录。这不代表没有课程或作业。':'No school records yet. This does not mean you have no classes or assignments.'}</Text>:null}
  {records.map(record=><Card key={record.id} style={[styles.card,{backgroundColor:c.surface}]}><Text style={[styles.heading,{color:c.text}]}>{record.payload.title}</Text><Text style={{color:c.muted}}>{record.provider.toUpperCase()} · {record.source_state}</Text><Button variant="secondary" isDisabled={busy||review} onPress={()=>setEditing(record)}>{zh?'查看／编辑私人设置':'View / edit private settings'}</Button></Card>)}
  {cursor?<Button variant="ghost" isDisabled={busy||review} onPress={()=>void load(true)}>{zh?'加载更多':'Load more'}</Button>:null}
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

import {Icon} from '../ui/Icon';
import {useInputProtection} from '../navigation/InputProtection';
import {StudyActionController,type StudyAction} from './action-controller';
import {useSceneFocus} from '../navigation/TabScene';
import {participationLabel} from '../social/shared';
import {SchoolSourcesScreen} from './SchoolSourcesScreen';
import { SourceScreen } from './SourceScreen';
import { ImportScreen } from './ImportScreen';
import { useCallback,useEffect,useRef,useState,useSyncExternalStore } from 'react';
import { ActivityIndicator,Alert,Linking,Pressable,ScrollView,Text,View } from 'react-native';
import { Button, Disclosure, SegmentedControl } from '../ui/Primitives';
import { Card } from '../ui/Primitives';
import { session } from '../runtime';
import { palette,styles } from '../theme';
import type { Language } from '../strings';
import type { Calendar,CalendarItem,Course,StudyItem } from './types';
import { dateInZone,dateTimeInZone,shiftDate } from './dates';
import { studyStrings } from './strings';
import { StudyForm,type Editor } from './StudyForm';

async function allPages<T>(path:string) {
  const items:T[]=[];let cursor:string|null=null;
  do {
    const result: {items:T[];next_cursor:string|null} = await session.request(`${path}?limit=100${cursor?`&cursor=${encodeURIComponent(cursor)}`:''}`);
    items.push(...result.items);cursor=result.next_cursor;
  } while(cursor);
  return items;
}
export function StudyScreen({language,dark,onActivity,initialReminder}:{language:Language;dark:boolean;onActivity:(id:string)=>void;initialReminder?:{id:string;date:string}|null}) {
 const sceneActive=useSceneFocus();
  const t=studyStrings[language],colors=palette[dark?'dark':'light'];
  const [managingSources,setManagingSources]=useState(false);
  const [schoolSources,setSchoolSources]=useState(false);
  const [importing,setImporting]=useState(false);
  const [view,setView]=useState<'day'|'week'|'courses'|'all'>('day');
  const [date,setDate]=useState(()=>dateInZone(new Date().toISOString()));
  const [zone,setZone]=useState('Asia/Hong_Kong'),[choosingZone,setChoosingZone]=useState(false);
  const [courses,setCourses]=useState<Course[]>([]),[items,setItems]=useState<StudyItem[]>([]),[calendar,setCalendar]=useState<Calendar|null>(null);
  const [courseId,setCourseId]=useState<string|null>(null),[editor,setEditor]=useState<Editor|null>(null);
  const [loading,setLoading]=useState(true),[error,setError]=useState(''),[linkError,setLinkError]=useState('');
  const alive=useRef(true);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;generation.current++;};},[]);
  useEffect(()=>{if(initialReminder){setDate(initialReminder.date);setZone('Asia/Hong_Kong');setView('day');setEditor(null);setImporting(false);setManagingSources(false);setSchoolSources(false);}},[initialReminder]);
  const generation=useRef(0);
  const load=useCallback(async()=>{
    if(!alive.current)return false;
    const current=++generation.current;setLoading(true);setError('');
    try {
      const [nextCourses,nextItems,nextCalendar]=await Promise.all([
        allPages<Course>('/study/courses'),allPages<StudyItem>('/study/items'),
        session.request<Calendar>(`/me/calendar?from=${date}&to=${shiftDate(date,view==='week'?7:1)}&timezone=${encodeURIComponent(zone)}`),
      ]);
      if(current!==generation.current||!alive.current)return false;
      setCourses(nextCourses);setCourseId(old=>old&&nextCourses.some(c=>c.id===old)?old:null);setItems(nextItems);setCalendar(nextCalendar);return true;
    }catch { if(current===generation.current&&alive.current)setError(t.error);return false; }
    finally { if(current===generation.current&&alive.current)setLoading(false); }
  },[date,view,zone,t.error]);
  useEffect(()=>{if(!sceneActive)return;void load();return()=>{generation.current++;};},[load,sceneActive]);
  const refreshRef=useRef(load);refreshRef.current=load;
  const actions=useRef(new StudyActionController((path,options)=>session.request(path,options),()=>refreshRef.current())).current;
  const actionState=useSyncExternalStore(actions.subscribe,actions.snapshot);
  const busy=actionState.phase==='submitting'||actionState.phase==='checking';
  const needsReview=['uncertain','refresh-needed','checking'].includes(actionState.phase);
  const actionLocked=busy||needsReview||loading;
  useInputProtection(null,busy,needsReview,language==='zh');
  async function mutate(action:StudyAction){if(!alive.current)return;await actions.submit(action);}
  async function openResource(url:string){setLinkError('');try{await Linking.openURL(url);}catch{if(alive.current)setLinkError(language==='zh'?'未能打开资料链接，请检查网址或稍后重试。':'Could not open the resource. Check the URL or try again.');}}
  function actionMessage(){
    const label=actionState.label;
    if(actionState.phase==='saved')return language==='zh'?`已保存并刷新：${label}`:`Saved and refreshed: ${label}`;
    if(actionState.phase==='refresh-needed')return language==='zh'?`已保存「${label}」，但列表刷新失败。请刷新记录，不必再次提交。`:`Saved “${label}”, but the list could not refresh. Refresh the records; do not submit again.`;
    if(actionState.phase==='uncertain')return language==='zh'?`「${label}」的结果尚待核对，或记录已被修改。先读取最新记录，再决定下一步。`:`The result for “${label}” is unconfirmed, or the record changed. Read the latest records before another action.`;
    if(actionState.phase==='reviewed')return language==='zh'?'已读取最新记录。请核对当前状态，再决定是否需要继续操作。':'Latest records loaded. Review their current state before deciding on another action.';
    if(actionState.phase==='rejected')return language==='zh'?`未保存「${label}」。请检查内容或重新登录后再试。`:`“${label}” was not saved. Check the content or sign in again.`;
    return '';
  }
  function remove(record:Course|StudyItem) {
    const collection='kind' in record?'items':'courses';
    Alert.alert(t.confirmDelete,collection==='courses'?t.detach:record.title,[{text:t.cancel,style:'cancel'},{text:t.remove,style:'destructive',onPress:()=>{if(!alive.current||actionLocked)return;void mutate({path:`/study/${collection}/${record.id}`,method:'DELETE',body:{version:record.version},label:record.title});}}]);
  }
  function renderItem(item:CalendarItem) {
    const school='school_origin' in item?item.school_origin:null;
    const linked=courses.find(c=>c.id===item.course_id);
    const detail=item.kind==='event'?(item.all_day?`${item.start_date} · ${t.allDayLabel}${item.end_date?` → ${item.end_date}`:''}`:`${dateTimeInZone(item.starts_at!,zone)} → ${item.ends_at?dateTimeInZone(item.ends_at,zone):t.unknownEnd}`)
      :item.kind==='task'?(item.due_date??(item.due_at?dateTimeInZone(item.due_at,zone):t.undated)):item.kind==='material'?item.url:'';
    return <Card key={item.id} style={[styles.card,{backgroundColor:colors.surface}]}>
      <Text style={[styles.caption,{color:colors.muted}]}>{t[item.kind]}{linked?` · ${linked.code||linked.title}`:''}{'status' in item?` · ${t[item.status]}`:''}</Text>
      <View style={{flexDirection:'row',alignItems:'flex-start',gap:12}}>{item.kind==='task'?<Pressable accessibilityRole="checkbox" accessibilityLabel={`${item.title} · ${item.status==='open'?t.complete:t.reopen}`} accessibilityState={{checked:item.status==='done',disabled:actionLocked,busy:busy&&actionState.label===item.title}} disabled={actionLocked} onPress={()=>void mutate(school?{path:`/school/records/${item.id}/personal`,method:'PATCH',body:{version:school.personal_version,completed:item.status==='open'},label:item.title}:{path:`/study/items/${item.id}`,method:'PATCH',body:{version:item.version,status:item.status==='open'?'done':'open'},label:item.title})} style={({pressed})=>({minWidth:44,minHeight:44,alignItems:'center',justifyContent:'center',opacity:pressed||actionLocked?0.5:1})}><View style={{width:26,height:26,borderRadius:13,borderWidth:1.5,borderColor:item.status==='done'?colors.accent:colors.muted,backgroundColor:item.status==='done'?colors.accent:'transparent',alignItems:'center',justifyContent:'center'}}>{item.status==='done'?<Icon name="check" color={dark?'#001C38':'white'} size={18}/>:null}</View></Pressable>:null}<Text style={[styles.heading,{color:colors.text,flex:1,flexShrink:1,textDecorationLine:item.kind==='task'&&item.status==='done'?'line-through':'none'}]}>{item.title}</Text></View>
      {detail?<Text selectable style={[styles.body,{color:colors.muted}]}>{detail}</Text>:null}
      {item.kind==='event'&&item.location?<Text style={[styles.body,{color:colors.muted}]}>{item.location}</Text>:null}
      {item.body?<Text selectable style={[styles.body,{color:colors.text}]}>{item.body}</Text>:null}
      {school?<View style={styles.stack}>
        <Text style={[styles.caption,{color:colors.accent}]}>{school.provider==='sis'?'SIS · ':'Canvas · '}{language==='zh'?'学校来源':'School source'}</Text>
        <Text style={[styles.caption,{color:colors.muted}]}>{language==='zh'?`最近读取 ${dateTimeInZone(school.source_seen_at,zone)}`:`Last read ${dateTimeInZone(school.source_seen_at,zone)}`}</Text>
        {school.stale?<Text accessibilityRole="alert" style={[styles.caption,{color:colors.danger}]}>{language==='zh'?'当前保留上次成功同步的安排，可能已有变化。恢复连接并核对后，再启用这条系统提醒。':'This is the last successful snapshot and may have changed. This source reminder is suspended until sync is healthy.'}</Text>:null}
        {item.kind==='task'?<Text style={[styles.caption,{color:colors.muted}]}>{language==='zh'?'勾选只记录自己的完成情况，不代表已向 Canvas 提交。':'Checking this records personal completion, not submission to Canvas.'}</Text>:null}
        {school.notes?<><Text style={[styles.caption,{color:colors.muted}]}>{language==='zh'?'我的备注 · 仅自己可见':'My notes · private'}</Text><Text selectable style={[styles.body,{color:colors.text}]}>{school.notes}</Text></>:null}
      </View>:<Disclosure title={language==='zh'?'查看与管理':'View & manage'}>
      {'activity_origin' in item?<><Text style={[styles.body,{color:colors.text}]}>{participationLabel(item.activity_origin.participation,language==='zh')}</Text><Button variant="secondary" onPress={()=>onActivity(item.activity_origin.id)}>{language==='zh'?'查看活动／管理参与':'View activity / manage participation'}</Button></>:<>

      {item.kind==='event'&&!('import_origin' in item)?<Button variant="secondary" isDisabled={actionLocked} onPress={()=>mutate({path:`/study/items/${item.id}`,method:'PATCH',body:{version:item.version,status:item.status==='active'?'cancelled':'active'},label:item.title})}>{item.status==='active'?t.cancelEvent:t.restoreEvent}</Button>:null}
      {item.kind==='material'?<Button variant="secondary" onPress={()=>void openResource(item.url)}>{t.viewLink}</Button>:null}
      {!('import_origin' in item)?<><Button variant="ghost" isDisabled={actionLocked} onPress={()=>setEditor({kind:item.kind,record:item})}>{t.edit}</Button>
      <Button variant="ghost" isDisabled={actionLocked} onPress={()=>remove(item)}>{t.remove}</Button></>:<><Button variant="ghost" isDisabled={actionLocked} onPress={()=>setEditor({kind:'event',record:item})}>{language==='zh'?'修改这一次':'Edit this occurrence'}</Button><Button variant="secondary" isDisabled={actionLocked} onPress={()=>mutate({path:`/calendar/series/${item.import_origin.series_id}/occurrence/status`,method:'PATCH',body:{version:item.version,recurrence_id:item.recurrence_id,status:'cancelled'},label:item.title})}>{language==='zh'?'取消这一次':'Cancel this occurrence'}</Button><Text style={[styles.caption,{color:colors.muted}]}>{language==='zh'?`导入来源：${item.import_origin.source_name}${item.source_status==='tentative'?' · 源日程暂定':''} · 尚未确认参与`:`Imported from ${item.import_origin.source_name}${item.source_status==='tentative'?' · tentative source event':''} · participation unconfirmed`}</Text>{item.source_occurrence_missing?<Text style={[styles.caption,{color:colors.danger}]}>{language==='zh'?'来源已无此日程；按你的选择保留个人安排。':'This occurrence is no longer in the source; your private change was retained.'}</Text>:null}</>}</>}
      </Disclosure>}
    </Card>;
  }
  if(schoolSources)return <SchoolSourcesScreen language={language} dark={dark} onBack={()=>{setSchoolSources(false);void load();}}/>;
  if(managingSources)return <SourceScreen language={language} dark={dark} onBack={()=>{setManagingSources(false);void load();}}/>;
  if(importing)return <ImportScreen language={language} dark={dark} onBack={()=>setImporting(false)} onSaved={()=>{setImporting(false);void load();}}/>;
  if(editor)return <StudyForm editor={editor} courses={courses} language={language} dark={dark} onBack={()=>setEditor(null)} onSaved={()=>{setEditor(null);void load();}} />;
  return <View style={styles.stack}>
    {initialReminder?<Text style={[styles.caption,{color:colors.muted}]}>{language==='zh'?'已打开提醒对应日期。请以下方最新安排为准；已取消或删除的内容不会恢复。':'Opened the reminder date. The current plans below take precedence; cancelled or deleted items are not restored.'}</Text>:null}
    <Text style={[styles.title,{color:colors.text}]}>{language==='zh'?'今天':'Today'}</Text>
    <Text style={[styles.caption,{color:colors.muted}]}>{t.private}</Text>
    <Text style={[styles.caption,{color:colors.muted}]}>{calendar?.school_connections?.map(c=>`${c.provider==='sis'?'SIS':'Canvas'} · ${c.state==='connected'?(language==='zh'?'已同步':'Synced'):c.state==='partial'?(language==='zh'?'部分覆盖':'Partial coverage'):c.state==='revoked'?(language==='zh'?'已撤销':'Revoked'):c.state==='reauth_required'?(language==='zh'?'需要重新授权':'Reconnect required'):(language==='zh'?'尚未完整同步':'Not fully synced')}`).join(' / ')??(language==='zh'?'学校来源尚未完成同步；当前安排不代表完整正式课表。':'School sources are not fully synced; these plans do not represent a complete timetable.')}</Text>
    <SegmentedControl value={view} label={language==='zh'?'日历视图':'Calendar view'} options={(['day','week','courses','all'] as const).map(v=>({value:v,label:t[v]}))} disabled={actionLocked} onChange={v=>{setView(v);setCourseId(null);}}/>
    <View style={styles.row}><Button variant="secondary" isDisabled={actionLocked} onPress={()=>setEditor({kind:'task',courseId})}>{t.add} {t.task}</Button><Button variant="secondary" isDisabled={actionLocked} onPress={()=>setEditor({kind:'event',courseId})}>{t.add} {t.event}</Button></View>
    <Disclosure title={language==='zh'?'更多记录与日历设置':'More records & calendar settings'}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}><View style={styles.row}>{(['note','material','course'] as const).map(kind=><Button key={kind} variant="secondary" isDisabled={actionLocked} onPress={()=>setEditor({kind,courseId})}>{t.add} {t[kind]}</Button>)}</View></ScrollView>
      <Button variant="secondary" isDisabled={actionLocked} onPress={()=>setImporting(true)}>{language==='zh'?'备用方式：导入 ICS 日历':'Alternative: import an ICS calendar'}</Button>
      <Button variant="ghost" isDisabled={actionLocked} onPress={()=>setSchoolSources(true)}>{language==='zh'?'学校连接与私人设置':'School connections and private settings'}</Button>
      <Button variant="ghost" isDisabled={actionLocked} onPress={()=>setManagingSources(true)}>{language==='zh'?'管理导入来源':'Manage imported sources'}</Button>
      <Button variant="ghost" isDisabled={actionLocked} onPress={()=>setChoosingZone(!choosingZone)}>{t.zone}: {zone}</Button>
      {choosingZone?(['Asia/Hong_Kong','UTC','Europe/London','America/New_York'].map(value=><Button key={value} variant={value===zone?'primary':'secondary'} isDisabled={actionLocked} onPress={()=>{setZone(value);setChoosingZone(false);}}>{value===zone?'✓ ':''}{value}</Button>)):null}
    </Disclosure>
    {error?<Text accessibilityRole="alert" style={[styles.body,{color:colors.danger}]}>{error}</Text>:null}
    {actionMessage()?<Text accessibilityRole={needsReview||actionState.phase==='rejected'?'alert':undefined} accessibilityLiveRegion="polite" style={[styles.body,{color:needsReview||actionState.phase==='rejected'?colors.danger:colors.accent}]}>{actionMessage()}</Text>:null}
    {busy?<Text accessibilityLiveRegion="polite" style={[styles.caption,{color:colors.muted}]}>{language==='zh'?'正在处理，请稍候…':'Working, please wait…'}</Text>:null}
    {linkError?<Text accessibilityRole="alert" style={[styles.body,{color:colors.danger}]}>{linkError}</Text>:null}
    {error&&(items.length||calendar)?<Text style={[styles.caption,{color:colors.muted}]}>{language==='zh'?'下方保留的是上次读取的记录，可能不是最新状态。':'The retained records below are from the last successful read and may be out of date.'}</Text>:null}
    <Button variant="ghost" isDisabled={loading||busy} onPress={()=>needsReview?void actions.check():void load()}>{needsReview?(language==='zh'?'读取最新记录，核对结果':'Read latest records to check result'):t.refresh}</Button>
    {loading?<ActivityIndicator color={colors.accent} accessibilityLabel={t.loading}/>:null}
    {view==='day'||view==='week'?<>
      <Text style={[styles.heading,{color:colors.text}]}>{date}{view==='week'?` — ${shiftDate(date,6)}`:''}</Text>
      <View style={styles.row}><Button variant="secondary" isDisabled={actionLocked} onPress={()=>setDate(shiftDate(date,view==='week'?-7:-1))}>{t.previous}</Button><Button variant="secondary" isDisabled={actionLocked} onPress={()=>setDate(shiftDate(date,view==='week'?7:1))}>{t.next}</Button></View>
      <Button variant="ghost" isDisabled={actionLocked} onPress={()=>setDate(dateInZone(new Date().toISOString(),zone))}>{t.today}</Button>
      {!loading&&calendar?.import_issues.length?<Text accessibilityRole="alert" style={[styles.body,{color:colors.danger}]}>{language==='zh'?'部分导入日程无法在此范围展开，请检查来源。':'Some imported schedules could not be expanded for this range. Review their sources.'}</Text>:null}
      {!loading&&calendar&&calendar.from===date&&calendar.to===shiftDate(date,view==='week'?7:1)&&calendar.timezone===zone?calendar.days.map(day=><View key={day.date} style={styles.stack}>
        {view==='week'?<Text style={[styles.heading,{color:colors.text}]}>{day.date}</Text>:null}
        {!day.events.length&&!day.tasks.length?<Text style={[styles.body,{color:colors.muted}]}>{t.empty}</Text>:null}
        {day.events.map(renderItem)}{day.tasks.map(renderItem)}
      </View>):null}
      {!loading&&calendar&&calendar.from===date&&calendar.to===shiftDate(date,view==='week'?7:1)&&calendar.timezone===zone&&calendar.undated_tasks.length?<View style={styles.stack}><Text style={[styles.heading,{color:colors.text}]}>{t.undated}</Text>{calendar.undated_tasks.map(renderItem)}</View>:null}
    </>:null}
    {view==='courses'?<>
      <Text style={[styles.caption,{color:colors.muted}]}>{t.manual}</Text>
      {!courses.length&&!loading?<Text style={[styles.body,{color:colors.muted}]}>{t.empty}</Text>:null}
      {courses.map(c=><Card key={c.id} style={[styles.card,{backgroundColor:colors.surface}]}><Text style={[styles.heading,{color:colors.text}]}>{c.title}</Text><Text style={[styles.body,{color:colors.muted}]}>{c.code}</Text>{c.description?<Text style={[styles.body,{color:colors.text}]}>{c.description}</Text>:null}
        <Button variant="secondary" isDisabled={actionLocked} onPress={()=>{setCourseId(c.id);setView('all');}}>{t.all}</Button>
        <Button variant="ghost" isDisabled={actionLocked} onPress={()=>setEditor({kind:'course',record:c})}>{t.edit}</Button><Button variant="ghost" isDisabled={actionLocked} onPress={()=>remove(c)}>{t.remove}</Button>
      </Card>)}
    </>:null}
    {view==='all'?<>
      {courseId?<Text style={[styles.heading,{color:colors.text}]}>{courses.find(c=>c.id===courseId)?.title}</Text>:null}
      {!items.filter(i=>!courseId||i.course_id===courseId).length&&!loading?<Text style={[styles.body,{color:colors.muted}]}>{t.empty}</Text>:null}
      {items.filter(i=>!courseId||i.course_id===courseId).map(renderItem)}
    </>:null}
  </View>;
}

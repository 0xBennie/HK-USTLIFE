import {useInputProtection} from '../navigation/InputProtection';
import {ZONES,zoneLabel} from './ics-text';
import {StudyActionController,type StudyAction} from './action-controller';
import {useSceneFocus} from '../navigation/TabScene';
import {SchoolSourcesScreen} from './SchoolSourcesScreen';
import { SourceScreen } from './SourceScreen';
import { ImportScreen } from './ImportScreen';
import { useCallback,useEffect,useRef,useState,useSyncExternalStore } from 'react';
import { ActionSheetIOS,Alert,Linking,Pressable,Text,View } from 'react-native';
import {CheckCircle,CircleButton,EmptyState,IconTile,ListGroup,ListRow,Notice,PageHeader,PenIcon,PrimaryButton,Segmented,Skeleton,Stagger,Surface} from '../ui/Pen';
import {WeekGrid} from './WeekGrid';
import {TodayHome,courseColor} from './TodayHome';
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
/** "全部": open deadlines and events by date, finished tasks after them, undated notes and links last. */
function sortRecords(items:StudyItem[]){
 const key=(i:StudyItem)=>{const r=i as Record<string,unknown>;const at=(r.due_at??r.starts_at??r.due_date??r.start_date) as string|null|undefined;const done=i.kind==='task'&&(r.status==='done');return `${done?1:0}${at?'0'+at:'1'}`;};
 return [...items].sort((a,b)=>key(a).localeCompare(key(b)));
}
export function StudyScreen({name,onMe,language,dark,onActivity,onPost,onCampus,onInbox,initialReminder}:{name?:string;onMe?:()=>void;language:Language;dark:boolean;onActivity:(id:string)=>void;onPost:(id:string)=>void;onCampus:()=>void;onInbox:()=>void;initialReminder?:{id:string;date:string}|null}) {
 const sceneActive=useSceneFocus();
  const t=studyStrings[language],colors=palette[dark?'dark':'light'];
  const [managingSources,setManagingSources]=useState(false);
  const [schoolSources,setSchoolSources]=useState(false);
  const [importing,setImporting]=useState(false);
  const [view,setView]=useState<'home'|'day'|'week'|'courses'|'all'>('home');
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
        session.request<Calendar>(`/me/calendar?from=${view==='home'?dateInZone(new Date().toISOString()):date}&to=${shiftDate(view==='home'?dateInZone(new Date().toISOString()):date,view==='week'?7:1)}&timezone=${encodeURIComponent(view==='home'?'Asia/Hong_Kong':zone)}`),
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
  // Pen "V6 / 本周课表" · 其他情况: a successful save shows no banner (the list updates and the tap gives haptic
  // feedback); only an unconfirmed result or a refused save explains itself, briefly.
  function actionMessage(){
    const label=actionState.label,zh=language==='zh';
    if(actionState.phase==='refresh-needed')return zh?`已保存「${label}」，列表还没更新。`:`Saved “${label}”; the list hasn’t updated yet.`;
    if(actionState.phase==='uncertain')return zh?`「${label}」的结果还没确认。`:`“${label}” isn’t confirmed yet.`;
    if(actionState.phase==='rejected')return zh?`没保存「${label}」，请检查内容后再试。`:`“${label}” wasn’t saved. Check it and try again.`;
    return '';
  }
  function remove(record:Course|StudyItem) {
    const collection='kind' in record?'items':'courses';
    Alert.alert(t.confirmDelete,collection==='courses'?t.detach:record.title,[{text:t.cancel,style:'cancel'},{text:t.remove,style:'destructive',onPress:()=>{if(!alive.current||actionLocked)return;void mutate({path:`/study/${collection}/${record.id}`,method:'DELETE',body:{version:record.version},label:record.title});}}]);
  }
  const zh=language==='zh';
  function postpone(item:Extract<CalendarItem,{kind:'task'}>){if('school_origin' in item)return;const body:Record<string,unknown>={version:item.version,status:item.status};if(item.due_at)body.due_at=new Date(Date.parse(item.due_at)+864e5).toISOString();else if(item.due_date)body.due_date=shiftDate(item.due_date,1);else return;void mutate({path:`/study/items/${item.id}`,method:'PATCH',body,label:item.title});}
  function toggle(item:Extract<CalendarItem,{kind:'task'}>){const school='school_origin' in item?item.school_origin:null;void mutate(school?{path:`/school/records/${item.id}/personal`,method:'PATCH',body:{version:school.personal_version,completed:item.status==='open'},label:item.title}:{path:`/study/items/${item.id}`,method:'PATCH',body:{version:item.version,status:item.status==='open'?'done':'open'},label:item.title});}
  function addMenu(){
    const kinds:[string,()=>void][]=[[zh?'截止 / 任务':'Deadline / task',()=>setEditor({kind:'task',courseId})],[zh?'日程':'Event',()=>setEditor({kind:'event',courseId})],[zh?'私人笔记':'Note',()=>setEditor({kind:'note',courseId})],[zh?'资料链接':'Link',()=>setEditor({kind:'material',courseId})],[zh?'课程':'Course',()=>setEditor({kind:'course',courseId})]];
    ActionSheetIOS.showActionSheetWithOptions({title:zh?'添加':'Add',options:[...kinds.map(k=>k[0]),zh?'取消':'Cancel'],cancelButtonIndex:kinds.length},i=>{if(i<kinds.length&&!actionLocked)kinds[i][1]();});
  }
  function itemMenu(item:CalendarItem){
    const opts:[string,()=>void,boolean?][]=[];
    if('activity_origin' in item)opts.push([zh?'查看活动':'View activity',()=>onActivity(item.activity_origin.id)]);
    else if('school_origin' in item){}
    else if('import_origin' in item){opts.push([zh?'修改这一次':'Edit this occurrence',()=>setEditor({kind:'event',record:item})]);opts.push([zh?'取消这一次':'Cancel this occurrence',()=>void mutate({path:`/calendar/series/${item.import_origin.series_id}/occurrence/status`,method:'PATCH',body:{version:item.version,recurrence_id:item.recurrence_id,status:'cancelled'},label:item.title}),true]);}
    else {
      if(item.kind==='material')opts.push([t.viewLink,()=>void openResource(item.url)]);
      opts.push([t.edit,()=>setEditor({kind:item.kind,record:item})]);
      if(item.kind==='event')opts.push([item.status==='active'?t.cancelEvent:t.restoreEvent,()=>void mutate({path:`/study/items/${item.id}`,method:'PATCH',body:{version:item.version,status:item.status==='active'?'cancelled':'active'},label:item.title})]);
      opts.push([t.remove,()=>remove(item),true]);
    }
    if(!opts.length)return;
    const destructive=opts.findIndex(o=>o[2]);
    ActionSheetIOS.showActionSheetWithOptions({title:item.title,options:[...opts.map(o=>o[0]),zh?'取消':'Cancel'],cancelButtonIndex:opts.length,destructiveButtonIndex:destructive>=0?destructive:undefined},i=>{if(i<opts.length&&!actionLocked)opts[i][1]();});
  }
  // "今天 17:00" / "明天 23:59" / "10 月 8 日" (Pen "V6 / 本周课表"), in the calendar's display zone.
  const dayWord=(d:string)=>{const today=dateInZone(new Date().toISOString(),zone);return d===today?(zh?'今天':'Today'):d===shiftDate(today,1)?(zh?'明天':'Tomorrow'):zh?`${Number(d.slice(5,7))} 月 ${Number(d.slice(8,10))} 日`:new Date(d+'T00:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'short',timeZone:'UTC'});};
  const dueText=(item:Extract<CalendarItem,{kind:'task'}>)=>{if(item.due_date)return dayWord(item.due_date);if(!item.due_at)return t.undated;const at=dateTimeInZone(item.due_at,zone);return `${dayWord(at.slice(0,10))} ${at.slice(11,16)}`;};
  function renderItem(item:CalendarItem,index:number) {
    const school='school_origin' in item?item.school_origin:null;
    const linked=courses.find(c=>c.id===item.course_id),col=courseColor(courses,item.course_id);
    // "全部" spans many days, so its events carry the date (Pen "V6 / 全部记录（课表）" cYjzG); day and week views don't.
    const eventDay=view==='all'&&item.kind==='event'&&item.starts_at?`${dayWord(dateTimeInZone(item.starts_at,zone).slice(0,10))} `:view==='all'&&item.kind==='event'&&item.start_date?`${dayWord(item.start_date)} `:'';
    const when=item.kind==='event'?(item.all_day?`${eventDay}${zh?'全天':'All day'}`.trim():`${eventDay}${dateTimeInZone(item.starts_at!,zone).slice(11)}${item.ends_at?'–'+dateTimeInZone(item.ends_at,zone).slice(11):''}`)
      :item.kind==='task'?dueText(item):'';
    const overdue=item.kind==='task'&&item.status==='open'&&(item.due_at?Date.parse(item.due_at)<Date.now():item.due_date?item.due_date<dateInZone(new Date().toISOString(),zone):false);
    const icon=item.kind==='event'?('activity_origin' in item?'users':'calendar-days'):item.kind==='note'?'notebook-pen':item.kind==='material'?'link':'circle-check';
    const done=item.kind==='task'&&item.status==='done',cancelled=item.kind==='event'&&item.status==='cancelled';
    return <Stagger key={item.id} index={index}><Surface padding={14} onPress={()=>item.kind==='task'&&!school?setEditor({kind:'task',record:item}):itemMenu(item)} label={item.title}>
      <View style={{flexDirection:'row',alignItems:'center',gap:12}}>
        {item.kind==='task'?<CheckCircle color={overdue?colors.danger:undefined} checked={done} disabled={actionLocked} label={`${item.title} · ${done?t.reopen:t.complete}`} onPress={()=>toggle(item)}/>:<IconTile icon={icon} color={item.kind==='event'?col:item.kind==='note'?colors.orange:colors.teal}/>}
        <View style={{flex:1,gap:3}}>
          <Text numberOfLines={2} style={{fontSize:16,lineHeight:22,fontWeight:'500',color:done||cancelled?colors.muted:colors.text,textDecorationLine:done||cancelled?'line-through':'none'}}>{item.title}</Text>
          <View style={{flexDirection:'row',alignItems:'center',gap:6,flexWrap:'wrap'}}>
            {linked?<View style={{paddingVertical:2,paddingHorizontal:7,borderRadius:6,backgroundColor:col+'1F'}}><Text style={{fontSize:11,fontWeight:'700',color:col}}>{linked.code||linked.title}</Text></View>:null}
            {school?<Text style={{fontSize:12,fontWeight:'600',color:colors.accent}}>{school.provider==='sis'?'SIS':'Canvas'}{school.stale?(zh?' · 待更新':' · stale'):''}</Text>:'import_origin' in item?<Text style={{fontSize:12,color:colors.muted}}>{item.import_origin.source_name}</Text>:null}
            {item.kind==='event'&&item.location?<Text numberOfLines={1} style={{fontSize:12,color:colors.muted}}>{item.location}</Text>:null}
            {cancelled?<Text style={{fontSize:12,fontWeight:'600',color:colors.danger}}>{t.cancelled}</Text>:null}
          </View>
        </View>
        {when?<Text style={{fontSize:14,fontWeight:'500',color:overdue?colors.danger:colors.muted}}>{when}</Text>:null}
        {!school&&item.kind!=='task'?<Pressable accessibilityRole="button" accessibilityLabel={zh?'更多操作':'More actions'} hitSlop={10} onPress={()=>itemMenu(item)}><PenIcon name="ellipsis" size={18} color={colors.tertiary}/></Pressable>:null}
      </View>
      {item.body&&view!=='day'&&view!=='week'?<Text numberOfLines={2} style={{fontSize:14,lineHeight:20,color:colors.muted,marginTop:8,marginLeft:42}}>{item.body}</Text>:null}
    </Surface></Stagger>;
  }
  // Week view starts on Monday; on a weekend the student cares about the coming week.
  useEffect(()=>{if(view!=='week')return;const wd=new Date(date+'T00:00:00Z').getUTCDay();if(wd===0)setDate(shiftDate(date,1));else if(wd===6)setDate(shiftDate(date,2));else if(wd!==1)setDate(shiftDate(date,1-wd));},[view,date]);
  const status=actionMessage();
  if(schoolSources)return <SchoolSourcesScreen language={language} dark={dark} onBack={()=>{setSchoolSources(false);void load();}}/>;
  if(managingSources)return <SourceScreen language={language} dark={dark} onBack={()=>{setManagingSources(false);void load();}} onImport={()=>{setManagingSources(false);setImporting(true);}}/>;
  if(importing)return <ImportScreen language={language} dark={dark} onBack={()=>setImporting(false)} onSaved={()=>{setImporting(false);void load();}}/>;
  if(editor)return <StudyForm editor={editor} courses={courses} language={language} dark={dark} onBack={()=>setEditor(null)} onSaved={()=>{setEditor(null);void load();}} />;
  if(view==='home')return <View style={{gap:16}}>
    {status?<Notice tone={actionState.phase==='rejected'?'error':'warning'} text={status} action={actionState.phase==='refresh-needed'?(zh?'刷新':'Refresh'):actionState.phase==='uncertain'?(zh?'核对':'Check'):undefined} onAction={()=>void actions.check()}/>:null}
    <TodayHome name={name} onMe={onMe} language={language} courses={courses} items={items} calendar={calendar} loading={loading} error={error} busy={actionLocked}
      onToggle={toggle} onPostpone={postpone} onOpenTask={task=>setEditor({kind:'task',record:task})} onAdd={addMenu} onManage={v=>{setDate(dateInZone(new Date().toISOString(),zone));setCourseId(null);setView(v);}}
      onActivity={onActivity} onPost={onPost} onCampus={onCampus} onInbox={onInbox} onSchool={()=>setSchoolSources(true)} onRetry={()=>void load()}/>
  </View>;
  const sameRange=calendar&&calendar.from===date&&calendar.to===shiftDate(date,view==='week'?7:1)&&calendar.timezone===zone;
  const dayTitle=(d:string)=>{const today=dateInZone(new Date().toISOString(),zone);const wd=new Date(d+'T00:00:00Z').getUTCDay();const label=zh?`${Number(d.slice(5,7))} 月 ${Number(d.slice(8))} 日 周${'日一二三四五六'[wd]}`:new Date(d+'T00:00:00Z').toLocaleDateString('en-HK',{weekday:'short',month:'short',day:'numeric',timeZone:'UTC'});return d===today?`${zh?'今天':'Today'} · ${label}`:label;};
  let n=0;
  return <View style={{gap:18}}>
    <PageHeader onBack={()=>{setView('home');setCourseId(null);}} backLabel={zh?'今天':'Today'} title={view==='courses'?(zh?'课程':'Courses'):view==='all'?(courseId?courses.find(c=>c.id===courseId)?.title??t.all:(zh?'全部记录':'All records')):view==='week'?(zh?'本周课表':'This week'):(zh?'日程':'Schedule')} subtitle={t.private}
      right={<><CircleButton icon="ellipsis" label={zh?'更多设置':'More settings'} onPress={()=>ActionSheetIOS.showActionSheetWithOptions({options:[zh?'学校连接与同步':'School connections',zh?'导入的日历':'Imported calendars',zh?`显示时区：${zoneLabel(zone,zh)}`:`Time zone: ${zoneLabel(zone,zh)}`,zh?'导入日历文件':'Import a calendar file',zh?'取消':'Cancel'],cancelButtonIndex:4},i=>{if(i===0)setSchoolSources(true);if(i===1)setManagingSources(true);if(i===3)setImporting(true);if(i===2)ActionSheetIOS.showActionSheetWithOptions({title:zh?'课表按哪个时区显示':'Show the calendar in',options:[...ZONES.map(z=>zoneLabel(z,zh)),zh?'取消':'Cancel'],cancelButtonIndex:ZONES.length},j=>{if(j<ZONES.length)setZone(ZONES[j]);});})}/><CircleButton icon="plus" label={zh?'添加':'Add'} onPress={addMenu}/></>}/>
    <Segmented value={view} label={zh?'视图':'View'} options={(['day','week','courses','all'] as const).map(v=>({value:v,label:v==='all'?(zh?'全部':'All'):t[v]}))} onChange={v=>{setView(v);setCourseId(null);}}/>
    {status?<Notice tone={actionState.phase==='rejected'?'error':'warning'} text={status} action={actionState.phase==='refresh-needed'?(zh?'刷新':'Refresh'):actionState.phase==='uncertain'?(zh?'核对':'Check'):undefined} onAction={()=>void actions.check()}/>:null}
    {error?<Notice tone="error" text={error} action={zh?'重试':'Retry'} onAction={()=>void load()}/>:null}
    {linkError?<Notice tone="error" text={linkError}/>:null}
    {view==='day'||view==='week'?<>
      <View style={{flexDirection:'row',alignItems:'center',gap:8}}>
        <CircleButton icon="chevron-left" label={t.previous} onPress={()=>setDate(shiftDate(date,view==='week'?-7:-1))}/>
        <Pressable accessibilityRole="button" onPress={()=>setDate(dateInZone(new Date().toISOString(),zone))} style={{flex:1,alignItems:'center'}}><Text style={{fontSize:17,fontWeight:'700',color:colors.text}}>{view==='week'?`${dayTitle(date).replace(/^今天 · |^Today · /,'')} – ${Number(shiftDate(date,6).slice(8))}${zh?' 日':''}`:dayTitle(date)}</Text><Text style={{fontSize:12,color:colors.accent}}>{zh?'回到今天':'Back to today'}</Text></Pressable>
        <CircleButton icon="chevron-right" label={t.next} onPress={()=>setDate(shiftDate(date,view==='week'?7:1))}/>
      </View>
      {loading&&!sameRange?<><Skeleton/><Skeleton/></>:null}
      {!loading&&calendar?.import_issues.length?<Notice tone="warning" text={zh?'部分导入日程无法在此范围展开，请检查来源。':'Some imported schedules could not be expanded for this range.'} action={zh?'查看':'Review'} onAction={()=>setManagingSources(true)}/>:null}
      {sameRange&&view==='week'?<>
        <WeekGrid days={calendar!.days} today={dateInZone(new Date().toISOString(),zone)} zone={zone} zh={zh} colorOf={id=>courseColor(courses,id)} codeOf={i=>courses.find(c=>c.id===i.course_id)?.code||i.title} onOpen={i=>itemMenu(i)} onDay={d=>{setDate(d);setView('day');}}/>
        {calendar!.days.some(d=>d.tasks.length)?<View style={{gap:10}}><Text style={{paddingHorizontal:4,fontSize:20,fontWeight:'700',color:colors.text}}>{zh?'本周截止':'Due this week'}</Text>{calendar!.days.flatMap(d=>d.tasks).map(i=>renderItem(i,n++))}</View>:null}
      </>:null}
      {sameRange&&view==='day'?calendar!.days.map(day=><View key={day.date} style={{gap:10}}>
        {!day.events.length&&!day.tasks.length?(view==='day'?<EmptyState icon="sun" title={zh?'这天没有安排':'Nothing planned'} body={zh?'留点空白也很好。':'Some free time is good too.'}/>:<Text style={{paddingHorizontal:4,fontSize:14,color:colors.tertiary}}>{zh?'没有安排':'Free'}</Text>):null}
        {day.events.map(i=>renderItem(i,n++))}{day.tasks.map(i=>renderItem(i,n++))}
      </View>):null}
      {sameRange&&calendar!.undated_tasks.length?<View style={{gap:10}}><Text style={{paddingHorizontal:4,fontSize:15,fontWeight:'700',color:colors.text}}>{t.undated}</Text>{calendar!.undated_tasks.map(i=>renderItem(i,n++))}</View>:null}
    </>:null}
    {view==='courses'?<>
      {!courses.length&&!loading?<EmptyState icon="library" title={zh?'还没有课程':'No courses yet'} body={zh?'连接 Canvas 后自动同步，也可以手动添加。':'Connect Canvas to sync, or add one.'} action={zh?'添加课程':'Add course'} onAction={()=>setEditor({kind:'course'})}/>:null}
      <ListGroup>{courses.map(c=><ListRow key={c.id} icon="book-open" tile={courseColor(courses,c.id)} title={c.code||c.title} subtitle={c.code?c.title:c.description||undefined} value={zh?`${items.filter(i=>i.course_id===c.id).length} 项`:`${items.filter(i=>i.course_id===c.id).length} items`} chevron onPress={()=>{setCourseId(c.id);setView('all');}}/>)}</ListGroup>
      {courseId===null&&courses.length?<Text style={{paddingHorizontal:16,fontSize:12,color:colors.muted}}>{t.manual}</Text>:null}
    </>:null}
    {view==='all'?<>
      {courseId?<View style={{flexDirection:'row',gap:10}}><View style={{flex:1}}><PrimaryButton tone="soft" label={t.edit} onPress={()=>{const c=courses.find(x=>x.id===courseId);if(c)setEditor({kind:'course',record:c});}}/></View><View style={{flex:1}}><PrimaryButton tone="soft" label={t.remove} onPress={()=>{const c=courses.find(x=>x.id===courseId);if(c)remove(c);}}/></View></View>:null}
      {!items.filter(i=>!courseId||i.course_id===courseId).length&&!loading?<EmptyState icon="inbox" title={t.empty}/>:null}
      {sortRecords(items.filter(i=>!courseId||i.course_id===courseId)).map(i=>renderItem(i,n++))}
    </>:null}
  </View>;
}

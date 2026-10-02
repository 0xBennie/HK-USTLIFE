import { useCallback,useEffect,useRef,useState } from 'react';
import { ActivityIndicator,Alert,Linking,ScrollView,Text,View } from 'react-native';
import { Button } from 'heroui-native/button';
import { Card } from 'heroui-native/card';
import { session } from '../runtime';
import { ApiFailure } from '../api';
import { palette,styles } from '../theme';
import type { Language } from '../strings';
import type { Calendar,Course,StudyItem } from './types';
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
export function StudyScreen({language,dark}:{language:Language;dark:boolean}) {
  const t=studyStrings[language],colors=palette[dark?'dark':'light'];
  const [view,setView]=useState<'day'|'week'|'courses'|'all'>('day');
  const [date,setDate]=useState(()=>dateInZone(new Date().toISOString()));
  const [zone,setZone]=useState('Asia/Hong_Kong'),[choosingZone,setChoosingZone]=useState(false);
  const [courses,setCourses]=useState<Course[]>([]),[items,setItems]=useState<StudyItem[]>([]),[calendar,setCalendar]=useState<Calendar|null>(null);
  const [courseId,setCourseId]=useState<string|null>(null),[editor,setEditor]=useState<Editor|null>(null);
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const generation=useRef(0);
  const load=useCallback(async()=>{
    const current=++generation.current;setLoading(true);setError('');
    try {
      const [nextCourses,nextItems,nextCalendar]=await Promise.all([
        allPages<Course>('/study/courses'),allPages<StudyItem>('/study/items'),
        session.request<Calendar>(`/me/calendar?from=${date}&to=${shiftDate(date,view==='week'?7:1)}&timezone=${encodeURIComponent(zone)}`),
      ]);
      if(current!==generation.current)return;
      setCourses(nextCourses);setItems(nextItems);setCalendar(nextCalendar);
    }catch { if(current===generation.current)setError(t.error); }
    finally { if(current===generation.current)setLoading(false); }
  },[date,view,zone,t.error]);
  useEffect(()=>{void load();return()=>{generation.current++;};},[load]);
  async function mutate(action:()=>Promise<unknown>) {
    if(busy)return;setBusy(true);setError('');
    try {await action();await load();}catch(e){setError(e instanceof ApiFailure&&e.code==='VERSION_CONFLICT'?t.conflict:t.saveError);}finally{setBusy(false);}
  }
  function remove(record:Course|StudyItem) {
    const collection='kind' in record?'items':'courses';
    Alert.alert(t.confirmDelete,collection==='courses'?t.detach:record.title,[{text:t.cancel,style:'cancel'},{text:t.remove,style:'destructive',onPress:()=>mutate(async()=>{
      await session.request(`/study/${collection}/${record.id}`,{method:'DELETE',body:{version:record.version}});
      if(collection==='courses')setCourseId(null);
    })}]);
  }
  function renderItem(item:StudyItem) {
    const linked=courses.find(c=>c.id===item.course_id);
    const detail=item.kind==='event'?(item.all_day?`${item.start_date} · ${t.allDayLabel}${item.end_date?` → ${item.end_date}`:''}`:`${dateTimeInZone(item.starts_at!,zone)} → ${item.ends_at?dateTimeInZone(item.ends_at,zone):t.unknownEnd}`)
      :item.kind==='task'?(item.due_date??(item.due_at?dateTimeInZone(item.due_at,zone):t.undated)):item.kind==='material'?item.url:'';
    return <Card key={item.id} style={[styles.card,{backgroundColor:colors.surface}]}>
      <Text style={[styles.caption,{color:colors.muted}]}>{t[item.kind]}{linked?` · ${linked.code||linked.title}`:''}{'status' in item?` · ${t[item.status]}`:''}</Text>
      <Text style={[styles.heading,{color:colors.text}]}>{item.title}</Text>
      {detail?<Text selectable style={[styles.body,{color:colors.muted}]}>{detail}</Text>:null}
      {item.kind==='event'&&item.location?<Text style={[styles.body,{color:colors.muted}]}>{item.location}</Text>:null}
      {item.body?<Text selectable style={[styles.body,{color:colors.text}]}>{item.body}</Text>:null}
      {item.kind==='task'?<Button variant="secondary" isDisabled={busy} onPress={()=>mutate(()=>session.request(`/study/items/${item.id}`,{method:'PATCH',body:{version:item.version,status:item.status==='open'?'done':'open'}}))}>{item.status==='open'?t.complete:t.reopen}</Button>:null}
      {item.kind==='event'?<Button variant="secondary" isDisabled={busy} onPress={()=>mutate(()=>session.request(`/study/items/${item.id}`,{method:'PATCH',body:{version:item.version,status:item.status==='active'?'cancelled':'active'}}))}>{item.status==='active'?t.cancelEvent:t.restoreEvent}</Button>:null}
      {item.kind==='material'?<Button variant="secondary" onPress={()=>mutate(()=>Linking.openURL(item.url))}>{t.viewLink}</Button>:null}
      <Button variant="ghost" isDisabled={busy} onPress={()=>setEditor({kind:item.kind,record:item})}>{t.edit}</Button>
      <Button variant="ghost" isDisabled={busy} onPress={()=>remove(item)}>{t.remove}</Button>
    </Card>;
  }
  if(editor)return <StudyForm editor={editor} courses={courses} language={language} dark={dark} onBack={()=>setEditor(null)} onSaved={()=>{setEditor(null);void load();}} />;
  return <View style={styles.stack}>
    <Text style={[styles.title,{color:colors.text}]}>{t.title}</Text><Text style={[styles.caption,{color:colors.muted}]}>{t.private}</Text>
    <Button variant="ghost" onPress={()=>setChoosingZone(!choosingZone)}>{t.zone}: {zone}</Button>
    {choosingZone?(['Asia/Hong_Kong','UTC','Europe/London','America/New_York'].map(value=><Button key={value} variant={value===zone?'primary':'secondary'} onPress={()=>{setZone(value);setChoosingZone(false);}}>{value===zone?'✓ ':''}{value}</Button>)):null}
    <ScrollView horizontal showsHorizontalScrollIndicator={false}><View style={styles.row}>{(['day','week','courses','all'] as const).map(v=><Button key={v} variant={view===v?'primary':'secondary'} onPress={()=>{setView(v);setCourseId(null);}}>{t[v]}</Button>)}</View></ScrollView>
    {error?<Text accessibilityRole="alert" style={[styles.body,{color:colors.danger}]}>{error}</Text>:null}
    <Button variant="ghost" isDisabled={loading} onPress={load}>{t.refresh}</Button>
    {loading?<ActivityIndicator color={colors.accent} accessibilityLabel={t.loading}/>:null}
    <ScrollView horizontal><View style={styles.row}>{(['event','task','note','material','course'] as const).map(kind=><Button key={kind} variant="secondary" onPress={()=>setEditor({kind,courseId})}>{t.add} {t[kind]}</Button>)}</View></ScrollView>
    {view==='day'||view==='week'?<>
      <Text style={[styles.heading,{color:colors.text}]}>{date}{view==='week'?` — ${shiftDate(date,6)}`:''}</Text>
      <View style={styles.row}><Button variant="secondary" onPress={()=>setDate(shiftDate(date,view==='week'?-7:-1))}>{t.previous}</Button><Button variant="secondary" onPress={()=>setDate(shiftDate(date,view==='week'?7:1))}>{t.next}</Button></View>
      <Button variant="ghost" onPress={()=>setDate(dateInZone(new Date().toISOString(),zone))}>{t.today}</Button>
      {!loading&&calendar&&calendar.from===date&&calendar.to===shiftDate(date,view==='week'?7:1)&&calendar.timezone===zone?calendar.days.map(day=><View key={day.date} style={styles.stack}>
        {view==='week'?<Text style={[styles.heading,{color:colors.text}]}>{day.date}</Text>:null}
        {!day.events.length&&!day.tasks.length?<Text style={[styles.body,{color:colors.muted}]}>{t.empty}</Text>:null}
        {day.events.map(renderItem)}{day.tasks.map(renderItem)}
      </View>):null}
      {calendar?.undated_tasks.length?<View style={styles.stack}><Text style={[styles.heading,{color:colors.text}]}>{t.undated}</Text>{calendar.undated_tasks.map(renderItem)}</View>:null}
    </>:null}
    {view==='courses'?<>
      <Text style={[styles.caption,{color:colors.muted}]}>{t.manual}</Text>
      {!courses.length&&!loading?<Text style={[styles.body,{color:colors.muted}]}>{t.empty}</Text>:null}
      {courses.map(c=><Card key={c.id} style={[styles.card,{backgroundColor:colors.surface}]}><Text style={[styles.heading,{color:colors.text}]}>{c.title}</Text><Text style={[styles.body,{color:colors.muted}]}>{c.code}</Text>{c.description?<Text style={[styles.body,{color:colors.text}]}>{c.description}</Text>:null}
        <Button variant="secondary" onPress={()=>{setCourseId(c.id);setView('all');}}>{t.all}</Button>
        <Button variant="ghost" onPress={()=>setEditor({kind:'course',record:c})}>{t.edit}</Button><Button variant="ghost" isDisabled={busy} onPress={()=>remove(c)}>{t.remove}</Button>
      </Card>)}
    </>:null}
    {view==='all'?<>
      {courseId?<Text style={[styles.heading,{color:colors.text}]}>{courses.find(c=>c.id===courseId)?.title}</Text>:null}
      {!items.filter(i=>!courseId||i.course_id===courseId).length&&!loading?<Text style={[styles.body,{color:colors.muted}]}>{t.empty}</Text>:null}
      {items.filter(i=>!courseId||i.course_id===courseId).map(renderItem)}
    </>:null}
  </View>;
}

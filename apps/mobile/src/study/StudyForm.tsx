import { useRef,useState } from 'react';
import { ScrollView,Text,View } from 'react-native';
import { Button } from 'heroui-native/button';
import { Input } from 'heroui-native/input';
import { ApiFailure } from '../api';
import { session } from '../runtime';
import { palette,styles } from '../theme';
import type { Language } from '../strings';
import type { Course,StudyItem,CalendarItem } from './types';
import { studyStrings } from './strings';
import { hongKongInput,newWriteKey,editedInstant } from './dates';

export type Editor = {kind:'course'|StudyItem['kind'];record?:Course|CalendarItem;courseId?:string|null};
export function StudyForm({editor,courses,language,dark,onSaved,onBack}:{editor:Editor;courses:Course[];language:Language;dark:boolean;onSaved:()=>void;onBack:()=>void}) {
  const t=studyStrings[language],colors=palette[dark?'dark':'light'],existing=editor.record;
  const imported=existing&&'import_origin' in existing?existing:undefined;
  const initial=existing && 'kind' in existing?existing:undefined;
  const [title,setTitle]=useState(existing?.title ?? '');
  const [body,setBody]=useState(existing && 'description' in existing?existing.description:initial?.body ?? '');
  const [code,setCode]=useState(existing && 'code' in existing?existing.code:'');
  const [courseId,setCourseId]=useState(initial?.course_id ?? editor.courseId ?? null);
  const [location,setLocation]=useState(initial?.kind==='event'?initial.location:'');
  const [url,setUrl]=useState(initial?.kind==='material'?initial.url:'');
  const [allDay,setAllDay]=useState(initial?.kind==='event'?initial.all_day:false);
  const [start,setStart]=useState(initial?.kind==='event'?(initial.all_day?initial.start_date??'':hongKongInput(initial.starts_at)):'');
  const [end,setEnd]=useState(initial?.kind==='event'?(initial.all_day?initial.end_date??'':hongKongInput(initial.ends_at)):'');
  const [dueMode,setDueMode]=useState<'none'|'date'|'time'>(initial?.kind==='task'?(initial.due_at?'time':initial.due_date?'date':'none'):'none');
  const [due,setDue]=useState(initial?.kind==='task'?(initial.due_date??hongKongInput(initial.due_at)):'');
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const key=useRef(newWriteKey());
  const change=<T,>(set:(v:T)=>void,value:T)=>{set(value);key.current=newWriteKey();};
  const field=(label:string,value:string,onChange:(v:string)=>void,multiline=false,placeholder?:string)=><View style={styles.smallStack}>
    <Text style={[styles.body,{color:colors.text}]}>{label}</Text>
    <Input accessibilityLabel={label} value={value} editable={!busy} onChangeText={v=>change(onChange,v)} multiline={multiline} placeholder={placeholder} autoCapitalize="none" style={[styles.input,{color:colors.text,borderColor:colors.border},multiline?{minHeight:112,textAlignVertical:'top'}:{}]} />
  </View>;
  async function save() {
    if(busy)return;setBusy(true);setError('');
    try {
      let payload:Record<string,unknown>={title,course_id:courseId};
      if(editor.kind==='course') payload={title,code,description:body};
      if(editor.kind==='note') payload={...payload,kind:'note',body};
      if(editor.kind==='material') payload={...payload,kind:'material',body,url};
      if(editor.kind==='event') payload={...payload,kind:'event',body,location,all_day:allDay,
        timezone:!imported&&initial?.kind==='event'?initial.timezone:'Asia/Hong_Kong',
        starts_at:allDay?null:editedInstant(start,initial?.kind==='event'?initial.starts_at:null),ends_at:allDay?null:editedInstant(end,initial?.kind==='event'?initial.ends_at:null),start_date:allDay?start:null,end_date:allDay?(end||null):null,
        status:initial?.kind==='event'?initial.status:'active',remind_minutes:!allDay && initial?.kind==='event'?initial.remind_minutes:null};
      if(editor.kind==='task') payload={...payload,kind:'task',body,status:initial?.kind==='task'?initial.status:'open',
        due_at:dueMode==='time'?editedInstant(due,initial?.kind==='task'?initial.due_at:null):null,due_date:dueMode==='date'?(due||null):null,
        remind_minutes:dueMode==='time' && initial?.kind==='task'?initial.remind_minutes:null,subtasks:initial?.kind==='task'?initial.subtasks:[]};
      const path=`/study/${editor.kind==='course'?'courses':'items'}`;
      if(imported) {
        await session.request(`/calendar/series/${imported.import_origin.series_id}/occurrence`,{method:'PATCH',body:{version:imported.version,recurrence_id:imported.recurrence_id,event:payload}});
        onSaved();return;
      }
      if(existing) { delete payload.kind;payload.version=existing.version; }
      await session.request(existing?`${path}/${existing.id}`:path,{method:existing?'PATCH':'POST',body:payload,idempotencyKey:key.current});
      onSaved();
    } catch(e) { setError(e instanceof ApiFailure?(e.code==='VERSION_CONFLICT'?t.conflict:e.status===400?t.invalid:t.saveError):t.invalid); }
    finally { setBusy(false); }
  }
  return <View style={styles.stack}>
    <Button variant="ghost" isDisabled={busy} onPress={onBack}>{t.back}</Button>
    <Text style={[styles.heading,{color:colors.text}]}>{existing?t.edit:t.add} · {t[editor.kind]}</Text>
    {field(t.name,title,setTitle)}
    {editor.kind==='course'?field(t.code,code,setCode):imported?<Text style={[styles.caption,{color:colors.muted}]}>{language==='zh'?'仅修改这一次日程，不影响其他周次。':'Edit this occurrence only; other dates stay unchanged.'}</Text>:<View style={styles.smallStack}>
      <Text style={[styles.body,{color:colors.text}]}>{t.courseChoice}</Text>
      <ScrollView horizontal><View style={styles.row}>
        <Button variant={courseId===null?'primary':'secondary'} isDisabled={busy} onPress={()=>change(setCourseId,null)}>{courseId===null?'✓ ':''}{t.noCourse}</Button>
        {courses.map(c=><Button key={c.id} variant={courseId===c.id?'primary':'secondary'} isDisabled={busy} onPress={()=>change(setCourseId,c.id)}>{courseId===c.id?'✓ ':''}{c.code||c.title}</Button>)}
      </View></ScrollView>
    </View>}
    {editor.kind==='event'?<>
      <Button variant="secondary" isDisabled={busy} onPress={()=>{setAllDay(!allDay);setStart('');setEnd('');key.current=newWriteKey();}}>{allDay?`✓ ${t.allDay}`:t.timed}</Button>
      <Text style={[styles.caption,{color:colors.muted}]}>{t.format}</Text>
      {field(allDay?t.date:t.start,start,setStart,false,allDay?'2026-10-05':'2026-10-05 09:00')}
      {field(allDay?t.endDate:t.end,end,setEnd)}
      {field(t.location,location,setLocation)}
    </>:null}
    {editor.kind==='task'?<>
      <Text style={[styles.body,{color:colors.text}]}>{t.due}</Text>
      {(['none','date','time'] as const).map(mode=><Button key={mode} variant={dueMode===mode?'primary':'secondary'} isDisabled={busy} onPress={()=>{setDueMode(mode);setDue('');key.current=newWriteKey();}}>{dueMode===mode?'✓ ':''}{mode==='none'?t.noDue:mode==='date'?t.dateDue:t.timeDue}</Button>)}
      {dueMode!=='none'?<><Text style={[styles.caption,{color:colors.muted}]}>{t.format}</Text>{field(dueMode==='date'?t.dueDate:t.dueTime,due,setDue,false,dueMode==='date'?'2026-10-05':'2026-10-05 17:00')}</>:null}
    </>:null}
    {editor.kind==='material'?field(t.url,url,setUrl,false,'https://…'):null}
    {field(t.body,body,setBody,true)}
    {error?<Text accessibilityRole="alert" style={[styles.body,{color:colors.danger}]}>{error}</Text>:null}
    <Button isDisabled={busy || !title.trim()} onPress={save}>{busy?t.loading:t.save}</Button>
  </View>;
}

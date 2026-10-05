import {useHideTabBar} from '../navigation/SceneOverlay';
import {StudySaveController,type StudyWrite} from './save-controller';
import {reviewRequired} from '../write-receipt';
import {useInputProtection} from '../navigation/InputProtection';
import { useEffect,useMemo,useRef,useState,useSyncExternalStore } from 'react';
import { ActionSheetIOS,Text,TextInput,View } from 'react-native';
import {CircleButton,FormField,FormGroup,GlassChips,ListGroup,ListRow,Notice,PrimaryButton,Surface,SwitchRow,usePenColors} from '../ui/Pen';
import {DateTimeField} from '../ui/DateTimeField';
import { ApiFailure } from '../api';
import { session } from '../runtime';
import type { Language } from '../strings';
import type { Course,StudyItem,CalendarItem } from './types';
import { studyStrings } from './strings';
import { hongKongInput,newWriteKey,editedInstant } from './dates';

export type Editor = {kind:'course'|StudyItem['kind'];record?:Course|CalendarItem;courseId?:string|null};
export function StudyForm({editor,courses,language,dark,onSaved,onBack}:{editor:Editor;courses:Course[];language:Language;dark:boolean;onSaved:()=>void;onBack:()=>void}) {
 useHideTabBar();
  const alive=useRef(true);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  const t=studyStrings[language],existing=editor.record;
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
  const [remindMinutes,setRemindMinutes]=useState<number|null>(initial&&(initial.kind==='event'||initial.kind==='task')?initial.remind_minutes:null);
  const [error,setError]=useState('');
  const controller=useMemo(()=>new StudySaveController((path,options)=>session.request(path,options),newWriteKey),[]);
  const saveState=useSyncExternalStore(controller.subscribe,controller.snapshot);
  const busy=saveState.phase==='submitting',uncertain=saveState.phase==='uncertain',frozen=busy||uncertain||saveState.phase==='saved';
  const mustReview=reviewRequired(saveState.error);
  const protectInput=useInputProtection({title,body,code,courseId,location,url,allDay,start,end,dueMode,due,remindMinutes},busy,uncertain,language==='zh');
  const change=<T,>(set:(v:T)=>void,value:T)=>{if(!frozen)set(value);};
  async function save() {
    if(controller.snapshot().phase==='submitting')return;setError('');
    try {
      let write:StudyWrite|undefined;
      if(controller.snapshot().phase!=='uncertain'){
      let payload:Record<string,unknown>={title,course_id:courseId};
      if(editor.kind==='course') payload={title,code,description:body};
      if(editor.kind==='note') payload={...payload,kind:'note',body};
      if(editor.kind==='material') payload={...payload,kind:'material',body,url};
      if(editor.kind==='event') payload={...payload,kind:'event',body,location,all_day:allDay,
        timezone:!imported&&initial?.kind==='event'?initial.timezone:'Asia/Hong_Kong',
        starts_at:allDay?null:editedInstant(start,initial?.kind==='event'?initial.starts_at:null),ends_at:allDay?null:editedInstant(end,initial?.kind==='event'?initial.ends_at:null),start_date:allDay?start:null,end_date:allDay?(end||null):null,
        status:initial?.kind==='event'?initial.status:'active',remind_minutes:!allDay?remindMinutes:null};
      if(editor.kind==='task') payload={...payload,kind:'task',body,status:initial?.kind==='task'?initial.status:'open',
        due_at:dueMode==='time'?editedInstant(due,initial?.kind==='task'?initial.due_at:null):null,due_date:dueMode==='date'?(due||null):null,
        remind_minutes:dueMode==='time'?remindMinutes:null,subtasks:initial?.kind==='task'?initial.subtasks:[]};
      const path=`/study/${editor.kind==='course'?'courses':'items'}`;
      if(imported) {
        write={path:`/calendar/series/${imported.import_origin.series_id}/occurrence`,method:'PATCH',body:{version:imported.version,recurrence_id:imported.recurrence_id,event:payload}};
      }else{
        if(existing){delete payload.kind;payload.version=existing.version;}
        write={path:existing?`${path}/${existing.id}`:path,method:existing?'PATCH':'POST',body:payload};
      }
      }
      if(await controller.submit(write)){if(alive.current)onSaved();return;}
      if(!alive.current)return;
      const failure=controller.snapshot();
      if(failure.error instanceof ApiFailure&&failure.error.code==='RECEIPT_REVIEW_REQUIRED')setError(language==='zh'?'重试期限已过。请返回查看已保存的安排，核对后再操作。':'Retry window ended. Go back and check saved plans before taking another action.');
      else if(failure.phase==='uncertain')setError(language==='zh'?'保存结果尚未确认。输入已保留，请重试同一笔操作；不要重新创建。':'Save result is unconfirmed. Your input is kept. Retry this request instead of creating another.');
      else if(failure.error)throw failure.error;
    } catch(e) { if(alive.current)setError(e instanceof ApiFailure?(e.code==='VERSION_CONFLICT'?t.conflict:e.status===400?t.invalid:t.saveError):t.invalid); }
  }
  // Pen board "V3 / 添加截止（弹出面板）" (Q5QFX): title card, course / due / reminder rows, quick due chips, notes, one prominent save.
  const zh=language==='zh',c=usePenColors();
  const kindTitle=editor.kind==='task'?(zh?'截止':'deadline'):t[editor.kind];
  const today=hongKongInput(new Date().toISOString()).slice(0,10);
  const addDays=(d:string,n:number)=>new Date(Date.parse(d+'T00:00:00Z')+n*864e5).toISOString().slice(0,10);
  const wd=new Date(today+'T00:00:00Z').getUTCDay(),friday=addDays(today,(5-wd+7)%7);
  const quick:[string,string][]=[[zh?'今晚 23:59':'Tonight 23:59',`${today} 23:59`],[zh?'明天 23:59':'Tomorrow 23:59',`${addDays(today,1)} 23:59`],[zh?'周五 17:00':'Fri 17:00',`${friday} 17:00`]];
  const remindLabel=(m:number|null)=>m===null?(zh?'不提醒':'None'):m===0?(zh?'准时':'At time'):m<60?(zh?`提前 ${m} 分钟`:`${m} min before`):m<1440?(zh?`提前 ${m/60} 小时`:`${m/60} h before`):(zh?`提前 ${m/1440} 天`:`${m/1440} d before`);
  const pickCourse=()=>{if(frozen)return;const opts=[t.noCourse,...courses.map(x=>x.code||x.title),zh?'取消':'Cancel'];ActionSheetIOS.showActionSheetWithOptions({options:opts,cancelButtonIndex:opts.length-1},i=>{if(i===0)setCourseId(null);else if(i<opts.length-1)setCourseId(courses[i-1].id);});};
  const pickRemind=()=>{if(frozen)return;const mins:(number|null)[]=[null,0,10,30,60,1440];const opts=[...mins.map(remindLabel),zh?'取消':'Cancel'];ActionSheetIOS.showActionSheetWithOptions({options:opts,cancelButtonIndex:opts.length-1},i=>{if(i<mins.length)setRemindMinutes(mins[i]);});};
  const linked=courses.find(x=>x.id===courseId);
  const timed=(editor.kind==='event'&&!allDay)||(editor.kind==='task'&&dueMode==='time');
  return <View style={{gap:16}}>
    <View style={{flexDirection:'row',alignItems:'center',minHeight:48}}>
      <CircleButton icon="x" label={zh?'取消':'Cancel'} disabled={busy} onPress={()=>protectInput(onBack)}/>
      <Text style={{flex:1,textAlign:'center',fontSize:17,fontWeight:'700',color:c.text}}>{existing?(zh?`编辑${kindTitle}`:`Edit ${kindTitle}`):(zh?`添加${kindTitle}`:`Add ${kindTitle}`)}</Text>
      <CircleButton variant="prominent" icon="check" label={t.save} disabled={(frozen&&!uncertain)||!title.trim()||mustReview} onPress={()=>void save()}/>
    </View>
    <Surface padding={16} style={{gap:6}}>
      <Text style={{fontSize:13,fontWeight:'600',color:c.muted}}>{editor.kind==='course'?(zh?'课程名称':'Course name'):(zh?'标题':'Title')}</Text>
      <TextInput accessibilityLabel={t.name} value={title} editable={!frozen} onChangeText={v=>change(setTitle,v)} placeholder={editor.kind==='task'?(zh?'例如 Lab 5: Linked lists':'e.g. Lab 5: Linked lists'):editor.kind==='event'?(zh?'例如 小组讨论':'e.g. Group meeting'):''} placeholderTextColor={c.tertiary} style={{fontSize:21,lineHeight:28,fontWeight:'700',color:c.text,paddingVertical:2}}/>
    </Surface>
    {editor.kind==='course'?<FormGroup><FormField label={t.code} value={code} onChangeText={v=>change(setCode,v)} editable={!frozen} autoCapitalize="characters"/></FormGroup>:null}
    {editor.kind!=='course'?<View style={{gap:10}}>
      <ListGroup>
        {imported?null:<ListRow icon="book-open" tile="#56647D" title={zh?'课程':'Course'} value={linked?(linked.code||linked.title):t.noCourse} chevron disabled={frozen} onPress={pickCourse}/>}
        {editor.kind==='task'?<DateTimeField label={zh?'截止':'Due'} value={dueMode==='none'?'':due} mode={dueMode==='date'?'date':'datetime'} clearable disabled={frozen} tile="#E5484D" onChange={v=>{if(frozen)return;if(!v){setDueMode('none');setDue('');}else{setDueMode(v.length>10?'time':'date');setDue(v);}}}/>:null}
        {editor.kind==='event'?<>
          <DateTimeField label={allDay?(zh?'日期':'Date'):(zh?'开始':'Starts')} value={start} mode={allDay?'date':'datetime'} disabled={frozen} tile="#24467F" onChange={v=>change(setStart,v)}/>
          <DateTimeField label={zh?'结束':'Ends'} value={end} mode={allDay?'date':'datetime'} clearable disabled={frozen} tile="#4F6F8C" onChange={v=>change(setEnd,v)}/>
        </>:null}
        {timed?<ListRow icon="bell" tile="#D98A1C" title={zh?'提醒':'Reminder'} value={remindLabel(remindMinutes)} chevron disabled={frozen} onPress={pickRemind}/>:null}
      </ListGroup>
      {editor.kind==='task'?<GlassChips label={zh?'快捷截止':'Quick due'} value={(dueMode==='time'?quick.find(q=>q[1]===due)?.[1]:undefined)??''} onChange={v=>{if(!frozen){setDueMode('time');setDue(v);if(remindMinutes===null)setRemindMinutes(60);}}} items={quick.map(([label,v])=>({value:v,label}))}/>:null}
      {editor.kind==='event'?<FormGroup><SwitchRow label={t.allDay} value={allDay} disabled={frozen} onValueChange={v=>{setAllDay(v);setStart('');setEnd('');}}/><FormField label={t.location} value={location} onChangeText={v=>change(setLocation,v)} editable={!frozen} placeholder={zh?'例如 Room 2465':'e.g. Room 2465'}/></FormGroup>:null}
      {editor.kind==='material'?<FormGroup><FormField label={t.url} value={url} onChangeText={v=>change(setUrl,v)} editable={!frozen} placeholder="https://…" autoCapitalize="none" keyboardType="url"/></FormGroup>:null}
      {imported?<Text style={{paddingHorizontal:16,fontSize:12,color:c.muted}}>{zh?'仅修改这一次日程，不影响其他周次。':'Edit this occurrence only; other dates stay unchanged.'}</Text>:null}
    </View>:null}
    <FormGroup><FormField label={editor.kind==='course'?(zh?'说明':'Description'):(zh?'备注':'Notes')} value={body} onChangeText={v=>change(setBody,v)} editable={!frozen} multiline placeholder={editor.kind==='task'?(zh?'例如 上传 .cpp 到 Canvas，附运行截图':'e.g. Upload .cpp to Canvas'):''}/></FormGroup>
    {error?<Notice tone={uncertain?'warning':'error'} text={error}/>:null}
    {mustReview?<PrimaryButton tone="soft" label={zh?'返回核对已保存的安排':'Go back to check saved plans'} onPress={()=>protectInput(onBack)}/>:<PrimaryButton label={busy?t.loading:uncertain?(zh?'重试确认保存结果':'Retry to confirm save'):editor.kind==='task'?(zh?'保存截止':'Save deadline'):t.save} disabled={(frozen&&!uncertain)||!title.trim()} onPress={()=>void save()}/>}
  </View>;
}

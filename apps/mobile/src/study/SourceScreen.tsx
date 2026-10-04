// Pen "V6 / 导入的日历" (V8htx3): calendars imported from .ics files, each with its series and the
// student's own changes to single dates (restore, or go back to what the file says), and delete.
import {useEffect,useRef,useState} from 'react';
import {Alert,Pressable,Text,View} from 'react-native';
import {session} from '../runtime';
import {ApiFailure} from '../api';
import type {Language} from '../strings';
import type {ImportSourceDetail} from '../../../../src/product/calendar/types';
import {CircleButton,Notice,PenIcon,Skeleton,usePenColors} from '../ui/Pen';
import {feel} from '../ui/feel';
import {seriesLines} from './ics-text';
type Source={id:string;name:string;version:number;series_count:number;created_at:number};
const md=(ms:number,zh:boolean)=>{const d=new Date(ms+8*3600e3);return zh?`${d.getUTCMonth()+1} 月 ${d.getUTCDate()} 日`:d.toLocaleDateString('en-GB',{day:'numeric',month:'short',timeZone:'UTC'});};
const dateOf=(value:string,zh:boolean)=>{const d=value.length>10?new Date(Date.parse(value)+8*3600e3).toISOString().slice(0,10):value;const w=new Date(d+'T00:00:00Z').getUTCDay();return zh?`${Number(d.slice(5,7))} 月 ${Number(d.slice(8,10))} 日 周${'日一二三四五六'[w]}`:new Date(d+'T00:00:00Z').toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short',timeZone:'UTC'});};

export function SourceScreen({language,onBack,onImport}:{language:Language;dark?:boolean;onBack:()=>void;onImport?:()=>void}) {
 const zh=language==='zh',c=usePenColors();
 const [sources,setSources]=useState<Source[]|null>(null),[detail,setDetail]=useState<ImportSourceDetail|null>(null),[open,setOpen]=useState<string|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const alive=useRef(true),lock=useRef(false);
 async function load(id?:string|null) {
  const list=await session.request<Source[]>('/calendar/sources');
  const selected=id?await session.request<ImportSourceDetail>(`/calendar/sources/${id}`):null;
  if(alive.current){setSources(list);setDetail(selected);}
 }
 async function run(action:()=>Promise<void>) {
  if(lock.current)return;lock.current=true;setBusy(true);setError('');
  try{await action();}catch(e){if(alive.current)setError(e instanceof ApiFailure&&(e.code==='VERSION_CONFLICT'||e.code==='STALE_PREVIEW')?(zh?'内容刚刚变了，已重新读取，请再试一次。':'It just changed; reloaded — please try again.'):(zh?'没有完成，请检查网络后重试。':'Not done. Check your connection and retry.'));if(alive.current)void load(open).catch(()=>{});}finally{lock.current=false;if(alive.current)setBusy(false);}
 }
 useEffect(()=>{alive.current=true;void run(()=>load());return()=>{alive.current=false;};},[]);
 const openSource=(id:string)=>{setOpen(id);setDetail(null);void run(()=>load(id));};
 function remove(s:{id:string;name:string;version:number}) {
  Alert.alert(zh?`删除「${s.name}」？`:`Delete “${s.name}”?`,zh?'这个日历的日程和你的改动都会移除；独立的笔记和手动日程会保留。':'Its events and your changes are removed; separate notes and manual events stay.',[{text:zh?'保留':'Keep',style:'cancel'},{text:zh?'删除':'Delete',style:'destructive',onPress:()=>run(async()=>{await session.request(`/calendar/sources/${s.id}`,{method:'DELETE',body:{version:s.version}});feel.success();setOpen(null);setDetail(null);await load();})}]);
 }
 function reset(seriesId:string,version:number,recurrence_id:string) {
  Alert.alert(zh?'改回文件里的安排？':'Go back to the file?',zh?'你对这一天的改动会撤销；如果文件里已经没有这一天，它会从课表里消失。':'Your change for this date is undone; if the file no longer has this date, it disappears from your calendar.',[{text:zh?'保留我的改动':'Keep my change',style:'cancel'},{text:zh?'改回':'Go back',onPress:()=>run(async()=>{await session.request(`/calendar/series/${seriesId}/occurrence`,{method:'DELETE',body:{version,recurrence_id}});await load(open);})}]);
 }
 const toggle=(seriesId:string,version:number,recurrence_id:string,cancelled:boolean)=>run(async()=>{await session.request(`/calendar/series/${seriesId}/occurrence/status`,{method:'PATCH',body:{version,recurrence_id,status:cancelled?'active':'cancelled'}});feel.select();await load(open);});
 const label=(t:string)=><Text style={{paddingHorizontal:4,paddingTop:8,fontSize:13,fontWeight:'600',color:c.muted}}>{t}</Text>;
 const nav=(title:string,back:()=>void,right?:React.ReactNode)=><View style={{flexDirection:'row',alignItems:'center',minHeight:48}}>
  <CircleButton icon="chevron-left" label={zh?'返回':'Back'} onPress={back}/>
  <Text accessibilityRole="header" numberOfLines={1} style={{flex:1,textAlign:'center',fontSize:17,fontWeight:'700',color:c.text}}>{title}</Text>
  {right??<View style={{width:44}}/>}
 </View>;
 if(open){
  const head=sources?.find(s=>s.id===open);
  return <View style={{gap:10}}>
   {nav(detail?.name??head?.name??(zh?'导入的日历':'Imported calendar'),()=>{setOpen(null);setDetail(null);setError('');})}
   {error?<Notice tone="error" text={error}/>:null}
   {!detail?<Skeleton height={160} radius={20}/>:<>
    {label(zh?'日程':'Events')}
    <View style={{borderRadius:20,overflow:'hidden',backgroundColor:c.surface}}>
     {[...detail.series].sort((a,b)=>a.summary.start.localeCompare(b.summary.start)).map((s,i)=>{const lines=seriesLines(s.summary,zh);return <View key={s.id} style={{gap:8,paddingVertical:12,paddingHorizontal:16,borderTopWidth:i?0.5:0,borderTopColor:c.border}}>
      <View style={{gap:2}}><Text style={{fontSize:16,color:c.text}}>{s.summary.title}</Text><Text style={{fontSize:13,lineHeight:18,color:c.muted}}>{[lines.when,lines.extra].filter(Boolean).join(' · ')}</Text></View>
      {s.overrides.map(o=>{const cancelled=o.payload.status==='cancelled';return <View key={o.recurrence_id} style={{gap:8,paddingVertical:10,paddingHorizontal:12,borderRadius:12,backgroundColor:c.fill}}>
       <View style={{flexDirection:'row',alignItems:'center',gap:8}}><PenIcon name="pencil" size={14} color={c.muted}/><Text style={{flex:1,fontSize:14,fontWeight:'500',color:c.text}}>{dateOf(o.recurrence_id,zh)}{!cancelled&&o.payload.title!==s.summary.title?` · ${o.payload.title}`:''}</Text><Text style={{fontSize:12,fontWeight:'600',color:cancelled?c.danger:c.green}}>{cancelled?(zh?'已取消':'Cancelled'):(zh?'已改动':'Changed')}</Text></View>
       <View style={{flexDirection:'row',gap:16}}>
        <Pressable accessibilityRole="button" disabled={busy} hitSlop={8} onPress={()=>toggle(s.id,s.version,o.recurrence_id,cancelled)}><Text style={{fontSize:14,fontWeight:'600',color:c.accent,opacity:busy?0.4:1}}>{cancelled?(zh?'恢复':'Restore'):(zh?'取消这一次':'Cancel this one')}</Text></Pressable>
        <Pressable accessibilityRole="button" disabled={busy} hitSlop={8} onPress={()=>reset(s.id,s.version,o.recurrence_id)}><Text style={{fontSize:14,fontWeight:'600',color:c.accent,opacity:busy?0.4:1}}>{zh?'改回文件里的':'Use the file'}</Text></Pressable>
       </View>
      </View>;})}
     </View>;})}
    </View>
    <Pressable accessibilityRole="button" disabled={busy} onPress={()=>remove(detail)} style={{alignSelf:'center',paddingVertical:10,opacity:busy?0.4:1}}><Text style={{fontSize:14,fontWeight:'600',color:c.danger}}>{zh?'删除这个日历':'Delete this calendar'}</Text></Pressable>
    <Text style={{textAlign:'center',paddingHorizontal:8,fontSize:12,lineHeight:17,color:c.muted}}>{zh?'删除只移除这个日历的日程和你的改动；独立的笔记和手动日程会保留。':'Deleting removes this calendar’s events and your changes; separate notes and manual events stay.'}</Text>
   </>}
  </View>;
 }
 return <View style={{gap:10}}>
  {nav(zh?'导入的日历':'Imported calendars',onBack,onImport?<CircleButton icon="plus" label={zh?'导入日历文件':'Import a calendar file'} onPress={onImport}/>:undefined)}
  <Text style={{paddingHorizontal:4,fontSize:13,lineHeight:18,color:c.muted}}>{zh?'从 .ics 文件导入的日程，只在你的课表里显示。':'Events imported from .ics files; only you see them.'}</Text>
  {error?<Notice tone="error" text={error} action={zh?'重试':'Retry'} onAction={()=>void run(()=>load())}/>:null}
  {sources===null?<Skeleton height={120} radius={20}/>:sources.length?<View style={{borderRadius:20,overflow:'hidden',backgroundColor:c.surface}}>
   {sources.map((s,i)=><Pressable key={s.id} accessibilityRole="button" onPress={()=>openSource(s.id)} style={({pressed})=>({flexDirection:'row',alignItems:'center',gap:12,paddingVertical:12,paddingHorizontal:16,borderTopWidth:i?0.5:0,borderTopColor:c.border,backgroundColor:pressed?c.fill:'transparent'})}>
    <View style={{width:36,height:36,borderRadius:18,alignItems:'center',justifyContent:'center',backgroundColor:c.accent+'1F'}}><PenIcon name="calendar" size={18} color={c.accent}/></View>
    <View style={{flex:1,gap:2}}><Text style={{fontSize:16,color:c.text}}>{s.name}</Text><Text style={{fontSize:13,color:c.muted}}>{zh?`${s.series_count} 组日程 · ${md(s.created_at,zh)}导入`:`${s.series_count} series · imported ${md(s.created_at,zh)}`}</Text></View>
    <PenIcon name="chevron-right" size={16} color={c.tertiary}/>
   </Pressable>)}
  </View>:<View style={{gap:12,padding:16,borderRadius:20,backgroundColor:c.surface}}>
   <Text style={{fontSize:16,fontWeight:'600',color:c.text}}>{zh?'还没有导入的日历':'No imported calendars yet'}</Text>
   <Text style={{fontSize:13,lineHeight:18,color:c.muted}}>{zh?'Outlook、Google 日历或课程网站都能导出 .ics 文件。':'Outlook, Google Calendar and course sites can export .ics files.'}</Text>
   {onImport?<Pressable accessibilityRole="button" onPress={()=>{feel.tap();onImport();}} style={({pressed})=>({height:46,borderRadius:23,alignItems:'center',justifyContent:'center',backgroundColor:c.fill,opacity:pressed?0.7:1})}><Text style={{fontSize:15,fontWeight:'600',color:c.text}}>{zh?'导入日历文件':'Import a calendar file'}</Text></Pressable>:null}
  </View>}
 </View>;
}

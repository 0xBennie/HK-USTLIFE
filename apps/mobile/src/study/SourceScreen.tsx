import {useEffect,useRef,useState} from 'react';
import {Alert,Text,View} from 'react-native';
import { Button } from '../ui/Primitives';
import { Card } from '../ui/Primitives';
import {session} from '../runtime';
import {ApiFailure} from '../api';
import {palette,styles} from '../theme';
import type {Language} from '../strings';
import type {ImportSourceDetail} from '../../../../src/product/calendar/types';
type Source={id:string;name:string;version:number;series_count:number};
export function SourceScreen({language,dark,onBack}:{language:Language;dark:boolean;onBack:()=>void}) {
  const zh=language==='zh',c=palette[dark?'dark':'light'];
  const [sources,setSources]=useState<Source[]>([]),[detail,setDetail]=useState<ImportSourceDetail|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const alive=useRef(true),lock=useRef(false);
  async function load(id?:string) {
    const list=await session.request<Source[]>('/calendar/sources');
    const selected=id?await session.request<ImportSourceDetail>(`/calendar/sources/${id}`):null;
    if(alive.current){setSources(list);setDetail(selected);}
  }
  async function run(action:()=>Promise<void>) {
    if(lock.current)return;lock.current=true;setBusy(true);setError('');
    try{await action();}catch(e){if(alive.current)setError(e instanceof ApiFailure&&(e.code==='VERSION_CONFLICT'||e.code==='STALE_PREVIEW')?(zh?'内容已变化，请刷新后操作。':'Content changed. Refresh before trying again.'):(zh?'操作未完成，请重试或刷新。':'Operation incomplete. Retry or refresh.'));}finally{lock.current=false;if(alive.current)setBusy(false);}
  }
  useEffect(()=>{alive.current=true;void run(()=>load());return()=>{alive.current=false;};},[]);
  function remove(s:Source) {
    Alert.alert(zh?'删除整个导入来源？':'Delete this imported source?',zh?'该来源的全部日程及个人修改都会移除，独立笔记和手动安排会保留。':'All events and private overrides in this source will be removed. Independent notes and manual schedules remain.',[{text:zh?'保留':'Keep',style:'cancel'},{text:zh?'删除来源':'Delete source',style:'destructive',onPress:()=>run(async()=>{await session.request(`/calendar/sources/${s.id}`,{method:'DELETE',body:{version:s.version}});await load();})}]);
  }
  function reset(seriesId:string,version:number,recurrence_id:string) {
    Alert.alert(zh?'撤销这次个人修改？':'Reset this private change?',zh?'将恢复当前来源的安排；若来源已取消这次安排，它会从你的课表中移除。':'Use the current source. If it no longer contains this occurrence, it will disappear from your calendar.',[{text:zh?'保留修改':'Keep change',style:'cancel'},{text:zh?'撤销修改':'Reset',onPress:()=>run(async()=>{await session.request(`/calendar/series/${seriesId}/occurrence`,{method:'DELETE',body:{version,recurrence_id}});await load(detail!.id);})}]);
  }
  return <View style={styles.stack}>
    <Button variant="ghost" isDisabled={busy} onPress={onBack}>{zh?'返回课表':'Back to calendar'}</Button>
    <Text style={[styles.title,{color:c.text}]}>{zh?'导入来源与个人修改':'Imported sources and private changes'}</Text>
    <Button variant="secondary" isDisabled={busy} onPress={()=>run(()=>load(detail?.id))}>{busy?(zh?'加载中…':'Loading…'):(zh?'刷新':'Refresh')}</Button>
    {error?<Text accessibilityRole="alert" style={[styles.body,{color:c.danger}]}>{error}</Text>:null}
    {!busy&&!sources.length&&!error?<Text style={[styles.body,{color:c.muted}]}>{zh?'还没有导入来源。':'No imported sources yet.'}</Text>:null}
    {sources.map(s=><Card key={s.id} style={[styles.card,{backgroundColor:c.surface}]}>
      <Text style={[styles.heading,{color:c.text}]}>{s.name}</Text><Text style={[styles.caption,{color:c.muted}]}>{s.series_count} {zh?'组日程':'series'}</Text>
      <Button variant="secondary" isDisabled={busy} onPress={()=>run(()=>load(s.id))}>{zh?'查看日程与修改':'View series and changes'}</Button>
      <Button variant="ghost" isDisabled={busy} onPress={()=>remove(s)}>{zh?'删除来源':'Delete source'}</Button>
    </Card>)}
    {detail?<><Text style={[styles.heading,{color:c.text}]}>{detail.name}</Text>{detail.series.map(s=><Card key={s.id} style={[styles.card,{backgroundColor:c.surface}]}>
      <Text style={[styles.heading,{color:c.text}]}>{s.summary.title}</Text><Text style={[styles.caption,{color:c.muted}]}>{s.summary.start} · {s.summary.timezone}</Text>
      {!s.overrides.length?<Text style={[styles.caption,{color:c.muted}]}>{zh?'没有个人修改。':'No private changes.'}</Text>:null}
      {s.overrides.map(o=><View key={o.recurrence_id} style={styles.smallStack}>
        <Text style={[styles.body,{color:c.text}]}>{o.payload.title} · {o.payload.status==='cancelled'?(zh?'已取消':'Cancelled'):(zh?'有效':'Active')}</Text>
        <Text style={[styles.caption,{color:c.muted}]}>{zh?'原始日期':'Original occurrence'}: {o.recurrence_id}</Text>
        <Text style={[styles.body,{color:c.text}]}>{o.payload.start_date??o.payload.starts_at}</Text>
        <Button variant="secondary" isDisabled={busy} onPress={()=>run(async()=>{await session.request(`/calendar/series/${s.id}/occurrence/status`,{method:'PATCH',body:{version:s.version,recurrence_id:o.recurrence_id,status:o.payload.status==='cancelled'?'active':'cancelled'}});await load(detail.id);})}>{o.payload.status==='cancelled'?(zh?'恢复个人安排':'Restore private event'):(zh?'取消个人安排':'Cancel private event')}</Button>
        <Button variant="ghost" isDisabled={busy} onPress={()=>reset(s.id,s.version,o.recurrence_id)}>{zh?'撤销修改，采用来源':'Reset to source'}</Button>
      </View>)}
    </Card>)}</>:null}
  </View>;
}

import {useInputProtection} from '../navigation/InputProtection';
import {useEffect,useRef,useState} from 'react';
import {Text,View,Alert} from 'react-native';
import { Button } from '../ui/Primitives';
import { Card } from '../ui/Primitives';
import { Input } from '../ui/Primitives';
import * as DocumentPicker from 'expo-document-picker';
import {File,Paths} from 'expo-file-system';
import {session} from '../runtime';
import {ApiFailure} from '../api';
import {palette,styles} from '../theme';
import type {Language} from '../strings';
import type {ImportPreview as Preview} from '../../../../src/product/calendar/types';

type Source={id:string;name:string;version:number;series_count:number};
export function ImportScreen({language,dark,onBack,onSaved}:{language:Language;dark:boolean;onBack:()=>void;onSaved:()=>void}) {
  const zh=language==='zh',c=palette[dark?'dark':'light'];
  const [sources,setSources]=useState<Source[]>([]),[source,setSource]=useState<string|null>(null),[name,setName]=useState('');
  const [fileName,setFileName]=useState(''),[zone,setZone]=useState(''),[preview,setPreview]=useState<Preview|null>(null);
  const [selected,setSelected]=useState<string[]>([]),[resolutions,setResolutions]=useState<Record<string,'keep_local'|'use_source'>>({}),[ack,setAck]=useState(false);
  const [pending,setPending]=useState(false);
  const confirmation=useRef<{uids:string[];acknowledge_fingerprints:boolean;resolutions:Record<string,string>}|null>(null);
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const content=useRef(''),alive=useRef(true),locked=useRef(false);
 const protectInput=useInputProtection({source,name,fileName,zone,selected,resolutions,ack},busy,pending,zh);
  async function loadSources() {try {const v=await session.request<Source[]>('/calendar/sources');if(alive.current){setSources(v);setError('');}}catch{if(alive.current)setError(zh?'无法载入已有来源，请重试。':'Could not load existing sources. Retry.');}}
  useEffect(()=>{alive.current=true;void loadSources();return()=>{alive.current=false;content.current='';};},[zh]);
  const reset=()=>{setPreview(null);setSelected([]);setResolutions({});setAck(false);setError('');};
  const run=async(action:()=>Promise<void>)=>{
    if(locked.current)return;locked.current=true;setBusy(true);setError('');
    try{await action();}catch(e){if(alive.current)setError(e instanceof ApiFailure?(e.code==='STALE_PREVIEW'||e.code==='PREVIEW_EXPIRED'?(zh?'预览已过期或数据已变化，请重新预览。':'Preview expired or data changed. Preview again.'):`${e.code}: ${e.message}`):(e instanceof Error?e.message:zh?'操作失败，请重试。':'Operation failed. Retry.'));}
    finally{locked.current=false;if(alive.current)setBusy(false);}
  };
  async function pick() {await run(async()=>{
    const result=await DocumentPicker.getDocumentAsync({type:'*/*',multiple:false,copyToCacheDirectory:true});
    if(result.canceled)return;const asset=result.assets[0],file=new File(asset.uri);
    try {
      if(!alive.current)return;
      if(!asset.name.toLowerCase().endsWith('.ics'))throw new Error(zh?'请选择 .ics 日历文件。':'Choose an .ics calendar file.');
      if((asset.size??file.size)>262144)throw new Error(zh?'文件不能超过 256 KiB。':'File must not exceed 256 KiB.');
      const text=await file.text();if(!alive.current)return;
      content.current=text;setFileName(asset.name);if(!name)setName(asset.name.replace(/\.ics$/i,''));reset();
    } finally {if(file.uri.startsWith(Paths.cache.uri)&&file.exists)file.delete();}
  });}
  async function makePreview() {await run(async()=>{
    const next=await session.request<Preview>('/calendar/imports/preview',{method:'POST',body:{...(source?{source_id:source}:{source_name:name.trim()}),content:content.current,...(zone?{floating_timezone:zone}:{})}});
    if(!alive.current)return;setPreview(next);setSelected([]);setResolutions({});setAck(false);
  });}
  async function confirm() {await run(async()=>{
    if(!preview)return;
    confirmation.current??={uids:[...selected],acknowledge_fingerprints:ack,resolutions:Object.fromEntries(Object.entries(resolutions).filter(([uid])=>selected.includes(uid)))};
    setPending(true);
    try {await session.request(`/calendar/imports/${preview.id}/confirm`,{method:'POST',body:confirmation.current});}
    catch(e){if(e instanceof ApiFailure&&e.status>=400&&e.status<500){confirmation.current=null;setPending(false);}throw e;}
    if(alive.current){content.current='';onSaved();}
  });}
  const caption=(text:string)=><Text style={[styles.caption,{color:c.muted}]}>{text}</Text>;
  const label=(text:string)=><Text style={[styles.body,{color:c.text}]}>{text}</Text>;
  const actionName={new:zh?'新增':'New',unchanged:zh?'无变化':'Unchanged',update:zh?'来源更新':'Source update',conflict:zh?'个人修改冲突':'Local conflict'};
  const fields={start:zh?'开始':'Start',end:zh?'结束':'End',duration:zh?'时长':'Duration',timezone:zh?'时区':'Timezone',recurrence:zh?'重复规则':'Recurrence',excluded:zh?'排除日期':'Excluded dates',exceptions:zh?'单次例外':'Exceptions',location:zh?'地点':'Location',description:zh?'说明':'Description',status:zh?'来源状态':'Source status',title:zh?'标题':'Title'};
  const missing=preview?.entries.some(e=>selected.includes(e.series.uid)&&e.action==='conflict'&&!resolutions[e.series.uid]);
  const needsAck=preview?.entries.some(e=>selected.includes(e.series.uid)&&e.series.identity==='fingerprint');
  return <View style={styles.stack}>
    <Button variant="ghost" isDisabled={busy||pending} onPress={()=>protectInput(onBack)}>{zh?'返回':'Back'}</Button>
    <Text style={[styles.title,{color:c.text}]}>{zh?'导入日历':'Import calendar'}</Text>
    {caption(zh?'文件仅用于你的私人安排。导入不代表正式选课或报名；确认前不会写入课表。':'Files are used for your private schedule. Import does not confirm enrolment or participation. Nothing enters your calendar until confirmation.')}
    <Button variant={source===null?'primary':'secondary'} isDisabled={busy||pending} onPress={()=>{setSource(null);reset();}}>{zh?'建立新来源':'New source'}</Button>
    <Button variant="ghost" isDisabled={busy||pending} onPress={()=>run(loadSources)}>{zh?'刷新已有来源':'Refresh sources'}</Button>
    {pending?caption(zh?'正在确认保存结果。若网络中断，请再次点确认以重试同一份选择。':'Confirming the save result. If the connection fails, confirm again to retry the same selection.'):null}
    {sources.map(s=><Button key={s.id} variant={source===s.id?'primary':'secondary'} isDisabled={busy||pending} onPress={()=>{setSource(s.id);reset();}}>{source===s.id?'✓ ':''}{zh?'更新':'Update'} {s.name} ({s.series_count})</Button>)}
    {!source?<><Text style={[styles.body,{color:c.text}]}>{zh?'来源名称':'Source name'}</Text><Input accessibilityLabel={zh?'来源名称':'Source name'} value={name} editable={!busy&&!pending} onChangeText={v=>{setName(v);reset();}} style={[styles.input,{color:c.text,borderColor:c.border}]}/></>:null}
    <Button variant="secondary" isDisabled={busy||pending} onPress={pick}>{zh?'选择 ICS 文件':'Choose ICS file'}</Button>
    {fileName?label(fileName):null}
    {caption(zh?'若文件未指定时区，请明确选择；全天日期不受时区影响。':'Choose a timezone for events without one; all-day dates are unchanged.')}
    {['','Asia/Hong_Kong','UTC','Europe/London','America/New_York'].map(v=><Button key={v} variant={zone===v?'primary':'secondary'} isDisabled={busy||pending} onPress={()=>{setZone(v);reset();}}>{zone===v?'✓ ':''}{v||(zh?'不补充时区':'Do not supply timezone')}</Button>)}
    <Button isDisabled={busy||pending||!fileName||(!source&&!name.trim())} onPress={makePreview}>{zh?'生成／更新预览':'Generate / refresh preview'}</Button>
    {error?<Text accessibilityRole="alert" style={[styles.body,{color:c.danger}]}>{error}</Text>:null}
    {preview?<>
      {caption(`${zh?'预览有效至':'Preview valid until'} ${new Date(preview.expires_at).toLocaleString()}`)}
      {preview.issues.map((issue,i)=><Text key={i} style={[styles.body,{color:c.danger}]}>{issue.uid??''} · {issue.code}: {issue.message}</Text>)}
      {!preview.entries.length?label(zh?'没有可导入的日程。请检查上方问题。':'No importable events. Review the issues above.'):null}
      {preview.entries.map(e=><Card key={e.series.uid} style={[styles.card,{backgroundColor:c.surface}]}>
        <Text style={[styles.heading,{color:c.text}]}>{e.series.title}</Text>{label(actionName[e.action])}
        {(Object.keys(fields) as (keyof typeof fields)[]).filter(k=>e.summary[k]||e.previous_summary?.[k]).map(k=><View key={k}>{caption(fields[k])}{e.previous_summary&&e.previous_summary[k]!==e.summary[k]?label(`${zh?'之前':'Before'}: ${e.previous_summary[k]||'—'}\n${zh?'之后':'After'}: ${e.summary[k]||'—'}`):label(e.summary[k]||'—')}</View>)}
        <Button variant={selected.includes(e.series.uid)?'primary':'secondary'} isDisabled={busy||pending} onPress={()=>setSelected(v=>v.includes(e.series.uid)?v.filter(x=>x!==e.series.uid):[...v,e.series.uid])}>{selected.includes(e.series.uid)?(zh?'✓ 已选择':'✓ Selected'):(zh?'选择':'Select')}</Button>
        {e.series.identity==='fingerprint'?caption(zh?'原文件没有稳定 ID，修改后重新导入可能产生新记录。':'No stable source ID; edited reimports may create a new record.'):null}
        {e.action==='conflict'?<>{caption(zh?`这组日程有 ${e.local_changes} 次个人修改。选择适用于这一组的全部个人修改。`:`This series has ${e.local_changes} private changes. Your choice applies to all of them.`)}
          {(['keep_local','use_source'] as const).map(v=><Button key={v} variant={resolutions[e.series.uid]===v?'primary':'secondary'} isDisabled={busy||pending} onPress={()=>setResolutions(r=>({...r,[e.series.uid]:v}))}>{resolutions[e.series.uid]===v?'✓ ':''}{v==='keep_local'?(zh?'保留个人修改，更新其余日程':'Keep private changes; update other dates'):(zh?'放弃个人修改，采用新来源':'Discard private changes; use source')}</Button>)}
        </>:null}
      </Card>)}
      {needsAck?<Button variant={ack?'primary':'secondary'} isDisabled={busy||pending} onPress={()=>setAck(!ack)}>{ack?'✓ ':''}{zh?'我已核对无稳定 ID 的日程':'I reviewed events without stable IDs'}</Button>:null}
      <Button isDisabled={busy||!selected.length||missing||Boolean(needsAck&&!ack)} onPress={()=>Alert.alert(zh?'确认导入？':'Confirm import?',zh?`将保存 ${selected.length} 组日程及所选冲突处理。`:`Save ${selected.length} selected series and conflict choices?`,[{text:zh?'返回检查':'Review',style:'cancel'},{text:zh?'确认保存':'Save',onPress:confirm}])}>{busy?(zh?'处理中…':'Working…'):(zh?'确认导入所选日程':'Import selected events')}</Button>
    </>:null}
  </View>;
}

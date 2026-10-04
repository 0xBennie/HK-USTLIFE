// Pen "V6 / 导入日历文件" (r1S0Aq): pick an .ics file, choose where it goes, preview in plain words, then
// import the chosen series. The confirm body and key stay fixed until the server answers, so a retry after a
// lost response confirms the same selection instead of importing twice.
import {useInputProtection} from '../navigation/InputProtection';
import {useEffect,useRef,useState} from 'react';
import {ActionSheetIOS,Alert,Pressable,Text,TextInput,View} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import {File,Paths} from 'expo-file-system';
import {session} from '../runtime';
import {ApiFailure} from '../api';
import type {Language} from '../strings';
import type {ImportPreview as Preview} from '../../../../src/product/calendar/types';
import {CircleButton,Notice,PenIcon,PrimaryButton,usePenColors,type PenIconName} from '../ui/Pen';
import {feel} from '../ui/feel';
import {ZONES,changeText,issueText,seriesLines,zoneLabel} from './ics-text';

type Source={id:string;name:string;version:number;series_count:number};
type Entry=Preview['entries'][number];
export function ImportScreen({language,onBack,onSaved}:{language:Language;dark?:boolean;onBack:()=>void;onSaved:()=>void}) {
 const zh=language==='zh',c=usePenColors();
 const [sources,setSources]=useState<Source[]>([]),[source,setSource]=useState<string|null>(null),[name,setName]=useState('');
 const [file,setFile]=useState<{name:string;size:number}|null>(null),[zone,setZone]=useState<string>('Asia/Hong_Kong'),[preview,setPreview]=useState<Preview|null>(null);
 const [selected,setSelected]=useState<string[]>([]),[resolutions,setResolutions]=useState<Record<string,'keep_local'|'use_source'>>({}),[ack,setAck]=useState(false);
 const [pending,setPending]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const confirmation=useRef<{uids:string[];acknowledge_fingerprints:boolean;resolutions:Record<string,string>}|null>(null);
 const content=useRef(''),alive=useRef(true),locked=useRef(false);
 const protectInput=useInputProtection({source,name,file,zone,selected,resolutions,ack},busy,pending,zh);
 async function loadSources(){try{const v=await session.request<Source[]>('/calendar/sources');if(alive.current)setSources(v);}catch{if(alive.current)setError(zh?'读取已有日历失败，请重试。':'Couldn’t load your calendars. Retry.');}}
 useEffect(()=>{alive.current=true;void loadSources();return()=>{alive.current=false;content.current='';};},[zh]);
 const reset=()=>{setPreview(null);setSelected([]);setResolutions({});setAck(false);setError('');};
 const run=async(action:()=>Promise<void>)=>{
  if(locked.current)return;locked.current=true;setBusy(true);setError('');
  try{await action();}catch(e){if(alive.current)setError(e instanceof ApiFailure?(e.code==='STALE_PREVIEW'||e.code==='PREVIEW_EXPIRED'?(zh?'预览过期或日历刚刚变了，请重新预览。':'The preview expired or the calendar changed. Preview again.'):e.code==='INVALID_CALENDAR'?(zh?'这个文件无法读取，请确认是有效的 .ics 日历文件。':'This file can’t be read. Make sure it is a valid .ics calendar.'):e.status===0?(zh?'网络中断，请重试。':'Connection lost. Retry.'):(zh?'没有完成，请重试。':'Not done. Retry.')):(e instanceof Error?e.message:zh?'没有完成，请重试。':'Not done. Retry.'));}
  finally{locked.current=false;if(alive.current)setBusy(false);}
 };
 async function pick(){await run(async()=>{
  const result=await DocumentPicker.getDocumentAsync({type:'*/*',multiple:false,copyToCacheDirectory:true});
  if(result.canceled)return;const asset=result.assets[0],picked=new File(asset.uri);
  try{
   if(!alive.current)return;
   if(!asset.name.toLowerCase().endsWith('.ics'))throw new Error(zh?'请选择 .ics 日历文件。':'Choose an .ics calendar file.');
   const size=asset.size??picked.size;if(size>262144)throw new Error(zh?'文件不能超过 256 KB。':'The file must be 256 KB or smaller.');
   const text=await picked.text();if(!alive.current)return;
   content.current=text;setFile({name:asset.name,size});if(!name)setName(asset.name.replace(/\.ics$/i,''));reset();
  }finally{if(picked.uri.startsWith(Paths.cache.uri)&&picked.exists)picked.delete();}
 });}
 async function makePreview(){await run(async()=>{
  const next=await session.request<Preview>('/calendar/imports/preview',{method:'POST',body:{...(source?{source_id:source}:{source_name:name.trim()}),content:content.current,floating_timezone:zone}});
  if(!alive.current)return;feel.select();setPreview(next);
  // Pre-select what changes something and has a stable ID; conflicts keep the student's own edits by default.
  setSelected(next.entries.filter(e=>e.action!=='unchanged'&&e.series.identity==='uid').map(e=>e.series.uid));
  setResolutions(Object.fromEntries(next.entries.filter(e=>e.action==='conflict').map(e=>[e.series.uid,'keep_local' as const])));setAck(false);
 });}
 async function confirm(){await run(async()=>{
  if(!preview)return;
  confirmation.current??={uids:[...selected],acknowledge_fingerprints:ack,resolutions:Object.fromEntries(Object.entries(resolutions).filter(([uid])=>selected.includes(uid)))};
  setPending(true);
  try{await session.request(`/calendar/imports/${preview.id}/confirm`,{method:'POST',body:confirmation.current});}
  catch(e){if(e instanceof ApiFailure&&e.status>=400&&e.status<500){confirmation.current=null;setPending(false);}throw e;}
  if(alive.current){feel.success();content.current='';onSaved();}
 });}
 const chooseZone=()=>ActionSheetIOS.showActionSheetWithOptions({title:zh?'文件里没写时区的时间按':'Times without a timezone use',options:[...ZONES.map(z=>zoneLabel(z,zh)),zh?'取消':'Cancel'],cancelButtonIndex:ZONES.length},i=>{if(i<ZONES.length){feel.select();setZone(ZONES[i]);reset();}});
 const missing=!!preview?.entries.some(e=>selected.includes(e.series.uid)&&e.action==='conflict'&&!resolutions[e.series.uid]);
 const needsAck=!!preview?.entries.some(e=>selected.includes(e.series.uid)&&e.series.identity==='fingerprint');
 const frozen=busy||pending;
 const tag:Record<Entry['action'],[string,string,string]>={new:[zh?'新增':'New','#2E9E5B1F','#2E9E5B'],update:[zh?'有更新':'Updated',c.accent+'1F',c.accent],conflict:[zh?'冲突':'Conflict','#D98A1C1F','#B8741A'],unchanged:[zh?'无变化':'Unchanged',c.fill,c.muted]};
 const counts=preview?(['new','update','conflict','unchanged'] as const).map(a=>[a,preview.entries.filter(e=>e.action===a).length] as const).filter(([,n])=>n):[];
 const issueGroups=preview?Object.entries(preview.issues.reduce<Record<string,number>>((m,i)=>({...m,[i.code]:(m[i.code]??0)+1}),{})):[];
 const label=(t:string)=><Text style={{paddingHorizontal:4,paddingTop:8,fontSize:13,fontWeight:'600',color:c.muted}}>{t}</Text>;
 const card={borderRadius:20,overflow:'hidden' as const,backgroundColor:c.surface};
 const radio=(on:boolean)=><PenIcon name={on?'circle-check':'circle'} size={20} color={on?c.accent:c.tertiary}/>;
 const row=(key:string,i:number,onPress:(()=>void)|undefined,children:React.ReactNode,disabled=false)=><Pressable key={key} accessibilityRole="button" disabled={disabled||!onPress} onPress={onPress} style={({pressed})=>({flexDirection:'row',alignItems:'center',gap:12,paddingVertical:12,paddingHorizontal:16,borderTopWidth:i?0.5:0,borderTopColor:c.border,backgroundColor:pressed?c.fill:'transparent',opacity:disabled?0.5:1})}>{children}</Pressable>;
 const two=(a:string,b?:string,icon?:PenIconName)=><>{icon?<PenIcon name={icon} size={20} color={c.accent}/>:null}<View style={{flex:1,gap:2}}><Text style={{fontSize:16,color:c.text}}>{a}</Text>{b?<Text style={{fontSize:13,lineHeight:18,color:c.muted}}>{b}</Text>:null}</View></>;
 return <View style={{gap:10}}>
  <View style={{flexDirection:'row',alignItems:'center',minHeight:48}}>
   <CircleButton icon="chevron-left" label={zh?'返回':'Back'} onPress={()=>protectInput(onBack)}/>
   <Text accessibilityRole="header" style={{flex:1,textAlign:'center',fontSize:17,fontWeight:'700',color:c.text}}>{zh?'导入日历文件':'Import a calendar file'}</Text>
   <View style={{width:44}}/>
  </View>
  <Text style={{paddingHorizontal:4,fontSize:13,lineHeight:18,color:c.muted}}>{zh?'只放进你自己的课表，别人看不到；确认前不会写入。':'Only your own calendar uses it; nothing is saved until you confirm.'}</Text>
  {label(zh?'文件':'File')}
  <View style={card}>{row('file',0,frozen?undefined:()=>void pick(),two(file?file.name:(zh?'选择 .ics 文件':'Choose an .ics file'),file?`${Math.max(1,Math.round(file.size/1024))} KB · ${zh?'换一个文件':'choose another'}`:(zh?'最大 256 KB':'Up to 256 KB'),'file-text'),frozen)}</View>
  {label(zh?'导入到':'Import into')}
  <View style={card}>
   {row('new',0,frozen?undefined:()=>{feel.select();setSource(null);reset();},<>{radio(source===null)}{two(zh?'新的日历':'A new calendar')}</>,frozen)}
   {source===null?<View style={{paddingLeft:48,paddingRight:16,paddingBottom:12}}><TextInput accessibilityLabel={zh?'日历名称':'Calendar name'} value={name} editable={!frozen} maxLength={120} onChangeText={v=>{setName(v);reset();}} placeholder={zh?'日历名称':'Calendar name'} placeholderTextColor={c.muted} style={{height:40,borderRadius:10,backgroundColor:c.fill,paddingHorizontal:12,fontSize:15,color:c.text}}/></View>:null}
   {sources.map((s,i)=>row(s.id,i+1,frozen?undefined:()=>{feel.select();setSource(s.id);reset();},<>{radio(source===s.id)}{two(zh?`更新「${s.name}」`:`Update “${s.name}”`,zh?`${s.series_count} 组日程`:`${s.series_count} series`)}</>,frozen))}
  </View>
  {label(zh?'文件里没写时区的时间':'Times without a timezone')}
  <View style={card}>{row('zone',0,frozen?undefined:chooseZone,<><Text style={{flex:1,fontSize:16,color:c.text}}>{zh?`按${zoneLabel(zone,zh)}`:`Use ${zoneLabel(zone,zh)}`}</Text><Text style={{fontSize:15,fontWeight:'600',color:c.accent}}>{zh?'更改':'Change'}</Text></>,frozen)}</View>
  <View style={{flexDirection:'row',paddingTop:4}}><PrimaryButton tone={preview?'soft':'accent'} label={busy&&!pending?(zh?'正在读取…':'Reading…'):preview?(zh?'重新预览':'Preview again'):(zh?'预览':'Preview')} disabled={frozen||!file||(!source&&!name.trim())} onPress={()=>void makePreview()}/></View>
  {error?<Notice tone="error" text={error}/>:null}
  {pending?<Notice tone="info" icon="loader" text={zh?'导入结果还没确认；再点一次只会核对同一次导入。':'Not confirmed yet; tapping again only checks the same import.'}/>:null}
  {preview?<>
   {label(zh?`预览 · 共 ${preview.entries.length} 组`:`Preview · ${preview.entries.length} series`)}
   {counts.length?<View style={{flexDirection:'row',flexWrap:'wrap',gap:6,paddingHorizontal:4}}>{counts.map(([a,n])=><View key={a} style={{paddingVertical:3,paddingHorizontal:8,borderRadius:99,backgroundColor:tag[a][1]}}><Text style={{fontSize:12,fontWeight:'600',color:tag[a][2]}}>{a==='conflict'?(zh?`和你的改动冲突 ${n}`:`Conflicts ${n}`):`${tag[a][0]} ${n}`}</Text></View>)}</View>:null}
   {preview.entries.length?<View style={card}>{preview.entries.map((e,i)=>{const on=selected.includes(e.series.uid),lines=seriesLines(e.summary,zh),diff=e.action==='update'&&e.previous_summary?changeText(e.previous_summary,e.summary,zh):'';
    return <View key={e.series.uid} style={{flexDirection:'row',gap:12,paddingVertical:12,paddingHorizontal:16,borderTopWidth:i?0.5:0,borderTopColor:c.border}}>
     <Pressable accessibilityRole="checkbox" accessibilityState={{checked:on,disabled:frozen}} accessibilityLabel={e.series.title} disabled={frozen} hitSlop={10} onPress={()=>{feel.select();setSelected(v=>on?v.filter(x=>x!==e.series.uid):[...v,e.series.uid]);}} style={{paddingTop:2}}>{radio(on)}</Pressable>
     <View style={{flex:1,gap:4}}>
      <View style={{flexDirection:'row',alignItems:'center',flexWrap:'wrap',gap:6}}><Text style={{fontSize:16,fontWeight:'600',color:c.text}}>{e.series.title}</Text><View style={{paddingVertical:2,paddingHorizontal:7,borderRadius:99,backgroundColor:tag[e.action][1]}}><Text style={{fontSize:12,fontWeight:'600',color:tag[e.action][2]}}>{tag[e.action][0]}</Text></View></View>
      <Text style={{fontSize:13,lineHeight:18,color:c.muted}}>{lines.when}{e.action==='conflict'?(zh?` · 你改过 ${e.local_changes} 次`:` · you changed ${e.local_changes}`):''}</Text>
      {lines.extra?<Text style={{fontSize:13,lineHeight:18,color:c.muted}}>{lines.extra}</Text>:null}
      {diff?<Text style={{fontSize:13,lineHeight:18,color:c.text}}>{zh?'改了：':'Changed: '}{diff}</Text>:null}
      {e.series.identity==='fingerprint'?<Text style={{fontSize:12,lineHeight:17,color:c.muted}}>{zh?'文件没有固定编号，以后重新导入可能变成新的一条':'No stable ID; a later re-import may add it again'}</Text>:null}
      {e.action==='conflict'&&on?<View accessibilityRole="radiogroup" style={{flexDirection:'row',gap:4,padding:3,borderRadius:99,backgroundColor:c.fill,marginTop:4}}>{(['keep_local','use_source'] as const).map(k=>{const sel=resolutions[e.series.uid]===k;return <Pressable key={k} accessibilityRole="radio" accessibilityState={{checked:sel}} disabled={frozen} onPress={()=>{feel.select();setResolutions(r=>({...r,[e.series.uid]:k}));}} style={{flex:1,height:32,borderRadius:99,alignItems:'center',justifyContent:'center',backgroundColor:sel?c.surface:'transparent'}}><Text style={{fontSize:13,fontWeight:sel?'600':'500',color:sel?c.text:c.muted}}>{k==='keep_local'?(zh?'保留我的改动':'Keep my edits'):(zh?'用文件里的':'Use the file')}</Text></Pressable>;})}</View>:null}
     </View>
    </View>;})}</View>:<Notice tone="info" text={zh?'这个文件里没有可以导入的日程。':'Nothing in this file can be imported.'}/>}
   {issueGroups.length?<View style={{gap:6,paddingVertical:12,paddingHorizontal:14,borderRadius:14,backgroundColor:c.orange+'1A'}}>
    <View style={{flexDirection:'row',alignItems:'center',gap:10}}><PenIcon name="triangle-alert" size={18} color={c.orange}/><Text style={{flex:1,fontSize:14,fontWeight:'600',color:c.text}}>{zh?`${preview.issues.length} 组无法导入`:`${preview.issues.length} can’t be imported`}</Text></View>
    {issueGroups.map(([code,n])=><Text key={code} style={{fontSize:13,lineHeight:18,color:c.text}}>{issueText(code,zh)}{zh?` · ${n} 组`:` · ${n}`}</Text>)}
   </View>:null}
   {needsAck?<Pressable accessibilityRole="checkbox" accessibilityState={{checked:ack}} disabled={frozen} onPress={()=>{feel.select();setAck(!ack);}} style={{flexDirection:'row',alignItems:'center',gap:12,paddingVertical:12,paddingHorizontal:16,borderRadius:20,backgroundColor:c.surface}}>{radio(ack)}<Text style={{flex:1,fontSize:15,lineHeight:21,color:c.text}}>{zh?'我知道这些日程以后重新导入可能会重复':'I understand these may duplicate on a later re-import'}</Text></Pressable>:null}
   <View style={{flexDirection:'row',paddingTop:4}}><PrimaryButton label={busy&&pending?(zh?'正在导入…':'Importing…'):pending?(zh?'再试一次':'Try again'):(zh?`导入所选 ${selected.length} 组`:`Import ${selected.length} selected`)} disabled={busy||!selected.length||missing||(needsAck&&!ack)} onPress={()=>pending?void confirm():Alert.alert(zh?'导入所选日程？':'Import the selected events?',zh?`会把 ${selected.length} 组日程放进你的课表。`:`${selected.length} series will be added to your calendar.`,[{text:zh?'再看看':'Review',style:'cancel'},{text:zh?'导入':'Import',onPress:()=>void confirm()}])}/></View>
   <Text style={{textAlign:'center',paddingHorizontal:8,fontSize:12,lineHeight:17,color:c.muted}}>{zh?'预览 30 分钟内有效；导入后可在「导入的日历」里管理或删除。':'Previews last 30 minutes; manage or delete imports in Imported calendars.'}</Text>
  </>:null}
 </View>;
}

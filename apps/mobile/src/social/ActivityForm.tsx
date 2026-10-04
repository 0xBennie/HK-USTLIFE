// Pen board "V6 / 发起活动（一页表单）" (l8rkBv): inline title, start/end through the date sheet, grouped option rows
// that expand in place. Limits mirror the server schema (title ≤120, place required, 1–50 places, ≤ HK$1000, ≥1 language).
import {useHideTabBar} from '../navigation/SceneOverlay';
import {writeReceipt,ensureReplayable,writeRejected,reviewRequired,type WriteReceipt} from '../write-receipt';
import {useInputProtection} from '../navigation/InputProtection';
import {useEffect,useRef,useState,type ReactNode} from 'react';
import {Pressable,Text,TextInput,View} from 'react-native';
import {session} from '../runtime';
import {ApiFailure} from '../api';
import type {Language} from '../strings';
import type {Activity,ActivityInput} from '../../../../src/product/social/types';
import {hongKongInput,parseHongKongInput,newWriteKey} from '../study/dates';
import {socialError} from './shared';
import {interactionLabel} from './covers';
import {CircleButton,GlassChips,Notice,PenIcon,PrimaryButton,usePenColors,type PenIconName} from '../ui/Pen';
import {PickerSheet,formatPicked} from '../ui/DateTimeField';
import {feel} from '../ui/feel';

/** Next full hour in Hong Kong, "YYYY-MM-DD HH:mm". */
/** Default start: the next full Hong Kong hour, or 18:00 when that would be at night (before 08:00 → that day, after 21:00 → the next day). */
const nextHour=()=>{const t=new Date(Date.now()+8*3600e3);t.setUTCMinutes(0,0,0);t.setUTCHours(t.getUTCHours()+1);const h=t.getUTCHours();if(h<8)t.setUTCHours(18);else if(h>21){t.setUTCDate(t.getUTCDate()+1);t.setUTCHours(18);}return t.toISOString().slice(0,16).replace('T',' ');};
const asMs=(v:string)=>Date.parse(v.replace(' ','T')+':00Z');
const plus=(v:string,minutes:number)=>new Date(asMs(v)+minutes*60000).toISOString().slice(0,16).replace('T',' ');
const LANG:{value:ActivityInput['languages'][number];zh:string;en:string}[]=[{value:'zh',zh:'普通话',en:'Mandarin'},{value:'en',zh:'English',en:'English'},{value:'yue',zh:'粤语',en:'Cantonese'}];
type Open='visibility'|'capacity'|'cost'|'languages'|'interaction'|'requirements'|null;

export function ActivityForm({initial,language,onBack,onSaved}:{initial?:Activity;language:Language;dark:boolean;onBack:()=>void;onSaved:(id:string)=>void}){
 useHideTabBar();
 const zh=language==='zh',c=usePenColors();
 const firstStart=initial?hongKongInput(initial.starts_at):nextHour();
 const [title,setTitle]=useState(initial?.title??''),[description,setDescription]=useState(initial?.description??''),[location,setLocation]=useState(initial?.location??'');
 const [start,setStart]=useState(firstStart),[end,setEnd]=useState(initial?hongKongInput(initial.ends_at):plus(firstStart,60)),[capacity,setCapacity]=useState(initial?.capacity??4);
 const [cost,setCost]=useState(initial&&initial.cost_minor?String(initial.cost_minor/100):''),[requirements,setRequirements]=useState(initial?.requirements??'');
 const [kind,setKind]=useState<ActivityInput['kind']>(initial?.kind??'activity'),[visibility,setVisibility]=useState<ActivityInput['visibility']>(initial?.visibility??'members');
 const [languages,setLanguages]=useState<ActivityInput['languages']>(initial?.languages??['zh']),[interaction,setInteraction]=useState<ActivityInput['interaction']>(initial?.interaction??'casual');
 const [open,setOpen]=useState<Open>(null),[picking,setPicking]=useState<'start'|'end'|null>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[reviewOnly,setReviewOnly]=useState(false);
 const pending=useRef<WriteReceipt|null>(null),lock=useRef(false),alive=useRef(true);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 const frozen=busy||pending.current!==null;
 const protectInput=useInputProtection({title,description,location,start,end,capacity,cost,requirements,kind,visibility,languages,interaction},busy,pending.current!==null,zh);
 const toggle=(o:Exclude<Open,null>)=>{feel.select();setOpen(open===o?null:o);};
 const costMinor=Math.round(Number(cost||'0')*100);
 const costLabel=costMinor===0?(zh?'免费':'Free'):`HK$${Number(cost)}`;
 /** Specific message for the first problem, or null when the form can be sent. */
 function problem():string|null{
  if(!title.trim())return zh?'写一个活动名称':'Add a title';
  if(!location.trim())return zh?'添加地点':'Add a place';
  if(asMs(end)<=asMs(start))return zh?'结束时间要晚于开始时间':'End must be after the start';
  if(!initial&&asMs(start)<=Date.now()+8*3600e3)return zh?'开始时间要在现在之后':'Start must be in the future';
  if(!/^\d{0,4}(\.\d{1,2})?$/.test(cost)||costMinor>100000)return zh?'费用填 0–1000 港币，最多两位小数':'Cost must be HK$0–1000, up to 2 decimals';
  if(!languages.length)return zh?'至少选一种语言':'Pick at least one language';
  return null;
 }
 async function save(){if(lock.current)return;
  const issue=pending.current?null:problem();if(issue){setError(issue);feel.warn();return;}
  lock.current=true;setBusy(true);setError('');try{
  if(!pending.current){
   const content={title:title.trim(),description:description.trim(),location:location.trim(),starts_at:parseHongKongInput(start)!,ends_at:parseHongKongInput(end)!,timezone:'Asia/Hong_Kong',capacity,cost_minor:costMinor,requirements:requirements.trim(),languages,interaction};
   pending.current=writeReceipt(initial?{...content,version:initial.version}:{...content,kind,visibility},newWriteKey());
  }
  ensureReplayable(pending.current,initial?'PATCH':'POST');
  const result=await session.request<Activity>(initial?`/activities/${initial.id}`:'/activities',{method:initial?'PATCH':'POST',body:pending.current.body,idempotencyKey:pending.current.key});
  if(typeof result?.id!=='string'||!result.id)throw new ApiFailure(502,'INVALID_RESPONSE','Missing saved record.');if(alive.current){pending.current=null;feel.success();onSaved(result.id);}
 }catch(e){if(!alive.current)return;if(writeRejected(e))pending.current=null;setReviewOnly(reviewRequired(e));setError(e instanceof ApiFailure?socialError(e,language):(zh?'暂时无法保存，请检查网络后重试。':'Could not save. Check your connection and retry.'));}finally{lock.current=false;if(alive.current)setBusy(false);}}
 const back=()=>protectInput(onBack);
 const pickDone=(v:string)=>{
  if(picking==='start'){const span=Math.max(asMs(end)-asMs(start),3600e3)/60000;setStart(v);if(asMs(end)<=asMs(v))setEnd(plus(v,span));}
  else if(picking==='end')setEnd(v);
  setPicking(null);
 };
 const pill=(text:string,onPress:()=>void,label:string)=><Pressable accessibilityRole="button" accessibilityLabel={label} disabled={frozen} onPress={onPress} style={({pressed})=>({paddingVertical:7,paddingHorizontal:12,borderRadius:10,backgroundColor:pressed?c.border:c.fill})}><Text style={{fontSize:15,fontWeight:'500',color:c.text,fontVariant:['tabular-nums']}}>{text}</Text></Pressable>;
 const timeRow=(which:'start'|'end',value:string,last:boolean)=><View style={{flexDirection:'row',alignItems:'center',gap:12,paddingVertical:10,paddingHorizontal:16,borderBottomWidth:last?0:0.5,borderBottomColor:c.border}}>
  <View style={{width:10,height:10,borderRadius:5,borderWidth:1.5,borderColor:c.text,backgroundColor:which==='start'?c.text:'transparent'}}/>
  <Text style={{flex:1,fontSize:16,fontWeight:'500',color:c.text}}>{which==='start'?(zh?'开始':'Start'):(zh?'结束':'End')}</Text>
  {pill(formatPicked(value.slice(0,10),zh),()=>setPicking(which),`${which==='start'?(zh?'开始日期':'Start date'):(zh?'结束日期':'End date')} ${value}`)}
  {pill(value.slice(11),()=>setPicking(which),`${which==='start'?(zh?'开始时间':'Start time'):(zh?'结束时间':'End time')} ${value.slice(11)}`)}
 </View>;
 const choice=(on:boolean,label:string,sub:string|null,onPress:()=>void,key:string)=><Pressable key={key} accessibilityRole="radio" accessibilityState={{checked:on}} disabled={frozen} onPress={()=>{feel.select();onPress();}} style={{flexDirection:'row',alignItems:'center',gap:10,paddingVertical:8}}>
  <PenIcon name={on?'circle-check':'circle'} size={20} color={on?c.accent:c.muted}/>
  <View style={{flex:1,gap:1}}><Text style={{fontSize:15,fontWeight:on?'600':'500',color:c.text}}>{label}</Text>{sub?<Text style={{fontSize:12,color:c.muted}}>{sub}</Text>:null}</View>
 </Pressable>;
 const editor=(children:ReactNode)=><View style={{paddingHorizontal:16,paddingBottom:12,paddingTop:2,gap:4}}>{children}</View>;
 const option=(key:Exclude<Open,null>,icon:PenIconName,label:string,value:string,body:ReactNode,last=false,locked=false)=><View key={key} style={{borderBottomWidth:last?0:0.5,borderBottomColor:c.border}}>
  <Pressable accessibilityRole="button" accessibilityState={{expanded:open===key}} disabled={frozen||locked} onPress={()=>toggle(key)} style={({pressed})=>({flexDirection:'row',alignItems:'center',gap:12,paddingVertical:13,paddingHorizontal:16,backgroundColor:pressed?c.fill:'transparent'})}>
   <PenIcon name={icon} size={18} color={c.muted}/>
   <Text style={{flex:1,fontSize:16,fontWeight:'500',color:c.text}}>{label}</Text>
   <Text numberOfLines={1} style={{maxWidth:'55%',fontSize:15,color:c.muted}}>{value}</Text>
   {locked?null:<PenIcon name={open===key?'chevron-down':'chevron-right'} size={16} color={c.muted}/>}
  </Pressable>
  {open===key?editor(body):null}
 </View>;
 const card={backgroundColor:c.surface,borderRadius:20,borderCurve:'continuous' as const,overflow:'hidden' as const,borderWidth:1,borderColor:c.glassBorder};
 return <View style={{gap:16}}>
  <View style={{flexDirection:'row',alignItems:'center',minHeight:48}}>
   <CircleButton icon="x" label={zh?'关闭':'Close'} disabled={busy} onPress={back}/>
   <Text style={{flex:1,textAlign:'center',fontSize:17,fontWeight:'700',color:c.text}}>{initial?(zh?'编辑活动':'Edit activity'):(zh?'发起活动':'New activity')}</Text>
   <View style={{width:44}}/>
  </View>
  {!initial?<GlassChips label={zh?'类型':'Type'} value={kind} onChange={v=>{if(!frozen)setKind(v);}} items={[{value:'activity',label:zh?'活动':'Activity'},{value:'study',label:zh?'学习组队':'Study group'}]}/>:null}
  <View style={{gap:6,paddingHorizontal:4}}>
   <TextInput accessibilityLabel={zh?'活动名称':'Title'} value={title} onChangeText={setTitle} editable={!frozen} maxLength={120} multiline blurOnSubmit placeholder={zh?'活动名称':'Activity name'} placeholderTextColor={c.muted+'99'} style={{fontSize:30,lineHeight:36,fontWeight:'800',color:c.text,padding:0,letterSpacing:-0.5}}/>
   <TextInput accessibilityLabel={zh?'活动介绍':'Description'} value={description} onChangeText={setDescription} editable={!frozen} maxLength={5000} multiline placeholder={zh?'写一句：这次一起做什么':'One line: what will you do together'} placeholderTextColor={c.muted+'99'} style={{fontSize:16,lineHeight:23,color:c.text,padding:0}}/>
  </View>
  <View style={card}>
   {timeRow('start',start,false)}{timeRow('end',end,false)}
   <View style={{flexDirection:'row',alignItems:'center',gap:6,paddingVertical:10,paddingHorizontal:16,backgroundColor:c.fill+'66'}}><PenIcon name="globe" size={14} color={c.muted}/><Text style={{fontSize:13,fontWeight:'500',color:c.muted}}>{zh?'香港时间':'Hong Kong time'}</Text></View>
  </View>
  <View style={[card,{flexDirection:'row',alignItems:'center',gap:12,paddingVertical:13,paddingHorizontal:16}]}>
   <PenIcon name="map-pin" size={18} color={c.muted}/>
   <View style={{flex:1,gap:2}}>
    <TextInput accessibilityLabel={zh?'地点':'Place'} value={location} onChangeText={setLocation} editable={!frozen} maxLength={300} placeholder={zh?'添加地点':'Add a place'} placeholderTextColor={c.text} style={{fontSize:16,fontWeight:'500',color:c.text,padding:0}}/>
    <Text style={{fontSize:13,color:c.muted}}>{zh?'校内地点或线上链接':'Campus location or online link'}</Text>
   </View>
  </View>
  <Text style={{fontSize:13,fontWeight:'600',color:c.muted,paddingHorizontal:4}}>{zh?'选项':'Options'}</Text>
  <View style={card}>
   {option('visibility','eye',zh?'谁能看到':'Who can see',visibility==='members'?(zh?'登录同学':'Signed-in students'):(zh?'公开':'Public'),<>
    {choice(visibility==='members',zh?'登录同学':'Signed-in students',zh?'在 App 里登录的同学能看到':'Students signed in to the app',()=>setVisibility('members'),'m')}
    {choice(visibility==='public',zh?'公开':'Public',zh?'没登录的人也能在网页上看到':'People who are not signed in can see it on the web',()=>setVisibility('public'),'p')}
    <Text style={{fontSize:12,color:c.muted,paddingTop:4}}>{zh?'发布后不能扩大可见范围。':'Visibility cannot be widened after publishing.'}</Text>
   </>,false,!!initial)}
   {option('capacity','users',zh?'人数上限':'Places',zh?`${capacity} 人`:`${capacity}`,<View style={{flexDirection:'row',alignItems:'center',gap:16,paddingVertical:6}}>
    <CircleButton icon="minus" label={zh?'减少':'Fewer'} disabled={frozen||capacity<=1} onPress={()=>{feel.select();setCapacity(Math.max(1,capacity-1));}}/>
    <Text style={{fontSize:28,fontWeight:'800',color:c.text,fontVariant:['tabular-nums'],minWidth:44,textAlign:'center'}}>{capacity}</Text>
    <CircleButton icon="plus" label={zh?'增加':'More'} disabled={frozen||capacity>=50} onPress={()=>{feel.select();setCapacity(Math.min(50,capacity+1));}}/>
    <Text style={{flex:1,fontSize:13,color:c.muted}}>{zh?'1–50 人，不含发起人':'1–50, not counting you'}</Text>
   </View>)}
   {option('cost','wallet',zh?'费用':'Cost',costLabel,<>
    <View style={{flexDirection:'row',alignItems:'center',gap:8,paddingVertical:4}}>
     <Text style={{fontSize:17,fontWeight:'600',color:c.text}}>HK$</Text>
     <TextInput accessibilityLabel={zh?'每人费用（港币）':'Cost per person (HKD)'} value={cost} onChangeText={v=>setCost(v.replace(/[^\d.]/g,''))} editable={!frozen} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={c.muted} style={{flex:1,fontSize:17,fontWeight:'600',color:c.text,padding:8,borderRadius:10,backgroundColor:c.fill}}/>
    </View>
    <Text style={{fontSize:12,color:c.muted}}>{zh?'不填或填 0 就是免费；仅作说明，App 不收款。':'Leave empty or 0 for free; shown for information, the app collects no payment.'}</Text>
   </>)}
   {option('languages','languages',zh?'语言':'Languages',LANG.filter(l=>languages.includes(l.value)).map(l=>zh?l.zh:l.en).join('、')||(zh?'未选':'None'),<View style={{flexDirection:'row',gap:8,paddingVertical:6}}>
    {LANG.map(l=>{const on=languages.includes(l.value);return <Pressable key={l.value} accessibilityRole="checkbox" accessibilityState={{checked:on}} disabled={frozen} onPress={()=>{feel.select();setLanguages(on?languages.filter(x=>x!==l.value):[...languages,l.value]);}} style={{paddingVertical:8,paddingHorizontal:14,borderRadius:99,backgroundColor:on?c.accent+'1F':c.fill}}><Text style={{fontSize:15,fontWeight:on?'700':'500',color:on?c.accent:c.text}}>{zh?l.zh:l.en}</Text></Pressable>;})}
   </View>)}
   {option('interaction','smile',zh?'相处方式':'Style',interactionLabel(interaction,zh),<>
    {choice(interaction==='quiet',interactionLabel('quiet',zh),zh?'各做各的，不用主动聊天':'Do your own thing, no need to chat',()=>setInteraction('quiet'),'q')}
    {choice(interaction==='casual',interactionLabel('casual',zh),zh?'边做边聊':'Chat as you go',()=>setInteraction('casual'),'c')}
    {choice(interaction==='active',interactionLabel('active',zh),zh?'一起讨论、一起完成':'Discuss and build together',()=>setInteraction('active'),'a')}
   </>)}
   {option('requirements','clipboard-list',zh?'参与须知':'Notes',requirements.trim()?(zh?'已填写':'Added'):(zh?'选填':'Optional'),<TextInput accessibilityLabel={zh?'参与须知':'Notes'} value={requirements} onChangeText={setRequirements} editable={!frozen} multiline maxLength={2000} placeholder={zh?'例如：带上电脑；新手也欢迎':'e.g. bring a laptop; beginners welcome'} placeholderTextColor={c.muted} style={{minHeight:80,fontSize:15,lineHeight:22,color:c.text,padding:10,borderRadius:12,backgroundColor:c.fill,textAlignVertical:'top'}}/>,true)}
  </View>
  {error?<Notice tone="error" text={error}/>:null}
  {reviewOnly?<PrimaryButton tone="soft" label={zh?'返回列表核对已保存内容':'Return to check saved content'} onPress={back}/>:null}
  <View style={{flexDirection:'row'}}><PrimaryButton label={busy?(zh?'保存中…':'Saving…'):pending.current?(zh?'重试确认结果':'Retry to confirm result'):initial?(zh?'保存并通知参与者':'Save and notify participants'):(zh?'发布':'Publish')} disabled={busy||reviewOnly} onPress={()=>void save()}/></View>
  <Text style={{textAlign:'center',fontSize:12,color:c.muted}}>{initial?(zh?'改时间或地点会通知已报名的人。':'Changing time or place notifies everyone who joined.'):(zh?'发布后不能扩大可见范围；改时间会通知已报名的人。':'Visibility cannot be widened later; time changes notify everyone who joined.')}</Text>
  {picking?<PickerSheet zh={zh} title={picking==='start'?(zh?'开始':'Start'):(zh?'结束':'End')} value={picking==='start'?start:end} mode="datetime" onClose={()=>setPicking(null)} onDone={pickDone}/>:null}
 </View>;
}

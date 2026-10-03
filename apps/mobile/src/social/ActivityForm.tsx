import {writeReceipt,ensureReplayable,writeRejected,reviewRequired,type WriteReceipt} from '../write-receipt';
import {useInputProtection} from '../navigation/InputProtection';
import {useEffect,useRef,useState} from 'react';
import {Alert,Text,View} from 'react-native';
import { Button } from '../ui/Primitives';
import { Input } from '../ui/Primitives';
import {session} from '../runtime';
import {ApiFailure} from '../api';
import {palette,styles} from '../theme';
import type {Language} from '../strings';
import type {Activity,ActivityInput} from '../../../../src/product/social/types';
import {hongKongInput,parseHongKongInput,newWriteKey} from '../study/dates';
import {socialError} from './shared';
export function ActivityForm({initial,language,dark,onBack,onSaved}:{initial?:Activity;language:Language;dark:boolean;onBack:()=>void;onSaved:(id:string)=>void}){
 const zh=language==='zh',c=palette[dark?'dark':'light'];
 const [title,setTitle]=useState(initial?.title??''),[description,setDescription]=useState(initial?.description??''),[location,setLocation]=useState(initial?.location??'');
 const [start,setStart]=useState(hongKongInput(initial?.starts_at??null)),[end,setEnd]=useState(hongKongInput(initial?.ends_at??null)),[capacity,setCapacity]=useState(String(initial?.capacity??4));
 const [cost,setCost]=useState(String((initial?.cost_minor??0)/100)),[requirements,setRequirements]=useState(initial?.requirements??'');
 const [kind,setKind]=useState<ActivityInput['kind']>(initial?.kind??'activity'),[visibility,setVisibility]=useState<ActivityInput['visibility']>(initial?.visibility??'members');
 const [languages,setLanguages]=useState<ActivityInput['languages']>(initial?.languages??['en']),[interaction,setInteraction]=useState<ActivityInput['interaction']>(initial?.interaction??'casual');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[reviewOnly,setReviewOnly]=useState(false);
 const pending=useRef<WriteReceipt|null>(null),lock=useRef(false),alive=useRef(true);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 const frozen=busy||pending.current!==null;
 const protectInput=useInputProtection({title,description,location,start,end,capacity,cost,requirements,kind,visibility,languages,interaction},busy,pending.current!==null,zh);
 const field=(label:string,value:string,change:(v:string)=>void,multiline=false)=><View style={styles.smallStack}><Text style={[styles.body,{color:c.text}]}>{label}</Text><Input accessibilityLabel={label} value={value} onChangeText={change} editable={!frozen} multiline={multiline} autoCapitalize="none" style={[styles.input,{color:c.text,borderColor:c.border},multiline?{minHeight:100,textAlignVertical:'top'}:{}]}/></View>;
 async function save(){if(lock.current)return;lock.current=true;setBusy(true);setError('');try{
  if(!pending.current){
   const starts_at=parseHongKongInput(start),ends_at=parseHongKongInput(end);if(!starts_at||!ends_at||!/^\d+$/.test(capacity)||!/^\d+(\.\d{1,2})?$/.test(cost))throw new Error('Invalid fields');
   const content={title,description,location,starts_at,ends_at,timezone:'Asia/Hong_Kong',capacity:Number(capacity),cost_minor:Math.round(Number(cost)*100),requirements,languages,interaction};
   pending.current=writeReceipt(initial?{...content,version:initial.version}:{...content,kind,visibility},newWriteKey());
  }
  ensureReplayable(pending.current,initial?'PATCH':'POST');
  const result=await session.request<Activity>(initial?`/activities/${initial.id}`:'/activities',{method:initial?'PATCH':'POST',body:pending.current.body,idempotencyKey:pending.current.key});
  if(typeof result?.id!=='string'||!result.id)throw new ApiFailure(502,'INVALID_RESPONSE','Missing saved record.');if(alive.current){pending.current=null;onSaved(result.id);}
 }catch(e){if(!alive.current)return;if(writeRejected(e))pending.current=null;setReviewOnly(reviewRequired(e));setError(e instanceof ApiFailure?socialError(e,language):(zh?'请使用 YYYY-MM-DD HH:mm，结束时间须晚于开始；检查名额和费用。':'Use YYYY-MM-DD HH:mm, an end after the start, and valid capacity/cost.'));}finally{lock.current=false;if(alive.current)setBusy(false);}}
 const back=()=>protectInput(onBack);
 return <View style={styles.stack}>
  <Button variant="ghost" isDisabled={busy} onPress={back}>{zh?'返回':'Back'}</Button>
  <Text style={[styles.title,{color:c.text}]}>{initial?(zh?'编辑活动':'Edit activity'):(zh?'发起一次小聚／学习组队':'Start an activity / study group')}</Text>
  <Text style={[styles.caption,{color:c.muted}]}>{zh?'本地开发演示内容。不会发布到公网；不代表学校官方活动。':'Local development demo content. Not published online or an official school event.'}</Text>
  {!initial?<><View style={styles.row}>{(['activity','study'] as const).map(k=><Button key={k} isDisabled={frozen} variant={kind===k?'primary':'secondary'} onPress={()=>setKind(k)}>{k==='study'?(zh?'学习组队':'Study group'):(zh?'活动':'Activity')}</Button>)}</View><Text style={[styles.body,{color:c.text}]}>{zh?'谁能看到标题、地点和评论？发布后不能扩大可见范围。':'Who can see the title, place and comments? Visibility is fixed after publishing.'}</Text>{(['members','public'] as const).map(v=><Button key={v} isDisabled={frozen} variant={visibility===v?'primary':'secondary'} onPress={()=>setVisibility(v)}>{v==='members'?(zh?'登录用户（非在籍认证）':'Signed-in users (not school verified)'):(zh?'公开，访客也能浏览':'Public, including visitors')}</Button>)}</>:null}
  {field(zh?'标题':'Title',title,setTitle)}{field(zh?'活动介绍':'Description',description,setDescription,true)}{field(zh?'集合地点／在线链接说明':'Meeting place / online meeting details',location,setLocation)}
  <Text style={[styles.caption,{color:c.muted}]}>{zh?'时间均为香港时间，填写 YYYY-MM-DD HH:mm。':'Use Hong Kong time: YYYY-MM-DD HH:mm.'}</Text>
  {field(zh?'开始':'Start',start,setStart)}{field(zh?'结束':'End',end,setEnd)}{field(zh?'参加名额（1–50，不含组织者）':'Participant places (1–50, organizer excluded)',capacity,setCapacity)}
  {field(zh?'每人预计费用（港币，0 为免费）':'Expected cost per person (HKD, 0 is free)',cost,setCost)}
  <Text style={[styles.caption,{color:c.muted}]}>{zh?'费用仅作说明，本 App 不收款。候补按加入顺序自动递补，参与者可随时退出。':'Cost is informational; no payments are collected. Waitlist places are promoted in order and participants may withdraw.'}</Text>
  <Text style={[styles.heading,{color:c.text}]}>{zh?'沟通语言':'Languages'}</Text>
  {(['zh','en','yue'] as const).map(l=><Button key={l} isDisabled={frozen} variant={languages.includes(l)?'primary':'secondary'} onPress={()=>setLanguages(languages.includes(l)?languages.filter(x=>x!==l):[...languages,l])}>{l==='zh'?(zh?'普通话':'Mandarin'):l==='yue'?(zh?'粤语':'Cantonese'):'English'}</Button>)}
  <Text style={[styles.heading,{color:c.text}]}>{zh?'相处方式':'Interaction style'}</Text>
  {(['quiet','casual','active'] as const).map(i=><Button key={i} isDisabled={frozen} variant={interaction===i?'primary':'secondary'} onPress={()=>setInteraction(i)}>{i==='quiet'?(zh?'安静共处，无需主动聊天':'Quiet company, no need to chat'):i==='casual'?(zh?'随意交流':'Casual conversation'):(zh?'共同讨论／协作':'Active discussion / collaboration')}</Button>)}
  {field(zh?'参与条件／新手须知':'Requirements / notes for beginners',requirements,setRequirements,true)}
  {reviewOnly?<Button variant="secondary" onPress={back}>{zh?'返回列表核对已保存内容':'Return to check saved content'}</Button>:null}
  {error?<Text accessibilityRole="alert" style={[styles.body,{color:c.danger}]}>{error}</Text>:null}
  <Button isDisabled={busy||reviewOnly} onPress={()=>void save()}>{busy?(zh?'保存中…':'Saving…'):pending.current?(zh?'重试确认结果':'Retry to confirm result'):initial?(zh?'保存并通知参与者':'Save and notify participants'):(zh?'发布演示活动':'Publish demo activity')}</Button>
 </View>;
}

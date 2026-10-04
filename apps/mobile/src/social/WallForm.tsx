import {useHideTabBar} from '../navigation/SceneOverlay';
import {writeReceipt,ensureReplayable,writeRejected,reviewRequired,type WriteReceipt} from '../write-receipt';
import {useInputProtection} from '../navigation/InputProtection';
import {useEffect,useRef,useState} from 'react';
import {Alert,Pressable,Text,TextInput,View} from 'react-native';
import {ListGroup,ListRow,Notice,PenIcon,usePenColors,CircleButton} from '../ui/Pen';
import {topicMeta} from './wall-ui';
import {session} from '../runtime';
import {ApiFailure} from '../api';
import {palette,styles} from '../theme';
import type {Language} from '../strings';
import type {WallPost,WallTopic} from '../../../../src/product/social/wall-types';
import {newWriteKey} from '../study/dates';
import {wallError} from './wall-shared';
export function WallForm({initial,language,dark,onBack,onSaved}:{initial?:WallPost;language:Language;dark:boolean;onBack:()=>void;onSaved:(id:string)=>void}){
 useHideTabBar();
 const zh=language==='zh',c=usePenColors();
 const [title,setTitle]=useState(initial?.title??''),[body,setBody]=useState(initial?.body??'');
 const [topic,setTopic]=useState<WallTopic>(initial?(initial.topic??(initial.kind==='help'?'question':'share')):'question');const kind:WallPost['kind']=topic==='question'?'help':'wall';const [visibility,setVisibility]=useState<WallPost['visibility']>(initial?.visibility??'members');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[reviewOnly,setReviewOnly]=useState(false);
 const pending=useRef<WriteReceipt|null>(null),lock=useRef(false),alive=useRef(true);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 const frozen=busy||pending.current!==null;
 const protectInput=useInputProtection({title,body,topic,visibility},busy,pending.current!==null,zh);
 async function save(){if(lock.current)return;lock.current=true;setBusy(true);setError('');try{
  pending.current??=writeReceipt(initial?{title,body,version:initial.version}:{title,body,kind,topic,visibility},newWriteKey());
  ensureReplayable(pending.current,initial?'PATCH':'POST');
  const result=await session.request<WallPost>(initial?`/posts/${initial.id}`:'/posts',{method:initial?'PATCH':'POST',body:pending.current.body,idempotencyKey:pending.current.key});
  if(typeof result?.id!=='string'||!result.id)throw new ApiFailure(502,'INVALID_RESPONSE','Missing saved record.');
  if(alive.current){pending.current=null;onSaved(result.id);}
 }catch(e){if(alive.current){if(writeRejected(e))pending.current=null;setReviewOnly(reviewRequired(e));setError(wallError(e,language));}}finally{lock.current=false;if(alive.current)setBusy(false);}}
 const back=()=>protectInput(onBack);
 const ph:Record<WallTopic,[string,string]>={question:[zh?'有人知道 LG1 晚上几点关吗？':'Anyone know when LG1 closes?',zh?'说说你的情况，越具体越容易得到好回答…':'Add details; specific questions get better answers…'],buddy:[zh?'周六西贡徒步，还差 2 人':'Hiking Sai Kung on Saturday, need 2 more',zh?'时间、地点、节奏、想找什么样的搭子…':'Time, place, pace, who you are looking for…'],market:[zh?'出 MATH 2411 教材，HK$ 80':'Selling MATH 2411 textbook, HK$ 80',zh?'成色、价格、面交地点…':'Condition, price, where to meet…'],share:[zh?'今天的海边很好看':'The seaside was lovely today',zh?'想分享点什么…':'What would you like to share…']};
 return <View style={{gap:16}}>
  <View style={{flexDirection:'row',alignItems:'center'}}>
   <CircleButton icon="x" label={zh?'取消':'Cancel'} disabled={busy} onPress={back}/>
   <Text style={{flex:1,textAlign:'center',fontSize:17,fontWeight:'700',color:c.text}}>{initial?(zh?'编辑帖子':'Edit post'):(zh?'发到校园墙':'Post to the wall')}</Text>
   <CircleButton variant="prominent" icon={pending.current?'rotate-cw':initial?'check':'arrow-up'} label={pending.current?(zh?'重试':'Retry'):initial?(zh?'保存':'Save'):(zh?'发布':'Post')} disabled={busy||reviewOnly||!title.trim()||!body.trim()} onPress={()=>void save()}/>
  </View>
  {!initial?<View style={{flexDirection:'row',gap:8}}>{(['question','buddy','market','share'] as const).map(t=>{const m=topicMeta[t],on=topic===t;return <Pressable key={t} accessibilityRole="button" accessibilityState={{selected:on}} disabled={frozen} onPress={()=>setTopic(t)} style={{flex:1,alignItems:'center',gap:6,paddingVertical:12,borderRadius:20,backgroundColor:on?m.color+'1F':c.surface,borderWidth:0,boxShadow:on?undefined:'0 4px 14px #1B35660D'}}><PenIcon name={m.icon} size={22} color={on?m.color:c.muted}/><Text style={{fontSize:13,fontWeight:'700',color:on?m.color:c.text}}>{zh?m.zh:m.en}</Text></Pressable>;})}</View>:null}
  <View style={{gap:8,padding:18,minHeight:240,borderRadius:28,backgroundColor:c.surface,borderWidth:1,borderColor:c.glassBorder}}>
   <TextInput accessibilityLabel={zh?'帖子标题':'Post title'} value={title} onChangeText={setTitle} maxLength={160} editable={!frozen} placeholder={ph[topic][0]} placeholderTextColor={c.tertiary} style={{fontSize:20,lineHeight:27,fontWeight:'700',color:c.text}}/>
   <TextInput accessibilityLabel={zh?'帖子正文':'Post body'} value={body} onChangeText={setBody} maxLength={5000} editable={!frozen} multiline placeholder={ph[topic][1]} placeholderTextColor={c.tertiary} style={{flex:1,minHeight:150,fontSize:16,lineHeight:24,color:c.text,textAlignVertical:'top'}}/>
   <Text style={{alignSelf:'flex-end',fontSize:12,color:c.tertiary}}>{body.length}/5000</Text>
  </View>
  {!initial?<ListGroup>
   <ListRow icon="eye" tile={c.teal} title={zh?'谁能看到':'Who can see'} value={visibility==='members'?(zh?'科大同学（登录）':'Signed-in members'):(zh?'所有人':'Everyone')} chevron onPress={()=>setVisibility(visibility==='members'?'public':'members')}/>
   <ListRow icon="user-round-pen" tile={c.orange} title={zh?'发布身份':'Posting as'} value={zh?'你的昵称':'Your display name'}/>
  </ListGroup>:null}
  <Text style={{paddingHorizontal:16,fontSize:12,color:c.muted}}>{zh?'可见范围发布后固定。你的私人课表不会附在帖子里。':'Visibility is fixed after posting. Your timetable is never attached.'}</Text>
  {reviewOnly?<Notice tone="warning" text={zh?'请返回列表核对已保存内容。':'Go back and check what was saved.'} action={zh?'返回':'Back'} onAction={back}/>:null}
  {error?<Notice tone="error" text={error}/>:null}
 </View>;
}

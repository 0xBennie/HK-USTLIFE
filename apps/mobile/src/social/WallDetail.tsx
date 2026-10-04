import {writeReceipt,ensureReplayable,writeRejected,reviewRequired,type WriteReceipt} from '../write-receipt';
import {useInputProtection} from '../navigation/InputProtection';
import {useSceneFocus} from '../navigation/TabScene';
import {SafetyActions} from './SafetyActions';
import {useCallback,useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {ActionSheetIOS,Alert,AppState,Pressable,Share,Text,TextInput,View} from 'react-native';
import {useSceneBottomBar} from '../navigation/SceneOverlay';
import {BottomBar,CircleButton,EmptyState,Notice,PenIcon,PrimaryButton,Skeleton,Stagger,Surface,ViewAll,usePenColors,GlassCapsule} from '../ui/Pen';
import {GradientAvatar,TopicPill,relativeTime,topicMeta,topicOf} from './wall-ui';
const replyCopy={
 question:{zh:['友善回复，帮到下一个人…','说说你知道的，帮到下一个人。'],en:['Reply kindly…','Share what you know.']},
 buddy:{zh:['我也想去 / 还有位置吗…','第一个报名的人，往往就是新朋友。'],en:['I’m in / still a spot?','Be the first to join.']},
 market:{zh:['问问成色、价格或约个时间…','有兴趣就留言，约在校内当面交易更安心。'],en:['Ask about condition or price…','Meet on campus to trade safely.']},
 share:{zh:['说点什么…','留下你的看法。'],en:['Say something…','Leave your thoughts.']},
} as const;
import { Button } from '../ui/Primitives';
import { Card } from '../ui/Primitives';
import { Input } from '../ui/Primitives';
import {session} from '../runtime';
import {ApiFailure} from '../api';
import {palette,styles} from '../theme';
import type {Language} from '../strings';
import type {WallPost,WallReply} from '../../../../src/product/social/wall-types';
import {dateTimeInZone,newWriteKey} from '../study/dates';
import {wallError,postStatus} from './wall-shared';
import {WallForm} from './WallForm';
type Pending=WriteReceipt&{path:string;method:string;after?:()=>void};
export function WallDetail({id,language,dark,onBack,onLogin,onNavigate}:{id:string;language:Language;dark:boolean;onBack:()=>void;onLogin:()=>void;onNavigate:()=>void}){
 const sceneActive=useSceneFocus();
 const zh=language==='zh',c=usePenColors(),profile=useSyncExternalStore(session.subscribe,session.snapshot).profile;
 const [post,setPost]=useState<WallPost|null>(null),[replies,setReplies]=useState<WallReply[]>([]),[cursor,setCursor]=useState<number|null>(null);
 const [text,setText]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[editing,setEditing]=useState(false);
 const [reviewOnly,setReviewOnly]=useState(false);
 const pending=useRef<Pending|null>(null),lock=useRef(false),epoch=useRef(0),alive=useRef(true);
 const protectInput=useInputProtection({text},busy,pending.current!==null,zh);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;epoch.current++;};},[]);
 useEffect(onNavigate,[editing,onNavigate]);
 const load=useCallback(async(before?:number,afterWrite=false)=>{
  const generation=++epoch.current;setBusy(true);setError('');
  try{const [current,page]=await Promise.all([session.request<WallPost>(`/posts/${id}`),session.request<{items:WallReply[];next_cursor:number|null}>(`/posts/${id}/replies`+(before?`?cursor=${before}`:''))]);
   if(alive.current&&generation===epoch.current){setPost(current);setReplies(old=>before?[...old,...page.items.filter(x=>!old.some(y=>y.id===x.id))]:page.items);setCursor(page.next_cursor);}
  }catch(e){if(alive.current&&generation===epoch.current){setPost(null);setReplies([]);setCursor(null);setError(afterWrite&&(!(e instanceof ApiFailure)||e.status===0||e.status>=500)?(zh?'操作已保存，但帖子详情暂时无法刷新。请稍后刷新，勿重复发布。':'The change was saved, but the post could not refresh. Refresh later; do not publish it again.'):wallError(e,language));}}
  finally{if(alive.current&&generation===epoch.current)setBusy(false);}
 },[id,language]);
 useEffect(()=>{if(!sceneActive||editing)return;if(!pending.current&&!lock.current)void load();const listener=AppState.addEventListener('change',s=>{if(s==='active'&&!lock.current&&!pending.current)void load();});return()=>{epoch.current++;listener.remove();};},[load,editing,sceneActive]);
 async function run(){if(lock.current||!pending.current)return;lock.current=true;setBusy(true);setError('');const request=pending.current;
  try{ensureReplayable(request,request.method);await session.request(request.path,{method:request.method,body:request.body,idempotencyKey:request.key});
   if(alive.current){pending.current=null;request.after?.();if(request.method!=='DELETE'||request.path!==`/posts/${id}`)await load(undefined,true);}
  }catch(e){if(alive.current){if(writeRejected(e)){pending.current=null;if(e.status===404||e.status===410){setPost(null);setReplies([]);setCursor(null);}}setReviewOnly(reviewRequired(e));setError(wallError(e,language));}}
  finally{lock.current=false;if(alive.current)setBusy(false);}
 }
 function act(suffix:string,method:string,body:unknown,after?:()=>void){if(lock.current||pending.current)return;epoch.current++;pending.current={path:`/posts/${id}${suffix}`,method,...writeReceipt(body,newWriteKey()),after};void run();}
 const frozen=busy||pending.current!==null;
 function confirm(title:string,message:string,action:()=>void){Alert.alert(title,message,[{text:zh?'返回':'Go back',style:'cancel'},{text:zh?'确认':'Confirm',style:'destructive',onPress:action}]);}
 function back(){protectInput(onBack);}
 if(editing&&post)return <WallForm initial={post} language={language} dark={dark} onBack={()=>setEditing(false)} onSaved={()=>setEditing(false)}/>;
 const owner=post?.is_mine;
 const ownerMenu=()=>post&&ActionSheetIOS.showActionSheetWithOptions({options:[zh?'编辑帖子':'Edit post',post.status!=='open'?(zh?'重新开放回复':'Reopen replies'):post.kind==='help'?(zh?'标记已解决':'Mark as solved'):(zh?'结束讨论':'Close discussion'),zh?'删除帖子':'Delete post',zh?'取消':'Cancel'],destructiveButtonIndex:2,cancelButtonIndex:3},i=>{if(frozen)return;if(i===0)setEditing(true);if(i===1)act('','PATCH',{version:post.version,status:post.status==='open'?(post.kind==='help'?'resolved':'closed'):'open'});if(i===2)confirm(zh?'删除帖子及所有回复？':'Delete this post and all replies?',zh?'删除后不能恢复。':'This cannot be undone.',()=>act('','DELETE',{version:post.version},onBack));});
 const bar=post&&profile&&post.status==='open'?<BottomBar><View style={{flexDirection:'row',alignItems:'flex-end',gap:10}}>
  <GradientAvatar name={profile.display_name||profile.email} size={36}/>
  <GlassCapsule radius={22} style={{flex:1}}><TextInput accessibilityLabel={zh?'回复内容':'Reply text'} value={text} onChangeText={setText} editable={!frozen} multiline maxLength={2000} placeholder={zh?replyCopy[topicOf(post)].zh[0]:replyCopy[topicOf(post)].en[0]} placeholderTextColor={c.muted} style={{minHeight:44,maxHeight:120,paddingHorizontal:16,paddingTop:12,paddingBottom:12,fontSize:16,color:c.text}}/></GlassCapsule>
  <CircleButton variant="prominent" icon="arrow-up" label={zh?'发布回复':'Post reply'} disabled={frozen||!text.trim()} onPress={()=>act('/replies','POST',{body:text},()=>setText(''))}/>
 </View></BottomBar>:null;
 useSceneBottomBar(editing?null:bar);
 const topic=post?topicOf(post):'question';
 return <View style={{gap:16}}>
  <View style={{flexDirection:'row',alignItems:'center',gap:10}}>
   <CircleButton icon="chevron-left" label={zh?'返回校园墙':'Back to wall'} onPress={back}/>
   <Text style={{flex:1,textAlign:'center',fontSize:17,fontWeight:'700',color:c.text}}>{zh?topicMeta[topic].zh:topicMeta[topic].en}</Text>
   {owner?<CircleButton icon="ellipsis" label={zh?'管理帖子':'Manage post'} onPress={ownerMenu}/>:<CircleButton icon="share" label={zh?'分享':'Share'} onPress={()=>post&&void Share.share({message:`${post.title}\n${post.body}`})}/>}
  </View>
  {error?<Notice tone="error" text={error} action={pending.current&&!reviewOnly?(zh?'重试':'Retry'):reviewOnly?(zh?'返回':'Back'):(zh?'刷新':'Refresh')} onAction={()=>pending.current&&!reviewOnly?void run():reviewOnly?protectInput(onBack):void load()}/>:null}
  {!post&&busy?<Skeleton height={260} radius={28}/>:null}
  {post?<>
   <Stagger index={0}><View style={{gap:12,padding:18,borderRadius:28,backgroundColor:c.surface,borderWidth:1,borderColor:c.glassBorder,boxShadow:'0 10px 30px #0000000F'}}>
    <View style={{flexDirection:'row',alignItems:'center',gap:10}}>
     <GradientAvatar name={post.author.display_name} size={44}/>
     <View style={{flex:1,gap:1}}><View style={{flexDirection:'row',alignItems:'center',gap:5}}><Text style={{fontSize:16,fontWeight:'700',color:c.text}}>{post.author.display_name}</Text>{post.visibility==='members'?<PenIcon name="badge-check" size={14} color="#24467F"/>:null}</View><Text style={{fontSize:12,color:c.muted}}>{relativeTime(post.created_at,zh)} · {post.visibility==='public'?(zh?'公开':'Public'):(zh?'仅同学可见':'Members only')}</Text></View>
     <TopicPill topic={topic} zh={zh}/>
    </View>
    <Text selectable style={{fontSize:22,lineHeight:30,fontWeight:'700',color:c.text}}>{post.title}</Text>
    <Text selectable style={{fontSize:16,lineHeight:25,color:c.text}}>{post.body}</Text>
    {post.status!=='open'?<View style={{alignSelf:'flex-start',flexDirection:'row',alignItems:'center',gap:5,paddingVertical:5,paddingHorizontal:11,borderRadius:99,backgroundColor:post.status==='resolved'?'#2E9E5B1F':c.fill}}><PenIcon name={post.status==='resolved'?'circle-check':'lock'} size={13} color={post.status==='resolved'?'#2E9E5B':c.muted}/><Text style={{fontSize:12,fontWeight:'700',color:post.status==='resolved'?'#2E9E5B':c.muted}}>{postStatus(post.status,zh)}</Text></View>:null}
   </View></Stagger>
   <View style={{flexDirection:'row',alignItems:'center',paddingHorizontal:4}}><Text style={{flex:1,fontSize:17,fontWeight:'700',color:c.text}}>{zh?`${post.reply_count} 条回复`:`${post.reply_count} replies`}</Text></View>
   {!replies.length?<Surface><EmptyState icon="message-circle" title={zh?'还没有回复':'No replies yet'} body={post.status==='open'?(zh?replyCopy[topicOf(post)].zh[1]:replyCopy[topicOf(post)].en[1]):(zh?'作者已暂停新回复。':'Replies are closed.')}/></Surface>:
   <View style={{borderRadius:28,overflow:'hidden',backgroundColor:c.surface,borderWidth:1,borderColor:c.glassBorder}}>{replies.map((r,i)=><Stagger key={r.id} index={i}><View style={{flexDirection:'row',gap:12,padding:16,paddingHorizontal:18,borderBottomWidth:i<replies.length-1?0.5:0,borderBottomColor:c.border}}>
    <GradientAvatar name={r.author.display_name} size={34}/>
    <View style={{flex:1,gap:4}}>
     <View style={{flexDirection:'row',alignItems:'center',gap:6}}><Text style={{fontSize:14,fontWeight:'700',color:c.text}}>{r.author.display_name}</Text><Text style={{flex:1,fontSize:12,color:c.muted}}>{relativeTime(r.created_at,zh)}</Text>{r.is_mine?<Pressable hitSlop={10} accessibilityLabel={zh?'删除我的回复':'Delete my reply'} onPress={()=>confirm(zh?'删除这条回复？':'Delete this reply?',r.body,()=>act(`/replies/${r.id}`,'DELETE',{version:r.version}))}><PenIcon name="trash" size={15} color={c.muted}/></Pressable>:null}</View>
     <Text selectable style={{fontSize:15,lineHeight:22,color:c.text}}>{r.body}</Text>
     <SafetyActions quiet="inline" target={{kind:'reply',id:String(r.id)}} author={r.author} language={language} dark={dark} disabled={frozen} onChanged={()=>void load()}/>
    </View>
   </View></Stagger>)}{cursor?<View style={{borderTopWidth:0.5,borderTopColor:c.border}}><ViewAll label={zh?'加载较早回复':'Earlier replies'} onPress={()=>void load(cursor)}/></View>:null}</View>}
   {!profile?<View style={{flexDirection:'row'}}><PrimaryButton label={zh?'登录后回复':'Sign in to reply'} onPress={onLogin}/></View>:null}
   {!owner?<SafetyActions target={{kind:'post',id:post.id}} author={post.author} language={language} dark={dark} disabled={frozen} onChanged={()=>void load()}/>:null}
  </>:null}
 </View>;
}

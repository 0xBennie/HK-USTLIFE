import {writeReceipt,ensureReplayable,writeRejected,reviewRequired,type WriteReceipt} from '../write-receipt';
import {useInputProtection} from '../navigation/InputProtection';
import {useSceneFocus} from '../navigation/TabScene';
import {SafetyActions} from './SafetyActions';
import {useCallback,useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {Alert,AppState,Text,View} from 'react-native';
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
 const zh=language==='zh',c=palette[dark?'dark':'light'],profile=useSyncExternalStore(session.subscribe,session.snapshot).profile;
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
 return <View style={styles.stack}>
  <Button variant="ghost" isDisabled={busy} onPress={back}>{zh?'返回校园墙':'Back to wall'}</Button>
  <Button variant="secondary" isDisabled={frozen} onPress={()=>void load()}>{busy?(zh?'更新中…':'Updating…'):(zh?'刷新帖子与回复':'Refresh post and replies')}</Button>
  {reviewOnly?<Button variant="secondary" onPress={()=>protectInput(onBack)}>{zh?'返回列表核对已保存内容':'Return to check saved content'}</Button>:null}
  {error?<Text accessibilityRole="alert" style={[styles.body,{color:c.danger}]}>{error}</Text>:null}
  {pending.current&&!reviewOnly?<Button isDisabled={busy} onPress={()=>void run()}>{zh?'重试确认上次操作':'Retry last operation'}</Button>:null}
  {post?<>
   <Text style={[styles.caption,{color:c.muted}]}>{zh?'本地演示':'Local demo'} · {post.visibility==='public'?(zh?'公开，访客可见':'Public, including visitors'):(zh?'登录可见（非在籍认证）':'Signed-in users (not school verified)')}</Text>
   <Text style={[styles.title,{color:c.text}]}>{post.title}</Text>
   <Text style={[styles.body,{color:c.text}]}>{postStatus(post.status,zh)}</Text>
   <Text style={[styles.caption,{color:c.muted}]}>{post.author.display_name} · {zh?'更新于':'Updated'} {dateTimeInZone(post.updated_at,'Asia/Hong_Kong')} HKT</Text>
   <Text selectable style={[styles.body,{color:c.text}]}>{post.body}</Text>
   <SafetyActions target={{kind:'post',id:post.id}} author={post.author} language={language} dark={dark} disabled={frozen} onChanged={()=>void load()}/>
   {post.is_mine?<>
    <Button variant="secondary" isDisabled={frozen} onPress={()=>setEditing(true)}>{zh?'编辑帖子':'Edit post'}</Button>
    <Button variant="secondary" isDisabled={frozen} onPress={()=>act('','PATCH',{version:post.version,status:post.status==='open'?(post.kind==='help'?'resolved':'closed'):'open'})}>{post.status!=='open'?(zh?'重新开放回复':'Reopen replies'):post.kind==='help'?(zh?'问题已解决':'Mark as resolved'):(zh?'结束讨论':'Close discussion')}</Button>
    <Button variant="ghost" isDisabled={frozen} onPress={()=>confirm(zh?'删除帖子及所有回复？':'Delete this post and all replies?',zh?'删除后不能恢复，消息中的帖子预览也会移除。':'This cannot be undone. Post previews in messages will also be removed.',()=>act('','DELETE',{version:post.version},onBack))}>{zh?'删除帖子':'Delete post'}</Button>
   </>:null}
   <Text style={[styles.heading,{color:c.text}]}>{zh?'回复':'Replies'}</Text>
   {!profile?<Button onPress={onLogin}>{zh?'登录后回复':'Sign in to reply'}</Button>:post.status==='open'?<>
    <Input accessibilityLabel={zh?'回复内容':'Reply text'} value={text} onChangeText={setText} editable={!frozen} multiline maxLength={2000} placeholder={zh?'分享你知道的，不用想得很正式。':'Share what you know, in your own words.'} style={[styles.input,{color:c.text,borderColor:c.border,minHeight:100,textAlignVertical:'top'}]}/>
    <Text style={[styles.caption,{color:c.muted}]}>{zh?'回复与帖子具有相同可见范围。':'Replies have the same visibility as the post.'}</Text>
    <Button isDisabled={frozen||!text.trim()} onPress={()=>act('/replies','POST',{body:text},()=>setText(''))}>{zh?'发布回复':'Post reply'}</Button>
   </>:<Text style={[styles.body,{color:c.muted}]}>{zh?'已暂停新回复，作者可以重新开放。':'New replies are closed. The author can reopen them.'}</Text>}
   {!replies.length?<Text style={[styles.body,{color:c.muted}]}>{zh?'还没有回复。':'No replies yet.'}</Text>:null}
   {replies.map(r=><Card key={r.id} style={[styles.card,{backgroundColor:c.surface}]}>
    <Text style={[styles.caption,{color:c.muted}]}>{r.author.display_name} · {dateTimeInZone(r.created_at,'Asia/Hong_Kong')} HKT</Text>
    <Text selectable style={[styles.body,{color:c.text}]}>{r.body}</Text>
    <SafetyActions target={{kind:'reply',id:String(r.id)}} author={r.author} language={language} dark={dark} disabled={frozen} onChanged={()=>void load()}/>
    {r.is_mine?<Button variant="ghost" isDisabled={frozen} onPress={()=>confirm(zh?'删除这条回复？':'Delete this reply?',r.body,()=>act(`/replies/${r.id}`,'DELETE',{version:r.version}))}>{zh?'删除我的回复':'Delete my reply'}</Button>:null}
   </Card>)}
   {cursor?<Button variant="secondary" isDisabled={frozen} onPress={()=>void load(cursor)}>{zh?'加载较早回复':'Load earlier replies'}</Button>:null}
  </>:null}
 </View>;
}

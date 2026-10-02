import {useCallback,useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {Alert,AppState,Text,View} from 'react-native';
import {Button} from 'heroui-native/button';
import {Card} from 'heroui-native/card';
import {Input} from 'heroui-native/input';
import {session} from '../runtime';
import {ApiFailure} from '../api';
import {palette,styles} from '../theme';
import type {Language} from '../strings';
import type {Activity,ActivityComment,Participation} from '../../../../src/product/social/types';
import {dateTimeInZone,newWriteKey} from '../study/dates';
import {socialError,participationLabel} from './shared';
import {ActivityForm} from './ActivityForm';
type Pending={path:string;method:string;body:unknown;key:string;after?:()=>void};
export function ActivityDetail({id,language,dark,onBack,onLogin,onNavigate}:{id:string;language:Language;dark:boolean;onBack:()=>void;onLogin:()=>void;onNavigate:()=>void}){
 const zh=language==='zh',c=palette[dark?'dark':'light'],profile=useSyncExternalStore(session.subscribe,session.snapshot).profile;
 const [activity,setActivity]=useState<Activity|null>(null),[comments,setComments]=useState<ActivityComment[]>([]),[cursor,setCursor]=useState<number|null>(null),[roster,setRoster]=useState<(Participation&{user:{id:string;display_name:string}})[]>([]);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[reply,setReply]=useState(''),[editing,setEditing]=useState(false),[saveOnJoin,setSaveOnJoin]=useState(false);
 useEffect(onNavigate,[editing,onNavigate]);
 const pending=useRef<Pending|null>(null),lock=useRef(false),epoch=useRef(0);
 const load=useCallback(async()=>{const generation=++epoch.current;setBusy(true);try{
  const [a,m]=await Promise.all([session.request<Activity>(`/activities/${id}`),session.request<{items:ActivityComment[];next_cursor:number|null}>(`/activities/${id}/comments`)]);
  const people=a.mine?.is_organizer?await session.request<(Participation&{user:{id:string;display_name:string}})[]>(`/activities/${id}/participants`):[];
  if(generation===epoch.current){setActivity(a);setComments(m.items);setCursor(m.next_cursor);setRoster(people);setError('');}
 }catch(e){if(generation===epoch.current){setActivity(null);setComments([]);setRoster([]);setError(socialError(e,language));}}finally{if(generation===epoch.current)setBusy(false);}},[id,language]);
 useEffect(()=>{if(editing)return;void load();const s=AppState.addEventListener('change',state=>{if(state==='active'&&!pending.current&&!lock.current)void load();});return()=>{epoch.current++;s.remove();};},[load,editing]);
 async function perform(next?:Pending){if(lock.current)return;lock.current=true;setBusy(true);setError('');if(next)pending.current=next;const action=pending.current;if(!action){lock.current=false;setBusy(false);return;}
  try{await session.request(action.path,{method:action.method,body:action.body,idempotencyKey:action.key});pending.current=null;action.after?.();if(!(action.method==='DELETE'&&action.path===`/activities/${id}`))await load();}
  catch(e){if(e instanceof ApiFailure&&e.status>0&&e.status<500)pending.current=null;setError(socialError(e,language));}finally{lock.current=false;setBusy(false);}
 }
 const act=(suffix:string,method:string,body:unknown,after?:()=>void)=>void perform({path:`/activities/${id}${suffix}`,method,body,key:newWriteKey(),after});
 const confirm=(title:string,body:string,action:()=>void)=>Alert.alert(title,body,[{text:zh?'返回':'Back',style:'cancel'},{text:zh?'确认':'Confirm',style:'destructive',onPress:action}]);
 const frozen=busy||pending.current!==null;
 async function more(){if(cursor===null||frozen)return;setBusy(true);try{const m=await session.request<{items:ActivityComment[];next_cursor:number|null}>(`/activities/${id}/comments?cursor=${cursor}`);setComments(old=>[...old,...m.items.filter(x=>!old.some(y=>y.id===x.id))]);setCursor(m.next_cursor);}catch(e){setError(socialError(e,language));}finally{setBusy(false);}}
 if(editing&&activity)return <ActivityForm initial={activity} language={language} dark={dark} onBack={()=>setEditing(false)} onSaved={()=>setEditing(false)}/>;
 const mine=activity?.mine,part=mine?.participation,participating=part&&['confirmed','waitlisted'].includes(part.status);
 const prefs=(changes:object)=>act('/preferences','PUT',{bookmarked:mine?.bookmarked??false,calendar_saved:mine?.calendar_saved??false,remind_minutes:mine?.remind_minutes??null,...changes});
 return <View style={styles.stack}>
  <Button variant="ghost" onPress={onBack}>{zh?'返回':'Back'}</Button>
  <Button variant="secondary" isDisabled={frozen} onPress={()=>void load()}>{busy?(zh?'更新中…':'Updating…'):(zh?'刷新活动状态':'Refresh activity')}</Button>
  {error?<Text accessibilityRole="alert" style={[styles.body,{color:c.danger}]}>{error}</Text>:null}
  {pending.current?<Button isDisabled={busy} onPress={()=>void perform()}>{zh?'重试确认操作结果':'Retry to confirm action'}</Button>:null}
  {activity?<>
   <Text style={[styles.caption,{color:c.muted}]}>{zh?'本地演示活动':'Local demo activity'} · {activity.visibility==='public'?(zh?'公开':'Public'):(zh?'登录用户可见，非在籍认证':'Signed-in users, not school verified')}</Text>
   <Text style={[styles.title,{color:c.text}]}>{activity.title}</Text>
   <Text style={[styles.body,{color:c.text}]}>{activity.status==='cancelled'?(zh?'已取消':'Cancelled'):activity.ended?(zh?'已结束':'Ended'):activity.started?(zh?'进行中，报名已结束':'In progress, signups ended'):activity.status==='closed'?(zh?'报名已关闭，活动仍保留':'Signups closed; activity remains scheduled'):(zh?'开放报名':'Open for signup')}</Text>
   <Text style={[styles.body,{color:c.text}]}>{dateTimeInZone(activity.starts_at,'Asia/Hong_Kong')} → {dateTimeInZone(activity.ends_at,'Asia/Hong_Kong')} HKT</Text>
   <Text style={[styles.body,{color:c.text}]}>{activity.location}</Text>
   <Text style={[styles.body,{color:c.text}]}>{zh?'组织者':'Organizer'}: {activity.organizer.display_name}\n{zh?'已确认':'Confirmed'} {activity.counts.confirmed}/{activity.capacity} · {zh?'候补':'Waitlist'} {activity.counts.waitlisted}</Text>
   <Text style={[styles.caption,{color:c.muted}]}>{zh?'名额不含组织者。候补按加入顺序自动递补，可随时退出。':'Places exclude the organizer. Waitlist promotion is automatic in join order; you can withdraw.'}</Text>
   <Text style={[styles.body,{color:c.text}]}>{activity.languages.map(l=>l==='en'?'English':l==='yue'?(zh?'粤语':'Cantonese'):(zh?'普通话':'Mandarin')).join(' / ')} · {activity.interaction==='quiet'?(zh?'安静共处':'Quiet company'):activity.interaction==='casual'?(zh?'随意交流':'Casual conversation'):(zh?'主动讨论／协作':'Active collaboration')}</Text>
   <Text style={[styles.body,{color:c.text}]}>{activity.cost_minor===0?(zh?'免费':'Free'):`HK$ ${(activity.cost_minor/100).toFixed(2)} ${zh?'／人（仅费用说明，不收款）':'per person (informational, no payment collected)'}`}</Text>
   {activity.description?<Text selectable style={[styles.body,{color:c.text}]}>{activity.description}</Text>:null}
   {activity.requirements?<Text selectable style={[styles.body,{color:c.text}]}>{zh?'参与须知':'Requirements'}: {activity.requirements}</Text>:null}
   {!profile?<Button onPress={onLogin}>{zh?'登录后报名／收藏':'Sign in to join / save'}</Button>:<>
    {part?<Text accessibilityRole="text" style={[styles.heading,{color:c.text}]}>{participationLabel(part.status,zh)}{part.waitlist_position?` · ${zh?'排位':'Position'} ${part.waitlist_position}`:''}</Text>:null}
    {!mine?.is_organizer&&!participating&&activity.status==='open'&&!activity.started?<><Button variant="secondary" isDisabled={frozen} onPress={()=>setSaveOnJoin(!saveOnJoin)}>{saveOnJoin?(zh?'✓ 同时保存到个人日程':'✓ Also save to my calendar'):(zh?'同时保存到个人日程：关':'Also save to my calendar: off')}</Button><Button isDisabled={frozen} onPress={()=>act('/join','POST',{activity_version:activity.version,save_calendar:saveOnJoin})}>{activity.counts.remaining?(zh?'报名参加':'Join activity'):(zh?'加入候补':'Join waitlist')}</Button></>:null}
    {participating?<Button variant="secondary" isDisabled={frozen} onPress={()=>confirm(zh?'退出活动？':'Withdraw?',zh?'退出将释放名额，并移除你保存的活动日程及提醒设置。':'This releases your place and removes your saved activity schedule and reminder setting.',()=>act('/withdraw','POST',{participation_version:part!.version}))}>{zh?'退出报名／候补':'Withdraw participation'}</Button>:null}
    <Button variant="secondary" isDisabled={frozen} onPress={()=>prefs({bookmarked:!mine?.bookmarked})}>{mine?.bookmarked?(zh?'✓ 已收藏，点击移除':'✓ Bookmarked, tap to remove'):(zh?'收藏活动':'Bookmark activity')}</Button>
    {activity.status!=='cancelled'?<Button variant="secondary" isDisabled={frozen} onPress={()=>prefs({calendar_saved:!mine?.calendar_saved,remind_minutes:null})}>{mine?.calendar_saved?(zh?'✓ 已保存日程，点击移除':'✓ In my calendar, tap to remove'):(zh?'保存到个人日程（不等于报名）':'Save to my calendar (does not join)')}</Button>:null}
    {mine?.is_organizer?<>
     {!activity.started&&activity.status!=='cancelled'?<><Button variant="secondary" isDisabled={frozen} onPress={()=>setEditing(true)}>{zh?'编辑／改期':'Edit / reschedule'}</Button><Button variant="secondary" isDisabled={frozen} onPress={()=>act('','PATCH',{version:activity.version,status:activity.status==='open'?'closed':'open'})}>{activity.status==='open'?(zh?'关闭报名':'Close signups'):(zh?'重新开放报名':'Reopen signups')}</Button><Button variant="secondary" isDisabled={frozen} onPress={()=>confirm(zh?'取消活动？':'Cancel activity?',zh?'所有参与者会收到站内通知，已保存的日程会移除。取消后不能恢复。':'Participants receive an in-app notice and saved schedules are removed. Cancellation is final.',()=>act('/cancel','POST',{version:activity.version}))}>{zh?'取消活动':'Cancel activity'}</Button></>:null}
     <Button variant="ghost" isDisabled={frozen} onPress={()=>confirm(zh?'删除活动及评论？':'Delete activity and comments?',zh?'活动内容、评论和参与记录将删除，其他用户会看到内容已移除。':'Activity content, comments and participation records are deleted. Others see that content was removed.',()=>act('','DELETE',{version:activity.version},onBack))}>{zh?'删除活动':'Delete activity'}</Button>
     <Text style={[styles.heading,{color:c.text}]}>{zh?'参与名单（仅组织者可见）':'Participation roster (organizer only)'}</Text>
     {roster.map(p=><Text key={p.user.id} style={[styles.body,{color:c.text}]}>{p.user.display_name} · {participationLabel(p.status,zh)}</Text>)}
    </>:null}
   </>}
   <Text style={[styles.heading,{color:c.text}]}>{zh?'活动讨论':'Activity discussion'}</Text>
   {profile&&!activity.ended&&activity.status!=='cancelled'?<><Input accessibilityLabel={zh?'发表评论':'Write a comment'} value={reply} editable={!frozen} onChangeText={setReply} multiline placeholder={zh?'询问条件、集合方式……':'Ask about requirements, meeting details…'} style={[styles.input,{color:c.text,borderColor:c.border,minHeight:90}]}/><Text style={[styles.caption,{color:c.muted}]}>{zh?'评论与活动具有相同可见范围。':'Comments have the same visibility as this activity.'}</Text><Button isDisabled={frozen||!reply.trim()} onPress={()=>act('/comments','POST',{body:reply},()=>setReply(''))}>{zh?'发布评论':'Post comment'}</Button></>:null}
   {!comments.length?<Text style={[styles.body,{color:c.muted}]}>{zh?'还没有评论。':'No comments yet.'}</Text>:null}
   {comments.map(m=><Card key={m.id} style={[styles.card,{backgroundColor:c.surface}]}><Text style={[styles.caption,{color:c.muted}]}>{m.author.display_name} · {dateTimeInZone(m.created_at,'Asia/Hong_Kong')}</Text><Text selectable style={[styles.body,{color:c.text}]}>{m.body}</Text>{m.can_delete?<Button variant="ghost" isDisabled={frozen} onPress={()=>confirm(zh?'删除评论？':'Delete comment?',m.body,()=>act(`/comments/${m.id}`,'DELETE',{version:m.version}))}>{zh?'删除我的评论':'Delete my comment'}</Button>:null}</Card>)}
   {cursor!==null?<Button variant="secondary" isDisabled={frozen} onPress={()=>void more()}>{zh?'加载较早评论':'Load earlier comments'}</Button>:null}
  </>:null}
 </View>;
}

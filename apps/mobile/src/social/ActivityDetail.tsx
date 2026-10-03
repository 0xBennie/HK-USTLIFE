import {ReconnectionScreen} from './ReconnectionScreen';
import {writeReceipt,ensureReplayable,writeRejected,reviewRequired,type WriteReceipt} from '../write-receipt';
import {useInputProtection} from '../navigation/InputProtection';
import {useSceneFocus} from '../navigation/TabScene';
import {ReminderPicker} from '../reminders/ReminderControls';
import {SafetyActions} from './SafetyActions';
import {useCallback,useEffect,useMemo,useRef,useState,useSyncExternalStore} from 'react';
import {Alert,AppState,Image,Share,Text,View} from 'react-native';
import Svg,{Defs,LinearGradient,Rect,Stop} from 'react-native-svg';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useSceneBottomBar} from '../navigation/SceneOverlay';
import {BottomBar,CircleButton,InitialAvatar,ListGroup,ListRow,PrimaryButton,Tag,TextAction,usePenColors} from '../ui/Pen';
import {activityCover,dateRange,interactionLabel,languageLabel} from './covers';
import { Button } from '../ui/Primitives';
import { Input } from '../ui/Primitives';
import {session} from '../runtime';
import {ApiFailure} from '../api';
import {styles} from '../theme';
import type {Language} from '../strings';
import type {Activity,ActivityComment,Participation} from '../../../../src/product/social/types';
import {dateTimeInZone,newWriteKey} from '../study/dates';
import {socialError,participationLabel} from './shared';
import {ActivityForm} from './ActivityForm';
import {ActivityJoinController} from './activity-join';
import {JoinActivitySheet} from './JoinActivitySheet';
type Pending=WriteReceipt&{path:string;method:string;after?:()=>void};
export function ActivityDetail({id,language,dark,onBack,onLogin,onNavigate}:{id:string;language:Language;dark:boolean;onBack:()=>void;onLogin:()=>void;onNavigate:()=>void}){
 const sceneActive=useSceneFocus();
 const zh=language==='zh',c=usePenColors(),insets=useSafeAreaInsets(),profile=useSyncExternalStore(session.subscribe,session.snapshot).profile;
 const [activity,setActivity]=useState<Activity|null>(null),[comments,setComments]=useState<ActivityComment[]>([]),[cursor,setCursor]=useState<number|null>(null),[roster,setRoster]=useState<(Participation&{user:{id:string;display_name:string}})[]>([]);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[reply,setReply]=useState(''),[editing,setEditing]=useState(false),[joinVisible,setJoinVisible]=useState(false);
 const joinController=useMemo(()=>new ActivityJoinController((path,options)=>session.request(path,options),newWriteKey),[id]);
 const joinState=useSyncExternalStore(joinController.subscribe,joinController.snapshot);
 const joinPending=joinState.phase==='submitting'||joinState.phase==='uncertain';
 useEffect(()=>{if(joinState.phase==='result'&&joinState.activity)setActivity(joinState.activity);},[joinState]);
 useEffect(onNavigate,[editing,onNavigate]);
 const [reviewOnly,setReviewOnly]=useState(false);
 const [recontact,setRecontact]=useState<{id:string;display_name:string}|null>(null);
 const pending=useRef<Pending|null>(null),lock=useRef(false),epoch=useRef(0),alive=useRef(true);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;epoch.current++;};},[]);
 const protectInput=useInputProtection({reply},busy||joinState.phase==='submitting',pending.current!==null||joinState.phase==='uncertain',zh);
 const load=useCallback(async(afterWrite=false)=>{const generation=++epoch.current;setBusy(true);try{
  const [a,m]=await Promise.all([session.request<Activity>(`/activities/${id}`),session.request<{items:ActivityComment[];next_cursor:number|null}>(`/activities/${id}/comments`)]);
  const people=a.mine?.is_organizer?await session.request<(Participation&{user:{id:string;display_name:string}})[]>(`/activities/${id}/participants`):[];
  if(generation===epoch.current){setActivity(a);setComments(m.items);setCursor(m.next_cursor);setRoster(people);setError('');}
 }catch(e){if(generation===epoch.current){setActivity(null);setComments([]);setRoster([]);setError(afterWrite&&(!(e instanceof ApiFailure)||e.status===0||e.status>=500)?(zh?'操作已保存，但暂时无法刷新详情。请稍后刷新；这不会撤销已完成的操作。':'The change was saved, but details could not refresh. Refresh later; this does not undo the completed action.'):socialError(e,language));}}finally{if(generation===epoch.current)setBusy(false);}},[id,language]);
 useEffect(()=>{if(!sceneActive||editing)return;if(!pending.current&&!lock.current&&!joinPending)void load();const s=AppState.addEventListener('change',state=>{if(state==='active'&&!pending.current&&!lock.current&&!['submitting','uncertain'].includes(joinController.snapshot().phase))void load();});return()=>{epoch.current++;s.remove();};},[load,editing,joinController,sceneActive]);
 async function perform(next?:Pending){if(lock.current)return;lock.current=true;setBusy(true);setError('');if(next)pending.current=next;const action=pending.current;if(!action){lock.current=false;setBusy(false);return;}
  try{ensureReplayable(action,action.method);await session.request(action.path,{method:action.method,body:action.body,idempotencyKey:action.key});if(!alive.current)return;pending.current=null;action.after?.();if(!(action.method==='DELETE'&&action.path===`/activities/${id}`))await load(true);}
  catch(e){if(!alive.current)return;if(writeRejected(e))pending.current=null;setReviewOnly(reviewRequired(e));setError(socialError(e,language));}finally{lock.current=false;if(alive.current)setBusy(false);}
 }
 const act=(suffix:string,method:string,body:unknown,after?:()=>void)=>{if(lock.current||pending.current)return;void perform({path:`/activities/${id}${suffix}`,method,...writeReceipt(body,newWriteKey()),after});};
 const confirm=(title:string,body:string,action:()=>void)=>Alert.alert(title,body,[{text:zh?'返回':'Back',style:'cancel'},{text:zh?'确认':'Confirm',style:'destructive',onPress:action}]);
 const frozen=busy||pending.current!==null||joinPending;
 async function more(){if(cursor===null||frozen)return;setBusy(true);try{const m=await session.request<{items:ActivityComment[];next_cursor:number|null}>(`/activities/${id}/comments?cursor=${cursor}`);setComments(old=>[...old,...m.items.filter(x=>!old.some(y=>y.id===x.id))]);setCursor(m.next_cursor);}catch(e){setError(socialError(e,language));}finally{setBusy(false);}}
 const mine=activity?.mine,part=mine?.participation,participating=part&&['confirmed','waitlisted'].includes(part.status);
 const canReconnect=!!profile&&!!activity?.ended&&activity.status!=='cancelled'&&(mine?.is_organizer||part?.status==='confirmed');
 const reconnect=(peer:{id:string;display_name:string})=>protectInput(()=>{setRecontact(peer);onNavigate();});
 const prefs=(changes:object)=>act('/preferences','PUT',{bookmarked:mine?.bookmarked??false,calendar_saved:mine?.calendar_saved??false,remind_minutes:mine?.remind_minutes??null,...changes});
 const canJoin=!!activity&&!mine?.is_organizer&&!participating&&activity.status==='open'&&!activity.started;
 const statusText=!activity?'':activity.status==='cancelled'?(zh?'已取消':'Cancelled'):activity.ended?(zh?'已结束':'Ended'):activity.started?(zh?'进行中，报名已结束':'In progress, signups ended'):activity.status==='closed'?(zh?'报名已关闭，活动仍保留':'Signups closed; activity remains scheduled'):(zh?'开放报名':'Open for signup');
 const withdraw=()=>confirm(zh?'退出活动？':'Withdraw?',zh?'退出将释放名额，并移除你保存的活动日程及提醒设置。':'This releases your place and removes your saved activity schedule and reminder setting.',()=>act('/withdraw','POST',{participation_version:part!.version}));
 // Pen lAQTw "Bottom bar": calendar circle + one primary action + one quiet line. Replaces the tab bar while this page is open.
 const bar=!activity||recontact||editing?null:<BottomBar>
  <View style={{flexDirection:'row',alignItems:'center',gap:10}}>
   {profile&&activity.status!=='cancelled'?<CircleButton variant="fill" icon={mine?.calendar_saved?'calendar-check':'calendar-plus'} color={mine?.calendar_saved?c.accent:c.text} disabled={frozen} label={mine?.calendar_saved?(zh?'已保存日程，点击移除':'In my calendar, tap to remove'):(zh?'保存到个人日程（不等于报名）':'Save to my calendar (does not join)')} onPress={()=>prefs({calendar_saved:!mine?.calendar_saved,remind_minutes:null})}/>:null}
   {!profile?<PrimaryButton label={zh?'登录后报名':'Sign in to join'} onPress={onLogin}/>
    :joinPending?<PrimaryButton tone="soft" label={zh?'查看操作进度':'View request status'} onPress={()=>setJoinVisible(true)}/>
    :canJoin?<PrimaryButton label={zh?'看看报名安排':'Review and join'} disabled={frozen} onPress={()=>{joinController.review(activity);setJoinVisible(true);}}/>
    :mine?.is_organizer&&!activity.started&&activity.status!=='cancelled'?<PrimaryButton tone="soft" label={zh?'修改时间与地点':'Edit time and place'} disabled={frozen} onPress={()=>setEditing(true)}/>
    :<PrimaryButton tone="soft" disabled label={part?`${participationLabel(part.status,zh)}${part.waitlist_position?` · ${zh?'第':'#'}${part.waitlist_position}${zh?' 位':''}`:''}`:statusText} onPress={()=>{}}/>}
  </View>
  {participating?<TextAction color={c.danger} disabled={frozen} label={part!.status==='waitlisted'?(zh?'退出候补':'Leave waitlist'):(zh?'退出报名':'Withdraw')} onPress={withdraw}/>
   :canJoin||!profile?<Text style={{minHeight:36,textAlign:'center',textAlignVertical:'center',paddingTop:7,fontSize:16,lineHeight:23,fontWeight:'600',color:c.muted}}>{zh?'候补按顺序递补，报名后可随时退出':'Waitlist moves in order; you can withdraw anytime'}</Text>:null}
 </BottomBar>;
 useSceneBottomBar(bar);
 if(recontact)return <ReconnectionScreen activityId={id} peer={recontact} language={language} dark={dark} onBack={()=>{setRecontact(null);void load();}}/>;
 if(editing&&activity)return <ActivityForm initial={activity} language={language} dark={dark} onBack={()=>setEditing(false)} onSaved={()=>setEditing(false)}/>;
 const top=insets.top+6;
 return <View style={{gap:20}}>
  {/* Pen "Hero image": 280pt full-bleed photo under the status bar, top gradient, glass circle buttons. */}
  <View style={{height:280,marginTop:-top,marginHorizontal:-16,marginBottom:-6,backgroundColor:c.fill}}>
   {activity?<Image source={activityCover(activity,'hero')} resizeMode="cover" accessible={false} style={{position:'absolute',width:'100%',height:'100%'}}/>:null}
   <Svg pointerEvents="none" style={{position:'absolute',width:'100%',height:'100%'}}><Defs><LinearGradient id="heroShade" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#000000" stopOpacity={0.45}/><Stop offset="0.5" stopColor="#000000" stopOpacity={0}/></LinearGradient></Defs><Rect x="0" y="0" width="100%" height="100%" fill="url(#heroShade)"/></Svg>
   <View style={{paddingTop:top,paddingHorizontal:16,flexDirection:'row',justifyContent:'space-between'}}>
    <CircleButton variant="overlay" icon="chevron-left" label={zh?'返回发现':'Back to Discover'} onPress={()=>protectInput(onBack)}/>
    {activity?<View style={{flexDirection:'row',gap:10}}>
     <CircleButton variant="overlay" icon="share" label={zh?'分享活动':'Share activity'} onPress={()=>void Share.share({message:`${activity.title}\n${dateRange(activity.starts_at,activity.ends_at,zh)} · ${activity.location}`})}/>
     <CircleButton variant="overlay" icon={mine?.bookmarked?'bookmark-check':'bookmark'} color={mine?.bookmarked?c.accent:undefined} disabled={!!profile&&frozen} label={mine?.bookmarked?(zh?'已收藏，点击移除':'Bookmarked, tap to remove'):(zh?'收藏活动':'Bookmark activity')} onPress={()=>profile?prefs({bookmarked:!mine?.bookmarked}):onLogin()}/>
    </View>:null}
   </View>
  </View>
  {reviewOnly?<Button variant="secondary" onPress={()=>protectInput(onBack)}>{zh?'返回列表核对已保存内容':'Return to check saved content'}</Button>:null}
  {error?<View style={{gap:8,padding:16,borderRadius:14,backgroundColor:c.surface}}><Text accessibilityRole="alert" style={{fontSize:15,lineHeight:22,color:c.danger}}>{error}</Text>{pending.current&&!reviewOnly?<Button isDisabled={busy} onPress={()=>void perform()}>{zh?'重试确认操作结果':'Retry to confirm action'}</Button>:<Button variant="secondary" isDisabled={frozen} onPress={()=>void load()}>{zh?'重新读取':'Reload'}</Button>}</View>:null}
  {joinPending?<View style={{padding:16,borderRadius:14,backgroundColor:c.tint}}><Text accessibilityRole="alert" style={{fontSize:15,lineHeight:22,color:c.text}}>{joinState.phase==='submitting'?(zh?'正在核对报名结果…':'Checking your signup…'):(zh?'有一笔报名结果尚未确认。':'One signup result is still unconfirmed.')}</Text></View>:null}
  {activity?<>
   <View style={{paddingHorizontal:4,gap:6}}>
    <Tag label={`${interactionLabel(activity.interaction,zh)} · ${zh?'本地演示':'Local demo'}`}/>
    <Text accessibilityRole="header" style={{fontSize:30,lineHeight:36,fontWeight:'700',color:c.text}}>{activity.title}</Text>
    <Text style={{fontSize:16,lineHeight:23,color:c.muted}}>{statusText}{activity.visibility==='members'?(zh?' · 登录用户可见':' · Signed-in users'):''}</Text>
   </View>
   <View style={{flexDirection:'row',alignItems:'center',gap:10,paddingHorizontal:4}}>
    <InitialAvatar name={activity.organizer.display_name}/>
    <Text style={{flex:1,fontSize:14,lineHeight:20,color:c.muted}}>{zh?`由 ${activity.organizer.display_name} 发起`:`Hosted by ${activity.organizer.display_name}`}{!profile?(zh?' · 登录后可报名':' · Sign in to join'):part?` · ${participationLabel(part.status,zh)}`:''}</Text>
   </View>
   <ListGroup>
    <ListRow icon="calendar-days" tile={c.red} title={dateRange(activity.starts_at,activity.ends_at,zh)} subtitle={zh?'香港时间':'Hong Kong time'}/>
    <ListRow icon="map-pin" tile={c.accent} title={activity.location} subtitle={zh?'集合地点':'Meeting point'}/>
    <ListRow icon="languages" tile={c.purple} title={`${interactionLabel(activity.interaction,zh)} · ${languageLabel(activity.languages,zh)}`} subtitle={zh?'参与方式':'How it works'}/>
    <ListRow icon="users" tile={c.green} title={`${activity.counts.confirmed} / ${activity.capacity} ${zh?'人已确认':'confirmed'} · ${activity.cost_minor===0?(zh?'免费':'Free'):`HK$ ${(activity.cost_minor/100).toFixed(2)}`}`} subtitle={`${zh?'名额与费用':'Places and cost'}${activity.counts.waitlisted?` · ${zh?'候补':'Waitlist'} ${activity.counts.waitlisted}`:''}${activity.cost_minor?(zh?' · 仅说明，不收款':' · informational, no payment'):''}`}/>
   </ListGroup>
   {activity.description||activity.requirements?<View style={{padding:16,gap:8,borderRadius:14,backgroundColor:c.surface}}>
    <Text style={{fontSize:17,lineHeight:25,fontWeight:'600',color:c.text}}>{zh?'这次一起做什么':'What we’ll do'}</Text>
    {activity.description?<Text selectable style={{fontSize:16,lineHeight:25,color:c.muted}}>{activity.description}</Text>:null}
    {activity.requirements?<Text selectable style={{fontSize:16,lineHeight:25,color:c.muted}}>{zh?'参与须知：':'Requirements: '}{activity.requirements}</Text>:null}
    <Text style={{fontSize:13,lineHeight:19,color:c.muted}}>{zh?'名额不含组织者。候补按加入顺序自动递补，可随时退出。':'Places exclude the organizer. Waitlist promotion is automatic in join order; you can withdraw.'}</Text>
   </View>:null}
   {mine?.calendar_saved&&activity.status!=='cancelled'?<View style={{padding:16,borderRadius:14,backgroundColor:c.surface}}><ReminderPicker value={mine.remind_minutes} onChange={value=>void prefs({remind_minutes:value})} language={language} dark={dark} disabled={frozen}/></View>:null}
   {mine?.is_organizer?<>
    <ListGroup header={zh?'参与情况':'Participation'}>
     <ListRow title={`${zh?'已确认':'Confirmed'} ${activity.counts.confirmed} / ${activity.capacity}`} subtitle={zh?'仅组织者可见':'Visible to the organizer only'}/>
     {roster.map(p=><ListRow key={p.user.id} title={p.user.display_name} value={participationLabel(p.status,zh)}/>)}
    </ListGroup>
    <ListGroup header={zh?'管理':'Manage'}>
     {!activity.started&&activity.status!=='cancelled'?<ListRow title={activity.status==='open'?(zh?'关闭报名':'Close signups'):(zh?'重新开放报名':'Reopen signups')} chevron disabled={frozen} onPress={()=>act('','PATCH',{version:activity.version,status:activity.status==='open'?'closed':'open'})}/>:null}
     {!activity.started&&activity.status!=='cancelled'?<ListRow title={zh?'取消活动':'Cancel activity'} subtitle={zh?'取消报名状态与相关提醒':'Notifies participants and removes saved schedules'} titleColor={c.danger} disabled={frozen} onPress={()=>confirm(zh?'取消活动？':'Cancel activity?',zh?'所有参与者会收到站内通知，已保存的日程会移除。取消后不能恢复。':'Participants receive an in-app notice and saved schedules are removed. Cancellation is final.',()=>act('/cancel','POST',{version:activity.version}))}/>:null}
     <ListRow title={zh?'删除活动':'Delete activity'} titleColor={c.danger} disabled={frozen} onPress={()=>confirm(zh?'删除活动及评论？':'Delete activity and comments?',zh?'活动内容、评论和参与记录将删除，其他用户会看到内容已移除。':'Activity content, comments and participation records are deleted. Others see that content was removed.',()=>act('','DELETE',{version:activity.version},onBack))}/>
    </ListGroup>
   </>:null}
   <ListGroup header={zh?'活动讨论':'Discussion'}>
    {!comments.length?<ListRow icon="message-circle" tile={c.gray} title={zh?'还没有评论':'No comments yet'} subtitle={zh?'有问题可以在这里问':'Ask questions here'}/>:null}
    {comments.map(m=><View key={m.id} style={{padding:16,gap:6,backgroundColor:c.surface,borderBottomWidth:0.5,borderBottomColor:c.border}}>
     <View style={{flexDirection:'row',alignItems:'center',gap:8}}><InitialAvatar name={m.author.display_name} size={22}/><Text style={{fontSize:13,lineHeight:19,color:c.muted}}>{m.author.display_name} · {dateRange(m.created_at,m.created_at,zh).split(' · ')[0]}</Text></View>
     <Text selectable style={{fontSize:16,lineHeight:24,color:c.text}}>{m.body}</Text>
     <SafetyActions target={{kind:'activity_comment',id:String(m.id)}} author={m.author} language={language} dark={dark} disabled={frozen} onChanged={()=>void load()}/>
     {canReconnect&&m.author.id!==profile?.id?<Button variant="secondary" isDisabled={frozen} onPress={()=>reconnect(m.author)}>{zh?'与这位同学再次同行':'Meet this person again'}</Button>:null}
     {m.can_delete?<Button variant="ghost" isDisabled={frozen} onPress={()=>confirm(zh?'删除评论？':'Delete comment?',m.body,()=>act(`/comments/${m.id}`,'DELETE',{version:m.version}))}>{zh?'删除我的评论':'Delete my comment'}</Button>:null}
    </View>)}
    {cursor!==null?<ListRow title={zh?'加载较早评论':'Load earlier comments'} titleColor={c.accent} disabled={frozen} onPress={()=>void more()}/>:null}
    {canReconnect&&activity.organizer.id!==profile?.id?<ListRow title={zh?'私下表达再次同行意愿':'Privately express interest in meeting again'} chevron disabled={frozen} onPress={()=>reconnect(activity.organizer)}/>:null}
   </ListGroup>
   {profile&&!activity.ended&&activity.status!=='cancelled'?<View style={{gap:10,padding:16,borderRadius:14,backgroundColor:c.surface}}>
    <Input accessibilityLabel={zh?'发表评论':'Write a comment'} value={reply} editable={!frozen} onChangeText={setReply} multiline placeholder={zh?'询问条件、集合方式……':'Ask about requirements, meeting details…'} style={{minHeight:80,textAlignVertical:'top'}}/>
    <Text style={{fontSize:13,lineHeight:19,color:c.muted}}>{zh?'评论与活动具有相同可见范围。':'Comments have the same visibility as this activity.'}</Text>
    <View style={{flexDirection:'row'}}><PrimaryButton tone="soft" label={zh?'发布评论':'Post comment'} disabled={frozen||!reply.trim()} onPress={()=>act('/comments','POST',{body:reply},()=>setReply(''))}/></View>
   </View>:null}
   <View style={{paddingHorizontal:4}}><SafetyActions target={{kind:'activity',id:activity.id}} author={activity.organizer} language={language} dark={dark} disabled={frozen} onChanged={()=>void load()}/></View>
  </>:busy?<Text style={[styles.body,{color:c.muted,textAlign:'center'}]}>{zh?'正在读取…':'Loading…'}</Text>:null}
  <JoinActivitySheet visible={joinVisible} controller={joinController} state={joinState} language={language} dark={dark} onClose={()=>{setJoinVisible(false);if(joinController.snapshot().phase==='result')void load(true);}} onRefresh={()=>{setJoinVisible(false);void load();}}/>
 </View>;
}

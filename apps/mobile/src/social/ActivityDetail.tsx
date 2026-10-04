import {ReconnectionScreen} from './ReconnectionScreen';
import {writeReceipt,ensureReplayable,writeRejected,reviewRequired,type WriteReceipt} from '../write-receipt';
import {useInputProtection} from '../navigation/InputProtection';
import {useSceneFocus} from '../navigation/TabScene';
import {SafetyActions} from './SafetyActions';
import {useCallback,useEffect,useMemo,useRef,useState,useSyncExternalStore} from 'react';
import {ActionSheetIOS,Alert,AppState,Image,Pressable,Share,Text,TextInput,View} from 'react-native';
import Svg,{Defs,LinearGradient,Rect,Stop} from 'react-native-svg';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useSceneBottomBar} from '../navigation/SceneOverlay';
import {BottomBar,CircleButton,GlassCapsule,InitialAvatar,ListGroup,ListRow,Notice,PenIcon,PrimaryButton,Skeleton,usePenColors,type PenIconName} from '../ui/Pen';
import {GradientAvatar} from './wall-ui';
import {feel} from '../ui/feel';
import {activityCover,dateRange,interactionLabel} from './covers';
import {session} from '../runtime';
import {ApiFailure} from '../api';
import type {Language} from '../strings';
import type {Activity,ActivityComment,Participation} from '../../../../src/product/social/types';
import {dateTimeInZone,newWriteKey} from '../study/dates';
import {socialError,participationLabel} from './shared';
import {ActivityForm} from './ActivityForm';
import {ActivityJoinController} from './activity-join';
import {JoinActivitySheet} from './JoinActivitySheet';
import {costText,dayTitle,hhmm,hk,timeSpan} from './activity-time';
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
 const [recontact,setRecontact]=useState<{id:string;display_name:string}|null>(null),[discussion,setDiscussion]=useState(false);
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
 const withdraw=()=>confirm(zh?(part?.status==='waitlisted'?'退出候补？':'退出活动？'):'Withdraw?',zh?'退出将释放名额，并移除你保存的活动日程及提醒设置。':'This releases your place and removes your saved activity schedule and reminder setting.',()=>act('/withdraw','POST',{participation_version:part!.version}));
 // Reminders need the activity in the personal calendar (server rule), so picking a time also saves it there.
 const reminderLabel=(m:number|null|undefined)=>m==null?(zh?'提醒':'Remind me'):m===0?(zh?'开始时提醒':'At start'):zh?`提前 ${m} 分钟`:`${m} min before`;
 const pickReminder=()=>{const values=[null,0,10,30,60] as const;ActionSheetIOS.showActionSheetWithOptions({title:zh?'什么时候提醒你？':'When should we remind you?',options:[...values.map(v=>v===null?(zh?'不提醒':'No reminder'):reminderLabel(v)),zh?'取消':'Cancel'],cancelButtonIndex:values.length},i=>{if(i<values.length){feel.select();const v=values[i];prefs(v===null?{remind_minutes:null}:{calendar_saved:true,remind_minutes:v});}});};
 const reconnectOpen=!!activity&&Date.parse(activity.ends_at)+7*864e5>Date.now();
 // Comments close when the activity ends or is cancelled (server rule COMMENTS_CLOSED).
 const commentsOpen=!!activity&&!!profile&&!activity.ended&&activity.status!=='cancelled';
 // Pen "V6 / 活动详情（报名卡）" has no tab bar; "V6 / 活动讨论" (p59aZA) floats the comment field like the wall's reply bar.
 useSceneBottomBar(discussion&&commentsOpen?<BottomBar><View style={{flexDirection:'row',alignItems:'flex-end',gap:10}}>
  <GlassCapsule radius={22} style={{flex:1}}><TextInput accessibilityLabel={zh?'发表评论':'Write a comment'} value={reply} onChangeText={setReply} editable={!frozen} multiline maxLength={2000} placeholder={zh?'问问集合方式、要带什么…':'Ask about meeting up or what to bring…'} placeholderTextColor={c.muted} style={{minHeight:44,maxHeight:120,paddingHorizontal:16,paddingTop:12,paddingBottom:12,fontSize:16,color:c.text}}/></GlassCapsule>
  <CircleButton variant="prominent" icon="arrow-up" label={zh?'发布评论':'Post comment'} disabled={frozen||!reply.trim()} onPress={()=>act('/comments','POST',{body:reply},()=>setReply(''))}/>
 </View></BottomBar>:<></>);
 if(recontact)return <ReconnectionScreen activityId={id} peer={recontact} language={language} dark={dark} onBack={()=>{setRecontact(null);void load();}}/>;
 if(editing&&activity)return <ActivityForm initial={activity} language={language} dark={dark} onBack={()=>setEditing(false)} onSaved={()=>setEditing(false)}/>;
 if(discussion&&activity)return <View style={{gap:16}}>
  <View style={{flexDirection:'row',alignItems:'center',minHeight:48}}>
   <CircleButton icon="chevron-left" label={zh?'返回活动':'Back to activity'} onPress={()=>protectInput(()=>{setDiscussion(false);onNavigate();})}/>
   <Text style={{flex:1,textAlign:'center',fontSize:17,fontWeight:'700',color:c.text}}>{zh?'活动讨论':'Discussion'}</Text>
   <View style={{width:44}}/>
  </View>
  {/* Pen "V6 / 活动讨论" (p59aZA): activity name + one-line promise, newest comments first, quiet row actions. */}
  <View style={{paddingHorizontal:4,gap:4}}>
   <Text style={{fontSize:17,fontWeight:'700',color:c.text}}>{activity.title}</Text>
   <Text style={{fontSize:13,lineHeight:18,color:c.muted}}>{zh?'只围绕这次活动交流，不强迫添加好友。':'Talk about this activity only — no friend requests.'}</Text>
  </View>
  {error?<Notice tone="error" text={error} action={pending.current&&!reviewOnly&&!busy?(zh?'再试一次':'Try again'):undefined} onAction={()=>void perform()}/>:null}
  {!comments.length?<View style={{paddingVertical:18,paddingHorizontal:16,gap:4,borderRadius:20,backgroundColor:c.surface}}>
   <Text style={{fontSize:15,fontWeight:'600',color:c.text}}>{zh?'还没有评论':'No comments yet'}</Text>
   {commentsOpen?<Text style={{fontSize:13,lineHeight:18,color:c.muted}}>{zh?'有问题可以在这里问发起人和同行的人。':'Ask the host and the others here.'}</Text>:null}
  </View>:<View style={{borderRadius:20,overflow:'hidden',backgroundColor:c.surface}}>
   {comments.map((m,i)=><View key={m.id} style={{paddingVertical:14,paddingHorizontal:16,gap:12,borderTopWidth:i?0.5:0,borderTopColor:c.border}}>
    <View style={{flexDirection:'row',gap:12}}>
     <GradientAvatar name={m.author.display_name} size={34}/>
     <View style={{flex:1,gap:4}}>
      <View style={{flexDirection:'row',alignItems:'center',gap:6}}><Text style={{fontSize:14,fontWeight:'700',color:c.text}}>{m.author.display_name}</Text><Text numberOfLines={1} style={{flex:1,fontSize:12,color:c.muted}}>{m.author.id===activity.organizer.id?`${zh?'发起人':'Host'} · `:''}{commentTime(m.created_at,zh)}</Text></View>
      <Text selectable style={{fontSize:15,lineHeight:22,color:c.text}}>{m.body}</Text>
      {m.can_delete?<QuietLink small label={zh?'删除我的评论':'Delete my comment'} disabled={frozen} onPress={()=>confirm(zh?'删除评论？':'Delete comment?',m.body,()=>act(`/comments/${m.id}`,'DELETE',{version:m.version}))}/>
      :<SafetyActions quiet="inline" target={{kind:'activity_comment',id:String(m.id)}} author={m.author} language={language} dark={dark} disabled={frozen} onChanged={()=>void load()}/>}
     </View>
    </View>
    {canReconnect&&reconnectOpen&&m.author.id!==profile?.id?<FillButton label={zh?`想和 ${m.author.display_name} 再一起`:`Meet ${m.author.display_name} again`} disabled={frozen} onPress={()=>reconnect(m.author)}/>:null}
   </View>)}
   {cursor!==null?<Pressable accessibilityRole="button" disabled={frozen} onPress={()=>void more()} style={({pressed})=>({paddingVertical:14,alignItems:'center',borderTopWidth:0.5,borderTopColor:c.border,opacity:pressed?0.6:1})}><Text style={{fontSize:15,fontWeight:'600',color:c.accent}}>{zh?'加载较早的评论':'Load earlier comments'}</Text></Pressable>:null}
  </View>}
 </View>;
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
  {error?<Notice tone="error" text={error} action={reviewOnly?(zh?'返回列表核对':'Back to check'):pending.current?(busy?undefined:(zh?'再试一次':'Try again')):frozen?undefined:(zh?'重新读取':'Reload')} onAction={()=>reviewOnly?protectInput(onBack):pending.current?void perform():void load()}/>:null}
  {joinPending?<View style={{padding:16,borderRadius:14,backgroundColor:c.tint}}><Text accessibilityRole="alert" style={{fontSize:15,lineHeight:22,color:c.text}}>{joinState.phase==='submitting'?(zh?'正在核对报名结果…':'Checking your signup…'):(zh?'有一笔报名结果尚未确认。':'One signup result is still unconfirmed.')}</Text></View>:null}
  {activity?<>
   {/* Pen "V6 / 活动详情（报名卡）" (Czib6): tags, title, host, date tile, place, one state-driven registration card. */}
   <View style={{paddingHorizontal:4,gap:8}}>
    <View style={{flexDirection:'row',flexWrap:'wrap',gap:6}}>
     {activity.kind==='study'?<Chip label={zh?'学习组队':'Study group'}/>:null}
     <Chip label={interactionLabel(activity.interaction,zh)}/>
     {activity.languages.map(l=><Chip key={l} label={l==='en'?'English':l==='yue'?(zh?'粤语':'Cantonese'):(zh?'普通话':'Mandarin')}/>)}
    </View>
    <Text accessibilityRole="header" style={{fontSize:28,lineHeight:34,fontWeight:'800',color:c.text,letterSpacing:-0.4}}>{activity.title}</Text>
    <View style={{flexDirection:'row',alignItems:'center',gap:8}}><InitialAvatar name={activity.organizer.display_name} size={24}/><Text style={{fontSize:14,fontWeight:'500',color:c.muted}}>{zh?`由 ${activity.organizer.display_name} 发起`:`Hosted by ${activity.organizer.display_name}`}</Text></View>
   </View>
   <View style={{paddingHorizontal:4,gap:14}}>
    <InfoRow lead={<DateTile iso={activity.starts_at}/>} title={dayTitle(activity.starts_at,zh)} sub={timeSpan(activity.starts_at,activity.ends_at,zh)}/>
    <InfoRow lead={<Tile icon="map-pin"/>} title={activity.location} sub={zh?'集合地点':'Meeting point'}/>
   </View>
   <RegistrationCard header={activity.status==='cancelled'?(zh?'活动已取消':'Cancelled'):activity.ended?(zh?'活动已结束':'Ended'):(zh?'报名':'Registration')}>
    {joinPending?<>
     <Status icon="loader" color={c.accent} title={joinState.phase==='submitting'?(zh?'正在核对报名结果…':'Checking your signup…'):(zh?'报名结果还没确认':'Signup result unconfirmed')} sub={zh?'不会重复报名；可以查看进度':'You will not be signed up twice'}/>
     <FillButton label={zh?'查看操作进度':'View request status'} onPress={()=>setJoinVisible(true)}/>
    </>:activity.status==='cancelled'?<Status icon="circle-x" color={c.danger} title={zh?'活动已取消':'Activity cancelled'} sub={zh?'已保存的日程和提醒已移除':'Saved schedules and reminders were removed'}/>
    :activity.ended?<>
     <Status icon="party-popper" color={c.accent} title={mine?.is_organizer?(zh?'活动已结束':'Activity ended'):(zh?'谢谢参加':'Thanks for coming')} sub={canReconnect&&reconnectOpen?(zh?'7 天内可以选想再一起的同伴；只有双方都愿意，才会互相看到':'Within 7 days you can say you would like to meet again; only mutual wishes are shown'):(zh?'感谢参与':'Thanks for taking part')}/>
     {canReconnect&&reconnectOpen&&!mine?.is_organizer?<FillButton label={zh?'想再一起':'Meet again'} disabled={frozen} onPress={()=>reconnect(activity.organizer)}/>:null}
    </>:mine?.is_organizer?<>
     <Status icon="badge-check" color={c.accent} title={zh?'你是发起人':'You are hosting'} sub={`${zh?'已确认':'Confirmed'} ${activity.counts.confirmed} / ${activity.capacity}${activity.counts.waitlisted?` · ${zh?'候补':'waitlist'} ${activity.counts.waitlisted}`:''}`}/>
     {!activity.started?<FillButton label={zh?'修改时间与地点':'Edit time and place'} disabled={frozen} onPress={()=>setEditing(true)}/>:null}
    </>:part?.status==='confirmed'?<>
     <Status icon="check" color={c.green} title={zh?'你已报名':'You are in'} sub={zh?`${hhmm(activity.starts_at)} 开始；有变化会第一时间通知你`:`Starts ${hhmm(activity.starts_at)}; we will tell you about any change`}/>
     <View style={{flexDirection:'row',gap:10}}>
      <SoftButton icon={mine?.calendar_saved?'calendar-check':'calendar-plus'} label={mine?.calendar_saved?(zh?'已在日历':'In calendar'):(zh?'加入日历':'Add to calendar')} active={!!mine?.calendar_saved} disabled={frozen} onPress={()=>prefs(mine?.calendar_saved?{calendar_saved:false,remind_minutes:null}:{calendar_saved:true})}/>
      <SoftButton icon={mine?.remind_minutes==null?'bell':'bell-ring'} label={reminderLabel(mine?.remind_minutes)} active={mine?.remind_minutes!=null} disabled={frozen} onPress={pickReminder}/>
     </View>
     <QuietLink label={zh?'不能来了？退出报名':'Can’t make it? Withdraw'} disabled={frozen} onPress={withdraw}/>
    </>:part?.status==='waitlisted'?<>
     <Status icon="hourglass" color={c.orange} title={zh?`候补第 ${part.waitlist_position??'–'} 位`:`Waitlist #${part.waitlist_position??'–'}`} sub={zh?'有人退出会自动递补，并通知你':'You move up automatically when someone leaves'}/>
     <QuietLink label={zh?'不想等了？退出候补':'Leave the waitlist'} disabled={frozen} onPress={withdraw}/>
    </>:activity.started?<Status icon="clock" color={c.muted} title={zh?'进行中':'In progress'} sub={zh?'报名已结束':'Signups have ended'}/>
    :activity.status==='closed'?<Status icon="pause" color={c.muted} title={zh?'暂停报名':'Signups paused'} sub={zh?'发起人暂时关闭了报名':'The host has paused signups'}/>
    :canJoin&&activity.counts.confirmed>=activity.capacity?<>
     <Status icon="users" color={c.muted} title={zh?'已满':'Full'} sub={zh?'可以加入候补，有人退出会按顺序递补并通知你':'Join the waitlist; places are offered in order'}/>
     <PrimaryButton label={zh?'加入候补':'Join waitlist'} disabled={frozen} onPress={()=>{joinController.review(activity);setJoinVisible(true);}}/>
    </>:canJoin?<>
     <View style={{gap:2}}>
      <Text style={{fontSize:17,fontWeight:'700',color:c.text}}>{zh?`还剩 ${activity.capacity-activity.counts.confirmed} 个名额 · ${costText(activity.cost_minor,zh)}`:`${activity.capacity-activity.counts.confirmed} places left · ${costText(activity.cost_minor,zh)}`}</Text>
      <Text style={{fontSize:13,color:c.muted}}>{activity.cost_minor?(zh?'费用仅作说明，App 不收款；报名后可随时退出':'Cost is informational; you can withdraw any time'):(zh?'报名后可随时退出；有变化会通知你':'You can withdraw any time; we will tell you about changes')}</Text>
     </View>
     <PrimaryButton label={zh?'报名':'Join'} disabled={frozen} onPress={()=>{joinController.review(activity);setJoinVisible(true);}}/>
    </>:<Status icon="info" color={c.muted} title={zh?'暂时不能报名':'Not open'} sub={zh?'稍后再来看看':'Check back later'}/>}
   </RegistrationCard>
   <View style={{paddingHorizontal:4}}>
    <InfoRow lead={<Tile icon="users" color={c.green}/>} title={zh?`${activity.counts.confirmed} / ${activity.capacity} 人已确认${activity.counts.waitlisted?` · 候补 ${activity.counts.waitlisted}`:''}`:`${activity.counts.confirmed} / ${activity.capacity} confirmed${activity.counts.waitlisted?` · ${activity.counts.waitlisted} waiting`:''}`} sub={mine?.is_organizer?(zh?'名单见下方，不含发起人':'Roster below, host not counted'):(zh?'名单仅发起人可见':'Only the host sees the list')}/>
   </View>
   {activity.description||activity.requirements?<View style={{paddingHorizontal:4,gap:8}}>
    <Text style={{fontSize:15,fontWeight:'700',color:c.text}}>{zh?'这次一起做什么':'What we’ll do'}</Text>
    {activity.description?<Text selectable style={{fontSize:15,lineHeight:23,color:c.text}}>{activity.description}</Text>:null}
    {activity.requirements?<Text selectable style={{fontSize:15,lineHeight:23,color:c.muted}}>{zh?'参与须知：':'Notes: '}{activity.requirements}</Text>:null}
   </View>:null}
   {mine?.is_organizer?<>
    <ListGroup header={zh?'参与情况（仅你可见）':'Participation (only you)'}>
     {roster.length?roster.map(p=><ListRow key={p.user.id} title={p.user.display_name} value={participationLabel(p.status,zh)}/>):<ListRow title={zh?'还没有人报名':'No one has joined yet'}/>}
    </ListGroup>
    <ListGroup header={zh?'管理':'Manage'}>
     {!activity.started&&activity.status!=='cancelled'?<ListRow title={activity.status==='open'?(zh?'暂停报名':'Pause signups'):(zh?'重新开放报名':'Reopen signups')} chevron disabled={frozen} onPress={()=>act('','PATCH',{version:activity.version,status:activity.status==='open'?'closed':'open'})}/>:null}
     {!activity.started&&activity.status!=='cancelled'?<ListRow title={zh?'取消活动':'Cancel activity'} subtitle={zh?'通知所有参与者，并移除他们的日程':'Notifies participants and removes saved schedules'} titleColor={c.danger} disabled={frozen} onPress={()=>confirm(zh?'取消活动？':'Cancel activity?',zh?'所有参与者会收到站内通知，已保存的日程会移除。取消后不能恢复。':'Participants receive an in-app notice and saved schedules are removed. Cancellation is final.',()=>act('/cancel','POST',{version:activity.version}))}/>:null}
     <ListRow title={zh?'删除活动':'Delete activity'} titleColor={c.danger} disabled={frozen} onPress={()=>confirm(zh?'删除活动及评论？':'Delete activity and comments?',zh?'活动内容、评论和参与记录将删除，其他用户会看到内容已移除。':'Activity content, comments and participation records are deleted. Others see that content was removed.',()=>act('','DELETE',{version:activity.version},onBack))}/>
    </ListGroup>
   </>:null}
   <Pressable accessibilityRole="button" onPress={()=>protectInput(()=>{setDiscussion(true);onNavigate();})} style={({pressed})=>({flexDirection:'row',alignItems:'center',gap:10,paddingVertical:14,paddingHorizontal:16,borderRadius:20,backgroundColor:pressed?c.fill:c.surface})}>
    <PenIcon name="message-circle" size={18} color={c.text}/>
    <Text style={{flex:1,fontSize:15,fontWeight:'600',color:c.text}}>{zh?'活动讨论':'Discussion'}</Text>
    <Text style={{fontSize:14,color:c.muted}}>{comments.length?(zh?`${comments.length}${cursor!==null?'+':''} 条`:`${comments.length}${cursor!==null?'+':''}`):(zh?'问点什么':'Ask something')}</Text>
    <PenIcon name="chevron-right" size={16} color={c.muted}/>
   </Pressable>
   <SafetyActions quiet target={{kind:'activity',id:activity.id}} author={activity.organizer} language={language} dark={dark} disabled={frozen} onChanged={()=>void load()}/>
  </>:busy?<View accessibilityLabel={zh?'正在读取':'Loading'} style={{gap:14}}><Skeleton height={96} radius={20}/><Skeleton height={150} radius={24}/></View>:null}
  <JoinActivitySheet visible={joinVisible} controller={joinController} state={joinState} language={language} dark={dark} onClose={()=>{setJoinVisible(false);if(joinController.snapshot().phase==='result')void load(true);}} onRefresh={()=>{setJoinVisible(false);void load();}}/>
 </View>;
}

function Chip({label}:{label:string}){const c=usePenColors();return <View style={{paddingVertical:4,paddingHorizontal:10,borderRadius:99,backgroundColor:c.accent+'14'}}><Text style={{fontSize:12,fontWeight:'600',color:c.accent}}>{label}</Text></View>;}
function Tile({icon,color}:{icon:PenIconName;color?:string}){const c=usePenColors();return <View style={{width:44,height:44,borderRadius:12,alignItems:'center',justifyContent:'center',backgroundColor:color?color+'1F':c.surface,borderWidth:color?0:1,borderColor:c.border}}><PenIcon name={icon} size={20} color={color??c.text}/></View>;}
/** Pen calendar tile: month band over the day number. */
function DateTile({iso}:{iso:string}){const c=usePenColors(),d=hk(iso);return <View style={{width:44,height:44,borderRadius:12,overflow:'hidden',backgroundColor:c.surface,borderWidth:1,borderColor:c.border}}>
 <View style={{height:15,alignItems:'center',justifyContent:'center',backgroundColor:c.accent+'1A'}}><Text style={{fontSize:9,fontWeight:'700',color:c.accent}}>{d.getUTCMonth()+1}月</Text></View>
 <View style={{flex:1,alignItems:'center',justifyContent:'center'}}><Text style={{fontSize:18,fontWeight:'800',color:c.text}}>{d.getUTCDate()}</Text></View>
</View>;}
function InfoRow({lead,title,sub}:{lead:React.ReactNode;title:string;sub:string}){const c=usePenColors();return <View style={{flexDirection:'row',alignItems:'center',gap:12}}>{lead}<View style={{flex:1,gap:2}}><Text style={{fontSize:16,fontWeight:'600',color:c.text}}>{title}</Text><Text style={{fontSize:14,color:c.muted}}>{sub}</Text></View></View>;}
function RegistrationCard({header,children}:{header:string;children:React.ReactNode}){const c=usePenColors();return <View style={{borderRadius:24,borderCurve:'continuous',overflow:'hidden',backgroundColor:c.surface,borderWidth:1,borderColor:c.glassBorder,boxShadow:'0 6px 20px #0B1A330F'}}>
 <View style={{paddingVertical:10,paddingHorizontal:16,backgroundColor:c.fill+'66',borderBottomWidth:0.5,borderBottomColor:c.border}}><Text style={{fontSize:13,fontWeight:'600',color:c.muted}}>{header}</Text></View>
 <View style={{padding:16,gap:14}}>{children}</View>
</View>;}
function Status({icon,color,title,sub}:{icon:PenIconName;color:string;title:string;sub:string}){const c=usePenColors();return <View style={{flexDirection:'row',alignItems:'center',gap:12}}>
 <View style={{width:40,height:40,borderRadius:20,alignItems:'center',justifyContent:'center',backgroundColor:color+'1F'}}><PenIcon name={icon} size={20} color={color}/></View>
 <View style={{flex:1,gap:2}}><Text style={{fontSize:17,fontWeight:'700',color:c.text}}>{title}</Text><Text style={{fontSize:13,lineHeight:18,color:c.muted}}>{sub}</Text></View>
</View>;}
function SoftButton({icon,label,active,disabled,onPress}:{icon:PenIconName;label:string;active:boolean;disabled?:boolean;onPress:()=>void}){const c=usePenColors();return <Pressable accessibilityRole="button" accessibilityState={{disabled,selected:active}} disabled={disabled} onPress={()=>{feel.select();onPress();}} style={({pressed})=>({flex:1,height:42,borderRadius:21,flexDirection:'row',gap:6,alignItems:'center',justifyContent:'center',backgroundColor:active?c.accent+'1F':c.fill,opacity:disabled?0.5:pressed?0.7:1})}>
 <PenIcon name={icon} size={16} color={active?c.accent:c.text}/><Text numberOfLines={1} style={{fontSize:14,fontWeight:'600',color:active?c.accent:c.text}}>{label}</Text>
</Pressable>;}
function QuietLink({label,onPress,disabled,small}:{label:string;onPress:()=>void;disabled?:boolean;small?:boolean}){const c=usePenColors();return <Pressable accessibilityRole="button" disabled={disabled} hitSlop={small?12:8} onPress={onPress} style={{alignSelf:'flex-start'}}><Text style={{fontSize:small?12:13,fontWeight:'500',color:c.muted}}>{label}</Text></Pressable>;}
/** Pen "想再一起" capsule: 46pt, system fill, 15/600 — the quiet second action inside a card. */
function FillButton({label,onPress,disabled}:{label:string;onPress:()=>void;disabled?:boolean}){const c=usePenColors();return <Pressable accessibilityRole="button" accessibilityState={{disabled}} disabled={disabled} onPress={()=>{feel.tap();onPress();}} style={({pressed})=>({height:46,borderRadius:23,alignItems:'center',justifyContent:'center',paddingHorizontal:18,backgroundColor:c.fill,opacity:disabled?0.4:pressed?0.7:1})}><Text numberOfLines={1} style={{fontSize:15,fontWeight:'600',color:c.text}}>{label}</Text></Pressable>;}
/** Comment time: "15:12" today, otherwise with the date (Hong Kong time). */
const commentTime=(iso:string,zh:boolean)=>{const d=hk(iso),today=hk(new Date().toISOString()).toISOString().slice(0,10)===d.toISOString().slice(0,10);return today?hhmm(iso):zh?`${d.getUTCMonth()+1}月${d.getUTCDate()}日 ${hhmm(iso)}`:`${d.getUTCDate()}/${d.getUTCMonth()+1} ${hhmm(iso)}`;};

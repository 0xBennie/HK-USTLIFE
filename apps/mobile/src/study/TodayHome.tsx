import React,{useEffect,useRef,useState} from 'react';
import {Linking,Pressable,Text,View} from 'react-native';
import Svg,{Defs,LinearGradient,Rect,Stop} from 'react-native-svg';
import {session} from '../runtime';
import {CheckCircle,CircleButton,EmptyState,Hero,HeroActions,IconTile,LargeTitle,ListGroup,ListRow,Notice,PenIcon,PrimaryButton,Section,Skeleton,Stagger,Surface,TopBar,ViewAll,usePenColors} from '../ui/Pen';
import type {Language} from '../strings';
import type {Calendar,CalendarItem,Course,StudyItem} from './types';
import type {ActivityNotification} from '../../../../src/product/social/types';
import {dateTimeInZone} from './dates';
import {DayRibbon} from './DayRibbon';
import {getWeather,type CampusWeather} from '../campus/weather';
const weatherIcon=(en?:string)=>!en?'cloud':/thunder/i.test(en)?'cloud-lightning':/rain|shower/i.test(en)?'cloud-rain':/sun|fine/i.test(en)?'sun':/fog|mist|haze/i.test(en)?'cloud-fog':/wind/i.test(en)?'wind':/hot|warm/i.test(en)?'thermometer-sun':'cloud';
import ReanimatedSwipeable,{type SwipeableMethods} from 'react-native-gesture-handler/ReanimatedSwipeable';
import {feel} from '../ui/feel';

// Pen board "V2 / 今天 / 今日简报" (jV0eP) and "第一次使用" (TCURr).
type Task=Extract<StudyItem,{kind:'task'}>;
const courseColors=['#24467F','#4F6F8C','#56647D','#2E7D55','#6B6F8E','#A9824C','#34506B'];
export const courseColor=(courses:Course[],id:string|null|undefined)=>{const i=courses.findIndex(c=>c.id===id);return i<0?'#8E8E93':courseColors[i%courseColors.length];};
const shade=(hex:string)=>'#'+[1,3,5].map(i=>Math.round(parseInt(hex.slice(i,i+2),16)*0.72).toString(16).padStart(2,'0')).join('');
const hk=(iso:string)=>dateTimeInZone(iso,'Asia/Hong_Kong');
const todayHK=()=>hk(new Date().toISOString()).slice(0,10);
const addDays=(d:string,n:number)=>new Date(Date.parse(d+'T00:00:00Z')+n*864e5).toISOString().slice(0,10);
const zhDay=['日','一','二','三','四','五','六'];
function dueKey(t:Task){return t.due_at?hk(t.due_at):t.due_date?`${t.due_date} 23:59`:'9999';}
function dueLabel(t:Task,zh:boolean){
 const today=todayHK(),key=dueKey(t),d=key.slice(0,10),time=t.due_at?key.slice(11):'';
 if(d<today){const days=Math.round((Date.parse(today)-Date.parse(d))/864e5);return days===1?(zh?`昨天 ${time||''}`.trim():`Yesterday ${time}`.trim()):(zh?`逾期 ${days} 天`:`${days} days overdue`);}
 if(d===today)return t.due_at&&Date.parse(t.due_at)<Date.now()?(zh?`今天 ${time}`:`Today ${time}`):time||(zh?'今天':'Today');
 if(d===addDays(today,1))return zh?`明天 ${time}`.trim():`Tomorrow ${time}`.trim();
 const wd=new Date(d+'T00:00:00Z').getUTCDay();
 return zh?`周${zhDay[wd]} ${time}`.trim():`${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][wd]} ${time}`.trim();
}
const notifIcon:Record<string,[string,string]>={joined:['circle-check','#2E9E5B'],waitlisted:['hourglass','#56647D'],promoted:['party-popper','#2E9E5B'],withdrawn:['log-out','#8E8E93'],activity_updated:['clock-alert','#D98A1C'],activity_cancelled:['calendar-x','#E5484D'],activity_removed:['trash','#8E8E93'],comment:['message-circle','#24467F'],post_reply:['message-square-reply','#24467F'],post_resolved:['circle-check-big','#2E9E5B'],reconnection_mutual:['heart-handshake','#A9824C']};
export function notificationText(m:ActivityNotification,zh:boolean){
 const t:Record<string,[string,string]>={joined:['报名已确认','Signup confirmed'],waitlisted:['已加入候补','On the waitlist'],promoted:['候补到你了','Waitlist place confirmed'],withdrawn:['已退出','Withdrawn'],activity_updated:['活动有变化','Activity changed'],activity_cancelled:['活动已取消','Activity cancelled'],activity_removed:['活动已删除','Activity removed'],comment:['活动讨论有新评论','New comment'],post_reply:['你的帖子有新回复','New reply to your post'],post_resolved:['问题已解决','Question resolved'],reconnection_mutual:['双方都愿意再见面','You both want to meet again']};
 return {title:(t[m.kind]??['新消息','Update'])[zh?0:1],subject:m.activity?.title??m.post?.title??m.reconnection?.display_name??'',icon:notifIcon[m.kind]??['bell','#8E8E93']};
}

export function TodayHome({name,onMe,language,courses,items,calendar,loading,error,busy,onToggle,onPostpone,onOpenTask,onAdd,onManage,onActivity,onPost,onCampus,onInbox,onSchool,onRetry}:{
 name?:string;onMe?:()=>void;language:Language;courses:Course[];items:StudyItem[];calendar:Calendar|null;loading:boolean;error:string;busy:boolean;
 onToggle:(task:Task)=>void;onPostpone:(task:Task)=>void;onOpenTask:(task:StudyItem)=>void;onAdd:()=>void;onManage:(view:'day'|'week'|'courses'|'all')=>void;
 onActivity:(id:string)=>void;onPost:(id:string)=>void;onCampus:()=>void;onInbox:()=>void;onSchool:()=>void;onRetry:()=>void}){
 const zh=language==='zh',c=usePenColors(),today=todayHK();
 const [notes,setNotes]=useState<ActivityNotification[]>([]);
 const [ride,setRide]=useState<{name:string;time:string|null;status:string}|null|undefined>(undefined);
 const [showDone,setShowDone]=useState(false);
 const [weather,setWeather]=useState<CampusWeather|null>(null);
 useEffect(()=>{let live=true;getWeather().then(w=>{if(live)setWeather(w);}).catch(()=>{});return()=>{live=false;};},[]);
 useEffect(()=>{let live=true;
  session.request<{items:ActivityNotification[]}>('/me/notifications').then(r=>{if(live)setNotes(r.items.filter(n=>!n.read_at).slice(0,3));}).catch(()=>{});
  session.request<{target_kind:string;target_id:string}[]>('/me/campus/bookmarks').then(async b=>{const id=b.find(x=>x.target_kind==='shuttle')?.target_id;if(!id){if(live)setRide(null);return;}
   const d=await session.request<{route:{name:{zh:string;en:string}};status:string;upcoming:{local_time:string}[]}>(`/transport/routes/${id}/departures`);if(live)setRide({name:d.route.name[zh?'zh':'en'],time:d.upcoming[0]?.local_time??null,status:d.status});}).catch(()=>{if(live)setRide(null);});
  return()=>{live=false;};
 },[items.length,zh]);
 const tasks=items.filter((i):i is Task=>i.kind==='task');
 const open=tasks.filter(t=>t.status==='open'&&(t.due_at||t.due_date)).sort((a,b)=>dueKey(a).localeCompare(dueKey(b)));
 const weekEnd=addDays(today,7);
 const overdue=open.filter(t=>dueKey(t)<hk(new Date().toISOString())&&dueKey(t).slice(0,10)<today||(t.due_at&&Date.parse(t.due_at)<Date.now()));
 const dueToday=open.filter(t=>!overdue.includes(t)&&dueKey(t).slice(0,10)===today);
 const dueWeek=open.filter(t=>!overdue.includes(t)&&!dueToday.includes(t)&&dueKey(t).slice(0,10)<=weekEnd);
 const doneRecent=tasks.filter(t=>t.status==='done'&&Date.parse(t.updated_at)>Date.now()-864e5);
 const events=(calendar?.days.find(d=>d.date===today)?.events??[]).filter(e=>e.kind==='event'&&e.status==='active'&&e.starts_at) as Extract<CalendarItem,{kind:'event'}>[];
 const now=Date.now();
 const upcoming=events.filter(e=>Date.parse(e.ends_at??e.starts_at!)>now).sort((a,b)=>a.starts_at!.localeCompare(b.starts_at!));
 const next=upcoming[0];
 const startsIn=next?Math.round((Date.parse(next.starts_at!)-now)/60000):0;
 const schoolLinked=(calendar?.school_connections??[]).some(s=>s.state==='connected'||s.state==='partial');
 const nothing=!loading&&!tasks.length&&!events.length&&courses.length===0;
 const wd=new Date(today+'T00:00:00Z').getUTCDay();
 const dateLine=zh?`${Number(today.slice(5,7))} 月 ${Number(today.slice(8))} 日 · 星期${zhDay[wd]}`:new Date(today+'T00:00:00Z').toLocaleDateString('en-HK',{weekday:'long',month:'short',day:'numeric',timeZone:'UTC'});
 const summary=[upcoming.length?(zh?`还有 ${upcoming.length} 节课`:`${upcoming.length} classes left`):null,dueToday.length?(zh?`${dueToday.length} 项今天截止`:`${dueToday.length} due today`):null,overdue.length?(zh?`${overdue.length} 项逾期`:`${overdue.length} overdue`):null].filter(Boolean).join(zh?'，':', ');
 const deadlineRow=(t:Task,tone:'red'|'orange'|'plain',i:number,last:boolean)=>{const col=courseColor(courses,t.course_id),course=courses.find(x=>x.id===t.course_id);
  const school='school_origin' in t;
  // Swipe right = complete (green), swipe left = push back one day (orange). Buttons stay the accessible path.
  return <Stagger key={t.id} index={i}><SwipeRow friction={1.6} overshootFriction={8} leftThreshold={70} rightThreshold={70}
   renderLeftActions={()=><View style={{width:96,backgroundColor:c.green,alignItems:'center',justifyContent:'center',gap:3}}><PenIcon name="check" size={22} strokeWidth={2.6} color="#FFFFFF"/><Text style={{fontSize:12,fontWeight:'700',color:'#FFFFFF'}}>{zh?'完成':'Done'}</Text></View>}
   renderRightActions={school?undefined:()=><View style={{width:96,backgroundColor:c.orange,alignItems:'center',justifyContent:'center',gap:3}}><PenIcon name="calendar-arrow-up" size={22} color="#FFFFFF"/><Text style={{fontSize:12,fontWeight:'700',color:'#FFFFFF'}}>{zh?'推迟一天':'+1 day'}</Text></View>}
   onOpen={direction=>{if(direction==='left'){feel.success();onToggle(t);}else{feel.tap();onPostpone(t);}}}>
  <Pressable accessibilityRole="button" accessibilityLabel={`${t.title}, ${dueLabel(t,zh)}`} accessibilityActions={[{name:'magicTap',label:zh?'完成':'Complete'}]} onPress={()=>onOpenTask(t)} style={({pressed})=>({flexDirection:'row',alignItems:'center',gap:12,paddingLeft:16,opacity:pressed?0.6:1})}>
   <CheckCircle checked={false} disabled={busy} color={tone==='red'?c.red:tone==='orange'?c.orange:undefined} label={zh?`完成 ${t.title}`:`Complete ${t.title}`} onPress={()=>onToggle(t)}/>
   <View style={{flex:1,flexDirection:'row',alignItems:'center',gap:8,paddingVertical:11,paddingRight:16,borderBottomWidth:last?0:0.5,borderBottomColor:c.border}}>
    <View style={{flex:1,gap:4}}>
     <Text numberOfLines={2} style={{fontSize:16,lineHeight:22,fontWeight:'500',color:c.text}}>{t.title}</Text>
     <View style={{flexDirection:'row',alignItems:'center',gap:6}}>
      {course?<View style={{paddingVertical:2,paddingHorizontal:7,borderRadius:6,backgroundColor:col+'1F'}}><Text style={{fontSize:11,fontWeight:'700',color:col}}>{course.code||course.title}</Text></View>:null}
      {'school_origin' in t?<><PenIcon name="graduation-cap" size={12} color={c.muted}/><Text style={{fontSize:12,color:c.muted}}>Canvas</Text></>:!course&&t.body?<Text numberOfLines={1} style={{flex:1,fontSize:12,color:c.muted}}>{t.body}</Text>:null}
     </View>
    </View>
    <Text style={{fontSize:14,fontWeight:tone==='plain'?'500':'700',color:tone==='red'?c.red:tone==='orange'?c.orange:c.muted}}>{dueLabel(t,zh)}</Text>
   </View>
  </Pressable></SwipeRow></Stagger>;};
 const group=(label:string,color:string)=><Text style={{paddingHorizontal:16,paddingTop:12,paddingBottom:2,fontSize:13,fontWeight:'600',color}}>{label}</Text>;
 const nowCard=next?<Stagger index={0}><View style={{borderRadius:22,overflow:'hidden',boxShadow:'0 10px 24px #00000026'}}>
  <Svg style={{position:'absolute',width:'100%',height:'100%'}}><Defs><LinearGradient id="now" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor={next.course_id?courseColor(courses,next.course_id):'#24467F'}/><Stop offset="1" stopColor={shade(next.course_id?courseColor(courses,next.course_id):'#24467F')}/></LinearGradient></Defs><Rect width="100%" height="100%" fill="url(#now)"/></Svg>
  <View style={{padding:16,gap:10}}>
   <View style={{flexDirection:'row',alignItems:'center'}}>
    <View style={{flexDirection:'row',alignItems:'center',gap:5,paddingVertical:5,paddingHorizontal:10,borderRadius:99,backgroundColor:'#FFFFFF2E'}}><PenIcon name="timer" size={13} color="#FFFFFF"/><Text style={{fontSize:13,fontWeight:'600',color:'#FFFFFF'}}>{startsIn<=0?(zh?'正在上课':'In progress'):startsIn<60?(zh?`${startsIn} 分钟后开始`:`Starts in ${startsIn} min`):(zh?`${hk(next.starts_at!).slice(11)} 开始`:`Starts ${hk(next.starts_at!).slice(11)}`)}</Text></View>
    <View style={{flex:1}}/><Text style={{fontSize:15,fontWeight:'600',color:'#FFFFFFD9'}}>{hk(next.starts_at!).slice(11)}–{next.ends_at?hk(next.ends_at).slice(11):''}</Text>
   </View>
   <View style={{flexDirection:'row',alignItems:'center',gap:10}}>
    <View style={{flex:1,gap:2}}><Text numberOfLines={1} style={{fontSize:20,fontWeight:'700',color:'#FFFFFF'}}>{next.title}</Text>{next.location?<Text numberOfLines={1} style={{fontSize:14,color:'#FFFFFFD9'}}>{next.location}</Text>:null}</View>
    {'activity_origin' in next?<Pressable accessibilityRole="button" onPress={()=>onActivity((next as {activity_origin:{id:string}}).activity_origin.id)} style={({pressed})=>({flexDirection:'row',alignItems:'center',gap:6,height:36,paddingHorizontal:14,borderRadius:99,backgroundColor:'#FFFFFF',opacity:pressed?0.8:1})}><PenIcon name="users" size={15} color="#56647D"/><Text style={{fontSize:15,fontWeight:'600',color:'#56647D'}}>{zh?'查看活动':'View'}</Text></Pressable>:<Pressable accessibilityRole="button" onPress={()=>void Linking.openURL('https://pathadvisor.ust.hk/')} style={({pressed})=>({flexDirection:'row',alignItems:'center',gap:6,height:36,paddingHorizontal:14,borderRadius:99,backgroundColor:'#FFFFFF',opacity:pressed?0.8:1})}><PenIcon name="navigation" size={15} color="#56647D"/><Text style={{fontSize:15,fontWeight:'600',color:'#56647D'}}>{zh?'找课室':'Find room'}</Text></Pressable>}
   </View>
  </View>
 </View></Stagger>:null;
 const hourNow=Number(hk(new Date().toISOString()).slice(11,13));
 const firstName=(name??'').split(/[@\s]/)[0];
 const greeting=(zh?(hourNow<5?'夜深了':hourNow<12?'早上好':hourNow<18?'下午好':'晚上好'):(hourNow<12?'Good morning':hourNow<18?'Good afternoon':'Good evening'))+(firstName?(zh?`，${firstName}`:`, ${firstName}`):'');
 const firstDue=dueToday[0];
 const brief=[upcoming.length?(zh?`还有 ${upcoming.length} 节课`:`${upcoming.length} classes left`):(zh?'今天没课了':'No more classes'),firstDue?(zh?`${firstDue.title.split(/[:：]/)[0]} ${firstDue.due_at?hk(firstDue.due_at).slice(11):'今天'} 截止`:`${firstDue.title.split(/[:：]/)[0]} due ${firstDue.due_at?hk(firstDue.due_at).slice(11):'today'}`):null,overdue.length?(zh?`${overdue.length} 项已逾期`:`${overdue.length} overdue`):null].filter(Boolean).join(' · ');
 const dueCount=overdue.length+dueToday.length;
 const nextLabel=next?`${startsIn<=0?(zh?'正在上课':'Now'):hk(next.starts_at!).slice(11)} · ${next.title}`:upcoming.length===0&&events.length?(zh?'今天的课都上完了':'Classes done for today'):(zh?'今天没有课':'No classes today');
 return <View style={{gap:24}}>
  <TopBar name={name} onAvatar={onMe} title={dateLine} right={<CircleButton icon="plus" label={zh?'添加截止或安排':'Add a deadline or plan'} onPress={onAdd}/>}/>
  {nothing&&!schoolLinked?<FirstUse zh={zh} onSchool={onSchool} onAdd={onAdd}/>:<>
  <Stagger index={0}><View style={{gap:6,paddingHorizontal:4}}>
   <Text accessibilityRole="header" style={{fontSize:32,lineHeight:40,fontWeight:'700',letterSpacing:-0.6,color:c.text}}>{greeting}</Text>
   <Text style={{fontSize:15,lineHeight:21,color:c.muted}}>{brief}</Text>
   {weather?<Pressable accessibilityRole="button" accessibilityLabel={zh?'天气来源：香港天文台':'Weather from HKO'} onPress={()=>void Linking.openURL(weather.source.url)} style={{alignSelf:'flex-start',flexDirection:'row',alignItems:'center',gap:6,marginTop:6,paddingVertical:6,paddingHorizontal:12,borderRadius:99,backgroundColor:c.surface}}>
    <PenIcon name={weatherIcon(weather.condition?.en)} size={15} color={c.blue}/>
    <Text style={{fontSize:13,fontWeight:'600',color:c.text}}>{weather.temperature??'–'}° {weather.condition?(zh?weather.condition.zh:weather.condition.en):''}</Text>
    <Text style={{fontSize:12,color:c.muted}}>{zh?`${weather.station} · 天文台`:`${weather.station} · HKO`}</Text>
   </Pressable>:null}
  </View></Stagger>
  {weather?.warnings.filter(w=>w.level!=='info').map(w=><Notice key={w.code} tone={w.level==='severe'?'error':'warning'} text={`${zh?w.zh:w.en}${weather.classes_may_be_suspended?(zh?' · 学校通常停课，以校方公告为准':' · classes usually suspended; check official notice'):''}`}/>)}
  <Stagger index={1}><DayRibbon zh={zh} onWeek={()=>onManage('week')}
   blocks={events.map(e=>({id:e.id,label:courses.find(x=>x.id===e.course_id)?.code||e.title,start:Date.parse(e.starts_at!),end:Date.parse(e.ends_at??e.starts_at!)+(e.ends_at?0:3600e3),color:e.course_id?courseColor(courses,e.course_id):'#24467F',onPress:'activity_origin' in e?()=>onActivity((e as {activity_origin:{id:string}}).activity_origin.id):undefined}))}
   pins={dueToday.filter(t=>t.due_at).map(t=>({id:t.id,label:t.title.split(/[:：]/)[0],at:Date.parse(t.due_at!),tone:'orange' as const,onPress:()=>onOpenTask(t)}))}/></Stagger>
  {error?<Notice tone="error" text={error} action={zh?'重试':'Retry'} onAction={onRetry}/>:null}
  {loading&&!calendar?<View style={{gap:12}}><Skeleton height={190}/><Skeleton height={96}/></View>:null}
  {next?<Stagger index={1}><Pressable accessibilityRole="button" onPress={()=>'activity_origin' in next?onActivity((next as {activity_origin:{id:string}}).activity_origin.id):void Linking.openURL('https://pathadvisor.ust.hk/')} style={({pressed})=>({height:176,borderRadius:28,overflow:'hidden',opacity:pressed?0.9:1,boxShadow:'0 14px 30px #1B356640'})}>
   <Svg style={{position:'absolute',width:'100%',height:'100%'}}><Defs><LinearGradient id="classcard" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#2C5291"/><Stop offset="1" stopColor="#182F59"/></LinearGradient></Defs><Rect width="100%" height="100%" fill="url(#classcard)"/></Svg>
   <View style={{flex:1,padding:18,justifyContent:'space-between'}}>
    <View style={{flexDirection:'row',alignItems:'center',gap:8}}>
     <View style={{paddingVertical:5,paddingHorizontal:11,borderRadius:99,backgroundColor:'#FFFFFF26'}}><Text style={{fontSize:13,fontWeight:'600',color:'#FFFFFF'}}>{startsIn<=0?(zh?'正在进行':'Now'):startsIn<60?(zh?`${startsIn} 分钟后`:`in ${startsIn} min`):(zh?'下一节':'Next up')}</Text></View>
     <View style={{flex:1}}/><Text style={{fontSize:15,fontWeight:'600',color:'#FFFFFFB3',fontVariant:['tabular-nums']}}>{hk(next.starts_at!).slice(11)}–{next.ends_at?hk(next.ends_at).slice(11):''}</Text>
    </View>
    <View style={{gap:4}}>
     <Text numberOfLines={1} style={{fontSize:26,fontWeight:'700',letterSpacing:-0.5,color:'#FFFFFF'}}>{next.title}</Text>
     <View style={{flexDirection:'row',alignItems:'center'}}><Text numberOfLines={1} style={{flex:1,fontSize:15,color:'#FFFFFFB3'}}>{next.location||(zh?'地点未填写':'No location')}</Text><Text style={{fontSize:15,fontWeight:'600',color:'#FFFFFF'}}>{'activity_origin' in next?(zh?'查看活动':'View'):(zh?'找课室':'Find room')}</Text><PenIcon name="chevron-right" size={17} strokeWidth={2.4} color="#FFFFFF"/></View>
    </View>
   </View>
  </Pressable></Stagger>:null}
  <Section title={zh?'截止':'Deadlines'}>
   {open.length||doneRecent.length?<View style={{backgroundColor:c.surface,borderRadius:24,overflow:'hidden',boxShadow:'0 2px 12px #00000008'}}>
    {overdue.length?<>{group(zh?'已逾期':'Overdue',c.red)}{overdue.map((t,i)=>deadlineRow(t,'red',i,i===overdue.length-1))}</>:null}
    {dueToday.length?<>{group(zh?'今天':'Today',c.text)}{dueToday.map((t,i)=>deadlineRow(t,'orange',i+overdue.length,i===dueToday.length-1))}</>:null}
    {dueWeek.length?<>{group(zh?'明天 · 本周':'This week',c.muted)}{dueWeek.slice(0,4).map((t,i)=>deadlineRow(t,'plain',i+overdue.length+dueToday.length,i===Math.min(dueWeek.length,4)-1))}</>:null}
    {!overdue.length&&!dueToday.length&&!dueWeek.length?<View style={{padding:18,flexDirection:'row',alignItems:'center',gap:10}}><PenIcon name="party-popper" size={20} color={c.green}/><Text style={{flex:1,fontSize:15,color:c.text}}>{zh?'这周没有截止，喘口气。':'Nothing due this week.'}</Text></View>:null}
    {doneRecent.length?<Pressable accessibilityRole="button" onPress={()=>setShowDone(!showDone)} style={{flexDirection:'row',alignItems:'center',gap:8,padding:14,paddingHorizontal:18,borderTopWidth:0.5,borderTopColor:c.border}}><PenIcon name="circle-check" size={16} color={c.green}/><Text style={{flex:1,fontSize:14,color:c.muted}}>{zh?`今天完成了 ${doneRecent.length} 项`:`${doneRecent.length} done today`}</Text><PenIcon name={showDone?'chevron-up':'chevron-down'} size={16} color={c.tertiary}/></Pressable>:null}
    {showDone?doneRecent.map(t=><View key={t.id} style={{flexDirection:'row',alignItems:'center',gap:12,paddingLeft:16,paddingVertical:8}}><CheckCircle checked disabled={busy} label={zh?`重新打开 ${t.title}`:`Reopen ${t.title}`} onPress={()=>onToggle(t)}/><Text style={{flex:1,fontSize:15,color:c.muted,textDecorationLine:'line-through'}}>{t.title}</Text></View>):null}
    <View style={{borderTopWidth:0.5,borderTopColor:c.border}}><ViewAll label={zh?'查看全部':'View all'} onPress={()=>onManage('all')}/></View>
   </View>:<Surface><EmptyState icon="calendar-check" title={zh?'还没有截止':'No deadlines yet'} body={zh?'登录学校账号后，Canvas 作业会自动出现。':'Sign in with HKUST and Canvas deadlines appear here.'} action={zh?'添加一项':'Add one'} onAction={onAdd}/></Surface>}
  </Section>
  {notes.length?<Section title={zh?'需要你处理':'Needs you'} link={zh?'全部':'All'} onLink={onInbox}>
   <ListGroup>{notes.map(m=>{const n=notificationText(m,zh);return <ListRow key={m.id} icon={n.icon[0]} tile={n.icon[1]} title={n.subject||n.title} subtitle={n.subject?n.title:undefined} chevron onPress={()=>m.activity?onActivity(m.activity.id):m.post?onPost(m.post.id):undefined}/>;})}</ListGroup>
  </Section>:null}
  {upcoming.length>1?<ListGroup header={zh?'今天还有':'Later today'}>{upcoming.slice(1).map(e=><ListRow key={e.id} icon="book-open" tile={courseColor(courses,e.course_id)} title={e.title} subtitle={e.location||undefined} value={hk(e.starts_at!).slice(11)}/>)}</ListGroup>:null}
  <ListGroup>
   <ListRow icon="bus" tile={c.teal} title={ride?`${ride.name}${ride.time?` · ${ride.time}`:''}`:(zh?'选一条常坐的路线':'Pick your usual route')} subtitle={ride?(ride.time?(zh?'校巴时刻表 · 点开看实时小巴':'Shuttle timetable · live buses inside'):(zh?'今天没有校巴 · 看看小巴和巴士':'No shuttle today · see buses')):(zh?'下一班车会显示在这里':'Your next ride shows here')} chevron onPress={onCampus}/>
   {!schoolLinked?<ListRow icon="graduation-cap" tile="#24467F" title={zh?'用 HKUST 账号自动同步':'Sync with HKUST'} subtitle={zh?'课表、Canvas 截止和学校邮箱自动出现':'Timetable, Canvas deadlines and mail, automatically'} chevron onPress={onSchool}/>:null}
  </ListGroup>
  </>}
 </View>;
}
/** Soft aurora fill (Plasma card): pale course colour washing into mint and white. */
function Aurora({color}:{color:string}){
 const id='au'+color.replace('#','');
 return <Svg style={{position:'absolute',width:'100%',height:'100%'}}><Defs>
  <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#F4F4F6"/><Stop offset="0.45" stopColor={color} stopOpacity={0.28}/><Stop offset="1" stopColor="#CFE3D8"/></LinearGradient>
  <LinearGradient id={id+'v'} x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.55}/><Stop offset="1" stopColor="#FFFFFF" stopOpacity={0}/></LinearGradient>
 </Defs><Rect width="100%" height="100%" fill={`url(#${id})`}/><Rect width="100%" height="100%" fill={`url(#${id}v)`}/></Svg>;
}
function FirstUse({zh,onSchool,onAdd}:{zh:boolean;onSchool:()=>void;onAdd:()=>void}){
 const c=usePenColors();
 const src=(icon:string,col:string,t:string,s:string,badge:string,live:boolean)=><View style={{flexDirection:'row',alignItems:'center',gap:12,padding:14,borderRadius:16,backgroundColor:c.background}}><IconTile icon={icon} color={col} size={36}/><View style={{flex:1,gap:2}}><Text style={{fontSize:16,fontWeight:'600',color:c.text}}>{t}</Text><Text style={{fontSize:12,color:c.muted}}>{s}</Text></View><View style={{paddingVertical:4,paddingHorizontal:9,borderRadius:99,backgroundColor:(live?c.green:c.orange)+'1F'}}><Text style={{fontSize:12,fontWeight:'600',color:live?c.green:c.orange}}>{badge}</Text></View></View>;
 return <Stagger index={0}><View style={{gap:16}}>
  <View style={{backgroundColor:c.surface,borderRadius:22,padding:18,gap:12,boxShadow:'0 6px 20px #00000014'}}>
   <Text style={{fontSize:22,lineHeight:30,fontWeight:'700',color:c.text}}>{zh?'登录一次，今天的事都在这里':'Sign in once. Your day in one place.'}</Text>
   <Text style={{fontSize:15,lineHeight:22,color:c.muted}}>{zh?'用 HKUST 账号登录后，课表、Canvas 作业和截止、成绩会自动同步。密码只在学校官方登录页输入，我们看不到，也不保存。':'Sign in with HKUST and your timetable, Canvas deadlines and grades sync automatically. You enter your password only on the school’s own page.'}</Text>
   {src('calendar-days','#56647D',zh?'课表与选课':'Timetable & enrollment',zh?'SIS · 上课时间、课室、候补位置':'SIS · times, rooms, waitlist',zh?'自动':'Auto',true)}
   {src('graduation-cap','#24467F',zh?'Canvas 作业与截止':'Canvas deadlines',zh?'截止日期、作业要求、课程公告':'Due dates, requirements, announcements',zh?'自动':'Auto',true)}
   {src('mail','#0078D4',zh?'学校邮箱':'School mail',zh?'重要邮件和里面的截止':'Important mail and its deadlines',zh?'测试中':'Beta',false)}
   <View style={{flexDirection:'row'}}><PrimaryButton label={zh?'用 HKUST 账号登录':'Sign in with HKUST'} onPress={onSchool}/></View>
   <Pressable onPress={onAdd} style={{alignItems:'center',padding:6}}><Text style={{fontSize:15,fontWeight:'600',color:c.accent}}>{zh?'先自己添加一项':'Add one myself'}</Text></Pressable>
  </View>
  <Surface><View style={{flexDirection:'row',alignItems:'center',gap:12}}><IconTile icon="lock" color={c.indigo}/><View style={{flex:1,gap:2}}><Text style={{fontSize:15,fontWeight:'600',color:c.text}}>{zh?'会话只留在你的手机':'Your session stays on this phone'}</Text><Text style={{fontSize:12,lineHeight:17,color:c.muted}}>{zh?'同步在手机上完成；服务器只收到整理好的课程和截止':'Sync runs on the phone; the server only receives organized courses and deadlines'}</Text></View></View></Surface>
 </View></Stagger>;
}

export function GuestHome({language,title,inbox,onLogin,onCampus}:{language:Language;title:string;inbox?:boolean;onLogin:()=>void;onCampus:()=>void}){
 const zh=language==='zh',c=usePenColors();
 return <View style={{gap:22}}>
  <LargeTitle eyebrow={inbox?(zh?'只留下与你有关的更新':'Updates that matter to you'):(zh?'先看看，再决定':'Look around first')} title={title}/>
  {inbox?<Surface><EmptyState icon="inbox" title={zh?'登录后查看你的消息':'Sign in to see your updates'} body={zh?'报名结果、活动变化和回复都会在这里。':'Signup results, activity changes and replies appear here.'} action={zh?'登录':'Sign in'} onAction={onLogin}/></Surface>:<FirstUse zh={zh} onSchool={onLogin} onAdd={onLogin}/>}
  <Surface onPress={onCampus} padding={12} style={{paddingHorizontal:16}}><View style={{flexDirection:'row',alignItems:'center',gap:12}}><IconTile icon="bus" color={c.teal}/><View style={{flex:1}}><Text style={{fontSize:15,fontWeight:'600',color:c.text}}>{zh?'不用登录也能看校巴':'Shuttles without signing in'}</Text><Text style={{fontSize:12,color:c.muted}}>{zh?'时刻表、小巴实时到站和校园地点':'Timetables, live minibuses and places'}</Text></View><PenIcon name="chevron-right" size={16} color={c.tertiary}/></View></Surface>
 </View>;
}

/** Swipeable list row that snaps back after triggering its action. */
function SwipeRow({onOpen,children,...props}:Omit<React.ComponentProps<typeof ReanimatedSwipeable>,'onSwipeableWillOpen'|'ref'>&{onOpen:(direction:'left'|'right')=>void}){
 const ref=useRef<SwipeableMethods>(null),busy=useRef(false);
 // RNGH reports the finger direction: a right swipe ('right') reveals the left (complete) action.
 return <ReanimatedSwipeable ref={ref} {...props} onSwipeableWillOpen={direction=>{if(busy.current)return;busy.current=true;onOpen(direction==='right'?'left':'right');setTimeout(()=>ref.current?.close(),250);}} onSwipeableClose={()=>{busy.current=false;}}>{children}</ReanimatedSwipeable>;
}

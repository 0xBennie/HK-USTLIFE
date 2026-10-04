// Native implementations of Pen boards "V3 / 学业" (ivz0E), "V3 / 成绩分布" (c1QOeO), "V3 / 预约场地" (acWzf),
// "V3 / 一起时间" (Kphqs), "V3 / 社团与组织" (jYEm4), "V3 / 宿舍服务" (rbykj), "V3 / 校园服务" (InJbr) — V5 Liquid Glass.
// All data is real: our API (/grades, /me/time-groups, /clubs, /study/*) or the official HKUST site via deep link.
import {useEffect,useMemo,useState} from 'react';
import {Alert,Image,Linking,Pressable,Share,Text,View} from 'react-native';
import * as Notifications from 'expo-notifications';
import {session,api} from '../runtime';
import {EmptyState,GlassChips,Hero,HeroActions,ListGroup,ListRow,Notice,PenIcon,PrimaryButton,SearchField,Section,Skeleton,Surface,usePenColors} from '../ui/Pen';
import {feel} from '../ui/feel';
import {Grid,LifeTop,Pill} from './kit';
import {dateTimeInZone} from '../study/dates';
import type {Course,StudyItem} from '../study/types';
type Base={zh:boolean;onBack:()=>void};
const covers={photo:require('../../assets/covers/1741699428083-ddb73b95d1b6.jpg')};
const BOOKING='https://booking.hkust.edu.hk/';
const hk=(iso:string)=>dateTimeInZone(iso,'Asia/Hong_Kong');
// 2026–27 Fall teaching weeks counted from Mon 31 Aug 2026 (13 teaching weeks).
const TERM={label:{zh:'2026–27 秋季学期',en:'2026–27 Fall'},start:Date.parse('2026-08-31T00:00:00+08:00'),weeks:13};
const termWeek=()=>Math.max(1,Math.min(TERM.weeks,Math.floor((Date.now()-TERM.start)/(7*864e5))+1));
const err=(zh:boolean)=>zh?'暂时无法读取，请稍后再试。':'Could not load.';

export function AcademicsScreen({zh,onBack,onGrades,onTimeMatch,onSchool}:Base&{onGrades:()=>void;onTimeMatch:()=>void;onSchool?:()=>void}){
 const c=usePenColors();
 const [courses,setCourses]=useState<Course[]|null>(null),[due,setDue]=useState<number|null>(null),[canvas,setCanvas]=useState('');
 useEffect(()=>{let live=true;
  session.request<{items:Course[]}>('/study/courses?limit=100').then(r=>{if(live)setCourses(r.items);}).catch(()=>{if(live)setCourses([]);});
  session.request<{items:StudyItem[]}>('/study/items?limit=100').then(r=>{const end=Date.now()+7*864e5;if(live)setDue(r.items.filter(i=>i.kind==='task'&&i.status==='open'&&i.due_at&&Date.parse(i.due_at)<=end&&Date.parse(i.due_at)>=Date.now()-864e5).length);}).catch(()=>{});
  session.request<{state:string;provider:string}[]>('/school/connections').then(r=>{if(live)setCanvas(r.find(x=>x.provider==='canvas')?.state??'');}).catch(()=>{});
  return()=>{live=false;};},[]);
 const week=termWeek(),linked=canvas==='connected'||canvas==='partial';
 return <View style={{gap:18}}>
  <LifeTop zh={zh} title={zh?'学业':'Academics'} onBack={onBack}/>
  <Hero label={zh?TERM.label.zh:TERM.label.en} value={String(week)} unit={zh?`/ ${TERM.weeks} 周`:`/ ${TERM.weeks} wks`} chip={courses===null?undefined:(zh?`${courses.length} 门课 · 本周 ${due??'–'} 项截止`:`${courses.length} courses · ${due??'–'} due this week`)} chipIcon="book-open"/>
  <View style={{height:6,borderRadius:3,backgroundColor:c.fill,overflow:'hidden'}}><View style={{width:`${week/TERM.weeks*100}%`,height:6,borderRadius:3,backgroundColor:'#24467F'}}/></View>
  <ListGroup>
   <ListRow icon="circle-check" tile="#E5484D" title={zh?'Canvas 作业':'Canvas assignments'} subtitle={linked?(zh?'已连接 · 自动进入「今天」':'Connected · flows into Today'):(zh?'粘贴 Canvas 令牌即可自动同步':'Paste a Canvas token to sync')} value={linked?(zh?'已连接':'On'):(zh?'连接':'Connect')} valueColor={linked?'#2E9E5B':'#24467F'} chevron onPress={onSchool}/>
   <ListRow icon="chart-column" tile="#24467F" title={zh?'成绩分布':'Grade distribution'} subtitle={zh?'同学匿名上报 · 满 10 人才显示':'Anonymous reports · shown at n ≥ 10'} chevron onPress={onGrades}/>
   <ListRow icon="users" tile="#7A5C8E" title={zh?'和同学找共同空闲':'Find common free time'} subtitle={zh?'只比对空闲时段，不共享课表':'Compares free slots only'} chevron onPress={onTimeMatch}/>
   <ListRow icon="graduation-cap" tile="#56647D" title={zh?'成绩与考试（SIS）':'Grades & exams (SIS)'} subtitle={zh?'学校开放 SIS 授权后自动同步':'Syncs once HKUST approves SIS access'} value={zh?'待批准':'Pending'}/>
  </ListGroup>
  <Section title={zh?'我的课程':'My courses'}>
   {courses===null?<Skeleton height={120} radius={28}/>:courses.length?<ListGroup>{courses.map(x=><ListRow key={x.id} icon="book-open" tile="#24467F" title={x.code||x.title} subtitle={x.code?x.title:undefined}/>)}</ListGroup>:<Surface><Text style={{fontSize:15,color:c.muted}}>{zh?'还没有课程。连接 Canvas 或在「今天」添加。':'No courses yet. Connect Canvas or add one.'}</Text></Surface>}
  </Section>
 </View>;
}

const GRADE_TERMS=['2025-26 Fall','2025-26 Spring','2026-27 Fall'];
const GRADES=['A+','A','A-','B+','B','B-','C+','C','C-','D','F'];
type CourseStat={course:string;sample:number;enough:boolean;a_share:number|null};
type Dist={course:string;sample:number;enough:boolean;bars:{grade:string;share:number}[]|null};
export function GradesScreen({zh,onBack}:Base){
 const c=usePenColors();
 const [q,setQ]=useState(''),[list,setList]=useState<CourseStat[]|null>(null),[pick,setPick]=useState<string|null>(null),[dist,setDist]=useState<Dist|null>(null),[error,setError]=useState(''),[rev,setRev]=useState(0);
 useEffect(()=>{const t=setTimeout(()=>{void api.request<CourseStat[]>(`/grades?q=${encodeURIComponent(q.trim())}`).then(r=>{setList(r);setError('');setPick(p=>p&&r.some(x=>x.course===p)?p:r[0]?.course??null);}).catch(()=>setError(err(zh)));},250);return()=>clearTimeout(t);},[q,rev]);
 useEffect(()=>{if(!pick){setDist(null);return;}void api.request<Dist>(`/grades/${encodeURIComponent(pick)}`).then(setDist).catch(()=>setDist(null));},[pick,rev]);
 const save=(course:string,grade:string,term:string)=>void session.request('/me/grades',{method:'POST',body:{course,term,grade}}).then(()=>{feel.success();setPick(course.toUpperCase().replace(/^([A-Z]{4})\s?/,'$1 '));setRev(v=>v+1);Alert.alert(zh?'谢谢！':'Thanks!',zh?'你的成绩已匿名计入。':'Saved anonymously.');}).catch(()=>Alert.alert(zh?'保存失败，请检查课程代码。':'Could not save.'));
 const contribute=()=>{if(!session.snapshot().profile){Alert.alert(zh?'登录后才能贡献':'Sign in first');return;}Alert.prompt(zh?'贡献一门课的成绩':'Share a grade',zh?'匿名保存，满 10 人后才公开。格式：COMP 2011 A-':'Anonymous. Format: COMP 2011 A-',[{text:zh?'取消':'Cancel',style:'cancel'},{text:zh?'下一步':'Next',onPress:(v?:string)=>{const m=/^\s*([A-Za-z]{4}\s?\d{4}[A-Za-z]?)\s+([ABCDFabcdf][+-]?)\s*$/.exec(v??'');if(!m||!GRADES.includes(m[2].toUpperCase())){Alert.alert(zh?'格式不对':'Invalid',zh?'例如：COMP 2011 A-':'e.g. COMP 2011 A-');return;}
  Alert.alert(zh?'哪个学期？':'Which term?',undefined,[...GRADE_TERMS.map(t=>({text:t,onPress:()=>save(m[1],m[2].toUpperCase(),t)})),{text:zh?'取消':'Cancel',style:'cancel' as const}]);}}],'plain-text','COMP 2011 ');};
 const aShare=dist?.bars?dist.bars.slice(0,3).reduce((s,b)=>s+b.share,0):0;
 return <View style={{gap:16}}>
  <LifeTop zh={zh} title={zh?'成绩分布':'Grade distribution'} onBack={onBack} right={{icon:'plus',label:zh?'贡献成绩':'Share a grade',onPress:contribute}}/>
  <SearchField value={q} onChangeText={setQ} placeholder={zh?'搜索课程，如 COMP 2011':'Search, e.g. COMP 2011'}/>
  {error?<Notice tone="error" text={error}/>:null}
  {dist?<Surface style={{gap:12}}>
   <View style={{flexDirection:'row',alignItems:'center'}}><View style={{flex:1,gap:2}}><Text style={{fontSize:22,fontWeight:'800',color:c.text}}>{dist.course}</Text><Text style={{fontSize:12,color:c.muted}}>{zh?`同学匿名上报 · 样本 ${dist.sample}`:`Anonymous reports · n=${dist.sample}`}</Text></View>{dist.enough?<Pill label={`A ${zh?'档':''} ${aShare.toFixed(1)}%`} color="#2E9E5B"/>:null}</View>
   {dist.enough&&dist.bars?<View style={{flexDirection:'row',alignItems:'flex-end',gap:5,height:120}}>{dist.bars.map((b,i)=>{const max=Math.max(...dist.bars!.map(x=>x.share),1);return <View key={b.grade} style={{flex:1,alignItems:'center',gap:4}}><View style={{width:'100%',height:Math.max(4,b.share/max*96),borderRadius:6,backgroundColor:i<3?'#2E9E5B':c.fill}}/><Text style={{fontSize:9,color:c.muted}}>{b.grade}</Text></View>;})}</View>
    :<View style={{alignItems:'center',gap:6,paddingVertical:16}}><PenIcon name="lock" size={22} color={c.muted}/><Text style={{fontSize:14,color:c.muted,textAlign:'center'}}>{zh?`还差 ${10-dist.sample} 位同学上报才显示分布，保护每个人的隐私。`:`${10-dist.sample} more reports needed.`}</Text></View>}
  </Surface>:null}
  {list===null?<Skeleton height={160} radius={28}/>:list.length?<ListGroup>{list.map(x=><ListRow key={x.course} onPress={()=>{feel.select();setPick(x.course);}} titleColor={x.course===pick?'#24467F':undefined} title={x.course} subtitle={zh?`样本 ${x.sample}`:`n=${x.sample}`} value={x.enough?`${x.a_share}%`:(zh?'样本不足':'Too few')} valueColor={x.enough?'#2E9E5B':undefined}/>)}</ListGroup>
   :<Surface><EmptyState icon="chart-column" title={zh?'还没有这门课的数据':'No reports yet'} body={zh?'做第一个上报的人，帮到下一届同学。':'Be the first to share.'} action={zh?'贡献成绩':'Share a grade'} onAction={contribute}/></Surface>}
  <Text style={{textAlign:'center',fontSize:12,color:c.muted}}>{zh?'只统计同学自愿匿名上报；不少于 10 人才公开。':'Voluntary anonymous reports; shown at n ≥ 10.'}</Text>
 </View>;
}

const VENUE_TYPES=[{key:'study',icon:'users',color:'#24467F',zh:'图书馆研讨室',en:'Library study rooms',sub:{zh:'小组讨论室',en:'Group study rooms'}},{key:'sport',icon:'feather',color:'#2E7D55',zh:'运动场地',en:'Sports facilities',sub:{zh:'羽毛球、壁球、网球',en:'Badminton, squash, tennis'}},{key:'music',icon:'music',color:'#7A5C8E',zh:'琴房与活动室',en:'Music & activity rooms',sub:{zh:'学生中心',en:'Student centre'}}];
export function BookingScreen({zh,onBack}:Base){
 const c=usePenColors();
 return <View style={{gap:18}}>
  <LifeTop zh={zh} title={zh?'预约场地':'Book a venue'} onBack={onBack}/>
  <Surface style={{gap:10}}>
   <View style={{flexDirection:'row',alignItems:'center',gap:10}}><View style={{width:40,height:40,borderRadius:20,backgroundColor:'#24467F1F',alignItems:'center',justifyContent:'center'}}><PenIcon name="calendar-plus" size={20} color="#24467F"/></View><View style={{flex:1}}><Text style={{fontSize:17,fontWeight:'700',color:c.text}}>{zh?'HKUST 官方预约系统':'HKUST booking system'}</Text><Text style={{fontSize:13,color:c.muted}}>booking.hkust.edu.hk · {zh?'用学校账号登录':'school sign-in'}</Text></View></View>
   <Text style={{fontSize:14,lineHeight:21,color:c.muted}}>{zh?'预约在学校系统完成（需要 HKUST 登录）。这里一步打开，订好后可以到校园墙约人。':'Booking happens in the school system. Open it here, then invite friends on the wall.'}</Text>
   <PrimaryButton icon="external-link" label={zh?'打开官方预约':'Open official booking'} onPress={()=>{feel.tap();void Linking.openURL(BOOKING);}}/>
  </Surface>
  <Section title={zh?'按类型':'By type'}><ListGroup>{VENUE_TYPES.map(v=><ListRow key={v.key} icon={v.icon} tile={v.color} title={zh?v.zh:v.en} subtitle={zh?v.sub.zh:v.sub.en} chevron onPress={()=>void Linking.openURL(BOOKING)}/>)}</ListGroup></Section>
 </View>;
}

type Group={id:string;name:string;code:string;size:number;is_owner:boolean};
type Slots={id:string;name:string;code:string;members:{name:string;you:boolean}[];slots:{start:string;end:string;free:number;total:number}[]};
export function TimeMatchScreen({zh,onBack}:Base){
 const c=usePenColors();
 const [groups,setGroups]=useState<Group[]|null>(null),[open,setOpen]=useState<string|null>(null),[detail,setDetail]=useState<Slots|null>(null),[error,setError]=useState('');
 const load=()=>session.request<Group[]>('/me/time-groups').then(g=>{setGroups(g);setOpen(o=>o&&g.some(x=>x.id===o)?o:g[0]?.id??null);}).catch(()=>setError(err(zh)));
 useEffect(()=>{void load();},[]);
 useEffect(()=>{if(!open){setDetail(null);return;}setDetail(null);void session.request<Slots>(`/me/time-groups/${open}`).then(setDetail).catch(()=>setError(err(zh)));},[open]);
 const create=()=>Alert.prompt(zh?'新建小组':'New group',zh?'例如：COMP 2011 小组':'e.g. COMP 2011 group',[{text:zh?'取消':'Cancel',style:'cancel'},{text:zh?'创建':'Create',onPress:(v?:string)=>{const n=(v??'').trim();if(n)void session.request<Group>('/me/time-groups',{method:'POST',body:{name:n.slice(0,40)}}).then(g=>{feel.success();setOpen(g.id);void load();}).catch(()=>Alert.alert(err(zh)));}}],'plain-text');
 const join=()=>Alert.prompt(zh?'输入小组码':'Group code',zh?'同学分享给你的 6 位码':'6-character code',[{text:zh?'取消':'Cancel',style:'cancel'},{text:zh?'加入':'Join',onPress:(v?:string)=>void session.request<Group>('/me/time-groups/join',{method:'POST',body:{code:(v??'').trim().toUpperCase()}}).then(g=>{feel.success();setOpen(g.id);void load();}).catch(()=>Alert.alert(zh?'找不到这个小组':'Group not found'))}],'plain-text');
 const leave=(g:Group)=>Alert.alert(zh?`退出「${g.name}」？`:`Leave ${g.name}?`,undefined,[{text:zh?'取消':'Cancel',style:'cancel'},{text:zh?'退出':'Leave',style:'destructive',onPress:()=>void session.request(`/me/time-groups/${g.id}`,{method:'DELETE'}).then(()=>{setOpen(null);void load();})}]);
 const cur=groups?.find(g=>g.id===open);
 const fmt=(s:{start:string;end:string})=>{const wd=new Date(Date.parse(s.start)+8*3600e3).getUTCDay();return `${zh?'周'+'日一二三四五六'[wd]:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][wd]} ${hk(s.start).slice(11)}–${hk(s.end).slice(11)}`;};
 return <View style={{gap:18}}>
  <LifeTop zh={zh} title={zh?'一起时间':'Time together'} onBack={onBack} right={{icon:'plus',label:zh?'新建小组':'New group',onPress:create}}/>
  {error?<Notice tone="error" text={error}/>:null}
  {groups&&groups.length>1?<GlassChips label={zh?'小组':'Groups'} value={open??''} onChange={setOpen} items={groups.map(g=>({value:g.id,label:g.name}))}/>:null}
  {groups===null?<Skeleton height={200} radius={28}/>:!groups.length?<Surface style={{gap:12}}><EmptyState icon="users" title={zh?'还没有小组':'No groups yet'} body={zh?'建一个小组，把码发给同学。只比对空闲时段，不会共享任何人的课表。':'Create a group and share the code. Only free slots are compared.'} action={zh?'新建小组':'New group'} onAction={create}/><PrimaryButton tone="soft" label={zh?'我有小组码':'I have a code'} onPress={join}/></Surface>:null}
  {cur?<>
   <Hero label={`${cur.name} · ${cur.size} ${zh?'人':'people'}`} value={detail?String(detail.slots.filter(s=>s.free===s.total).length):'–'} unit={zh?'个共同空档':'common slots'} chip={zh?'只比对空闲时段，不共享课表':'Free slots only, never timetables'} chipIcon="shield-check"/>
   <HeroActions><PrimaryButton label={zh?'邀请同学':'Invite'} onPress={()=>void Share.share({message:zh?`来 USTLIFE 加入「${cur.name}」一起找空闲时间，小组码：${cur.code}`:`Join "${cur.name}" on USTLIFE, code ${cur.code}`})}/><PrimaryButton tone="soft" label={zh?'输入小组码':'Enter code'} onPress={join}/></HeroActions>
   <Section title={zh?'本周共同空档':'Common slots this week'}>{detail===null?<Skeleton height={140} radius={28}/>:detail.slots.length?<ListGroup>{detail.slots.map(s=><ListRow key={s.start} icon="calendar-check" tile={s.free===s.total?'#2E9E5B':'#D98A1C'} title={fmt(s)} subtitle={s.free===s.total?(zh?`${s.total} 人都有空`:`All ${s.total} free`):(zh?`${s.free}/${s.total} 人有空`:`${s.free}/${s.total} free`)} value={zh?'约这个':'Pick'} valueColor="#24467F" onPress={()=>void Share.share({message:zh?`「${cur.name}」${fmt(s)} 一起？`:`${cur.name}: ${fmt(s)}?`})}/>)}</ListGroup>:<Surface><Text style={{fontSize:15,color:c.muted}}>{zh?'这周没有大家都空的时段。':'No common slot this week.'}</Text></Surface>}</Section>
   <Section title={zh?'成员':'Members'}>{detail?<ListGroup>{detail.members.map((m,i)=><ListRow key={i} icon="user-round" tile="#24467F" title={m.you?`${m.name}${zh?'（你）':' (you)'}`:m.name}/>)}<ListRow icon="log-out" tile={c.gray} title={zh?'退出小组':'Leave group'} titleColor={c.red} onPress={()=>leave(cur)}/></ListGroup>:null}</Section>
   <Text style={{textAlign:'center',fontSize:12,color:c.muted}}>{zh?`小组码 ${cur.code} · 空档由每人自己的日程计算，别人看不到你的安排`:`Code ${cur.code} · computed privately from each calendar`}</Text>
  </>:null}
 </View>;
}

type Club={id:string;name:string;category:string;tags:string;url:string|null;followers:number;following:boolean};
const clubIcon:Record<string,[string,string]>={academic:['book-open','#24467F'],sport:['dumbbell','#2E7D55'],culture:['palette','#7A5C8E'],engineering:['cpu','#4F6F8C'],service:['heart-handshake','#D98A1C']};
export function ClubsScreen({zh,onBack}:Base){
 const c=usePenColors();
 const [q,setQ]=useState(''),[cat,setCat]=useState('all'),[clubs,setClubs]=useState<Club[]|null>(null);
 useEffect(()=>{void (session.snapshot().profile?session:api).request<Club[]>('/clubs').then(setClubs).catch(()=>setClubs([]));},[]);
 const toggle=(x:Club)=>{if(!session.snapshot().profile){Alert.alert(zh?'登录后关注':'Sign in to follow');return;}feel.select();setClubs(l=>l?.map(y=>y.id===x.id?{...y,following:!y.following,followers:y.followers+(y.following?-1:1)}:y)??null);void session.request<Club>(`/me/clubs/${x.id}`,{method:'PUT',body:{following:!x.following}}).then(n=>setClubs(l=>l?.map(y=>y.id===n.id?n:y)??null)).catch(()=>setClubs(l=>l?.map(y=>y.id===x.id?x:y)??null));};
 const list=(clubs??[]).filter(x=>(cat==='all'||x.category===cat)&&`${x.name}${x.tags}`.toLowerCase().includes(q.trim().toLowerCase()));
 const top=[...(clubs??[])].sort((a,b)=>b.followers-a.followers)[0];
 return <View style={{gap:16}}>
  <LifeTop zh={zh} title={zh?'社团与组织':'Clubs'} onBack={onBack}/>
  <SearchField value={q} onChangeText={setQ} placeholder={zh?'搜索社团或标签':'Search clubs or tags'}/>
  <GlassChips label={zh?'分类':'Category'} value={cat} onChange={setCat} items={[{value:'all',label:zh?'全部':'All'},{value:'academic',label:zh?'学术':'Academic'},{value:'sport',label:zh?'运动':'Sport'},{value:'culture',label:zh?'文化':'Culture'},{value:'engineering',label:zh?'工程':'Engineering'}]}/>
  {top&&cat==='all'&&!q?<View style={{height:170,borderRadius:28,overflow:'hidden'}}>
   <Image source={covers.photo} resizeMode="cover" style={{position:'absolute',width:'100%',height:'100%'}}/>
   <View style={{flex:1,justifyContent:'space-between',padding:16,backgroundColor:'#00000040'}}>
    <View style={{alignSelf:'flex-start',paddingVertical:4,paddingHorizontal:10,borderRadius:99,backgroundColor:'#FFFFFFE6'}}><Text style={{fontSize:12,fontWeight:'700',color:'#0B0B0C'}}>{zh?'最多人关注':'Most followed'}</Text></View>
    <View><Text style={{fontSize:22,fontWeight:'800',color:'#FFFFFF'}}>{top.name}</Text><Text style={{fontSize:13,color:'#FFFFFFD9'}}>{top.tags} · {zh?`${top.followers} 人关注`:`${top.followers} followers`}</Text></View>
   </View>
  </View>:null}
  {clubs===null?<Skeleton height={200} radius={28}/>:<ListGroup>{list.map(x=>{const [icon,col]=clubIcon[x.category]??['users','#56647D'];return <ListRow key={x.id} icon={icon} tile={col} title={x.name} subtitle={`${x.tags} · ${zh?`${x.followers} 人关注`:`${x.followers} followers`}`} accessory={<Pressable accessibilityRole="button" onPress={()=>toggle(x)} hitSlop={8} style={{paddingVertical:6,paddingHorizontal:12,borderRadius:99,backgroundColor:x.following?'#2E9E5B1F':c.fill}}><Text style={{fontSize:13,fontWeight:'700',color:x.following?'#2E9E5B':c.text}}>{x.following?(zh?'已关注':'Following'):(zh?'关注':'Follow')}</Text></Pressable>}/>;})}</ListGroup>}
  <Text style={{textAlign:'center',fontSize:12,color:c.muted}}>{zh?'首批收录的社团；社团负责人认证后可自行更新活动。':'Initial list; verified club leads can update their pages.'}</Text>
 </View>;
}

const PRESETS=[30,45,60];
export function HallScreen({zh,onBack}:Base){
 const c=usePenColors();
 const [until,setUntil]=useState<number|null>(null),[tick,setTick]=useState(Date.now());
 useEffect(()=>{void Notifications.getAllScheduledNotificationsAsync().then(l=>{const n=l.find(x=>x.identifier==='campus.local.laundry');const t=n?.trigger as {value?:number;date?:number}|undefined;const at=t?.value??t?.date;if(at&&at>Date.now())setUntil(Number(at));});},[]);
 useEffect(()=>{if(!until)return;const t=setInterval(()=>setTick(Date.now()),15_000);return()=>clearInterval(t);},[until]);
 const left=until?Math.max(0,Math.ceil((until-tick)/60000)):null;
 async function start(min:number){
  const perm=await Notifications.requestPermissionsAsync();
  if(!perm.granted){Alert.alert(zh?'需要通知权限':'Notifications off',zh?'在系统设置里允许通知后，洗好了会提醒你。':'Allow notifications in Settings.');return;}
  const at=Date.now()+min*60_000;
  await Notifications.cancelScheduledNotificationAsync('campus.local.laundry').catch(()=>{});
  await Notifications.scheduleNotificationAsync({identifier:'campus.local.laundry',content:{title:zh?'衣服洗好了':'Laundry is done',body:zh?'15 分钟内去取，避免被别人拿出来。':'Collect within 15 min.'},trigger:{type:Notifications.SchedulableTriggerInputTypes.DATE,date:new Date(at)}});
  feel.success();setUntil(at);setTick(Date.now());
 }
 async function cancel(){await Notifications.cancelScheduledNotificationAsync('campus.local.laundry').catch(()=>{});setUntil(null);feel.tap();}
 return <View style={{gap:18}}>
  <LifeTop zh={zh} title={zh?'宿舍服务':'Hall services'} onBack={onBack}/>
  <Hero label={zh?'洗衣计时':'Laundry timer'} value={left===null?'–':String(left)} unit={zh?'分钟':'min'} chip={left===null?(zh?'放好衣服，点一下开始计时':'Start when the machine starts'):left===0?(zh?'洗好了，去取吧':'Done — go collect'):(zh?`${hk(new Date(until!).toISOString()).slice(11)} 洗好 · 到时推送提醒`:`Done at ${hk(new Date(until!).toISOString()).slice(11)}`)} chipIcon="timer"/>
  {until?<HeroActions><PrimaryButton tone="soft" label={zh?'取消计时':'Cancel'} onPress={()=>void cancel()}/></HeroActions>
   :<View style={{flexDirection:'row',gap:10}}>{PRESETS.map((m,i)=><View key={m} style={{flex:1}}><PrimaryButton tone={i===0?'accent':'soft'} label={zh?`${m} 分钟`:`${m} min`} onPress={()=>void start(m)}/></View>)}</View>}
  <ListGroup>
   <ListRow icon="wrench" tile="#D98A1C" title={zh?'宿舍报修与住宿事务':'Hall repairs & housing'} subtitle={zh?'学生住宿官方网站':'Official student housing site'} chevron onPress={()=>void Linking.openURL('https://sao.hkust.edu.hk/')}/>
  </ListGroup>
  <Text style={{textAlign:'center',fontSize:12,color:c.muted}}>{zh?'洗衣机实时状态需要宿舍系统开放接口；计时提醒在本机运行。':'Live machine status needs the hall system; the timer runs on this phone.'}</Text>
 </View>;
}

export function ServicesScreen({zh,onBack,onOpen}:Base&{onOpen:(key:string)=>void}){
 const c=usePenColors();
 const [q,setQ]=useState('');
 const entries=useMemo(()=>[
  {key:'academics',icon:'graduation-cap',color:'#24467F',name:zh?'学业':'Academics',sub:zh?'课程 · 分布 · 空闲':'Courses · grades'},
  {key:'booking',icon:'calendar-plus',color:'#2E7D55',name:zh?'预约场地':'Book venue',sub:zh?'官方预约系统':'Official system'},
  {key:'timematch',icon:'users',color:'#7A5C8E',name:zh?'一起时间':'Time together',sub:zh?'找共同空闲':'Common free time'},
  {key:'clubs',icon:'heart',color:'#E5484D',name:zh?'社团':'Clubs',sub:zh?'关注 · 活动':'Follow · events'},
  {key:'hall',icon:'washing-machine',color:'#4F6F8C',name:zh?'宿舍服务':'Hall',sub:zh?'洗衣计时 · 报修':'Laundry · repairs'},
  {key:'market',icon:'shopping-bag',color:'#A9824C',name:zh?'二手与换宿':'Market',sub:zh?'来自校园墙':'From the wall'},
  {key:'places:study',icon:'library',color:'#24467F',name:zh?'图书馆与自习':'Library & study',sub:zh?'开放时间 · 位置':'Hours · location'},
  {key:'transit',icon:'bus',color:'#4F6F8C',name:zh?'交通':'Transport',sub:zh?'校巴 · 九巴 · 小巴':'Shuttle · bus'},
  {key:'places:shop',icon:'shopping-cart',color:'#A9824C',name:zh?'吃喝与购物':'Food & shops',sub:zh?'餐厅 · 超市':'Dining · shops'},
  {key:'places:service',icon:'life-buoy',color:'#56647D',name:zh?'学生服务':'Student services',sub:zh?'诊所 · 银行 · 自提柜':'Clinic · bank · lockers'},
  {key:'affairs',icon:'clipboard-check',color:'#D98A1C',name:zh?'办事指南':'How-to guides',sub:zh?'续借 · 加退选 · 学生证':'Renew · add/drop'},
  {key:'map',icon:'map',color:'#2E7D55',name:zh?'找课室':'Find a room',sub:'Path Advisor'},
 ],[zh]);
 const list=entries.filter(e=>`${e.name}${e.sub}`.toLowerCase().includes(q.trim().toLowerCase()));
 return <View style={{gap:16}}>
  <LifeTop zh={zh} title={zh?'校园服务':'Campus services'} onBack={onBack} right={{icon:'map',label:zh?'地图':'Map',onPress:()=>onOpen('map')}}/>
  <SearchField value={q} onChangeText={setQ} placeholder={zh?'校园里的任何东西…':'Anything on campus…'}/>
  <Grid>{list.map(e=><Pressable key={e.key} accessibilityRole="button" accessibilityLabel={e.name} onPress={()=>{feel.tap();onOpen(e.key);}} style={({pressed})=>({width:'48.5%',gap:12,padding:16,borderRadius:24,borderCurve:'continuous',backgroundColor:c.surface,boxShadow:'0 6px 18px #1B35660D',transform:[{scale:pressed?0.97:1}]})}>
   <View style={{width:40,height:40,borderRadius:20,alignItems:'center',justifyContent:'center',backgroundColor:e.color+'1F'}}><PenIcon name={e.icon} size={20} color={e.color}/></View>
   <View style={{gap:2}}><Text style={{fontSize:16,fontWeight:'700',color:c.text}}>{e.name}</Text><Text numberOfLines={1} style={{fontSize:12,color:c.muted}}>{e.sub}</Text></View>
  </Pressable>)}</Grid>
 </View>;
}

import {useSceneFocus} from '../navigation/TabScene';
import {useCallback,useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {AppState,Image,Pressable,ScrollView,Text,View} from 'react-native';
import Svg,{Defs,LinearGradient,Rect,Stop} from 'react-native-svg';
import { Button } from '../ui/Primitives';
import { Input } from '../ui/Primitives';
import {FilterPill,PenIcon,PillRow,PrimaryButton,TextAction,ViewAll,usePenColors} from '../ui/Pen';
import {useAppearance} from '../ui/Appearance';
import {session} from '../runtime';
import {ApiFailure} from '../api';
import {styles} from '../theme';
import type {Language} from '../strings';
import type {Activity} from '../../../../src/product/social/types';
import {parseHongKongInput} from '../study/dates';
import {socialError,participationLabel} from './shared';
import {activityCover,cardDateTime,interactionLabel,languageLabel} from './covers';
import {ActivityForm} from './ActivityForm';
import {ActivityDetail} from './ActivityDetail';
type Filters={q:string;kind:string;interaction:string;language:string;mine:string;from:string;to:string};
const emptyFilters:Filters={q:'',kind:'',interaction:'',language:'',mine:'',from:'',to:''};

const relative=(iso:string,zh:boolean)=>{const d=Math.round((Date.parse(iso.slice(0,10))-Date.parse(new Date(Date.now()+8*3600e3).toISOString().slice(0,10)))/864e5);const t=cardDateTime(iso).slice(6);return d<=0?(zh?`今天 ${t}`:`Today ${t}`):d===1?(zh?`明天 ${t}`:`Tomorrow ${t}`):zh?`${d} 天后`:`in ${d}d`;};
/** V3 featured card (Plasma "Offers"): full-bleed photo, white time pill, title over a soft dark fade. */
function FeaturedCard({activity:a,zh,onOpen}:{activity:Activity;zh:boolean;onOpen:()=>void}){
 const {reduceMotion}=useAppearance();
 const status=a.mine?.participation?participationLabel(a.mine.participation.status,zh):null;
 return <Pressable accessibilityRole="button" accessibilityLabel={`${a.title}, ${cardDateTime(a.starts_at)}, ${a.location}`} onPress={onOpen} style={({pressed})=>({width:284,height:340,borderRadius:30,borderCurve:'continuous',overflow:'hidden',transform:[{scale:pressed&&!reduceMotion?0.98:1}]})}>
  <Image source={activityCover(a)} resizeMode="cover" accessible={false} style={{position:'absolute',width:'100%',height:'100%'}}/>
  <Svg style={{position:'absolute',width:'100%',height:'100%'}}><Defs><LinearGradient id="fade" x1="0" y1="0" x2="0" y2="1"><Stop offset="0.45" stopColor="#000000" stopOpacity={0}/><Stop offset="1" stopColor="#000000" stopOpacity={0.62}/></LinearGradient></Defs><Rect width="100%" height="100%" fill="url(#fade)"/></Svg>
  <View style={{flex:1,padding:18,justifyContent:'space-between'}}>
   <View style={{flexDirection:'row',gap:6}}><View style={{paddingVertical:6,paddingHorizontal:12,borderRadius:99,backgroundColor:'#FFFFFF'}}><Text style={{fontSize:14,fontWeight:'600',color:'#0B0B0C'}}>{relative(a.starts_at,zh)}</Text></View>{status?<View style={{paddingVertical:6,paddingHorizontal:12,borderRadius:99,backgroundColor:'#2E9E5B'}}><Text style={{fontSize:14,fontWeight:'600',color:'#FFFFFF'}}>{status}</Text></View>:null}</View>
   <View style={{gap:4}}>
    <Text numberOfLines={2} style={{fontSize:25,lineHeight:31,fontWeight:'700',color:'#FFFFFF',letterSpacing:-0.4}}>{a.title}</Text>
    <Text numberOfLines={2} style={{fontSize:15,lineHeight:21,color:'#FFFFFFD9'}}>{interactionLabel(a.interaction,zh)} · {a.location} · {a.counts.confirmed}/{a.capacity} {zh?'人':''}</Text>
   </View>
  </View>
 </Pressable>;
}
/** V3 list row (Plasma transactions): round photo, title and time, places on the right. */
function ActivityRow({activity:a,zh,last,onOpen}:{activity:Activity;zh:boolean;last:boolean;onOpen:()=>void}){
 const c=usePenColors(),full=a.counts.remaining<=0,status=a.mine?.participation?participationLabel(a.mine.participation.status,zh):null;
 return <Pressable accessibilityRole="button" accessibilityLabel={a.title} onPress={onOpen} style={({pressed})=>({flexDirection:'row',alignItems:'center',gap:14,paddingLeft:18,opacity:pressed?0.6:1})}>
  <Image source={activityCover(a)} style={{width:48,height:48,borderRadius:24}}/>
  <View style={{flex:1,flexDirection:'row',alignItems:'center',gap:10,paddingVertical:14,paddingRight:18,borderBottomWidth:last?0:0.5,borderBottomColor:c.border}}>
   <View style={{flex:1,gap:3}}><Text numberOfLines={1} style={{fontSize:17,fontWeight:'500',color:c.text}}>{a.title}</Text><Text numberOfLines={1} style={{fontSize:14,color:c.muted}}>{relative(a.starts_at,zh)} · {a.location}</Text></View>
   <View style={{alignItems:'flex-end',gap:2}}><Text style={{fontSize:16,fontWeight:'600',color:status?c.green:full?c.orange:c.text,fontVariant:['tabular-nums']}}>{status??(full?(zh?'可候补':'Waitlist'):`${a.counts.confirmed}/${a.capacity}`)}</Text><Text style={{fontSize:12,color:c.muted}}>{a.cost_minor?`HK$ ${(a.cost_minor/100).toFixed(0)}`:(zh?'免费':'Free')}</Text></View>
  </View>
 </Pressable>;
}

export function DiscoverScreen({language,dark,onLogin,initialId,onDismissTarget,onNavigate,onDepthChange,createRequest=0}:{language:Language;dark:boolean;onLogin:()=>void;initialId:string|null;onDismissTarget:()=>void;onNavigate:()=>void;onDepthChange?:(nested:boolean)=>void;createRequest?:number}){
 const sceneActive=useSceneFocus();
 const zh=language==='zh',c=usePenColors(),profile=useSyncExternalStore(session.subscribe,session.snapshot).profile;
 const [selected,setSelected]=useState<string|null>(initialId),[creating,setCreating]=useState(false),[filtersOpen,setFiltersOpen]=useState(false);
 const [filters,setFilters]=useState<Filters>(emptyFilters),[applied,setApplied]=useState(filters);
 const [items,setItems]=useState<Activity[]>([]),[cursor,setCursor]=useState<string|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');const epoch=useRef(0),lock=useRef(false);
 useEffect(()=>{if(initialId)setSelected(initialId);},[initialId]);
 useEffect(onNavigate,[selected,creating,onNavigate]);
 useEffect(()=>{onDepthChange?.(selected!==null||creating);},[selected,creating,onDepthChange]);
 // The Discover large-title plus button (Pen MjoHv) starts an activity.
 const created=useRef(createRequest);
 useEffect(()=>{if(createRequest===created.current)return;created.current=createRequest;if(profile)setCreating(true);else onLogin();},[createRequest]);
 const load=useCallback(async(next?:string)=>{if(lock.current&&next)return;lock.current=true;const generation=++epoch.current;setBusy(true);setError('');try{
  const query=new URLSearchParams({limit:'20'});for(const [key,value]of Object.entries(applied))if(value)query.set(key,key==='from'||key==='to'?parseHongKongInput(value)!:value);if(next)query.set('cursor',next);
  const page=await session.request<{items:Activity[];next_cursor:string|null}>('/activities?'+query.toString());
  if(generation===epoch.current){setItems(old=>next?[...old,...page.items.filter(x=>!old.some(y=>y.id===x.id))]:page.items);setCursor(page.next_cursor);}
 }catch(e){if(generation===epoch.current){setItems([]);setCursor(null);setError(e instanceof Error&&!(e instanceof ApiFailure)?(zh?'时间格式应为 YYYY-MM-DD HH:mm。':'Use YYYY-MM-DD HH:mm for the time window.'):socialError(e,language));}}finally{if(generation===epoch.current){lock.current=false;setBusy(false);}}},[applied,language]);
 useEffect(()=>{if(!sceneActive||selected||creating)return;void load();const listener=AppState.addEventListener('change',state=>{if(state==='active')void load();});return()=>{epoch.current++;lock.current=false;listener.remove();};},[load,selected,creating,sceneActive]);
 if(creating)return <ActivityForm language={language} dark={dark} onBack={()=>setCreating(false)} onSaved={id=>{setCreating(false);setSelected(id);}}/>;
 if(selected)return <ActivityDetail key={selected} id={selected} language={language} dark={dark} onLogin={onLogin} onNavigate={onNavigate} onBack={()=>{setSelected(null);onDismissTarget();}}/>;
 const choose=(key:keyof Filters,value:string)=>setFilters({...filters,[key]:value});
 // Interaction pills apply immediately, as on the board; the 筛选 pill opens the remaining conditions.
 const quick=(interaction:string)=>{const next={...filters,interaction};setFilters(next);setApplied(next);};
 const filtered=JSON.stringify(applied)!==JSON.stringify(emptyFilters);
 const options=(key:keyof Filters,values:[string,string][])=> <PillRow>{values.map(([value,label])=><FilterPill key={value} label={label} selected={filters[key]===value} onPress={()=>choose(key,value)}/>)}</PillRow>;
 return <View style={{gap:18}}>
  <PillRow>
   <FilterPill label={zh?'全部':'All'} selected={!applied.interaction} onPress={()=>quick('')}/>
   <FilterPill label={interactionLabel('quiet',zh)} selected={applied.interaction==='quiet'} onPress={()=>quick('quiet')}/>
   <FilterPill label={interactionLabel('casual',zh)} selected={applied.interaction==='casual'} onPress={()=>quick('casual')}/>
   <FilterPill label={zh?'筛选':'Filters'} icon="sliders-horizontal" selected={filtersOpen} onPress={()=>setFiltersOpen(!filtersOpen)}/>
  </PillRow>
  {filtersOpen?<View style={{gap:12,padding:16,borderRadius:14,backgroundColor:c.surface}}>
   <Input accessibilityLabel={zh?'搜索标题或地点':'Search title or place'} value={filters.q} onChangeText={v=>choose('q',v)} placeholder={zh?'标题／地点':'Title / place'}/>
   {options('kind',[['',zh?'全部类型':'All types'],['activity',zh?'活动':'Activities'],['study',zh?'学习组队':'Study groups']])}
   {options('language',[['',zh?'所有语言':'All languages'],['zh',zh?'普通话':'Mandarin'],['en','English'],['yue',zh?'粤语':'Cantonese']])}
   {options('interaction',[['',zh?'所有方式':'Any style'],['quiet',interactionLabel('quiet',zh)],['casual',interactionLabel('casual',zh)],['active',interactionLabel('active',zh)]])}
   {profile?options('mine',[['',zh?'发现活动':'Discover'],['organized',zh?'我组织的':'Organized'],['participating',zh?'我的参与':'Participating'],['saved',zh?'收藏／日程':'Saved']]):null}
   <Text style={{fontSize:13,lineHeight:19,color:c.muted}}>{zh?'可选：香港时间窗口（YYYY-MM-DD HH:mm）。不会分享你的课表。':'Optional Hong Kong time window (YYYY-MM-DD HH:mm). Your timetable is not shared.'}</Text>
   <Input accessibilityLabel={zh?'时间窗开始':'Window start'} value={filters.from} onChangeText={v=>choose('from',v)} placeholder="2026-10-05 10:00"/>
   <Input accessibilityLabel={zh?'时间窗结束':'Window end'} value={filters.to} onChangeText={v=>choose('to',v)} placeholder="2026-10-05 18:00"/>
   <View style={{flexDirection:'row'}}><PrimaryButton label={zh?'查看结果':'Show results'} disabled={busy} onPress={()=>{setFiltersOpen(false);if(JSON.stringify(filters)===JSON.stringify(applied))void load();else setApplied({...filters});}}/></View>
  </View>:null}
  {error?<View style={{gap:8,padding:16,borderRadius:14,backgroundColor:c.surface}}><Text accessibilityRole="alert" style={{fontSize:15,lineHeight:22,color:c.danger}}>{error}</Text><Button variant="secondary" isDisabled={busy} onPress={()=>void load()}>{zh?'重试':'Try again'}</Button></View>:null}
  {!busy&&!error&&!items.length?<View style={{alignItems:'center',gap:10,paddingVertical:28}}>
   <PenIcon name="search-x" size={44} strokeWidth={1.8} color={c.muted}/>
   <Text style={{fontSize:21,lineHeight:30,fontWeight:'700',color:c.text}}>{zh?'暂时没有合适的':'Nothing fits right now'}</Text>
   <Text style={{fontSize:15,lineHeight:22,color:c.muted,textAlign:'center'}}>{zh?'放宽一点条件，或发起自己的小计划。':'Loosen a condition, or start a small plan of your own.'}</Text>
   {filtered?<View style={{flexDirection:'row',alignSelf:'stretch',marginTop:8}}><PrimaryButton label={zh?'清除筛选':'Clear filters'} onPress={()=>{setFilters(emptyFilters);setApplied(emptyFilters);}}/></View>:null}
   <TextAction color={c.accent} label={zh?'发起一个小计划':'Start a small plan'} onPress={()=>profile?setCreating(true):onLogin()}/>
  </View>:null}
  {items.length?<View style={{gap:12}}>
   <Text style={{paddingHorizontal:4,fontSize:20,fontWeight:'700',color:c.text}}>{zh?'即将开始':'Coming up'}</Text>
   <ScrollView horizontal showsHorizontalScrollIndicator={false} decelerationRate="fast" snapToInterval={296} style={{marginHorizontal:-16}} contentContainerStyle={{paddingHorizontal:16,gap:12}}>{items.slice(0,5).map(a=><FeaturedCard key={a.id} activity={a} zh={zh} onOpen={()=>setSelected(a.id)}/>)}</ScrollView>
  </View>:null}
  {items.length?<View style={{gap:12}}>
   <Text style={{paddingHorizontal:4,fontSize:20,fontWeight:'700',color:c.text}}>{zh?'全部活动':'All activities'}</Text>
   <View style={{backgroundColor:c.surface,borderRadius:24,overflow:'hidden',boxShadow:'0 2px 12px #00000008'}}>{items.map((a,i)=><ActivityRow key={a.id} activity={a} zh={zh} last={i===items.length-1&&!cursor} onOpen={()=>setSelected(a.id)}/>)}{cursor?<View style={{borderTopWidth:0.5,borderTopColor:c.border}}><ViewAll label={zh?'加载更多':'Load more'} onPress={()=>void load(cursor)}/></View>:null}</View>
  </View>:null}
  {items.length?<Text style={[styles.caption,{fontSize:12,textAlign:'center',color:c.muted}]}>{zh?'示例内容 · 不代表真实开放的活动':'Sample content · Not real open activities'}</Text>:null}
 </View>;
}

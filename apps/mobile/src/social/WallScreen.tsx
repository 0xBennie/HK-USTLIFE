import {feel} from '../ui/feel';
import {ClassmateScreen,CompanyScreen} from '../life/SocialExtras';
import {usePageTop} from '../navigation/TabScene';
import {useSceneFocus} from '../navigation/TabScene';
import {useCallback,useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {AppState,Pressable,Text,TextInput,View} from 'react-native';
import Svg,{Defs,LinearGradient,Rect,Stop} from 'react-native-svg';
import {EmptyState,FilterPill,Notice,PenIcon,PillRow,Skeleton,Stagger,ViewAll,usePenColors,GlassChips} from '../ui/Pen';
import {WallPostCard,topicMeta,topicOf} from './wall-ui';
import { Button, SegmentedControl } from '../ui/Primitives';
import { Card } from '../ui/Primitives';
import { Input } from '../ui/Primitives';
import {api,session} from '../runtime';
import {palette,styles} from '../theme';
import type {Language} from '../strings';
import type {WallPost} from '../../../../src/product/social/wall-types';
import {dateTimeInZone} from '../study/dates';
import {wallError,postStatus} from './wall-shared';
import {WallForm} from './WallForm';
import {WallDetail} from './WallDetail';
export function WallScreen({language,dark,onLogin,initialId,onDismissTarget,onNavigate,onDepthChange,createRequest=0,onActivities=()=>{}}:{language:Language;dark:boolean;onLogin:()=>void;initialId:string|null;onDismissTarget:()=>void;onNavigate:()=>void;onDepthChange?:(nested:boolean)=>void;createRequest?:number;onActivities?:()=>void}){
 const sceneActive=useSceneFocus();
 const zh=language==='zh',c=usePenColors(),profile=useSyncExternalStore(session.subscribe,session.snapshot).profile;
 const [company,setCompany]=useState<string|null>(null),[employer,setEmployer]=useState<Promo|null>(null),[person,setPerson]=useState<{id:string;display_name:string}|null>(null);
 const [selected,setSelected]=useState(initialId),[creating,setCreating]=useState(false),[q,setQ]=useState(''),[filters,setFilters]=useState<{q:string;kind:string;mine:boolean;topic?:string}>({q:'',kind:'',mine:false});
 const [items,setItems]=useState<WallPost[]>([]),[cursor,setCursor]=useState<string|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');const epoch=useRef(0),lock=useRef(false);
 // Only verified, non-sample employers may appear in the feed; with none, no promotion is shown.
 useEffect(()=>{void api.request<{id:string;sample:boolean}[]>('/employers').then(list=>{const real=list.find(e=>!e.sample);return real?api.request<Promo>(`/employers/${real.id}`).then(setEmployer):undefined;}).catch(()=>{});},[]);
 useEffect(()=>{if(initialId){setCreating(false);setSelected(initialId);}},[initialId]);
 useEffect(onNavigate,[selected,creating,onNavigate]);
 // The Discover large-title plus button opens the post form (Pen MjoHv).
 const created=useRef(createRequest);
 useEffect(()=>{if(createRequest===created.current)return;created.current=createRequest;if(profile)setCreating(true);else onLogin();},[createRequest]);
 useEffect(()=>{onDepthChange?.(selected!==null||creating);},[selected,creating,onDepthChange]);
 const load=useCallback(async(next?:string)=>{if(next&&lock.current)return;lock.current=true;const generation=++epoch.current;setBusy(true);setError('');try{
  const query=new URLSearchParams();if(filters.q)query.set('q',filters.q);if(filters.kind)query.set('kind',filters.kind);if(filters.topic)query.set('topic',filters.topic);if(filters.mine)query.set('mine','true');if(next)query.set('cursor',next);
  const page=await session.request<{items:WallPost[];next_cursor:string|null}>('/posts?'+query.toString());
  if(generation===epoch.current){setItems(old=>next?[...old,...page.items.filter(x=>!old.some(y=>y.id===x.id))]:page.items);setCursor(page.next_cursor);}
 }catch(e){if(generation===epoch.current){setItems([]);setCursor(null);setError(wallError(e,language));}}finally{if(generation===epoch.current){lock.current=false;setBusy(false);}}},[filters,language]);
 useEffect(()=>{if(!sceneActive||selected||creating)return;void load();const listener=AppState.addEventListener('change',s=>{if(s==='active')void load();});return()=>{epoch.current++;lock.current=false;listener.remove();};},[load,selected,creating,sceneActive]);
 usePageTop(`${company}${person?.id}${selected}${creating}`);
 if(creating)return <WallForm language={language} dark={dark} onBack={()=>setCreating(false)} onSaved={id=>{setCreating(false);setSelected(id);}}/>;
 if(company)return <CompanyScreen zh={zh} id={company} onBack={()=>setCompany(null)}/>;
 if(person)return <ClassmateScreen zh={zh} author={person} onBack={()=>setPerson(null)} onOpenPost={id=>{setPerson(null);setSelected(id);}}/>;
 if(selected)return <WallDetail key={selected} id={selected} language={language} dark={dark} onLogin={onLogin} onNavigate={onNavigate} onBack={()=>{setSelected(null);onDismissTarget();}}/>;
 const topicFilter=filters.kind==='help'?'question':filters.topic??'';
 const hot=items.filter(p=>p.status==='open').sort((a,b)=>b.reply_count-a.reply_count)[0];
 const pickTopic=(t:string)=>setFilters({...filters,kind:t==='question'?'help':'',topic:t&&t!=='question'?t:undefined});
 return <View style={{gap:16}}>
  <View style={{flexDirection:'row',justifyContent:'space-between'}}>
   {[...(['question','buddy','market','share'] as const).map(t=>({key:t,icon:topicMeta[t].icon,color:topicMeta[t].color,label:zh?topicMeta[t].zh:topicMeta[t].en,on:topicFilter===t,press:()=>{feel.select();pickTopic(topicFilter===t?'':t);}})),{key:'act',icon:'calendar-heart',color:'#56647D',label:zh?'活动':'Events',on:false,press:()=>{feel.tap();onActivities();}}].map(b=><Pressable key={b.key} accessibilityRole="button" accessibilityState={{selected:b.on}} onPress={b.press} style={({pressed})=>({alignItems:'center',gap:7,width:68,transform:[{scale:pressed?0.94:1}]})}>
    <View style={{width:56,height:56,borderRadius:28,alignItems:'center',justifyContent:'center',backgroundColor:b.on?b.color:c.surface,borderWidth:1,borderColor:b.on?b.color:c.glassBorder,boxShadow:b.on?`0 8px 18px ${b.color}55`:'0 4px 14px #1B35660F'}}><PenIcon name={b.icon} size={23} strokeWidth={2.2} color={b.on?'#FFFFFF':b.color}/></View>
    <Text style={{fontSize:12,fontWeight:b.on?'800':'600',color:b.on?b.color:c.text}}>{b.label}</Text>
   </Pressable>)}
  </View>
  <View style={{flexDirection:'row',alignItems:'center',gap:8,height:46,paddingHorizontal:16,borderRadius:23,backgroundColor:c.surface,borderWidth:1,borderColor:c.glassBorder}}>
   <PenIcon name="search" size={17} color={c.muted}/>
   <TextInput accessibilityLabel={zh?'搜索校园墙':'Search campus wall'} value={q} onChangeText={setQ} onSubmitEditing={()=>setFilters({...filters,q})} returnKeyType="search" maxLength={120} placeholder={zh?'搜索问题、搭子、二手…':'Search questions, buddies, items…'} placeholderTextColor={c.muted} clearButtonMode="while-editing" style={{flex:1,fontSize:16,color:c.text}}/>
  </View>
  {hot&&!filters.q&&!topicFilter&&hot.reply_count>0?<Pressable accessibilityRole="button" onPress={()=>setSelected(hot.id)} style={{flexDirection:'row',alignItems:'center',gap:12,paddingVertical:14,paddingHorizontal:16,borderRadius:22,backgroundColor:c.surface,borderWidth:1,borderColor:c.glassBorder}}>
   <View style={{width:34,height:34,borderRadius:17,backgroundColor:'#E5484D1F',alignItems:'center',justifyContent:'center'}}><PenIcon name="flame" size={18} color="#E5484D"/></View>
   <View style={{flex:1,gap:1}}><Text style={{fontSize:12,fontWeight:'600',color:c.red}}>{zh?'今日热议':'Trending'}</Text><Text numberOfLines={1} style={{fontSize:15,fontWeight:'600',color:c.text}}>{hot.title}</Text></View>
   <PenIcon name="chevron-right" size={16} color={c.tertiary}/>
  </Pressable>:null}
  <GlassChips label={zh?'帖子范围':'Posts'} value={filters.mine?'mine':'all'} onChange={v=>setFilters({...filters,mine:v==='mine'})} items={[{value:'all',label:zh?'最新':'Latest'},...(profile?[{value:'mine' as const,label:zh?'我发的':'Mine'}]:[])] as {value:'all'|'mine';label:string}[]}/>
  {error?<Notice tone="error" text={error} action={zh?'重试':'Retry'} onAction={()=>void load()}/>:null}
  {busy&&!items.length?<><Skeleton height={220} radius={28}/><Skeleton height={160} radius={28}/></>:null}
  {!busy&&!error&&!items.length?<EmptyState icon="messages-square" title={zh?'这里还很安静':'It is quiet here'} body={zh?'问第一个问题，或者约个搭子。':'Ask the first question or find a buddy.'} action={zh?'发一条':'Post'} onAction={()=>profile?setCreating(true):onLogin()}/>:null}
  {items.map((p,i)=><View key={p.id} style={{gap:16}}>
   <Stagger index={i}><WallPostCard post={p} zh={zh} onOpen={()=>setSelected(p.id)} onAuthor={p.is_mine?undefined:()=>setPerson(p.author)}/></Stagger>
   {i===0&&employer&&!topicFilter&&!filters.mine?<SponsoredCard zh={zh} employer={employer} onOpen={()=>setCompany(employer.id)}/>:null}
  </View>)}
  {cursor?<ViewAll label={zh?'加载更多':'Load more'} onPress={()=>void load(cursor)}/>:null}
 </View>;
}
type Promo={id:string;name:string;tagline:string;sample:boolean;jobs:{id:string;title:string;detail:string}[]};
/** Pen "Sponsored 校招": rendered only for a verified employer from /employers (never sample data). */
function SponsoredCard({zh,employer,onOpen}:{zh:boolean;employer:Promo;onOpen:()=>void}){
 const job=employer.jobs[0];
 return <Pressable accessibilityRole="button" onPress={onOpen} style={({pressed})=>({gap:12,padding:18,borderRadius:28,overflow:'hidden',boxShadow:'0 12px 28px #1E336040',transform:[{scale:pressed?0.985:1}]})}>
  <Svg style={{position:'absolute',top:0,left:0,right:0,bottom:0}}><Defs><LinearGradient id="ad" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#1B1B3A"/><Stop offset="1" stopColor="#1E3360"/></LinearGradient></Defs><Rect width="100%" height="100%" fill="url(#ad)"/></Svg>
  <View style={{flexDirection:'row',alignItems:'center',gap:10}}>
   <View style={{width:40,height:40,borderRadius:12,backgroundColor:'#FFFFFF',alignItems:'center',justifyContent:'center'}}><Text style={{fontSize:20,fontWeight:'800',color:'#1E3360'}}>{employer.name.slice(0,1)}</Text></View>
   <View style={{flex:1}}><Text numberOfLines={1} style={{fontSize:15,fontWeight:'700',color:'#FFFFFF'}}>{employer.name}</Text><Text numberOfLines={1} style={{fontSize:12,color:'#FFFFFFB3'}}>{employer.tagline}</Text></View>
   <View style={{paddingVertical:4,paddingHorizontal:10,borderRadius:99,backgroundColor:'#FFFFFF26'}}><Text style={{fontSize:12,fontWeight:'700',color:'#FFFFFF'}}>{zh?'推广':'Ad'}</Text></View>
  </View>
  {job?<Text style={{fontSize:20,lineHeight:27,fontWeight:'700',color:'#FFFFFF'}}>{job.title}</Text>:null}
  {job?<View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>{job.detail.split(' · ').filter(Boolean).map(t=><View key={t} style={{paddingVertical:4,paddingHorizontal:10,borderRadius:99,backgroundColor:'#FFFFFF1F'}}><Text style={{fontSize:12,fontWeight:'700',color:'#FFFFFF'}}>{t}</Text></View>)}</View>:null}
 </Pressable>;
}

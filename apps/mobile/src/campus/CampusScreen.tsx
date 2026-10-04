import {DepartureBoard} from './DepartureBoard';
import {AffairsScreen} from '../affairs/AffairsScreen';
import {useSceneFocus} from '../navigation/TabScene';
import {useSceneNavigation} from '../navigation/InputProtection';
import {PublicTransitScreen} from './PublicTransitScreen';
import {DirectoryScreen} from './DirectoryScreen';
import {TargetActions} from './TargetActions';
import {liveAlternatives,type LiveOption} from './live';
import {useEffect,useMemo,useRef,useState,useSyncExternalStore} from 'react';
import {AppState,Linking,Pressable,ScrollView,Text,TextInput,View} from 'react-native';
import Svg,{Circle} from 'react-native-svg';
import {api,session} from '../runtime';
import type {Language} from '../strings';
import type {ShuttleRoute,ShuttleDepartures} from '../../../../src/product/campus/shuttle';
import type {directoryData} from '../../../../src/product/campus/directory-data';
import {CircleButton,EmptyState,Hero,HeroActions,IconTile,ListGroup,ListRow,Notice,PageHeader,PenIcon,PrimaryButton,Section,Skeleton,Stagger,Surface,TopBar,ViewAll,usePenColors,GlassChips,ProgressRing} from '../ui/Pen';

// Pen board "V2 / 校园 / 我的下一班" (gWkUE): search, my next ride with live alternatives, affairs, saved, campus life.
type Catalog={routes:ShuttleRoute[];freshness:string;refresh_due_at:string};
type Place=typeof directoryData[number]&{version:number;freshness:string};
type Affair={id:string;template:{title:{zh:string;en:string};steps:{id:string;text:{zh:string;en:string}}[]};step_checks:Record<string,boolean>;personal_due:{kind:'date';date:string}|{kind:'time';at:string}|null;requires_review:boolean};
type Page={kind:'home'}|{kind:'route';id:string}|{kind:'routes'}|{kind:'directory';category?:string;placeId?:string}|{kind:'transit'}|{kind:'affairs'};
const PATH_ADVISOR='https://pathadvisor.ust.hk/';
const destinationKey=(id:string)=>id.replace(/^campus-to-/,'');
const minutesUntil=(scheduled:string)=>Math.round((Date.parse(scheduled)-Date.now())/60000);
const hkDate=()=>new Date(Date.now()+8*3600e3).toISOString().slice(0,10);

export function CampusScreen({language,dark,onLogin,name,onMe}:{language:Language;dark:boolean;onLogin:()=>void;name?:string;onMe?:()=>void}) {
 const zh=language==='zh',c=usePenColors(),sceneActive=useSceneFocus(),navigate=useSceneNavigation(zh);
 const profile=useSyncExternalStore(session.subscribe,session.snapshot).profile;
 const [page,setPage]=useState<Page>({kind:'home'});
 const [catalog,setCatalog]=useState<Catalog|null>(null),[places,setPlaces]=useState<Place[]>([]),[marks,setMarks]=useState<{target_kind:string;target_id:string}[]>([]),[affairs,setAffairs]=useState<Affair[]>([]);
 const [routeId,setRouteId]=useState<string|null>(null),[departures,setDepartures]=useState<ShuttleDepartures|null>(null),[nextDay,setNextDay]=useState<{date:string;time:string}|null>(null),[live,setLive]=useState<LiveOption[]|null>(null);
 const [error,setError]=useState(false),[q,setQ]=useState(''),[revision,setRevision]=useState(0),[searching,setSearching]=useState(false);
 const reload=useRef(0);
 useEffect(()=>{if(!sceneActive||page.kind!=='home')return;let active=true;const run=++reload.current;
  void(async()=>{try{
   const [cat,pl,bm,af]=await Promise.all([api.request<Catalog>('/transport/routes'),api.request<Place[]>('/campus/places'),profile?session.request<{target_kind:string;target_id:string}[]>('/me/campus/bookmarks'):Promise.resolve([]),profile?session.request<{items:Affair[]}>('/me/affairs?limit=10&state=active').catch(()=>({items:[]})):Promise.resolve({items:[]})]);
   if(!active||run!==reload.current)return;setCatalog(cat);setPlaces(pl);setMarks(bm);setAffairs(af.items);setError(false);
   setRouteId(old=>old??bm.find(b=>b.target_kind==='shuttle'&&b.target_id.startsWith('campus-to-'))?.target_id??'campus-to-hang-hau');
  }catch{if(active)setError(true);}})();
  const sub=AppState.addEventListener('change',s=>{if(s==='active')setRevision(v=>v+1);});
  return()=>{active=false;sub.remove();};
 },[sceneActive,page.kind,profile?.id,revision]);
 useEffect(()=>{if(!routeId||!sceneActive||page.kind!=='home')return;const signal={cancelled:false};setDepartures(null);setNextDay(null);setLive(null);
  void(async()=>{try{
   const d=await api.request<ShuttleDepartures>(`/transport/routes/${routeId}/departures`);if(signal.cancelled)return;setDepartures(d);
   if(!d.upcoming.length){for(let i=1;i<=7;i++){const day=new Date(Date.parse(hkDate()+'T00:00:00+08:00')+i*864e5);const n=await api.request<ShuttleDepartures>(`/transport/routes/${routeId}/departures?at=${encodeURIComponent(day.toISOString())}`);if(signal.cancelled)return;if(n.status==='scheduled'&&n.upcoming[0]){setNextDay({date:n.service_date,time:n.upcoming[0].local_time});break;}}}
  }catch{if(!signal.cancelled)setDepartures(null);}})();
  const refreshLive=()=>void liveAlternatives(destinationKey(routeId),signal).then(v=>{if(!signal.cancelled)setLive(v);});
  refreshLive();const timer=setInterval(refreshLive,60000);
  return()=>{signal.cancelled=true;clearInterval(timer);};
 },[routeId,sceneActive,page.kind]);
 const outbound=useMemo(()=>(catalog?.routes??[]).filter(r=>r.id.startsWith('campus-to-')),[catalog]);
 const go=(p:Page)=>navigate(()=>setPage(p));
 const home=()=>navigate(()=>setPage({kind:'home'}));
 if(page.kind==='transit')return <PublicTransitScreen language={language} dark={dark} onBack={home}/>;
 if(page.kind==='directory')return <DirectoryScreen language={language} dark={dark} onBack={home} onLogin={onLogin} initialCategory={page.category} initialId={page.placeId}/>;
 if(page.kind==='affairs')return <AffairsScreen language={language} dark={dark} onBack={home} onLogin={onLogin}/>;
 if(page.kind==='route')return <RouteDetail id={page.id} language={language} dark={dark} onBack={()=>go({kind:'routes'})} onLogin={onLogin}/>;
 if(page.kind==='routes')return <RouteList catalog={catalog} language={language} onBack={home} onRoute={id=>go({kind:'route',id})} onTransit={()=>go({kind:'transit'})}/>;
 const route=outbound.find(r=>r.id===routeId);
 const first=departures?.upcoming[0];
 const query=q.trim().toLowerCase();
 const roomLike=/^[a-z]{0,4}\s?\d{3,4}[a-z]?$/i.test(q.trim());
 const placeHits=query?places.filter(p=>`${p.name.zh} ${p.name.en} ${p.location.zh} ${p.location.en} ${p.description.zh}`.toLowerCase().includes(query)).slice(0,5):[];
 const routeHits=query?(catalog?.routes??[]).filter(r=>`${r.name.zh} ${r.name.en} ${r.origin} ${r.destination}`.toLowerCase().includes(query)).slice(0,4):[];
 const savedPlaces=marks.filter(m=>m.target_kind==='place').map(m=>places.find(p=>p.id===m.target_id)).filter((p):p is Place=>!!p);
 const chipLabel=(r:ShuttleRoute)=>(r.name[language].split('→').pop()??'').trim();
 const byCat=(k:string)=>places.filter(p=>p.category===k);
 const names=(list:Place[])=>[...new Set(list.map(p=>p.name[language].replace(/（.*?）|\(.*?\)/g,'').trim()))].slice(0,2).join(' · ');
 const tiles:[string,string,string,string,()=>void][]=[
  ['library',c.indigo,zh?'学习空间':'Study spaces',names(byCat('study')),()=>go({kind:'directory',category:'study'})],
  ['shopping-bag','#A9824C',zh?'吃喝与购物':'Food & shops',names(byCat('shop')),()=>go({kind:'directory',category:'shop'})],
  ['life-buoy',c.blue,zh?'学生服务':'Student services',names(byCat('service')),()=>go({kind:'directory',category:'service'})],
  ['map',c.teal,zh?'找课室 ↗':'Find a room ↗',zh?'房间号 · Path Advisor':'Room no. · Path Advisor',()=>void Linking.openURL(PATH_ADVISOR)],
 ];
 return <View style={{gap:22}}>
  <TopBar name={name} onAvatar={onMe} title={zh?'校园':'Campus'} right={<CircleButton icon={searching?'x':'search'} label={zh?'搜索':'Search'} onPress={()=>{setSearching(!searching);setQ('');}}/>}/>
  {searching?<View style={{flexDirection:'row',alignItems:'center',gap:8,height:48,paddingHorizontal:14,borderRadius:24,backgroundColor:c.surface,boxShadow:'0 2px 12px #00000008'}}>
   <PenIcon name="search" size={18} color={c.muted}/>
   <TextInput autoFocus accessibilityLabel={zh?'搜索地点、路线或房间号':'Search places, routes or room numbers'} value={q} onChangeText={setQ} placeholder={zh?'地点、路线、办事，或房间号':'Places, routes, services or room no.'} placeholderTextColor={c.muted} returnKeyType="search" clearButtonMode="while-editing" style={{flex:1,fontSize:17,color:c.text}}/>
  </View>:null}
  {query?<View style={{gap:10}}>
   {roomLike?<ListGroup><ListRow icon="map" tile={c.teal} title={zh?`在 Path Advisor 找 ${q.trim().toUpperCase()}`:`Find ${q.trim().toUpperCase()} in Path Advisor`} subtitle={zh?'学校官方课室导航 · 显示电梯和路线':'Official HKUST room finder'} chevron onPress={()=>void Linking.openURL(PATH_ADVISOR)}/></ListGroup>:null}
   {placeHits.length?<ListGroup header={zh?'地点与服务':'Places'}>{placeHits.map(p=><ListRow key={p.id} icon={p.category==='study'?'library':p.category==='shop'?'shopping-bag':'life-buoy'} tile={p.category==='study'?c.indigo:p.category==='shop'?'#A9824C':c.accent} title={p.name[language]} subtitle={p.location[language]} chevron onPress={()=>go({kind:'directory',placeId:p.id})}/>)}</ListGroup>:null}
   {routeHits.length?<ListGroup header={zh?'校巴路线':'Shuttles'}>{routeHits.map(r=><ListRow key={r.id} icon="bus" tile={c.teal} title={r.name[language]} chevron onPress={()=>go({kind:'route',id:r.id})}/>)}</ListGroup>:null}
   {!roomLike&&!placeHits.length&&!routeHits.length?<EmptyState icon="search-x" title={zh?'没有找到':'No results'} body={zh?'试试地点名、路线目的地，或输入房间号如 2465。':'Try a place, a destination, or a room number like 2465.'}/>:null}
  </View>:<>
  {error?<Notice tone="error" text={zh?'暂时无法更新校园信息。':'Could not update campus info.'} action={zh?'重试':'Retry'} onAction={()=>setRevision(v=>v+1)}/>:null}

  <Section title={zh?'去哪里':'Where to'}>
   <GlassChips label={zh?'目的地':'Destination'} value={routeId??''} onChange={v=>setRouteId(v)} items={outbound.map(r=>({value:r.id,label:chipLabel(r)}))}/>
   {route?<Stagger index={0}><DepartureBoard zh={zh} title={zh?`校巴 · 往${chipLabel(route)}`:`Shuttle · to ${chipLabel(route)}`}
    label={first?(zh?'下一班':'Next'):nextDay?(zh?`${formatDay(nextDay.date,zh)}首班`:`${formatDay(nextDay.date,zh)} first`):(zh?'暂无班次':'No departures')}
    time={first?first.local_time:nextDay?nextDay.time:null} minutes={first?minutesUntil(first.scheduled_at):nextDay?Math.max(0,Math.round((Date.parse(`${nextDay.date}T${nextDay.time}:00+08:00`)-Date.now())/60000)):null}
    later={(departures?.upcoming??[]).slice(1,5).map(d=>d.local_time)} note={!first?(zh?'今天校巴已停运，可坐下方小巴或巴士。':'No more shuttles today — try a bus below.'):undefined}
    live={live===null?null:live.map(l=>({code:l.code,operator:l.operator,name:`${l.operator==='gmb'?(zh?'绿色小巴':'Minibus'):(zh?'九巴':'KMB')} · ${l.gate[language]}`,minutes:l.minutes}))}
    onOpen={()=>go({kind:'route',id:route.id})} onRoutes={()=>go({kind:'routes'})} onBuses={()=>go({kind:'transit'})}/></Stagger>:<Skeleton height={300} radius={30}/>}
   <Text style={{paddingHorizontal:4,fontSize:12,color:c.muted}}>{zh?'校巴为公布时刻表；巴士和小巴为运营方实时预测。':'Shuttles follow published timetables; buses show operator live predictions.'}</Text>
  </Section>
  {affairs.length?<Section title={zh?'办事进度':'In progress'} link={zh?'全部指南':'All guides'} onLink={()=>go({kind:'affairs'})}>{affairs.slice(0,2).map((a,i)=>{const steps=a.template.steps,done=steps.filter(s=>a.step_checks[s.id]).length,next=steps.find(s=>!a.step_checks[s.id]);
   return <Stagger key={a.id} index={i}><Surface onPress={()=>go({kind:'affairs'})} label={a.template.title[language]}><View style={{flexDirection:'row',alignItems:'center',gap:14}}>
    <ProgressRing done={done} total={steps.length}/>
    <View style={{flex:1,gap:2}}><Text style={{fontSize:17,fontWeight:'600',color:c.text}}>{a.template.title[language]}</Text><Text numberOfLines={1} style={{fontSize:13,color:a.requires_review?c.orange:c.muted}}>{a.requires_review?(zh?'官方说明有更新，请核对':'Official guide changed — review'):!next?(zh?'步骤都完成了':'All steps done'):`${zh?'下一步：':'Next: '}${next.text[language]}${a.personal_due?.kind==='date'?(zh?` · ${Number(a.personal_due.date.slice(5,7))} 月 ${Number(a.personal_due.date.slice(8))} 日前`:` · by ${a.personal_due.date.slice(5)}`):''}`}</Text></View>
    <PenIcon name="chevron-right" size={16} color={c.tertiary}/>
   </View></Surface></Stagger>;})}</Section>:null}
  {savedPlaces.length?<Section title={zh?'我的常用':'Saved'}><ListGroup>{savedPlaces.map(p=><ListRow key={p.id} icon={p.category==='study'?'book-open':p.category==='shop'?'shopping-bag':'package'} tile={p.category==='study'?c.indigo:p.category==='shop'?'#A9824C':c.orange} title={p.name[language]} subtitle={p.location[language]} chevron onPress={()=>go({kind:'directory',placeId:p.id})}/>)}</ListGroup></Section>:null}
  <Section title={zh?'校园生活':'Campus life'}>
   {[tiles.slice(0,2),tiles.slice(2)].map((row,r)=><View key={r} style={{flexDirection:'row',gap:10}}>{row.map(([icon,col,t,s,on])=><Pressable key={t} accessibilityRole="button" accessibilityLabel={t} onPress={on} style={({pressed})=>({flex:1,gap:14,padding:14,borderRadius:18,backgroundColor:c.surface,opacity:pressed?0.7:1})}>
    <IconTile icon={icon} color={col} size={36}/>
    <View style={{gap:2}}><Text style={{fontSize:16,fontWeight:'600',color:c.text}}>{t}</Text><Text numberOfLines={1} style={{fontSize:12,color:c.muted}}>{s||'—'}</Text></View>
   </Pressable>)}</View>)}
  </Section>
  <ListGroup><ListRow icon="clipboard-check" tile={c.orange} title={zh?'办事指南':'How-to guides'} subtitle={zh?'续借、加退选、补办学生证':'Renewals, add/drop, student card'} chevron onPress={()=>go({kind:'affairs'})}/></ListGroup>
  </>}
 </View>;
}
function formatDay(date:string,zh:boolean){const wd=new Date(date+'T00:00:00Z').getUTCDay();return zh?`周${'日一二三四五六'[wd]}`:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][wd];}
function RouteList({catalog,language,onBack,onRoute,onTransit}:{catalog:Catalog|null;language:Language;onBack:()=>void;onRoute:(id:string)=>void;onTransit:()=>void}){
 const zh=language==='zh',c=usePenColors();
 const all=catalog?.routes??[],out=all.filter(r=>r.id.startsWith('campus-to-')||r.id.endsWith('-to-east-point-city')),inbound=all.filter(r=>!out.includes(r));
 const row=(r:ShuttleRoute)=><ListRow key={r.id} icon="bus" tile={c.teal} title={r.name[language]} subtitle={`${r.eligibility==='student_only'?(zh?'学生专用':'Students only'):(zh?'学生及职员':'Students & staff')} · ${r.fare_minor?`HK$ ${(r.fare_minor/100).toFixed(1)}`:(zh?'免费':'Free')}`} chevron onPress={()=>onRoute(r.id)}/>;
 return <View style={{gap:18}}>
  <PageHeader onBack={onBack} backLabel={zh?'校园':'Campus'} title={zh?'校巴时刻表':'Campus shuttles'} subtitle={zh?'计划班次 · 非实时车况':'Scheduled service · not live tracking'}/>
  {!catalog?<><Skeleton/><Skeleton/></>:null}
  {out.length?<ListGroup header={zh?'从科大出发':'From HKUST'}>{out.map(row)}</ListGroup>:null}
  {inbound.length?<ListGroup header={zh?'回科大':'To HKUST'}>{inbound.map(row)}</ListGroup>:null}
  <ListGroup><ListRow icon="bus-front" tile={c.green} title={zh?'九巴与绿色小巴':'KMB & green minibuses'} subtitle={zh?'实时到站':'Live arrivals'} chevron onPress={onTransit}/></ListGroup>
 </View>;
}
// Pen board "13 / Shuttle route" (n71ixQ).
function RouteDetail({id,language,dark,onBack,onLogin}:{id:string;language:Language;dark:boolean;onBack:()=>void;onLogin:()=>void}){
 const zh=language==='zh',c=usePenColors(),active=useSceneFocus();
 const [d,setD]=useState<ShuttleDepartures|null>(null),[error,setError]=useState(false);
 useEffect(()=>{if(!active)return;let live=true;const load=()=>api.request<ShuttleDepartures>(`/transport/routes/${id}/departures`).then(v=>{if(live){setD(v);setError(false);}}).catch(()=>{if(live)setError(true);});void load();const t=setInterval(load,60000);return()=>{live=false;clearInterval(t);};},[id,active]);
 const status:Record<string,string>={scheduled:zh?'今天有班次':'Running today',finished_for_day:zh?'今天的班次已结束':'Finished for today',public_holiday:zh?'公众假期：没有常规班次':'Public holiday: no regular service',non_operating_day:zh?'今天不运行':'Not running today',outside_service_period:zh?'超出公布服务期':'Outside service period',stale:zh?'资料待更新，请核对官方页面':'Needs review; check the official page',holiday_coverage_unknown:zh?'该年份假期未核验':'Holiday calendar unverified'};
 const next=d?.upcoming??[];
 return <View style={{gap:18}}>
  <PageHeader onBack={onBack} backLabel={zh?'路线':'Routes'} eyebrow={zh?'计划班次 · 非实时车辆位置':'Scheduled · not live vehicle position'} title={d?.route.name[language]??'…'} subtitle={d?`${d.route.origin} → ${d.route.destination}`:undefined}/>
  {error?<Notice tone="error" text={zh?'未能取得最新班次，已隐藏结果。':'Could not refresh departures.'}/>:null}
  {!d&&!error?<><Skeleton height={140}/><Skeleton/></>:null}
  {d?<>
   <Notice tone={d.status==='scheduled'?'success':'warning'} text={`${status[d.status]??d.status} · ${d.service_date}${d.holiday?` · ${d.holiday}`:''}`}/>
   {next.length?<View style={{backgroundColor:c.surface,borderRadius:18,overflow:'hidden'}}>{next.slice(0,6).map((t,i)=>{const m=minutesUntil(t.scheduled_at);return <View key={t.scheduled_at} style={{flexDirection:'row',alignItems:'center',gap:12,paddingVertical:13,paddingHorizontal:16,borderBottomWidth:i<Math.min(next.length,6)-1?0.5:0,borderBottomColor:c.border}}>
    <View style={{width:10,height:10,borderRadius:5,backgroundColor:i===0?c.teal:'transparent',borderWidth:i===0?0:1.5,borderColor:c.tertiary}}/>
    <Text style={{flex:1,fontSize:20,fontWeight:i===0?'700':'500',color:c.text,fontVariant:['tabular-nums']}}>{t.local_time}</Text>
    <Text style={{fontSize:15,fontWeight:i===0?'600':'400',color:i===0?c.teal:c.muted}}>{m<=0?(zh?'即将开出':'Now'):zh?`${m} 分钟后`:`in ${m} min`}</Text>
   </View>;})}</View>:null}
   <ListGroup header={zh?'全部公布时刻':'Published times'}><View style={{padding:14,flexDirection:'row',flexWrap:'wrap',gap:8}}>{d.timetable.map(t=><View key={t.scheduled_at} style={{paddingVertical:5,paddingHorizontal:10,borderRadius:8,backgroundColor:c.fill}}><Text style={{fontSize:14,color:c.text,fontVariant:['tabular-nums']}}>{t.local_time}</Text></View>)}</View></ListGroup>
   <ListGroup>
    <ListRow icon="map-pin" tile={c.accent} title={zh?'上客点':'Boarding point'} subtitle={zh?'站点说明与官方地图':'Official boarding maps'} chevron onPress={()=>void Linking.openURL(d.source.url)}/>
    <ListRow icon="info" tile={c.gray} title={zh?'数据来源与更新时间':'Source & freshness'} subtitle={`${zh?'核对于':'Checked'} ${d.source.retrieved_at.slice(0,10)} · ${d.route.valid_from} — ${d.route.valid_to}`} chevron onPress={()=>void Linking.openURL(d.source.url)}/>
   </ListGroup>
   <Text style={{paddingHorizontal:16,fontSize:12,lineHeight:17,color:c.muted}}>{zh?'上车需出示校方认可的证件或二维码；本 App 不能代替乘车验证。':'Show school-recognized ID or QR when boarding; this app is not a boarding pass.'}</Text>
   <TargetActions key={id} target={{target_kind:'shuttle',target_id:id}} language={language} dark={dark} onLogin={onLogin}/>
  </>:null}
 </View>;
}

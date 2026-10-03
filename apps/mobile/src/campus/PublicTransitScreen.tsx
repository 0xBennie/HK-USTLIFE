import {useSceneFocus} from '../navigation/TabScene';
import {useEffect,useRef,useState} from 'react';
import {AppState,Linking,Text,TextInput,View} from 'react-native';
import {api} from '../runtime';
import type {Language} from '../strings';
import type {PublicRoute,TransitArrivals,TransitCatalog,TransitStops} from '../../../../src/product/campus/public-transit-types';
import {visibleTransitArrivals} from './transit-state';
import {EmptyState,FilterPill,ListGroup,ListRow,Notice,PageHeader,PenIcon,PillRow,Skeleton,Stagger,usePenColors} from '../ui/Pen';
const hkTime=(s:string)=>new Date(s).toLocaleTimeString('en-GB',{timeZone:'Asia/Hong_Kong',hour:'2-digit',minute:'2-digit',hour12:false});
// Pen "public-transit" / "transit-detail" boards: route → boarding stop → live arrivals.
export function PublicTransitScreen({language,onBack}:{language:Language;dark:boolean;onBack:()=>void}) {
 const sceneActive=useSceneFocus();
 const zh=language==='zh',c=usePenColors();
 const [route,setRoute]=useState<PublicRoute|null>(null),[sequence,setSequence]=useState<number|null>(null),[search,setSearch]=useState(''),[operator,setOperator]=useState<''|'kmb'|'gmb'>('');
 const [catalog,setCatalog]=useState<TransitCatalog|null>(null),[stops,setStops]=useState<TransitStops|null>(null),[arrivals,setArrivals]=useState<TransitArrivals|null>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState(false),[clock,setClock]=useState(Date.now());
 const refresh=useRef<()=>Promise<void>>(async()=>{}),epoch=useRef(0);
 useEffect(()=>{
  if(!sceneActive){setArrivals(null);return;}
  let active=true;
  const load=async()=>{
   const request=++epoch.current;setBusy(true);setError(false);
   try {
    if(!route){const result=await api.request<TransitCatalog>('/transport/public/routes');if(active&&request===epoch.current)setCatalog(result);}
    else {
     const path=`/transport/public/routes/${encodeURIComponent(route.id)}`;
     const [mapping,predictions]=await Promise.all([api.request<TransitStops>(`${path}/stops`),sequence===null?Promise.resolve(null):api.request<TransitArrivals>(`${path}/arrivals?stop_sequence=${sequence}`)]);
     if(active&&request===epoch.current){setStops(mapping);setArrivals(predictions);}
    }
   }catch{if(active&&request===epoch.current){setError(true);setArrivals(null);}}
   finally{if(active&&request===epoch.current){setBusy(false);setClock(Date.now());}}
  };
  refresh.current=load;void load();
  const timer=setInterval(()=>{if(AppState.currentState==='active')void load();},30000);
  const tick=sequence===null?null:setInterval(()=>setClock(Date.now()),1000);
  const subscription=AppState.addEventListener('change',state=>{setArrivals(null);setClock(Date.now());if(state==='active')void load();else epoch.current++;});
  return()=>{active=false;epoch.current++;clearInterval(timer);if(tick)clearInterval(tick);subscription.remove();};
 },[route?.id,sequence,sceneActive]);
 const labels:Record<string,string>={not_listed:zh?'运营商目录暂未列出此路线':'Not in the operator catalog',available:zh?'运营商实时预测':'Live operator predictions',no_predictions:zh?'暂时没有到站预测（不代表停运）':'No predictions right now (not a suspension)',unavailable:zh?'暂时无法查询':'Unavailable right now',stale:zh?'资料已过期，请刷新':'Data expired — refresh',disabled:zh?'运营商已暂停此站预报':'Predictions disabled for this stop'};
 const visible=visibleTransitArrivals(sceneActive?arrivals:null,clock);
 const query=search.trim().toLowerCase();
 const routes=catalog?.routes.filter(r=>(!operator||r.operator===operator)&&`${r.code} ${r.origin.zh} ${r.origin.en} ${r.destination.zh} ${r.destination.en}`.toLowerCase().includes(query))??[];
 const stopList=stops?.status==='available'?stops.stops.filter(s=>`${s.name.zh} ${s.name.en}`.toLowerCase().includes(query)):[];
 const badge=(r:PublicRoute)=><View style={{minWidth:52,paddingVertical:4,paddingHorizontal:6,borderRadius:8,alignItems:'center',backgroundColor:r.operator==='gmb'?c.green:c.danger}}><Text style={{fontSize:14,fontWeight:'800',color:'#FFFFFF'}}>{r.code}</Text></View>;
 const back=()=>{if(sequence!==null){setSequence(null);setArrivals(null);}else if(route){setRoute(null);setStops(null);setSearch('');}else onBack();};
 const searchBox=(placeholder:string)=><View style={{flexDirection:'row',alignItems:'center',gap:8,height:44,paddingHorizontal:12,borderRadius:12,backgroundColor:c.fill}}><PenIcon name="search" size={17} color={c.muted}/><TextInput accessibilityLabel={placeholder} value={search} onChangeText={setSearch} placeholder={placeholder} placeholderTextColor={c.muted} clearButtonMode="while-editing" style={{flex:1,fontSize:16,color:c.text}}/></View>;
 if(route&&sequence!==null){
  const stopName=arrivals?.stop?.name[language]??stops?.stops.find(s=>s.sequence===sequence)?.name[language]??'';
  return <View style={{gap:18}}>
   <PageHeader onBack={back} backLabel={zh?'站点':'Stops'} eyebrow={`${route.operator==='kmb'?(zh?'九巴':'KMB'):(zh?'绿色小巴':'Minibus')} ${route.code} · ${zh?'往':'to'} ${route.destination[language]}`} title={stopName} subtitle={zh?'到站预测每 30 秒更新':'Updates every 30 seconds'}/>
   {error?<Notice tone="error" text={zh?'连接失败，已隐藏预测。':'Connection failed; predictions hidden.'} action={zh?'重试':'Retry'} onAction={()=>void refresh.current()}/>:null}
   {!visible&&busy?<Skeleton height={150}/>:null}
   {visible?<>
    {visible.status!=='available'?<Notice tone="warning" text={labels[visible.status]}/>:null}
    {visible.arrivals.length?<View style={{backgroundColor:c.surface,borderRadius:18,overflow:'hidden'}}>{visible.arrivals.map((a,i)=>{const m=Math.max(0,Math.round((Date.parse(a.at)-clock)/60000));return <Stagger key={`${a.at}${i}`} index={i}><View style={{flexDirection:'row',alignItems:'center',gap:12,paddingVertical:14,paddingHorizontal:16,borderBottomWidth:i<visible.arrivals.length-1?0.5:0,borderBottomColor:c.border}}>
     <View style={{width:8,height:8,borderRadius:4,backgroundColor:c.green}}/>
     <View style={{flex:1,gap:2}}><Text style={{fontSize:22,fontWeight:i===0?'700':'500',color:c.text,fontVariant:['tabular-nums']}}>{m===0?(zh?'即将到站':'Due'):zh?`${m} 分钟`:`${m} min`}</Text>{a.remark[language]?<Text style={{fontSize:12,color:c.muted}}>{a.remark[language]}</Text>:null}</View>
     <Text style={{fontSize:15,color:c.muted,fontVariant:['tabular-nums']}}>{hkTime(a.at)}</Text>
    </View></Stagger>;})}</View>:null}
    {visible.messages.map((m,i)=><Notice key={i} text={m[language]}/>)}
   </>:null}
   {arrivals?.source?<Text style={{paddingHorizontal:16,fontSize:12,color:c.muted}}>{zh?'运营商生成':'Operator generated'} {hkTime(arrivals.source.generated_at)}{arrivals.expires_at?` · ${zh?'有效至':'valid until'} ${hkTime(arrivals.expires_at)}`:''}</Text>:null}
   <ListGroup><ListRow icon="file-text" tile={c.gray} title={zh?'运营商数据来源':'Operator data source'} chevron onPress={()=>void Linking.openURL(arrivals?.source?.url??route.source.url)}/></ListGroup>
  </View>;
 }
 if(route)return <View style={{gap:18}}>
  <PageHeader onBack={back} backLabel={zh?'路线':'Routes'} eyebrow={route.operator==='kmb'?(zh?'九巴':'KMB'):(zh?'新界绿色小巴':'NT green minibus')} title={`${route.code} · ${zh?'往':'to'} ${route.destination[language]}`} subtitle={zh?'选择上车站，查看实时到站':'Choose your boarding stop for live arrivals'}/>
  {route.remark[language]?<Notice text={route.remark[language]}/>:null}
  {searchBox(zh?'上车站名称':'Boarding stop')}
  {stops&&stops.status!=='available'?<Notice tone="warning" text={labels[stops.status]}/>:null}
  {!stops&&busy?<><Skeleton/><Skeleton/></>:null}
  {stopList.length?<ListGroup>{stopList.map(s=><ListRow key={s.sequence} icon={/科技大|SCIENCE/i.test(s.name.zh+s.name.en)?'graduation-cap':'map-pin'} tile={/科技大|SCIENCE/i.test(s.name.zh+s.name.en)?c.accent:c.gray} title={s.name[language]} subtitle={`${zh?'第':'Stop'} ${s.sequence}${zh?' 站':''}`} chevron onPress={()=>{setSequence(s.sequence);setArrivals(null);setSearch('');}}/>)}</ListGroup>:stops?.status==='available'&&!busy?<EmptyState icon="search-x" title={zh?'没有匹配的站点':'No matching stops'}/>:null}
 </View>;
 return <View style={{gap:18}}>
  <PageHeader onBack={back} backLabel={zh?'校园':'Campus'} title={zh?'九巴与绿色小巴':'KMB & minibuses'} subtitle={zh?'进出科大的巴士和小巴，实时到站':'Buses and minibuses serving HKUST, live'}/>
  {searchBox(zh?'路线号或目的地':'Route or destination')}
  <PillRow>{([['',zh?'全部':'All'],['gmb',zh?'绿色小巴':'Minibus'],['kmb',zh?'九巴':'KMB']] as const).map(([v,l])=><FilterPill key={v} label={l} selected={operator===v} onPress={()=>setOperator(v)}/>)}</PillRow>
  {error?<Notice tone="error" text={zh?'连接失败，请联网后重试。':'Connection failed.'} action={zh?'重试':'Retry'} onAction={()=>void refresh.current()}/>:null}
  {catalog?.issues.map(issue=><Notice key={`${issue.operator}:${issue.route_code}`} tone="warning" text={`${issue.operator.toUpperCase()} ${issue.route_code}: ${labels[issue.reason]}`}/>)}
  {!catalog&&busy?<><Skeleton/><Skeleton/><Skeleton/></>:null}
  {routes.length?<ListGroup>{routes.map(r=><ListRow key={r.id} title={`${zh?'往':'to'} ${r.destination[language]}`} subtitle={`${zh?'由':'from'} ${r.origin[language]}`} accessory={badge(r)} chevron onPress={()=>{setRoute(r);setSearch('');setStops(null);}}/>)}</ListGroup>:catalog&&!busy?<EmptyState icon="search-x" title={zh?'没有匹配的路线':'No matching routes'}/>:null}
  <ListGroup><ListRow icon="info" tile={c.gray} title={zh?'校方公共交通指引':'HKUST transport guide'} chevron onPress={()=>void Linking.openURL('https://cso.hkust.edu.hk/index.php/tran/pt')}/></ListGroup>
 </View>;
}

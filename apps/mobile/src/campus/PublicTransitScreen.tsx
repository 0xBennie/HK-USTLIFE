import {useEffect,useRef,useState} from 'react';
import {AppState,Linking,Text,View} from 'react-native';
import {Button} from 'heroui-native/button';
import {Card} from 'heroui-native/card';
import {Input} from 'heroui-native/input';
import {api} from '../runtime';
import {palette,styles} from '../theme';
import type {Language} from '../strings';
import type {PublicRoute,TransitArrivals,TransitCatalog,TransitStops} from '../../../../src/product/campus/public-transit-types';
import {visibleTransitArrivals} from './transit-state';
const hkTime=(s:string)=>new Date(s).toLocaleString('en-GB',{timeZone:'Asia/Hong_Kong',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false});
export function PublicTransitScreen({language,dark,onBack}:{language:Language;dark:boolean;onBack:()=>void}) {
 const zh=language==='zh',c=palette[dark?'dark':'light'];
 const [route,setRoute]=useState<PublicRoute|null>(null),[sequence,setSequence]=useState<number|null>(null),[search,setSearch]=useState('');
 const [catalog,setCatalog]=useState<TransitCatalog|null>(null),[stops,setStops]=useState<TransitStops|null>(null),[arrivals,setArrivals]=useState<TransitArrivals|null>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState(false),[linkError,setLinkError]=useState(false),[clock,setClock]=useState(Date.now());
 const refresh=useRef<()=>Promise<void>>(async()=>{}),epoch=useRef(0);
 useEffect(()=>{
  let active=true;
  const load=async()=>{
   const request=++epoch.current;setBusy(true);setError(false);setArrivals(null);
   try {
    if(!route){const result=await api.request<TransitCatalog>('/transport/public/routes');if(active&&request===epoch.current)setCatalog(result);}
    else {
     const path=`/transport/public/routes/${encodeURIComponent(route.id)}`;
     const [mapping,predictions]=await Promise.all([api.request<TransitStops>(`${path}/stops`),sequence===null?Promise.resolve(null):api.request<TransitArrivals>(`${path}/arrivals?stop_sequence=${sequence}`)]);
     if(active&&request===epoch.current){setStops(mapping);setArrivals(predictions);}
    }
   }catch{if(active&&request===epoch.current){setError(true);setCatalog(null);setStops(null);setArrivals(null);}}
   finally{if(active&&request===epoch.current){setBusy(false);setClock(Date.now());}}
  };
  refresh.current=load;void load();
  const timer=setInterval(()=>{if(AppState.currentState==='active')void load();},60000);
  const tick=sequence===null?null:setInterval(()=>setClock(Date.now()),1000);
  const subscription=AppState.addEventListener('change',state=>{
   setArrivals(null);setClock(Date.now());if(state==='active')void load();else epoch.current++;
  });
  return()=>{active=false;epoch.current++;clearInterval(timer);if(tick)clearInterval(tick);subscription.remove();};
 },[route?.id,sequence]);
 const open=async(url:string)=>{try{setLinkError(false);await Linking.openURL(url);}catch{setLinkError(true);}};
 const labels:Record<string,string>={not_listed:zh?'运营商当前目录没有此路线，暂不提供查询。':'Not listed in the current operator catalog; query unavailable.',available:zh?'运营商到站预测':'Operator arrival predictions',no_predictions:zh?'暂时没有到站预测；不代表路线停运。':'No predictions currently available; this does not mean the route is suspended.',unavailable:zh?'暂时无法查询，请稍后刷新或查看官方来源。':'Query unavailable. Refresh later or check the official source.',stale:zh?'资料已过期，已隐藏预测，请刷新。':'Source data expired. Predictions are hidden; refresh to retry.',disabled:zh?'运营商已暂停此站的到站预报。':'The operator has disabled predictions for this stop.'};
 const visible=visibleTransitArrivals(arrivals,clock);
 const query=search.trim().toLowerCase();
 const routes=catalog?.routes.filter(r=>`${r.code} ${r.origin.zh} ${r.origin.en} ${r.destination.zh} ${r.destination.en}`.toLowerCase().includes(query))??[];
 const stopList=stops?.status==='available'?stops.stops.filter(s=>`${s.name.zh} ${s.name.en}`.toLowerCase().includes(query)):[];
 return <View style={styles.stack}>
  <Button variant="ghost" onPress={()=>{if(sequence!==null){setSequence(null);setArrivals(null);}else if(route){setRoute(null);setStops(null);setSearch('');}else onBack();}}>{sequence!==null?(zh?'返回站点':'Back to stops'):route?(zh?'返回公共路线':'Back to public routes'):(zh?'返回校园交通':'Back to campus transport')}</Button>
  <Text style={[styles.title,{color:c.text}]}>{zh?'九巴与绿色小巴':'KMB and green minibuses'}</Text>
  <Text style={[styles.caption,{color:c.muted}]}>{zh?'覆盖科大相关九巴 91、91M、91B、91P、291P 和新界小巴 11、11B、11S、104、11M、12。':'Coverage: KMB 91, 91M, 91B, 91P, 291P and NT GMB 11, 11B, 11S, 104, 11M, 12.'}</Text>
  <Text style={[styles.caption,{color:c.muted}]}>{zh?'先选择方向和班次类型，再选择上车站。预测可能改变；运营商标注的计划班次会保留备注。':'Select direction and service variant, then your boarding stop. Predictions may change; operator remarks about scheduled departures are retained.'}</Text>
  <Button variant="secondary" isDisabled={busy} onPress={()=>refresh.current()}>{busy?(zh?'查询中…':'Loading…'):(zh?'刷新查询':'Refresh')}</Button>
  {error?<Text accessibilityRole="alert" style={[styles.body,{color:c.danger}]}>{zh?'连接失败，已隐藏查询结果。请联网后重试。':'Connection failed. Results are hidden; reconnect and retry.'}</Text>:null}
  {!route?<>
   <Input accessibilityLabel={zh?'搜索公共路线':'Search public routes'} placeholder={zh?'路线号／目的地':'Route / destination'} value={search} onChangeText={setSearch} style={[styles.input,{color:c.text,borderColor:c.border}]}/>
   {catalog?.issues.map(issue=><Text key={`${issue.operator}:${issue.route_code}`} style={[styles.caption,{color:c.danger}]}>{issue.operator.toUpperCase()} {issue.route_code}: {labels[issue.reason]}</Text>)}
   {routes.map(r=><Card key={r.id} style={[styles.card,{backgroundColor:c.surface}]}>
    <Text style={[styles.heading,{color:c.text}]}>{r.operator==='kmb'?(zh?'九巴':'KMB'):(zh?'新界小巴':'NT GMB')} {r.code}</Text>
    <Text style={[styles.body,{color:c.text}]}>{r.origin[language]} → {r.destination[language]}</Text>
    <Text style={[styles.caption,{color:c.muted}]}>{r.description[language]} · {zh?'方向':'Direction'} {r.direction}</Text>
    <Button variant="secondary" onPress={()=>{setRoute(r);setSearch('');setStops(null);}}>{zh?'选择上车站':'Choose boarding stop'}</Button>
   </Card>)}
   {catalog&&!routes.length&&!busy?<Text style={[styles.body,{color:c.muted}]}>{zh?'没有可用的匹配路线。':'No available matching routes.'}</Text>:null}
  </>:<>
   <Text style={[styles.heading,{color:c.text}]}>{route.code} · {route.origin[language]} → {route.destination[language]}</Text>
   <Text style={[styles.caption,{color:c.muted}]}>{route.description[language]} · {zh?'方向':'Direction'} {route.direction}</Text>
   {route.remark[language]?<Text style={[styles.body,{color:c.text}]}>{route.remark[language]}</Text>:null}
   {stops&&stops.status!=='available'?<Text accessibilityRole="alert" style={[styles.body,{color:c.danger}]}>{labels[stops.status]}</Text>:null}
   {sequence===null?<>
    <Input accessibilityLabel={zh?'搜索站点':'Search stops'} placeholder={zh?'上车站名称':'Boarding stop name'} value={search} onChangeText={setSearch} style={[styles.input,{color:c.text,borderColor:c.border}]}/>
    {stopList.map(s=><Card key={s.sequence} style={[styles.card,{backgroundColor:c.surface}]}>
     <Text style={[styles.body,{color:c.text}]}>{s.sequence}. {s.name[language]}</Text>
     <Button variant="secondary" onPress={()=>{setSequence(s.sequence);setArrivals(null);}}>{zh?'查看到站预测':'View arrival predictions'}</Button>
    </Card>)}
    {stops?.status==='available'&&!stopList.length&&!busy?<Text style={[styles.body,{color:c.muted}]}>{zh?'没有匹配的站点。':'No matching stops.'}</Text>:null}
   </>:<>
    <Text style={[styles.heading,{color:c.text}]}>{sequence}. {arrivals?.stop?.name[language]??stops?.stops.find(s=>s.sequence===sequence)?.name[language]}</Text>
    {visible?<>
     <Text accessibilityRole={visible.status==='available'?'text':'alert'} style={[styles.body,{color:c.text}]}>{labels[visible.status]}</Text>
     {visible.arrivals.map((a,i)=><Card key={`${a.at}:${i}`} style={[styles.card,{backgroundColor:c.surface}]}><Text style={[styles.heading,{color:c.text}]}>{hkTime(a.at)} HKT</Text>{a.remark[language]?<Text style={[styles.body,{color:c.text}]}>{a.remark[language]}</Text>:null}</Card>)}
     {visible.messages.map((m,i)=><Text key={i} style={[styles.body,{color:c.muted}]}>{m[language]}</Text>)}
    </>:null}
    {arrivals?.source?<Text style={[styles.caption,{color:c.muted}]}>{zh?'运营商生成时间':'Operator generated'}: {hkTime(arrivals.source.generated_at)} HKT{arrivals.expires_at?`\n${zh?'最迟有效至':'Valid at most until'}: ${hkTime(arrivals.expires_at)} HKT`:''}</Text>:null}
   </>}
   <Button variant="ghost" onPress={()=>open(arrivals?.source?.url??route.source.url)}>{zh?'查看运营商数据来源':'View operator data source'}</Button>
  </>}
  <Button variant="ghost" onPress={()=>open('https://cso.hkust.edu.hk/index.php/tran/pt')}>{zh?'校方公共交通指引':'HKUST public transport guide'}</Button>
  {linkError?<Text accessibilityRole="alert" style={[styles.body,{color:c.danger}]}>{zh?'无法打开来源链接。':'Could not open source link.'}</Text>:null}
 </View>;
}

// Pen board "V6 / 交通（从科大出发）" (d6fkS7): every way off campus, grouped by where you board,
// minutes first. Buses/minibuses and MTR are live operator data; the shuttle is the published timetable.
import {useEffect,useMemo,useState} from 'react';
import {ActionSheetIOS,AppState,Linking,Platform,Pressable,Text,View} from 'react-native';
import {AppleMaps} from 'expo-maps';
import {NumberFlow} from 'number-flow-react-native';
import {api} from '../runtime';
import {useSceneFocus} from '../navigation/TabScene';
import {GlassChips,Notice,PenIcon,Skeleton,usePenColors,type PenIconName} from '../ui/Pen';
import {feel} from '../ui/feel';
import {LifeTop} from '../life/kit';
import type {CampusDepartures,CampusDeparture,CampusGate,TransitName} from '../../../../src/product/campus/public-transit-types';
import type {MtrDepartures} from '../../../../src/product/campus/mtr';

type Shuttle={id:string;name:TransitName;destination:TransitName;eligibility:string;fare_minor:number;status:string;next:{service_date:string;local_time:string;scheduled_at:string;today:boolean}|null;later:string[]};
type Mode='all'|'shuttle'|'kmb'|'gmb'|'mtr';
const COLORS={kmb:'#E5484D',gmb:'#2E9E5B',shuttle:'#24467F',mtr:'#7E3C93'};
const HKUST={latitude:22.3360,longitude:114.2626};
// Last good answers, so coming back from a route detail shows data at once instead of skeletons.
const memo:{dep?:CampusDepartures;mtr?:MtrDepartures;shuttles?:Shuttle[]}={};
const weekday=(date:string,zh:boolean)=>{const wd=new Date(date+'T00:00:00Z').getUTCDay();return zh?`周${'日一二三四五六'[wd]}`:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][wd];};
const hhmm=(iso:string)=>new Date(iso).toLocaleTimeString('en-GB',{timeZone:'Asia/Hong_Kong',hour:'2-digit',minute:'2-digit',hour12:false});
/** "香港科技大学(南) (SK950)" → "科大南"; "坑口站公共运输交汇处" → "坑口站". */
const shortStop=(n:TransitName)=>n.zh.replace(/香港科技大学/,'科大').replace(/\s*\(SK\d+\)/,'').replace(/[()（）]/g,'');
const shortDest=(n:TransitName,zh:boolean)=>zh?n.zh.replace(/公共运输交汇处|公共運輸交匯處/,'').trim():n.en.replace(/\s*PUBLIC TRANSPORT INTERCHANGE/i,'').trim();

export function TransitHub({zh,onBack,onRoute,onShuttle}:{zh:boolean;onBack:()=>void;onRoute:(routeId:string,sequence:number)=>void;onShuttle:(id:string)=>void}){
 const c=usePenColors(),active=useSceneFocus();
 const [mode,setMode]=useState<Mode>('all');
 const [dep,setDep]=useState<CampusDepartures|null>(memo.dep??null),[mtr,setMtr]=useState<MtrDepartures|null>(memo.mtr??null),[shuttles,setShuttles]=useState<Shuttle[]|null>(memo.shuttles??null);
 const [failed,setFailed]=useState(false),[busFailed,setBusFailed]=useState(false),[clock,setClock]=useState(Date.now());
 useEffect(()=>{
  if(!active)return;let live=true;
  const load=async()=>{
   const [d,m,s]=await Promise.allSettled([api.request<CampusDepartures>('/transport/public/campus-departures',{timeoutMs:30_000}),api.request<MtrDepartures>('/transport/mtr/hang-hau'),api.request<{routes:Shuttle[]}>('/transport/campus-shuttles')]);
   if(!live)return;
   if(d.status==='fulfilled'){memo.dep=d.value;setDep(d.value);}if(m.status==='fulfilled'){memo.mtr=m.value;setMtr(m.value);}if(s.status==='fulfilled'){memo.shuttles=s.value.routes;setShuttles(s.value.routes);}
   setBusFailed(d.status==='rejected');setFailed(d.status==='rejected'&&m.status==='rejected');setClock(Date.now());
  };
  void load();
  const poll=setInterval(()=>{if(AppState.currentState==='active')void load();},30_000),tick=setInterval(()=>setClock(Date.now()),15_000);
  const sub=AppState.addEventListener('change',s=>{if(s==='active')void load();});
  return()=>{live=false;clearInterval(poll);clearInterval(tick);sub.remove();};
 },[active]);
 const minutes=(iso:string)=>Math.max(0,Math.round((Date.parse(iso)-clock)/60000));
 const gates=useMemo(()=>{
  const rows=(dep?.departures??[]).filter(d=>mode==='all'||mode===d.operator);
  const order:CampusGate[]=['north','south','other'];
  return order.map(g=>({gate:g,rows:rows.filter(r=>r.gate===g)})).filter(g=>g.rows.length);
 },[dep,mode]);
 const walk=()=>{
  const opts=(['north','south'] as const).filter(g=>dep?.gates[g]);
  if(!opts.length)return;
  const open=(g:'north'|'south')=>{const p=dep!.gates[g]!;feel.select();void Linking.openURL(`maps://?daddr=${p.lat},${p.lng}&dirflg=w`);};
  if(Platform.OS!=='ios'||opts.length===1){open(opts[0]);return;}
  ActionSheetIOS.showActionSheetWithOptions({title:zh?'步行到哪个上车点？':'Walk to which stop?',options:[...opts.map(g=>g==='north'?(zh?'北闸':'North gate'):(zh?'南闸':'South gate')),zh?'取消':'Cancel'],cancelButtonIndex:opts.length},i=>{if(i<opts.length)open(opts[i]);});
 };
 const markers=(['north','south'] as const).flatMap(g=>{const p=dep?.gates[g];return p?[{id:g,coordinates:{latitude:p.lat,longitude:p.lng},title:g==='north'?(zh?'北闸':'North gate'):(zh?'南闸':'South gate'),systemImage:'figure.walk',tintColor:COLORS.shuttle}]:[];});
 const showShuttle=mode==='all'||mode==='shuttle',showMtr=mode==='all'||mode==='mtr';
 const busRow=(d:CampusDeparture,last:boolean)=>{
  const first=d.arrivals[0],later=d.arrivals.slice(1,3).map(hhmm);
  const sub=later.length?`${zh?'之后':'Then'} ${later.join(' · ')}`:d.messages[0]?(zh?d.messages[0].zh:d.messages[0].en):(zh?d.description.zh:d.description.en);
  return <Row key={d.route_id} c={c} last={last} badge={d.code} color={COLORS[d.operator]} dest={shortDest(d.destination,zh)} sub={sub} zh={zh}
   value={first?minutes(first):null} unit={first&&minutes(first)===0?(zh?'即将到站':'Due'):(zh?'分钟':'min')} onPress={()=>onRoute(d.route_id,d.stop.sequence)}/>;
 };
 return <View style={{gap:16}}>
  <LifeTop zh={zh} title={zh?'交通':'Getting around'} onBack={onBack}/>
  <GlassChips label={zh?'交通方式':'Mode'} value={mode} onChange={setMode} items={[{value:'all',label:zh?'全部':'All'},{value:'shuttle',label:zh?'校巴':'Shuttle'},{value:'kmb',label:zh?'九巴':'KMB'},{value:'gmb',label:zh?'小巴':'Minibus'},{value:'mtr',label:zh?'港铁':'MTR'}]}/>
  {Platform.OS==='ios'?<Pressable accessibilityRole="button" accessibilityLabel={zh?'步行到上车点':'Walk to the stop'} onPress={walk} style={{height:168,borderRadius:28,borderCurve:'continuous',overflow:'hidden',backgroundColor:c.fill}}>
   <View pointerEvents="none" style={{flex:1}}><AppleMaps.View style={{flex:1}} cameraPosition={{coordinates:HKUST,zoom:15.2}} markers={markers} uiSettings={{compassEnabled:false,myLocationButtonEnabled:false,scaleBarEnabled:false,togglePitchEnabled:false}} properties={{selectionEnabled:false}}/></View>
   <View style={{position:'absolute',left:12,top:12,flexDirection:'row',alignItems:'center',gap:6,paddingVertical:7,paddingHorizontal:12,borderRadius:99,backgroundColor:'#FFFFFFE6'}}><PenIcon name="navigation" size={14} color={COLORS.shuttle}/><Text style={{fontSize:13,fontWeight:'600',color:COLORS.shuttle}}>{zh?'步行到上车点':'Walk to the stop'}</Text></View>
  </Pressable>:null}
  {failed?<Notice tone="error" text={zh?'暂时连不上运营方，稍后自动重试。':'Operators unreachable; retrying shortly.'}/>:null}
  {mode!=='shuttle'&&mode!=='mtr'?(!dep?(busFailed&&!failed?<Notice tone="warning" text={zh?'巴士和小巴暂时连不上，30 秒后自动重试。':'Buses unreachable; retrying in 30 s.'}/>:<><Skeleton height={190} radius={24}/><Skeleton height={190} radius={24}/></>):gates.map(g=><Group key={g.gate} c={c} icon="door-open" title={g.gate==='north'?(zh?'北闸':'North gate'):g.gate==='south'?(zh?'南闸':'South gate'):shortStop(g.rows[0].stop.name)} note={g.gate==='other'?undefined:shortStop(g.rows[0].stop.name)}>
   {g.rows.map((d,i)=>busRow(d,i===g.rows.length-1))}
  </Group>)):null}
  {showShuttle?(!shuttles?<Skeleton height={120} radius={24}/>:<Group c={c} icon="bus" title={zh?'校巴':'Shuttle'} note={zh?'公布时刻表':'Published timetable'}>
   {[...shuttles].sort((a,b)=>(a.next?.scheduled_at??'~')<(b.next?.scheduled_at??'~')?-1:1).map((s,i,list)=>{
    // Lunch shuttles leave from different buildings; say where to board ("午间：广场 → 东港城" → "午间 · 广场上车").
    const lunch=s.id.endsWith('-to-east-point-city')?(zh?`午间 · ${s.name.zh.split('→')[0].replace(/^午间：/,'').trim()}上车`:`Lunch · from ${s.name.en.split('→')[0].replace(/^Lunch:\s*/,'').trim()}`):null;
    const sub=s.later.length?`${zh?'之后':'Then'} ${s.later.join(' · ')}`:lunch??`${s.eligibility==='student_only'?(zh?'学生专用':'Students'):(zh?'师生可乘':'Students & staff')} · ${s.fare_minor?`HK$${(s.fare_minor/100).toFixed(1)}`:(zh?'免费':'Free')}`;
    return <Row key={s.id} c={c} last={i===list.length-1} badge={zh?'校巴':'Bus'} color={COLORS.shuttle} dest={zh?s.destination.zh:s.destination.en} sub={sub} zh={zh}
     time={s.next?s.next.local_time:null} unit={s.next?(s.next.today?(zh?'今天':'Today'):weekday(s.next.service_date,zh)):''} onPress={()=>onShuttle(s.id)}/>;
   })}
  </Group>):null}
  {showMtr?(!mtr?<Skeleton height={120} radius={24}/>:<Group c={c} icon="train-front" title={zh?'港铁坑口站':'MTR Hang Hau'} note={zh?'将军澳线 · 港铁实时':'TKO line · live'}>
   {mtr.delayed?<View style={{padding:12}}><Notice tone="warning" text={zh?'港铁显示列车服务有延误。':'MTR reports delays.'}/></View>:null}
   {mtr.status!=='available'?<Text style={{padding:16,fontSize:14,color:c.muted}}>{mtr.status==='unavailable'?(zh?'暂时连不上港铁，稍后自动重试。':'MTR unreachable; retrying.'):(zh?'港铁暂时没有班次资料。':'No train data right now.')}</Text>
    :mtr.directions.map((d,i)=>{const first=d.arrivals[0],later=d.arrivals.slice(1,3).map(hhmm);return <Row key={d.destination.en} c={c} last={i===mtr.directions.length-1} badge={zh?'将军澳线':'TKL'} badgeWidth={zh?72:52} color={COLORS.mtr} dest={zh?d.destination.zh:d.destination.en} sub={`${zh?`${d.platform} 号月台`:`Platform ${d.platform}`}${later.length?` · ${zh?'之后':'then'} ${later.join(' · ')}`:''}`} zh={zh}
     value={first?minutes(first):null} unit={first&&minutes(first)===0?(zh?'即将到站':'Due'):(zh?'分钟':'min')}/>;})}
  </Group>):null}
  <Text style={{textAlign:'center',fontSize:12,color:c.muted}}>{zh?'小巴、巴士、港铁为实时到站；校巴为公布时刻表。':'Buses, minibuses and MTR are live; the shuttle is the published timetable.'}</Text>
 </View>;
}

function Group({c,icon,title,note,children}:{c:ReturnType<typeof usePenColors>;icon:PenIconName;title:string;note?:string;children:React.ReactNode}){
 return <View style={{gap:8}}>
  <View style={{flexDirection:'row',alignItems:'center',gap:6,paddingHorizontal:4}}><PenIcon name={icon} size={16} color={c.muted}/><Text style={{fontSize:15,fontWeight:'700',color:c.text}}>{title}</Text>{note?<Text numberOfLines={1} style={{flexShrink:1,fontSize:13,color:c.muted}}>{note}</Text>:null}</View>
  <View style={{backgroundColor:c.surface,borderRadius:24,borderCurve:'continuous',overflow:'hidden',borderWidth:1,borderColor:c.glassBorder,boxShadow:'0 6px 20px #0B1A330F'}}>{children}</View>
 </View>;
}

function Row({c,last,badge,badgeWidth=52,color,dest,sub,value,time,unit,zh,onPress}:{c:ReturnType<typeof usePenColors>;last:boolean;badge:string;badgeWidth?:number;color:string;dest:string;sub:string;value?:number|null;time?:string|null;unit:string;zh:boolean;onPress?:()=>void}){
 const none=value==null&&time==null;
 return <Pressable disabled={!onPress} onPress={()=>{feel.select();onPress?.();}} accessibilityRole={onPress?'button':undefined} accessibilityLabel={`${badge} ${zh?'往':'to'} ${dest}`}
  style={({pressed})=>({flexDirection:'row',alignItems:'center',gap:12,paddingVertical:12,paddingHorizontal:16,backgroundColor:pressed?c.fill:'transparent',borderBottomWidth:last?0:0.5,borderBottomColor:c.border})}>
  <View style={{width:badgeWidth,height:28,borderRadius:8,alignItems:'center',justifyContent:'center',backgroundColor:color}}><Text style={{fontSize:badge.length>3?12:14,fontWeight:'800',color:'#FFFFFF'}}>{badge}</Text></View>
  <View style={{flex:1,gap:2}}>
   <View style={{flexDirection:'row',alignItems:'baseline',gap:5}}><Text style={{fontSize:12,fontWeight:'500',color:c.muted}}>{zh?'往':'to'}</Text><Text numberOfLines={1} style={{flexShrink:1,fontSize:17,fontWeight:'600',color:c.text}}>{dest}</Text></View>
   <Text numberOfLines={1} style={{fontSize:12,color:c.muted}}>{sub}</Text>
  </View>
  {none?<Text style={{fontSize:15,fontWeight:'600',color:c.muted}}>{zh?'暂无预测':'No ETA'}</Text>
   :<View style={{flexDirection:'row',alignItems:'baseline',gap:3}}>
    {value!=null?<NumberFlow value={value} style={{fontSize:30,fontWeight:'800',color,letterSpacing:-0.5,fontVariant:['tabular-nums']}}/>:<Text style={{fontSize:24,fontWeight:'800',color,fontVariant:['tabular-nums']}}>{time}</Text>}
    <Text style={{fontSize:12,fontWeight:'500',color:c.muted}}>{unit}</Text>
   </View>}
 </Pressable>;
}

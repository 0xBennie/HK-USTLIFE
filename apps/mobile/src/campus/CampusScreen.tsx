import { PublicTransitScreen } from './PublicTransitScreen';
import { DirectoryScreen } from './DirectoryScreen';
import { TargetActions } from './TargetActions';
import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {AppState,Linking,Text,View} from 'react-native';
import {Button} from 'heroui-native/button';
import {Card} from 'heroui-native/card';
import {Input} from 'heroui-native/input';
import {api,session} from '../runtime';
import {palette,styles} from '../theme';
import type {Language} from '../strings';
import type {ShuttleRoute,ShuttleDepartures} from '../../../../src/product/campus/shuttle';
type Catalog={routes:ShuttleRoute[];freshness:string;refresh_due_at:string};
export function CampusScreen({language,dark,onLogin}:{language:Language;dark:boolean;onLogin:()=>void}) {
 const profile=useSyncExternalStore(session.subscribe,session.snapshot).profile;
 const [onlySaved,setOnlySaved]=useState(false),[savedRoutes,setSavedRoutes]=useState<string[]>([]);
 const [directory,setDirectory]=useState(false),[publicTransit,setPublicTransit]=useState(false);
 const zh=language==='zh',c=palette[dark?'dark':'light'];
 const [catalog,setCatalog]=useState<Catalog|null>(null),[route,setRoute]=useState<string|null>(null),[detail,setDetail]=useState<ShuttleDepartures|null>(null),[search,setSearch]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState(false);const epoch=useRef(0);
 useEffect(()=>{if(directory||publicTransit)return;let active=true;
   const load=async()=>{const current=++epoch.current;setBusy(true);setError(false);try{
     const [list,result,bookmarks]=await Promise.all([api.request<Catalog>('/transport/routes'),route?api.request<ShuttleDepartures>(`/transport/routes/${route}/departures`):Promise.resolve(null),profile?session.request<{target_kind:string;target_id:string}[]>('/me/campus/bookmarks'):Promise.resolve([])]);
     if(active&&current===epoch.current){setCatalog(list);setDetail(result);setSavedRoutes(bookmarks.filter(b=>b.target_kind==='shuttle').map(b=>b.target_id));}
   }catch{if(active&&current===epoch.current){setError(true);setDetail(null);}}finally{if(active&&current===epoch.current)setBusy(false);}};
   void load();const timer=setInterval(()=>{if(AppState.currentState==='active')void load();},60000);
   const subscription=AppState.addEventListener('change',state=>{if(state==='active')void load();});
   refresh.current=load;return()=>{active=false;epoch.current++;clearInterval(timer);subscription.remove();};
 },[route,profile?.id,directory,publicTransit]);
 const refresh=useRef<()=>Promise<void>>(async()=>{});
 const open=async(url:string)=>{try{await Linking.openURL(url);}catch{setError(true);}};
 const labels:Record<string,string>={scheduled:zh?'当日计划班次':'Scheduled service',finished_for_day:zh?'当日计划班次已结束':'Scheduled service finished',public_holiday:zh?'公众假期：无常规班次':'Public holiday: no regular service',non_operating_day:zh?'非运行日':'Non-operating day',outside_service_period:zh?'超出公布服务期':'Outside published service period',stale:zh?'资料待更新，请核对官方页面':'Timetable needs review; check official source',holiday_coverage_unknown:zh?'该年份假期资料未核验':'Holiday calendar not verified for this year'};
 if(publicTransit)return <PublicTransitScreen language={language} dark={dark} onBack={()=>setPublicTransit(false)}/>;
 if(directory)return <DirectoryScreen language={language} dark={dark} onBack={()=>setDirectory(false)} onLogin={onLogin}/>;
 return <View style={styles.stack}>
   <Button variant="secondary" onPress={()=>setDirectory(true)}>{zh?'校园地点与服务':'Campus places and services'}</Button>
   <Button variant="secondary" onPress={()=>setPublicTransit(true)}>{zh?'九巴与绿色小巴到站查询':'KMB and green minibus arrivals'}</Button>
   <Text style={[styles.title,{color:c.text}]}>{zh?'校园交通':'Campus transport'}</Text>
   <Text style={[styles.caption,{color:c.muted}]}>{zh?'校巴计划时刻表 · 没有实时车辆定位或空位数据':'Shuttle schedules · no live vehicle location or seat availability'}</Text>
   <Button variant="secondary" isDisabled={busy} onPress={()=>refresh.current()}>{busy?(zh?'更新中…':'Refreshing…'):(zh?'刷新班次':'Refresh schedules')}</Button>
   {error?<Text accessibilityRole="alert" style={[styles.body,{color:c.danger}]}>{zh?'未能取得最新查询结果。已隐藏班次，请联网后重试。':'Could not refresh. Departure results are hidden; reconnect and retry.'}</Text>:null}
   {route?<Button variant="ghost" onPress={()=>{setRoute(null);setDetail(null);}}>{zh?'返回路线目录':'Back to routes'}</Button>:null}
   {!route?<>
     <Input accessibilityLabel={zh?'搜索校巴路线':'Search shuttle routes'} placeholder={zh?'目的地／上客点':'Destination / boarding point'} value={search} onChangeText={setSearch} style={[styles.input,{color:c.text,borderColor:c.border}]}/>
     <Button variant={onlySaved?'primary':'secondary'} onPress={()=>profile?setOnlySaved(!onlySaved):onLogin()}>{onlySaved?(zh?'✓ 只看收藏':'✓ Saved routes'):(zh?'只看收藏路线':'Saved routes only')}</Button>
     {catalog?.freshness==='stale'?<Text style={[styles.body,{color:c.danger}]}>{labels.stale}</Text>:null}
     {catalog?.routes.filter(r=>(!onlySaved||savedRoutes.includes(r.id))&&`${r.name.zh} ${r.name.en} ${r.origin} ${r.destination}`.toLowerCase().includes(search.trim().toLowerCase())).map(r=><Card key={r.id} style={[styles.card,{backgroundColor:c.surface}]}>
       <Text style={[styles.heading,{color:c.text}]}>{r.name[language]}</Text>
       <Text style={[styles.caption,{color:c.muted}]}>{r.eligibility==='student_only'?(zh?'学生专用':'Students only'):(zh?'学生及职员':'Students and staff')} · {r.fare_minor===null?(zh?'票价未公布':'Fare not stated'):`HK$ ${(r.fare_minor/100).toFixed(2)}`}</Text>
       <Button variant="secondary" onPress={()=>{setDetail(null);setRoute(r.id);}}>{zh?'查看当日计划':'View today’s schedule'}</Button>
     </Card>)}
     {catalog&&!catalog.routes.some(r=>(!onlySaved||savedRoutes.includes(r.id))&&`${r.name.zh} ${r.name.en} ${r.origin} ${r.destination}`.toLowerCase().includes(search.trim().toLowerCase()))?<Text style={[styles.body,{color:c.muted}]}>{zh?'没有匹配的已核验路线。':'No matching reviewed route.'}</Text>:null}
   </>:null}
   {detail&&detail.route.id===route&&!error?<>
     <Text style={[styles.heading,{color:c.text}]}>{detail.route.name[language]}</Text>
     <Text style={[styles.body,{color:c.text}]}>{labels[detail.status]}</Text>
     <Text style={[styles.body,{color:c.text}]}>{detail.service_date} · Hong Kong (UTC+8)</Text>
     <Text style={[styles.body,{color:c.text}]}>{detail.route.origin} → {detail.route.destination}</Text>
     {detail.holiday?<Text style={[styles.body,{color:c.muted}]}>{detail.holiday}</Text>:null}
     {detail.upcoming.length?<><Text style={[styles.heading,{color:c.text}]}>{zh?'接下来的计划发车':'Upcoming scheduled departures'}</Text><Text style={[styles.body,{color:c.text}]}>{detail.upcoming.map(d=>d.local_time).join(' · ')}</Text></>:null}
     <Text style={[styles.caption,{color:c.muted}]}>{zh?'公布的常规时刻（仍需满足运行日和有效期）':'Published regular times (subject to operating dates and validity)'}</Text>
     <Text style={[styles.body,{color:c.text}]}>{detail.timetable.map(d=>d.local_time).join(' · ')}</Text>
     <Text style={[styles.caption,{color:c.muted}]}>{detail.route.valid_from} — {detail.route.valid_to} · {zh?'周一至周五，公众假期除外':'Monday–Friday, excluding public holidays'}</Text>
     {detail.route.note?<Text style={[styles.caption,{color:c.muted}]}>{detail.route.note}</Text>:null}
     <Text style={[styles.body,{color:c.muted}]}>{zh?'须使用校方认可的证件／二维码；本 App 登录不能替代乘车验证。收费路线使用八达通。':'Use school-recognized identification or HKUST QR verification; this app is not boarding identification. Paid routes use Octopus.'}</Text>
     <Text style={[styles.caption,{color:c.muted}]}>{zh?'尚未接入临时停运通知；出发前核对官方页面及上客点地图。':'Disruption notices are not monitored. Check the official page and boarding maps before departure.'}</Text>
     <Text style={[styles.caption,{color:c.muted}]}>{zh?'资料核对':'Source checked'}: {detail.source.retrieved_at}\n{zh?'本次查询':'Query'}: {detail.generated_at}</Text>
     <Button variant="secondary" onPress={()=>open(detail.source.url)}>{zh?'查看校方来源／上客点地图':'Official source / boarding maps'}</Button>
     <Button variant="ghost" onPress={()=>open(detail.holiday_source.url)}>{zh?'公众假期数据来源':'Public holiday source'}</Button>
     <TargetActions key={detail.route.id} target={{target_kind:'shuttle',target_id:detail.route.id}} language={language} dark={dark} onLogin={onLogin} onChanged={()=>void refresh.current()}/>

   </>:null}
 </View>;
}

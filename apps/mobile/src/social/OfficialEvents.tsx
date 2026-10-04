// Pen "V3 / 发现" section "今天在科大" (Q8cPQt / b50WEc) and board "V6 / 科大官方活动" (xKe4t):
// official HKUST University Events from calendar.hkust.edu.hk, relayed by /campus/events.
// Rows open "V6 / 官方活动面板（App 内）" (z2v9N); counts follow "V6 / 分类显示真实数量" (R64Nw).
import {useEffect,useRef,useState} from 'react';
import {Linking,Pressable,Text,View} from 'react-native';
import {api} from '../runtime';
import {GlassChips,PenIcon,PrimaryButton,Skeleton,usePenColors,type PenIconName} from '../ui/Pen';
import {BottomSheet} from '../ui/BottomSheet';
import {dayTitle} from './activity-time';
import {feel} from '../ui/feel';
import {LifeTop} from '../life/kit';
import type {CampusEvent} from '../../../../src/product/campus/events';

type Events={today:string;upcoming:CampusEvent[];ongoing:CampusEvent[];source:{url:string}};
let last:Events|null=null;
function useEvents(){
 const [e,setE]=useState<Events|null>(last);
 useEffect(()=>{let live=true;void api.request<Events>('/campus/events',{timeoutMs:20_000}).then(v=>{last=v;if(live)setE(v);}).catch(()=>{});return()=>{live=false;};},[]);
 return e;
}
const md=(d:string,zh:boolean)=>{const [,m,day]=d.split('-').map(Number);return zh?`${m} 月 ${day} 日`:new Date(d+'T00:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'short',timeZone:'UTC'});};
const dayLabel=(d:string,today:string,zh:boolean)=>{
 const diff=Math.round((Date.parse(d)-Date.parse(today))/864e5),wd=new Date(d+'T00:00:00Z').getUTCDay();
 const w=zh?`周${'日一二三四五六'[wd]}`:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][wd];
 return diff<=0?(zh?`今天 · ${md(d,zh)}`:`Today · ${md(d,zh)}`):diff===1?(zh?`明天 · ${w}`:`Tomorrow · ${w}`):`${w} · ${md(d,zh)}`;
};
function Row({e,zh,last,today,onOpen}:{e:CampusEvent;zh:boolean;last:boolean;today?:string;onOpen:(e:CampusEvent)=>void}){
 const c=usePenColors();
 const multi=e.start_date!==e.end_date;
 const sub=[e.venue,multi?(zh?`至 ${md(e.end_date,zh)}`:`until ${md(e.end_date,zh)}`):e.time&&today?(zh?`至 ${e.time.split('–')[1]}`:`until ${e.time.split('–')[1]}`):null].filter(Boolean).join(' · ');
 return <Pressable onPress={()=>{feel.select();onOpen(e);}} accessibilityRole="button" accessibilityLabel={`${e.start_time??''} ${e.title}`}
  style={({pressed})=>({flexDirection:'row',alignItems:'center',gap:14,paddingVertical:12,paddingHorizontal:16,backgroundColor:pressed?c.fill:'transparent',borderBottomWidth:last?0:0.5,borderBottomColor:c.border})}>
  <View style={{width:52,alignItems:'center'}}><Text style={{fontSize:e.start_time?17:15,fontWeight:'800',color:c.accent,fontVariant:['tabular-nums']}}>{e.start_time??(zh?'全天':'All day')}</Text></View>
  <View style={{flex:1,gap:2}}><Text numberOfLines={1} style={{fontSize:15,fontWeight:'600',color:c.text}}>{e.title}</Text>{sub?<Text numberOfLines={1} style={{fontSize:12,color:c.muted}}>{sub}</Text>:null}</View>
 </Pressable>;
}
const Card=({children}:{children:React.ReactNode})=>{const c=usePenColors();return <View style={{backgroundColor:c.surface,borderRadius:24,borderCurve:'continuous',overflow:'hidden',borderWidth:1,borderColor:c.glassBorder,boxShadow:'0 6px 20px #0B1A330F'}}>{children}</View>;};

/** Pen z2v9N: the facts the official calendar gives (dates, time, venue, organizer), then the official page. */
function EventSheet({event,zh,onClose}:{event:CampusEvent|null;zh:boolean;onClose:()=>void}){
 const c=usePenColors(),shown=useRef<CampusEvent|null>(null);
 if(event)shown.current=event;
 const e=shown.current;
 if(!e)return null;
 const multi=e.start_date!==e.end_date;
 const rows:[PenIconName,string,string][]=[
  ['calendar',multi?`${md(e.start_date,zh)} – ${md(e.end_date,zh)}`:dayTitle(e.start_date+'T00:00:00+08:00',zh),`${e.time??(zh?'全天':'All day')} · ${zh?'香港时间':'Hong Kong time'}`],
  ['map-pin',e.venue??(zh?'见官方页面':'See the official page'),zh?'地点（以官方页面为准）':'Venue (the official page is authoritative)'],
  ...(e.organizer?[['building-2',e.organizer,zh?'主办':'Organizer'] as [PenIconName,string,string]]:[]),
 ];
 return <BottomSheet visible={!!event} onClose={onClose} closeLabel={zh?'关闭':'Close'} header={<View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:16,height:44}}>
   <Pressable accessibilityRole="button" hitSlop={10} onPress={onClose}><Text style={{fontSize:17,color:c.accent}}>{zh?'关闭':'Close'}</Text></Pressable>
   <Text accessibilityRole="header" style={{fontSize:17,fontWeight:'700',color:c.text}}>{zh?'科大官方活动':'HKUST event'}</Text>
   <Text style={{fontSize:17,color:'transparent'}}>{zh?'关闭':'Close'}</Text>
  </View>}>
  <View style={{paddingHorizontal:16,paddingTop:8,gap:16}}>
   <View style={{paddingHorizontal:4,gap:6}}>
    {e.on_campus?<View style={{alignSelf:'flex-start',paddingVertical:3,paddingHorizontal:8,borderRadius:99,backgroundColor:c.accent+'14'}}><Text style={{fontSize:12,fontWeight:'600',color:c.accent}}>{zh?'在校园':'On campus'}</Text></View>:null}
    <Text selectable style={{fontSize:22,lineHeight:28,fontWeight:'700',color:c.text}}>{e.title}</Text>
   </View>
   <View style={{borderRadius:20,overflow:'hidden',backgroundColor:c.surface}}>
    {rows.map(([icon,title,sub],i)=><View key={icon} style={{flexDirection:'row',alignItems:'center',gap:12,paddingVertical:12,paddingHorizontal:16,borderTopWidth:i?0.5:0,borderTopColor:c.border}}>
     <PenIcon name={icon} size={20} color={c.muted}/>
     <View style={{flex:1,gap:2}}><Text style={{fontSize:16,fontWeight:'500',color:c.text}}>{title}</Text><Text style={{fontSize:13,color:c.muted}}>{sub}</Text></View>
    </View>)}
   </View>
   <View style={{flexDirection:'row'}}><PrimaryButton icon="arrow-up-right" iconAfter label={zh?'打开官方页面':'Open the official page'} onPress={()=>void Linking.openURL(e.url)}/></View>
   <Text style={{textAlign:'center',fontSize:12,color:c.muted,paddingBottom:4}}>{zh?'资料来自科大大学活动日历 calendar.hkust.edu.hk':'From the HKUST University Events calendar'}</Text>
  </View>
 </BottomSheet>;
}

/** Up to three on-campus events still to come today (falls back to the next day that has some). */
export function OfficialEventsSection({zh,onAll}:{zh:boolean;onAll:()=>void}){
 const c=usePenColors(),e=useEvents(),[open,setOpen]=useState<CampusEvent|null>(null);
 if(!e)return <Skeleton height={190} radius={24}/>;
 const nowHm=new Date(Date.now()+8*3600e3).toISOString().slice(11,16);
 const campus=e.upcoming.filter(x=>x.on_campus);
 const todays=campus.filter(x=>x.start_date<=e.today&&(x.start_date!==x.end_date||!x.time||x.time.split('–')[1]>nowHm));
 const firstDay=campus.find(x=>x.start_date>e.today)?.start_date;
 const show=(todays.length?todays:campus.filter(x=>x.start_date===firstDay)).slice(0,3);
 if(!show.length)return null;
 const title=todays.length?(zh?'今天在科大':'Today at HKUST'):dayLabel(firstDay!,e.today,zh);
 // Every event (on or off campus) starting on the day shown, as listed by the official calendar.
 const dayCount=e.upcoming.filter(x=>x.start_date===(todays.length?e.today:firstDay)).length;
 return <View style={{gap:10}}>
  <View style={{flexDirection:'row',alignItems:'flex-end',justifyContent:'space-between',paddingHorizontal:4}}>
   <View style={{gap:2}}><Text style={{fontSize:20,fontWeight:'700',color:c.text}}>{title}</Text><Text style={{fontSize:12,fontWeight:'500',color:c.muted}}>{zh?`科大官方活动日历 · ${todays.length?'今天 ':''}${dayCount} 场`:`HKUST University Events · ${dayCount}${todays.length?' today':''}`}</Text></View>
   <Pressable onPress={()=>{feel.select();onAll();}} hitSlop={8} accessibilityRole="button"><Text style={{fontSize:15,fontWeight:'600',color:c.muted}}>{zh?'全部 ›':'All ›'}</Text></Pressable>
  </View>
  <Card>{show.map((x,i)=><Row key={x.id} e={x} zh={zh} last={i===show.length-1} today={todays.length?e.today:undefined} onOpen={setOpen}/>)}</Card>
  <EventSheet event={open} zh={zh} onClose={()=>setOpen(null)}/>
 </View>;
}

export function OfficialEventsScreen({zh,onBack}:{zh:boolean;onBack:()=>void}){
 const c=usePenColors(),e=useEvents();
 const [scope,setScope]=useState<'campus'|'all'>('campus'),[open,setOpen]=useState<CampusEvent|null>(null);
 const total=e?{campus:e.upcoming.filter(x=>x.on_campus).length+e.ongoing.filter(x=>x.on_campus).length,all:e.upcoming.length+e.ongoing.length}:null;
 const list=(e?.upcoming??[]).filter(x=>scope==='all'||x.on_campus);
 const days=[...new Set(list.map(x=>x.start_date<(e?.today??'')?e!.today:x.start_date))].sort();
 const ongoing=(e?.ongoing??[]).filter(x=>scope==='all'||x.on_campus);
 return <View style={{gap:16}}>
  <LifeTop zh={zh} title={zh?'科大官方活动':'HKUST events'} onBack={onBack}/>
  <GlassChips label={zh?'范围':'Scope'} value={scope} onChange={setScope} items={[{value:'campus',label:zh?'在校园':'On campus',count:total?.campus},{value:'all',label:zh?'全部':'All',count:total?.all}]}/>
  {!e?<><Skeleton height={190} radius={24}/><Skeleton height={190} radius={24}/></>:null}
  {e?days.map(d=>{const rows=list.filter(x=>(x.start_date<e.today?e.today:x.start_date)===d);return <View key={d} style={{gap:8}}>
   <Text style={{fontSize:15,fontWeight:'700',color:c.text,paddingHorizontal:4}}>{dayLabel(d,e.today,zh)}</Text>
   <Card>{rows.map((x,i)=><Row key={x.id} e={x} zh={zh} last={i===rows.length-1} onOpen={setOpen}/>)}</Card>
  </View>;}):null}
  {ongoing.length?<View style={{gap:8}}><Text style={{fontSize:15,fontWeight:'700',color:c.text,paddingHorizontal:4}}>{zh?'长期开放':'Ongoing'}</Text><Card>{ongoing.map((x,i)=><Row key={x.id} e={x} zh={zh} last={i===ongoing.length-1} onOpen={setOpen}/>)}</Card></View>:null}
  <Text style={{textAlign:'center',fontSize:12,color:c.muted}}>{zh?'资料来源：科大大学活动日历 calendar.hkust.edu.hk · 点按看详情与报名':'Source: calendar.hkust.edu.hk · tap for details and registration'}</Text>
  <EventSheet event={open} zh={zh} onClose={()=>setOpen(null)}/>
 </View>;
}

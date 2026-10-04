// Pen "V3 / 发现" section "今天在科大" (Q8cPQt / b50WEc) and board "V6 / 科大官方活动" (xKe4t):
// official HKUST University Events from calendar.hkust.edu.hk, relayed by /campus/events. Rows open the official page.
import {useEffect,useState} from 'react';
import {Linking,Pressable,Text,View} from 'react-native';
import {api} from '../runtime';
import {GlassChips,Skeleton,usePenColors} from '../ui/Pen';
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
function Row({e,zh,last,today}:{e:CampusEvent;zh:boolean;last:boolean;today?:string}){
 const c=usePenColors();
 const multi=e.start_date!==e.end_date;
 const sub=[e.venue,multi?(zh?`至 ${md(e.end_date,zh)}`:`until ${md(e.end_date,zh)}`):e.time&&today?(zh?`至 ${e.time.split('–')[1]}`:`until ${e.time.split('–')[1]}`):null].filter(Boolean).join(' · ');
 return <Pressable onPress={()=>{feel.select();void Linking.openURL(e.url);}} accessibilityRole="link" accessibilityLabel={`${e.start_time??''} ${e.title}`}
  style={({pressed})=>({flexDirection:'row',alignItems:'center',gap:14,paddingVertical:12,paddingHorizontal:16,backgroundColor:pressed?c.fill:'transparent',borderBottomWidth:last?0:0.5,borderBottomColor:c.border})}>
  <View style={{width:52,alignItems:'center'}}><Text style={{fontSize:e.start_time?17:15,fontWeight:'800',color:c.accent,fontVariant:['tabular-nums']}}>{e.start_time??(zh?'全天':'All day')}</Text></View>
  <View style={{flex:1,gap:2}}><Text numberOfLines={1} style={{fontSize:15,fontWeight:'600',color:c.text}}>{e.title}</Text>{sub?<Text numberOfLines={1} style={{fontSize:12,color:c.muted}}>{sub}</Text>:null}</View>
 </Pressable>;
}
const Card=({children}:{children:React.ReactNode})=>{const c=usePenColors();return <View style={{backgroundColor:c.surface,borderRadius:24,borderCurve:'continuous',overflow:'hidden',borderWidth:1,borderColor:c.glassBorder,boxShadow:'0 6px 20px #0B1A330F'}}>{children}</View>;};

/** Up to three on-campus events still to come today (falls back to the next day that has some). */
export function OfficialEventsSection({zh,onAll}:{zh:boolean;onAll:()=>void}){
 const c=usePenColors(),e=useEvents();
 if(!e)return <Skeleton height={190} radius={24}/>;
 const nowHm=new Date(Date.now()+8*3600e3).toISOString().slice(11,16);
 const campus=e.upcoming.filter(x=>x.on_campus);
 const todays=campus.filter(x=>x.start_date<=e.today&&(x.start_date!==x.end_date||!x.time||x.time.split('–')[1]>nowHm));
 const firstDay=campus.find(x=>x.start_date>e.today)?.start_date;
 const show=(todays.length?todays:campus.filter(x=>x.start_date===firstDay)).slice(0,3);
 if(!show.length)return null;
 const title=todays.length?(zh?'今天在科大':'Today at HKUST'):dayLabel(firstDay!,e.today,zh);
 return <View style={{gap:10}}>
  <View style={{flexDirection:'row',alignItems:'flex-end',justifyContent:'space-between',paddingHorizontal:4}}>
   <View style={{gap:2}}><Text style={{fontSize:20,fontWeight:'700',color:c.text}}>{title}</Text><Text style={{fontSize:12,fontWeight:'500',color:c.muted}}>{zh?'科大官方活动日历':'HKUST University Events'}</Text></View>
   <Pressable onPress={()=>{feel.select();onAll();}} hitSlop={8} accessibilityRole="button"><Text style={{fontSize:15,fontWeight:'600',color:c.muted}}>{zh?'全部 ›':'All ›'}</Text></Pressable>
  </View>
  <Card>{show.map((x,i)=><Row key={x.id} e={x} zh={zh} last={i===show.length-1} today={todays.length?e.today:undefined}/>)}</Card>
 </View>;
}

export function OfficialEventsScreen({zh,onBack}:{zh:boolean;onBack:()=>void}){
 const c=usePenColors(),e=useEvents();
 const [scope,setScope]=useState<'campus'|'all'>('campus');
 const list=(e?.upcoming??[]).filter(x=>scope==='all'||x.on_campus);
 const days=[...new Set(list.map(x=>x.start_date<(e?.today??'')?e!.today:x.start_date))].sort();
 const ongoing=(e?.ongoing??[]).filter(x=>scope==='all'||x.on_campus);
 return <View style={{gap:16}}>
  <LifeTop zh={zh} title={zh?'科大官方活动':'HKUST events'} onBack={onBack}/>
  <GlassChips label={zh?'范围':'Scope'} value={scope} onChange={setScope} items={[{value:'campus',label:zh?'在校园':'On campus'},{value:'all',label:zh?'全部':'All'}]}/>
  {!e?<><Skeleton height={190} radius={24}/><Skeleton height={190} radius={24}/></>:null}
  {e?days.map(d=>{const rows=list.filter(x=>(x.start_date<e.today?e.today:x.start_date)===d);return <View key={d} style={{gap:8}}>
   <Text style={{fontSize:15,fontWeight:'700',color:c.text,paddingHorizontal:4}}>{dayLabel(d,e.today,zh)}</Text>
   <Card>{rows.map((x,i)=><Row key={x.id} e={x} zh={zh} last={i===rows.length-1}/>)}</Card>
  </View>;}):null}
  {ongoing.length?<View style={{gap:8}}><Text style={{fontSize:15,fontWeight:'700',color:c.text,paddingHorizontal:4}}>{zh?'长期开放':'Ongoing'}</Text><Card>{ongoing.map((x,i)=><Row key={x.id} e={x} zh={zh} last={i===ongoing.length-1}/>)}</Card></View>:null}
  <Text style={{textAlign:'center',fontSize:12,color:c.muted}}>{zh?'资料来源：科大大学活动日历 calendar.hkust.edu.hk · 点按看详情与报名':'Source: calendar.hkust.edu.hk · tap for details and registration'}</Text>
 </View>;
}

// Pen "V6 / 本周课表" (QkyT2): weekday tiles lined up with the grid columns, hourly grid with course blocks, red
// now line. Events that overlap on a day merge into one block ("2 项" + names) that opens that day's schedule.
import {useEffect,useState} from 'react';
import {Pressable,Text,View,useColorScheme} from 'react-native';
import {usePenColors} from '../ui/Pen';
import {feel} from '../ui/feel';
import type {CalendarItem} from './types';
import {dateTimeInZone} from './dates';

type Day={date:string;events:CalendarItem[]};
type Timed=Extract<CalendarItem,{kind:'event'}>;
const HOUR=58,LABEL=40,PAD=12;
/** Hours since midnight in the calendar's display zone (the same zone the API used to split the days). */
const hourIn=(iso:string,zone:string)=>{const s=dateTimeInZone(iso,zone);return Number(s.slice(11,13))+Number(s.slice(14,16))/60;};
const span=(e:Timed,zone:string)=>{const start=hourIn(e.starts_at!,zone),end=e.ends_at?hourIn(e.ends_at,zone):start+1;return [start,end>start?end:24] as const;};
/** Groups a day's timed events into runs that overlap in time (each run is drawn as one block). */
function clusters(events:Timed[],zone:string){
 const out:{events:Timed[];start:number;end:number}[]=[];
 for(const e of [...events].sort((a,b)=>span(a,zone)[0]-span(b,zone)[0])){const [start,end]=span(e,zone),last=out[out.length-1];
  if(last&&start<last.end){last.events.push(e);last.end=Math.max(last.end,end);}else out.push({events:[e],start,end});}
 return out;
}

export function WeekGrid({days,today,zone,zh,colorOf,codeOf,onOpen,onDay}:{days:Day[];today:string;zone:string;zh:boolean;colorOf:(courseId:string|null|undefined)=>string;codeOf:(item:CalendarItem)=>string;onOpen:(item:CalendarItem)=>void;onDay:(date:string)=>void}){
 const c=usePenColors(),dark=useColorScheme()==='dark';
 const [width,setWidth]=useState(0),[now,setNow]=useState(Date.now());
 useEffect(()=>{const t=setInterval(()=>setNow(Date.now()),60000);return()=>clearInterval(t);},[]);
 const weekend=days.filter(d=>{const wd=new Date(d.date+'T00:00:00Z').getUTCDay();return wd===0||wd===6;});
 const shown=days.filter(d=>{const wd=new Date(d.date+'T00:00:00Z').getUTCDay();return (wd!==0&&wd!==6)||d.events.some(e=>e.kind==='event'&&!e.all_day);}).slice(0,7);
 const timed=shown.flatMap(d=>d.events.filter(e=>e.kind==='event'&&!e.all_day&&e.starts_at)) as Timed[];
 const h0=Math.min(9,...timed.map(e=>Math.floor(span(e,zone)[0]))),h1=Math.min(24,Math.max(18,...timed.map(e=>Math.ceil(span(e,zone)[1]))));
 const col=width?(width-LABEL)/shown.length:0;
 const nowH=hourIn(new Date(now).toISOString(),zone),todayIndex=shown.findIndex(d=>d.date===today);
 const hours=[];for(let h=h0;h<=h1;h++)hours.push(h);
 return <View style={{gap:14}}>
  <View style={{flexDirection:'row',gap:4,paddingLeft:PAD+LABEL+2,paddingRight:PAD+2}}>{shown.map(d=>{const on=d.date===today,wd=new Date(d.date+'T00:00:00Z').getUTCDay();return <Pressable key={d.date} accessibilityRole="button" accessibilityLabel={zh?`${Number(d.date.slice(5,7))} 月 ${Number(d.date.slice(8))} 日 周${'日一二三四五六'[wd]}`:new Date(d.date+'T00:00:00Z').toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',timeZone:'UTC'})} accessibilityHint={zh?'打开这天的日程':'Opens this day'} accessibilityState={{selected:on}} onPress={()=>{feel.select();onDay(d.date);}} style={({pressed})=>({flex:1,alignItems:'center',gap:2,paddingVertical:10,borderRadius:18,borderCurve:'continuous',backgroundColor:on?'#24467F':c.surface,boxShadow:on?'0 8px 18px #1B356640':'0 4px 14px #1B35660D',transform:[{scale:pressed?0.96:1}]})}>
   <Text style={{fontSize:12,fontWeight:'600',color:on?'#FFFFFFB3':c.muted}}>{zh?'日一二三四五六'[wd]:'SMTWTFS'[wd]}</Text>
   <Text style={{fontSize:20,fontWeight:'700',color:on?'#FFFFFF':c.text,fontFamily:'ui-rounded'}}>{Number(d.date.slice(8))}</Text>
  </Pressable>;})}</View>
  <View onLayout={e=>setWidth(e.nativeEvent.layout.width-PAD*2)} style={{padding:PAD,borderRadius:28,borderCurve:'continuous',backgroundColor:c.surface,boxShadow:'0 10px 30px #1B356614'}}>
   <View style={{height:(h1-h0)*HOUR+12}}>
    {hours.map(h=><View key={h} style={{position:'absolute',left:0,right:0,top:(h-h0)*HOUR,flexDirection:'row',alignItems:'center',gap:6}}><Text style={{width:LABEL-6,fontSize:11,fontWeight:'600',color:c.tertiary,fontVariant:['tabular-nums']}}>{String(h).padStart(2,'0')}:00</Text><View style={{flex:1,height:0.5,backgroundColor:c.border}}/></View>)}
    {col?shown.map((d,i)=>clusters(d.events.filter(e=>e.kind==='event'&&!e.all_day&&e.starts_at) as Timed[],zone).map(run=>{
     const top=(run.start-h0)*HOUR+6,height=Math.max(30,(run.end-run.start)*HOUR-4),left=LABEL+i*col+2,width=col-4;
     if(run.events.length>1){const names=run.events.map(codeOf),label=zh?`${run.events.length} 项`:`${run.events.length} items`;
      return <Pressable key={run.events.map(e=>e.id).join('+')} accessibilityRole="button" accessibilityLabel={`${label}：${names.join(zh?'、':', ')}`} accessibilityHint={zh?'打开这天的日程':'Opens this day'} onPress={()=>{feel.select();onDay(d.date);}} style={({pressed})=>({position:'absolute',left,top,width,height,borderRadius:10,borderCurve:'continuous',paddingVertical:5,paddingLeft:8,paddingRight:5,overflow:'hidden',backgroundColor:c.accent+'14',opacity:pressed?0.7:1})}>
       <View style={{position:'absolute',left:0,top:0,bottom:0,width:3}}>{run.events.map(e=><View key={e.id} style={{flex:1,backgroundColor:colorOf(e.course_id)}}/>)}</View>
       <Text numberOfLines={1} style={{fontSize:10,lineHeight:13,fontWeight:'800',color:c.accent}}>{label}</Text>
       {height>30?<Text numberOfLines={Math.max(1,Math.floor((height-23)/12))} style={{fontSize:9,lineHeight:12,color:c.accent,opacity:0.8}}>{names.join(zh?'、':', ')}</Text>:null}
      </Pressable>;}
     const e=run.events[0],tint=colorOf(e.course_id),ink=dark?'#FFFFFFE6':tint,cancelled=e.status==='cancelled';
     return <Pressable key={e.id} accessibilityRole="button" accessibilityLabel={`${e.title} ${e.location??''}`} onPress={()=>onOpen(e)} style={({pressed})=>({position:'absolute',left,top,width,height,borderRadius:10,borderCurve:'continuous',padding:5,overflow:'hidden',backgroundColor:tint+(cancelled?'0F':dark?'38':'24'),borderLeftWidth:3,borderLeftColor:tint,opacity:pressed?0.7:cancelled?0.5:1})}>
      <Text numberOfLines={2} style={{fontSize:10,lineHeight:13,fontWeight:'800',color:ink,textDecorationLine:cancelled?'line-through':'none'}}>{codeOf(e)}</Text>
      {height>44&&e.location?<Text numberOfLines={1} style={{fontSize:9,color:ink,opacity:0.8}}>{e.location.split(/[·,]/)[0]}</Text>:null}
     </Pressable>;})):null}
    {col&&todayIndex>=0&&nowH>=h0&&nowH<=h1?<View pointerEvents="none" style={{position:'absolute',left:LABEL,right:0,top:(nowH-h0)*HOUR+6,height:2,backgroundColor:c.red+'66'}}>
     <View style={{position:'absolute',left:todayIndex*col,width:col,height:2,backgroundColor:c.red}}/>
     <View style={{position:'absolute',left:todayIndex*col-4,top:-4,width:10,height:10,borderRadius:5,backgroundColor:c.red}}/>
    </View>:null}
   </View>
  </View>
  {weekend.length&&shown.length<days.length?<Text style={{paddingHorizontal:4,fontSize:12,color:c.muted}}>{zh?'周末没有课，已隐藏。':'No weekend classes — hidden.'}</Text>:null}
 </View>;
}

// Pen board "V3 / 本周课表" (KVyBB), V5 styling: weekday tiles, hourly grid with course blocks, red now line.
import {useEffect,useState} from 'react';
import {Pressable,Text,View} from 'react-native';
import {usePenColors} from '../ui/Pen';
import {feel} from '../ui/feel';
import type {CalendarItem} from './types';

type Day={date:string;events:CalendarItem[]};
const HOUR=58,LABEL=40;
const hk=(iso:string)=>{const d=new Date(Date.parse(iso)+8*3600e3);return d.getUTCHours()+d.getUTCMinutes()/60;};

export function WeekGrid({days,today,zh,colorOf,codeOf,onOpen,onDay}:{days:Day[];today:string;zh:boolean;colorOf:(courseId:string|null|undefined)=>string;codeOf:(item:CalendarItem)=>string;onOpen:(item:CalendarItem)=>void;onDay:(date:string)=>void}){
 const c=usePenColors();
 const [width,setWidth]=useState(0),[now,setNow]=useState(Date.now());
 useEffect(()=>{const t=setInterval(()=>setNow(Date.now()),60000);return()=>clearInterval(t);},[]);
 const weekend=days.filter(d=>{const wd=new Date(d.date+'T00:00:00Z').getUTCDay();return wd===0||wd===6;});
 const shown=days.filter(d=>{const wd=new Date(d.date+'T00:00:00Z').getUTCDay();return (wd!==0&&wd!==6)||d.events.some(e=>e.kind==='event'&&!e.all_day);}).slice(0,7);
 const timed=shown.flatMap(d=>d.events.filter(e=>e.kind==='event'&&!e.all_day&&e.starts_at)) as Extract<CalendarItem,{kind:'event'}>[];
 const h0=Math.min(9,...timed.map(e=>Math.floor(hk(e.starts_at!)))),h1=Math.max(18,...timed.map(e=>Math.ceil(hk(e.ends_at??e.starts_at!)+(e.ends_at?0:1))));
 const col=width?(width-LABEL)/shown.length:0;
 const nowH=hk(new Date(now).toISOString()),todayIndex=shown.findIndex(d=>d.date===today);
 const hours=[];for(let h=h0;h<=h1;h++)hours.push(h);
 return <View style={{gap:14}}>
  <View style={{flexDirection:'row',gap:8}}>{shown.map(d=>{const on=d.date===today,wd=new Date(d.date+'T00:00:00Z').getUTCDay();return <Pressable key={d.date} accessibilityRole="button" accessibilityLabel={d.date} onPress={()=>{feel.select();onDay(d.date);}} style={({pressed})=>({flex:1,alignItems:'center',gap:2,paddingVertical:10,borderRadius:18,borderCurve:'continuous',backgroundColor:on?'#24467F':c.surface,boxShadow:on?'0 8px 18px #1B356640':'0 4px 14px #1B35660D',transform:[{scale:pressed?0.96:1}]})}>
   <Text style={{fontSize:12,fontWeight:'600',color:on?'#FFFFFFB3':c.muted}}>{zh?'日一二三四五六'[wd]:'SMTWTFS'[wd]}</Text>
   <Text style={{fontSize:20,fontWeight:'700',color:on?'#FFFFFF':c.text,fontFamily:'ui-rounded'}}>{Number(d.date.slice(8))}</Text>
  </Pressable>;})}</View>
  <View onLayout={e=>setWidth(e.nativeEvent.layout.width-24)} style={{padding:12,borderRadius:28,borderCurve:'continuous',backgroundColor:c.surface,boxShadow:'0 10px 30px #1B356614'}}>
   <View style={{height:(h1-h0)*HOUR+12}}>
    {hours.map(h=><View key={h} style={{position:'absolute',left:0,right:0,top:(h-h0)*HOUR,flexDirection:'row',alignItems:'center',gap:6}}><Text style={{width:LABEL-6,fontSize:11,fontWeight:'600',color:c.tertiary,fontVariant:['tabular-nums']}}>{String(h).padStart(2,'0')}:00</Text><View style={{flex:1,height:0.5,backgroundColor:c.border}}/></View>)}
    {col?shown.map((d,i)=>(d.events.filter(e=>e.kind==='event'&&!e.all_day&&e.starts_at) as Extract<CalendarItem,{kind:'event'}>[]).map(e=>{const top=(hk(e.starts_at!)-h0)*HOUR+6,height=Math.max(30,((e.ends_at?hk(e.ends_at):hk(e.starts_at!)+1)-hk(e.starts_at!))*HOUR-4),tint=colorOf(e.course_id),cancelled=e.status==='cancelled';
     return <Pressable key={e.id} accessibilityRole="button" accessibilityLabel={`${e.title} ${e.location??''}`} onPress={()=>onOpen(e)} style={({pressed})=>({position:'absolute',left:LABEL+i*col+2,top,width:col-4,height,borderRadius:10,borderCurve:'continuous',padding:5,overflow:'hidden',backgroundColor:tint+(cancelled?'0F':'24'),borderLeftWidth:3,borderLeftColor:tint,opacity:pressed?0.7:cancelled?0.5:1})}>
      <Text numberOfLines={2} style={{fontSize:10,lineHeight:13,fontWeight:'800',color:tint,textDecorationLine:cancelled?'line-through':'none'}}>{codeOf(e)}</Text>
      {height>44&&e.location?<Text numberOfLines={1} style={{fontSize:9,color:tint,opacity:0.8}}>{e.location.split(/[·,]/)[0]}</Text>:null}
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

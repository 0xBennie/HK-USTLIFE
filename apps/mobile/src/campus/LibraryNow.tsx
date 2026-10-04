// Pen board "V4 / 校园 · 发车看板" → card "Library now" (MKbYn): live HKUST Library status from /campus/library,
// which relays the library homepage's own endpoints (headcount vs last week, study-room bookings, today's hours).
import {useEffect,useState} from 'react';
import {AppState,Linking,Pressable,Text,View} from 'react-native';
import {NumberFlow} from 'number-flow-react-native';
import {api} from '../runtime';
import {usePenColors} from '../ui/Pen';
import {feel} from '../ui/feel';
import type {LibraryStatus} from '../../../../src/product/campus/library';

let last:LibraryStatus|null=null;
export function LibraryNow({zh,active}:{zh:boolean;active:boolean}){
 const c=usePenColors();
 const [s,setS]=useState<LibraryStatus|null>(last);
 useEffect(()=>{
  if(!active)return;let live=true;
  const load=()=>void api.request<LibraryStatus>('/campus/library',{timeoutMs:20_000}).then(v=>{last=v;if(live)setS(v);}).catch(()=>{});
  load();const t=setInterval(()=>{if(AppState.currentState==='active')load();},120_000);
  return()=>{live=false;clearInterval(t);};
 },[active]);
 if(!s||(!s.people&&!s.rooms&&!s.hours.length))return null;
 const lc=s.hours.find(h=>h.code==='lc'),main=s.hours.find(h=>h.code==='main');
 const stat=(label:string,value:number|string,unit:string,sub:string,color:string)=><View style={{flex:1,gap:2}}>
  <Text numberOfLines={1} style={{fontSize:12,fontWeight:'600',color:c.muted}}>{label}</Text>
  <View style={{flexDirection:'row',alignItems:'flex-end',gap:3}}>{typeof value==='number'?<NumberFlow value={value} style={{fontSize:26,fontWeight:'800',color,letterSpacing:-0.5,fontVariant:['tabular-nums']}}/>:<Text style={{fontSize:26,fontWeight:'800',color}}>{value}</Text>}<Text style={{fontSize:12,fontWeight:'500',color:c.muted,paddingBottom:5}}>{unit}</Text></View>
  <Text numberOfLines={1} style={{fontSize:11,color:c.muted}}>{sub}</Text>
 </View>;
 const lcValue=lc?.all_day?24:lc?.open&&lc.close?`${lc.open}`:'–',lcUnit=lc?.all_day?(zh?'小时':'hours'):lc?.close?`–${lc.close}`:'';
 const mainSub=main?(main.open&&main.close?(main.open_now?(zh?`主馆开到 ${main.close}`:`Main until ${main.close}`):(zh?`主馆已关 · ${main.open} 开`:`Main opens ${main.open}`)):`${zh?'主馆':'Main'} ${main.text}`):'';
 return <View style={{gap:14,padding:18,borderRadius:28,borderCurve:'continuous',backgroundColor:c.surface,borderWidth:1,borderColor:c.glassBorder,boxShadow:'0 10px 30px #0000000F'}}>
  <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}>
   <View style={{flexDirection:'row',alignItems:'center',gap:8}}><View style={{width:8,height:8,borderRadius:4,backgroundColor:c.green}}/><Text style={{fontSize:15,fontWeight:'700',color:c.text}}>{zh?'图书馆 · 现在':'Library now'}</Text></View>
   {s.rooms?<Pressable accessibilityRole="link" hitSlop={8} onPress={()=>{feel.select();void Linking.openURL(s.rooms!.link);}}><Text style={{fontSize:13,fontWeight:'600',color:c.accent}}>{zh?'预约研讨室 ›':'Book a room ›'}</Text></Pressable>:null}
  </View>
  <View style={{flexDirection:'row',gap:12}}>
   {s.people?stat(zh?'馆内':'Inside',s.people.now,zh?'人':'ppl',s.people.last_week!=null?(zh?`上周此时 ${s.people.last_week}`:`Last week ${s.people.last_week}`):`${s.people.at}`,'#24467F'):null}
   {s.rooms?stat(zh?'研讨室已订':'Rooms booked',s.rooms.booked,`/ ${s.rooms.total}`,s.pods?(zh?`学习舱 ${s.pods.booked} / ${s.pods.total}`:`Pods ${s.pods.booked} / ${s.pods.total}`):'','#2E9E5B'):null}
   {lc?stat(zh?'LC 学习区':'Learning Commons',lcValue,lcUnit,mainSub,'#24467F'):null}
  </View>
 </View>;
}

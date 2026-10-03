// Pen board "V4 / 今天 · 一日时间轴": one glance at the day — classes as blocks, timed deadlines as pins, a red now line.
import {useEffect,useState} from 'react';
import {Pressable,Text,View} from 'react-native';
import Reanimated,{FadeIn} from 'react-native-reanimated';
import {PenIcon,usePenColors} from '../ui/Pen';
import {useAppearance} from '../ui/Appearance';

export type RibbonBlock={id:string;label:string;start:number;end:number;color:string;onPress?:()=>void};
export type RibbonPin={id:string;label:string;at:number;tone:'orange'|'red';onPress?:()=>void};

const hourOf=(ms:number)=>{const d=new Date(ms+8*3600e3);return d.getUTCHours()+d.getUTCMinutes()/60;};

export function DayRibbon({blocks,pins,zh,onWeek}:{blocks:RibbonBlock[];pins:RibbonPin[];zh:boolean;onWeek:()=>void}){
 const c=usePenColors(),{reduceMotion}=useAppearance();
 const [width,setWidth]=useState(0),[now,setNow]=useState(Date.now());
 useEffect(()=>{const t=setInterval(()=>setNow(Date.now()),60000);return()=>clearInterval(t);},[]);
 const hours=[...blocks.flatMap(b=>[hourOf(b.start),hourOf(b.end)]),...pins.map(p=>hourOf(p.at))];
 const h0=Math.min(9,Math.floor(Math.min(...hours,24))),h1=Math.max(21,Math.ceil(Math.max(...hours,0)));
 const x=(ms:number)=>Math.max(0,Math.min(width,(hourOf(ms)-h0)/(h1-h0)*width));
 const ticks=[];for(let h=h0;h<=h1;h+=3)ticks.push(h);
 const nowH=hourOf(now),showNow=nowH>=h0&&nowH<=h1;
 let lastPin=-999;
 const placed=[...pins].sort((a,b)=>a.at-b.at).slice(0,4).map(p=>{const w=64,want=Math.min(width-w,Math.max(0,x(p.at)-w/2)),left=Math.max(want,lastPin+w+4);lastPin=Math.min(left,width-w);return {...p,left:lastPin,w};});
 const tone=(t:RibbonPin['tone'])=>t==='red'?c.red:c.orange;
 return <View style={{gap:14,padding:18,borderRadius:28,borderCurve:'continuous',backgroundColor:c.surface,borderWidth:1,borderColor:c.glassBorder,boxShadow:'0 10px 30px #1B356614'}}>
  <View style={{flexDirection:'row',alignItems:'center'}}>
   <Text style={{flex:1,fontSize:17,fontWeight:'700',color:c.text}}>{zh?'今天的节奏':'Your day'}</Text>
   <Pressable accessibilityRole="button" hitSlop={10} onPress={onWeek} style={({pressed})=>({flexDirection:'row',alignItems:'center',gap:2,opacity:pressed?0.6:1})}><Text style={{fontSize:14,fontWeight:'600',color:c.blue}}>{zh?'本周':'Week'}</Text><PenIcon name="chevron-right" size={15} strokeWidth={2.4} color={c.blue}/></Pressable>
  </View>
  <View accessibilityLabel={zh?`今天 ${blocks.length} 节课，${pins.length} 个截止`:`${blocks.length} classes and ${pins.length} deadlines today`} onLayout={e=>setWidth(e.nativeEvent.layout.width)} style={{height:96}}>
   {width?<>
    <View style={{position:'absolute',left:0,right:0,top:47,height:2,borderRadius:1,backgroundColor:c.blue+'1A'}}/>
    {ticks.map(h=>{const left=(h-h0)/(h1-h0)*width;return <View key={h} style={{position:'absolute',left:left-12,top:43,width:24,alignItems:'center'}}><View style={{width:1,height:10,backgroundColor:c.blue+'33'}}/><Text style={{marginTop:20,fontSize:11,fontWeight:'600',color:c.muted,fontVariant:['tabular-nums']}}>{h}</Text></View>;})}
    {blocks.map((b,i)=>{const left=x(b.start),w=Math.max(34,x(b.end)-left),past=b.end<now;return <Reanimated.View key={b.id} entering={reduceMotion?undefined:FadeIn.delay(80*i)} style={{position:'absolute',left,top:30,width:w,height:36}}>
     <Pressable accessibilityRole="button" accessibilityLabel={b.label} onPress={b.onPress} style={({pressed})=>({flex:1,borderRadius:10,borderCurve:'continuous',alignItems:'center',justifyContent:'center',backgroundColor:b.color,opacity:past?0.35:pressed?0.8:1})}><Text numberOfLines={1} style={{fontSize:10,fontWeight:'800',color:'#FFFFFF',letterSpacing:0.3}}>{b.label.split(' ')[0]}</Text></Pressable>
    </Reanimated.View>;})}
    {placed.map(p=><View key={p.id}>
     <View style={{position:'absolute',left:Math.min(width-2,x(p.at)),top:22,width:2,height:26,backgroundColor:tone(p.tone)}}/>
     <Pressable accessibilityRole="button" accessibilityLabel={p.label} onPress={p.onPress} style={{position:'absolute',left:p.left,top:0,width:p.w,height:22,borderRadius:11,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:3,paddingHorizontal:6,backgroundColor:tone(p.tone)}}><PenIcon name="flag" size={10} strokeWidth={2.6} color="#FFFFFF"/><Text numberOfLines={1} style={{flexShrink:1,fontSize:10,fontWeight:'700',color:'#FFFFFF'}}>{p.label}</Text></Pressable>
    </View>)}
    {showNow?<View pointerEvents="none" style={{position:'absolute',left:x(now)-5,top:14}}>
     <View style={{width:10,height:10,borderRadius:5,backgroundColor:c.red}}/>
     <View style={{marginLeft:4,width:2,height:52,borderRadius:1,backgroundColor:c.red}}/>
    </View>:null}
   </>:null}
  </View>
  {!blocks.length&&!pins.length?<Text style={{fontSize:14,color:c.muted}}>{zh?'今天没有课，也没有截止。':'Nothing scheduled today.'}</Text>:null}
 </View>;
}

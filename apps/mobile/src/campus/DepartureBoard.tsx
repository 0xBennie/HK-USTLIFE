// Pen board "V4 / 校园 · 发车看板": split-flap departure time, countdown ring, next departures, live bus ETAs.
import {useEffect} from 'react';
import {Pressable,Text,View} from 'react-native';
import {NumberFlow} from 'number-flow-react-native';
import Reanimated,{useAnimatedProps,useSharedValue,withRepeat,withSequence,withTiming,useAnimatedStyle} from 'react-native-reanimated';
import Svg,{Circle,Defs,LinearGradient,Rect,Stop} from 'react-native-svg';
import {PenIcon} from '../ui/Pen';
import {useAppearance} from '../ui/Appearance';

const AnimatedCircle=Reanimated.createAnimatedComponent(Circle);
export type LiveRow={code:string;operator:'gmb'|'kmb';name:string;minutes:number|null};

function Flap({ch}:{ch:string}){
 return <View style={{width:40,height:58,borderRadius:10,borderCurve:'continuous',backgroundColor:'#FFFFFF1A',borderWidth:1,borderColor:'#FFFFFF14',alignItems:'center',justifyContent:'center',overflow:'hidden'}}>
  {/\d/.test(ch)?<NumberFlow value={Number(ch)} style={{fontSize:40,fontWeight:'700',color:'#FFFFFF',fontFamily:'ui-rounded'}}/>:<Text style={{fontSize:40,fontWeight:'700',color:'#FFFFFF'}}>{ch}</Text>}
  <View style={{position:'absolute',left:0,right:0,top:28.5,height:1,backgroundColor:'#0B163059'}}/>
 </View>;
}

function Ring({minutes,zh,window=30}:{minutes:number|null;zh:boolean;window?:number}){
 const {reduceMotion}=useAppearance();
 const size=84,stroke=7,r=(size-stroke)/2,len=2*Math.PI*r;
 const target=minutes===null?0:Math.max(0.04,Math.min(1,1-minutes/window));
 const p=useSharedValue(reduceMotion?target:0);
 useEffect(()=>{p.value=reduceMotion?target:withTiming(target,{duration:900});},[target,reduceMotion]);
 const props=useAnimatedProps(()=>({strokeDashoffset:len*(1-p.value)}));
 return <View style={{width:size,height:size,alignItems:'center',justifyContent:'center'}}>
  <Svg width={size} height={size} style={{position:'absolute',transform:[{rotate:'-90deg'}]}}>
   <Circle cx={size/2} cy={size/2} r={r} stroke="#FFFFFF26" strokeWidth={stroke} fill="none"/>
   <AnimatedCircle cx={size/2} cy={size/2} r={r} stroke="#FFFFFF" strokeWidth={stroke} strokeLinecap="round" fill="none" strokeDasharray={`${len} ${len}`} animatedProps={props}/>
  </Svg>
  <Text style={{fontSize:28,fontWeight:'700',color:'#FFFFFF',fontFamily:'ui-rounded',fontVariant:['tabular-nums']}}>{minutes===null?'—':minutes<=0?'0':minutes>90?String(Math.round(minutes/60)):String(minutes)}</Text>
  <Text style={{fontSize:11,fontWeight:'600',color:'#FFFFFFB3'}}>{minutes!==null&&minutes<=0?(zh?'即将开出':'leaving'):minutes!==null&&minutes>90?(zh?'小时后':'hours'):(zh?'分钟后':'min')}</Text>
 </View>;
}

function LiveDot(){
 const {reduceMotion}=useAppearance(),o=useSharedValue(1);
 useEffect(()=>{if(!reduceMotion)o.value=withRepeat(withSequence(withTiming(0.25,{duration:900}),withTiming(1,{duration:900})),-1);},[reduceMotion]);
 const style=useAnimatedStyle(()=>({opacity:o.value}));
 return <Reanimated.View style={[{width:8,height:8,borderRadius:4,backgroundColor:'#5BE38F'},style]}/>;
}

export function DepartureBoard({zh,title,label,time,minutes,later,live,note,onOpen,onRoutes,onBuses}:{zh:boolean;title:string;label:string;time:string|null;minutes:number|null;later:string[];live:LiveRow[]|null;note?:string;onOpen:()=>void;onRoutes:()=>void;onBuses:()=>void}){
 const chars=(time??'--:--').split('');
 const link=(t:string,on:()=>void)=><Pressable accessibilityRole="button" hitSlop={8} onPress={on} style={({pressed})=>({flexDirection:'row',alignItems:'center',gap:2,opacity:pressed?0.6:1})}><Text style={{fontSize:13,fontWeight:'600',color:'#FFFFFFCC'}}>{t}</Text><PenIcon name="chevron-right" size={14} strokeWidth={2.4} color="#FFFFFFCC"/></Pressable>;
 return <Pressable accessibilityRole="button" accessibilityLabel={`${title} ${label} ${time??''}`} onPress={onOpen} style={({pressed})=>({borderRadius:30,borderCurve:'continuous',overflow:'hidden',backgroundColor:'#1C3766',boxShadow:'0 16px 34px #1B356640',transform:[{scale:pressed?0.985:1}]})}>
  <Svg preserveAspectRatio="none" viewBox="0 0 100 100" style={{position:'absolute',top:0,left:0,right:0,bottom:0}}><Defs><LinearGradient id="board" x1="0" y1="0" x2="0.6" y2="1"><Stop offset="0" stopColor="#2C5291"/><Stop offset="1" stopColor="#142A52"/></LinearGradient></Defs><Rect x="0" y="0" width="100" height="100" fill="url(#board)"/></Svg>
  <View style={{padding:20,gap:16}}>
   <View style={{flexDirection:'row',alignItems:'center',gap:8}}><LiveDot/><Text style={{flex:1,fontSize:14,fontWeight:'600',color:'#FFFFFFCC'}}>{title}</Text>{link(zh?'全部路线':'Routes',onRoutes)}</View>
   <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}>
    <View style={{gap:4}}>
     <Text style={{fontSize:13,fontWeight:'600',color:'#FFFFFF99'}}>{label}</Text>
     <View style={{flexDirection:'row',alignItems:'center',gap:4}}>{chars.map((ch,i)=>ch===':'?<Text key={i} style={{fontSize:38,fontWeight:'700',color:'#FFFFFF',marginHorizontal:1}}>:</Text>:<Flap key={i} ch={ch}/>)}</View>
    </View>
    <Ring minutes={minutes} zh={zh}/>
   </View>
   {later.length?<View style={{flexDirection:'row',alignItems:'center',gap:8}}><Text style={{fontSize:13,fontWeight:'600',color:'#FFFFFF99'}}>{zh?'之后':'Then'}</Text>{later.slice(0,4).map(t=><View key={t} style={{paddingVertical:6,paddingHorizontal:10,borderRadius:99,backgroundColor:'#FFFFFF1A'}}><Text style={{fontSize:13,fontWeight:'700',color:'#FFFFFF',fontVariant:['tabular-nums']}}>{t}</Text></View>)}</View>:note?<Text style={{fontSize:13,color:'#FFFFFFB3'}}>{note}</Text>:null}
   <View style={{height:1,backgroundColor:'#FFFFFF1F'}}/>
   {live===null?<Text style={{fontSize:13,color:'#FFFFFF99'}}>{zh?'正在查询闸口实时巴士…':'Checking live buses…'}</Text>:live.length?live.map((l,i)=><View key={l.code+i} style={{flexDirection:'row',alignItems:'center',gap:10}}>
    <View style={{paddingVertical:4,paddingHorizontal:8,borderRadius:8,backgroundColor:l.operator==='gmb'?'#2E9E5B':'#E5484D'}}><Text style={{fontSize:12,fontWeight:'800',color:'#FFFFFF'}}>{l.code}</Text></View>
    <Text numberOfLines={1} style={{flex:1,fontSize:14,fontWeight:'500',color:'#FFFFFFCC'}}>{l.name}</Text>
    <Text style={{fontSize:15,fontWeight:'700',color:l.minutes===null?'#FFFFFF80':'#FFFFFF',fontVariant:['tabular-nums']}}>{l.minutes===null?(zh?'暂无预测':'No ETA'):l.minutes===0?(zh?'即将到站':'Due'):zh?`${l.minutes} 分钟`:`${l.minutes} min`}</Text>
   </View>):<Text style={{fontSize:13,color:'#FFFFFF99'}}>{zh?'这个方向暂时没有实时巴士。':'No live buses this way.'}</Text>}
   <View style={{flexDirection:'row',justifyContent:'flex-end'}}>{link(zh?'九巴与绿色小巴':'All buses',onBuses)}</View>
  </View>
 </Pressable>;
}

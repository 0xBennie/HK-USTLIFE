import {useMemo,useState} from 'react';
import {Modal,Pressable,ScrollView,Text,View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useAppearance} from './Appearance';
import {FormRow,PenIcon,PrimaryButton,usePenColors} from './Pen';

// Values stay in the existing Hong Kong text format ("YYYY-MM-DD" or "YYYY-MM-DD HH:mm") so save controllers are unchanged.
const pad=(n:number)=>String(n).padStart(2,'0');
const hkToday=()=>new Date(Date.now()+8*3600e3).toISOString().slice(0,10);
const shift=(date:string,days:number)=>new Date(Date.parse(date+'T00:00:00Z')+days*864e5).toISOString().slice(0,10);
const weekday=(date:string)=>new Date(date+'T00:00:00Z').getUTCDay();
const zhDays=['日','一','二','三','四','五','六'],enDays=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
export function formatPicked(value:string,zh:boolean){
 if(!value)return zh?'未设置':'Not set';
 const d=value.slice(0,10),t=value.slice(11),today=hkToday();
 const day=d===today?(zh?'今天':'Today'):d===shift(today,1)?(zh?'明天':'Tomorrow'):zh?`${Number(d.slice(5,7))} 月 ${Number(d.slice(8,10))} 日 周${zhDays[weekday(d)]}`:`${enDays[weekday(d)]}, ${d.slice(5).replace('-','/')}`;
 return t?`${day} ${t}`:day;
}
export function DateTimeField({label,value,onChange,mode,disabled,icon='calendar-days',tile,clearable}:{label:string;value:string;onChange:(v:string)=>void;mode:'date'|'datetime';disabled?:boolean;icon?:string;tile?:string;clearable?:boolean}){
 const c=usePenColors(),zh=label.match(/[一-鿿]/)!==null;
 const [open,setOpen]=useState(false);
 return <>
  <FormRow icon={icon} tile={tile??c.red} label={label} value={formatPicked(value,zh)} valueColor={value?c.accent:c.muted} onPress={disabled?undefined:()=>setOpen(true)}/>
  {open?<PickerSheet zh={zh} title={label} value={value} mode={mode} clearable={clearable} onClose={()=>setOpen(false)} onDone={v=>{onChange(v);setOpen(false);}}/>:null}
 </>;
}
function PickerSheet({zh,title,value,mode,clearable,onClose,onDone}:{zh:boolean;title:string;value:string;mode:'date'|'datetime';clearable?:boolean;onClose:()=>void;onDone:(v:string)=>void}){
 const c=usePenColors(),{reduceMotion}=useAppearance(),today=hkToday();
 const [date,setDate]=useState(value.slice(0,10)||today);
 const [hour,setHour]=useState(value.length>11?Number(value.slice(11,13)):9);
 const [minute,setMinute]=useState(value.length>11?Number(value.slice(14,16)):0);
 const [month,setMonth]=useState(date.slice(0,7));
 const days=useMemo(()=>{const first=month+'-01',lead=weekday(first),cells:(string|null)[]=Array(lead).fill(null);let d=first;while(d.slice(0,7)===month){cells.push(d);d=shift(d,1);}while(cells.length%7)cells.push(null);return cells;},[month]);
 const moveMonth=(n:number)=>{const [y,m]=month.split('-').map(Number);const t=new Date(Date.UTC(y,m-1+n,1));setMonth(`${t.getUTCFullYear()}-${pad(t.getUTCMonth()+1)}`);};
 const quick=[[zh?'今天':'Today',today],[zh?'明天':'Tomorrow',shift(today,1)],[zh?'下周一':'Next Mon',shift(today,((8-weekday(today))%7)||7)]] as const;
 const times=[[9,0],[12,0],[17,0],[18,0],[23,59]] as const;
 const result=mode==='date'?date:`${date} ${pad(hour)}:${pad(minute)}`;
 return <Modal visible presentationStyle="pageSheet" animationType={reduceMotion?'none':'slide'} onRequestClose={onClose}>
  <SafeAreaView edges={['top','bottom']} style={{flex:1,backgroundColor:c.background}}>
   <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:20,paddingVertical:12}}>
    <Pressable hitSlop={10} onPress={onClose}><Text style={{fontSize:17,color:c.accent}}>{zh?'取消':'Cancel'}</Text></Pressable>
    <Text style={{fontSize:17,fontWeight:'600',color:c.text}}>{title}</Text>
    <Pressable hitSlop={10} onPress={()=>onDone(result)}><Text style={{fontSize:17,fontWeight:'600',color:c.accent}}>{zh?'完成':'Done'}</Text></Pressable>
   </View>
   <ScrollView contentContainerStyle={{padding:16,gap:16}}>
    <View style={{flexDirection:'row',gap:8}}>{quick.map(([l,d])=><Pressable key={l} onPress={()=>{setDate(d);setMonth(d.slice(0,7));}} style={{paddingVertical:8,paddingHorizontal:14,borderRadius:99,backgroundColor:date===d?c.accent:c.surface}}><Text style={{fontSize:15,fontWeight:'600',color:date===d?'#FFFFFF':c.text}}>{l}</Text></Pressable>)}</View>
    <View style={{backgroundColor:c.surface,borderRadius:18,padding:14,gap:10}}>
     <View style={{flexDirection:'row',alignItems:'center'}}>
      <Text style={{flex:1,fontSize:17,fontWeight:'700',color:c.text}}>{zh?`${month.slice(0,4)} 年 ${Number(month.slice(5))} 月`:month}</Text>
      <Pressable accessibilityLabel={zh?'上个月':'Previous month'} hitSlop={10} onPress={()=>moveMonth(-1)} style={{padding:6}}><PenIcon name="chevron-left" color={c.accent} size={20}/></Pressable>
      <Pressable accessibilityLabel={zh?'下个月':'Next month'} hitSlop={10} onPress={()=>moveMonth(1)} style={{padding:6}}><PenIcon name="chevron-right" color={c.accent} size={20}/></Pressable>
     </View>
     <View style={{flexDirection:'row'}}>{(zh?zhDays:enDays).map(d=><Text key={d} style={{flex:1,textAlign:'center',fontSize:12,fontWeight:'600',color:c.muted}}>{d}</Text>)}</View>
     {Array.from({length:days.length/7},(_,r)=><View key={r} style={{flexDirection:'row'}}>{days.slice(r*7,r*7+7).map((d,i)=>{const on=d===date,isToday=d===today;return <Pressable key={i} disabled={!d} accessibilityLabel={d??undefined} accessibilityState={{selected:on}} onPress={()=>d&&setDate(d)} style={{flex:1,height:42,alignItems:'center',justifyContent:'center'}}><View style={{width:36,height:36,borderRadius:18,alignItems:'center',justifyContent:'center',backgroundColor:on?c.accent:'transparent'}}><Text style={{fontSize:17,fontWeight:on||isToday?'700':'400',color:on?'#FFFFFF':isToday?c.accent:c.text}}>{d?Number(d.slice(8)):''}</Text></View></Pressable>;})}</View>)}
    </View>
    {mode==='datetime'?<View style={{backgroundColor:c.surface,borderRadius:18,padding:14,gap:12}}>
     <Text style={{fontSize:13,fontWeight:'600',color:c.muted}}>{zh?'时间（香港）':'Time (Hong Kong)'}</Text>
     <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>{times.map(([h,m])=>{const on=h===hour&&m===minute;return <Pressable key={`${h}${m}`} onPress={()=>{setHour(h);setMinute(m);}} style={{paddingVertical:8,paddingHorizontal:14,borderRadius:99,backgroundColor:on?c.accent:c.fill}}><Text style={{fontSize:15,fontWeight:'600',color:on?'#FFFFFF':c.text}}>{pad(h)}:{pad(m)}</Text></Pressable>;})}</View>
     <View style={{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:18}}>
      <Stepper value={pad(hour)} onMinus={()=>setHour((hour+23)%24)} onPlus={()=>setHour((hour+1)%24)} label={zh?'小时':'Hour'}/>
      <Text style={{fontSize:30,fontWeight:'700',color:c.text}}>:</Text>
      <Stepper value={pad(minute)} onMinus={()=>setMinute(minute>=15?minute-(minute%15||15):45)} onPlus={()=>setMinute(minute>=45?0:minute-(minute%15)+15)} label={zh?'分钟':'Minute'}/>
     </View>
    </View>:null}
    <View style={{flexDirection:'row'}}><PrimaryButton label={`${zh?'设为':'Set'} ${formatPicked(result,zh)}`} onPress={()=>onDone(result)}/></View>
    {clearable&&value?<Pressable onPress={()=>onDone('')} style={{alignItems:'center',padding:8}}><Text style={{fontSize:16,fontWeight:'600',color:c.danger}}>{zh?'清除':'Clear'}</Text></Pressable>:null}
   </ScrollView>
  </SafeAreaView>
 </Modal>;
}
function Stepper({value,onMinus,onPlus,label}:{value:string;onMinus:()=>void;onPlus:()=>void;label:string}){
 const c=usePenColors();
 return <View style={{alignItems:'center',gap:6}}>
  <Pressable accessibilityLabel={`${label} +`} onPress={onPlus} hitSlop={8} style={{padding:6,borderRadius:99,backgroundColor:c.fill}}><PenIcon name="chevron-up" size={18} color={c.text}/></Pressable>
  <Text accessibilityLabel={`${label} ${value}`} style={{fontSize:34,fontWeight:'700',color:c.text,fontVariant:['tabular-nums']}}>{value}</Text>
  <Pressable accessibilityLabel={`${label} -`} onPress={onMinus} hitSlop={8} style={{padding:6,borderRadius:99,backgroundColor:c.fill}}><PenIcon name="chevron-down" size={18} color={c.text}/></Pressable>
 </View>;
}

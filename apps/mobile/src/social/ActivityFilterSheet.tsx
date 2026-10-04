// Pen "V6 / 活动筛选（面板）" (s99lg): search, four chip groups and a Hong Kong time window picked with the
// shared date sheet (never typed). Changes stay in the sheet until "查看结果".
import {useEffect,useState} from 'react';
import {Pressable,ScrollView,Text,View} from 'react-native';
import {BottomSheet} from '../ui/BottomSheet';
import {PickerSheet,formatPicked} from '../ui/DateTimeField';
import {Notice,PenIcon,PlainField,PrimaryButton,usePenColors} from '../ui/Pen';
import {feel} from '../ui/feel';
import {interactionLabel} from './covers';

export type Filters={q:string;kind:string;interaction:string;language:string;mine:string;from:string;to:string};
export const emptyFilters:Filters={q:'',kind:'',interaction:'',language:'',mine:'',from:'',to:''};

export function ActivityFilterSheet({visible,zh,value,showMine,onClose,onApply}:{visible:boolean;zh:boolean;value:Filters;showMine:boolean;onClose:()=>void;onApply:(f:Filters)=>void}){
 const c=usePenColors();
 const [draft,setDraft]=useState<Filters>(value),[picking,setPicking]=useState<'from'|'to'|null>(null),[error,setError]=useState('');
 useEffect(()=>{if(visible){setDraft(value);setError('');}},[visible,value]);
 const set=(key:keyof Filters,v:string)=>{setError('');setDraft(d=>({...d,[key]:v}));};
 const group=(title:string,key:keyof Filters,options:[string,string][])=><View style={{gap:8}}>
  <Text style={{paddingHorizontal:4,fontSize:13,fontWeight:'600',color:c.muted}}>{title}</Text>
  <View accessibilityRole="radiogroup" style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>{options.map(([v,label])=>{const on=draft[key]===v;return <Pressable key={v||'all'} accessibilityRole="radio" accessibilityState={{checked:on}} onPress={()=>{feel.select();set(key,v);}} style={({pressed})=>({paddingVertical:8,paddingHorizontal:14,borderRadius:99,backgroundColor:on?c.accent+'1F':c.fill,opacity:pressed?0.7:1})}><Text style={{fontSize:14,fontWeight:'600',color:on?c.accent:c.text}}>{label}</Text></Pressable>;})}</View>
 </View>;
 const apply=()=>{if(draft.from&&draft.to&&draft.to<=draft.from){setError(zh?'结束时间要晚于开始时间':'The end must be after the start');return;}feel.tap();onApply({...draft,q:draft.q.trim()});};
 const all=zh?'全部':'All';
 return <BottomSheet visible={visible} onClose={onClose} closeLabel={zh?'关闭':'Close'} header={<View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:16,height:44}}>
   <Pressable accessibilityRole="button" hitSlop={10} onPress={()=>{feel.select();setError('');setDraft(emptyFilters);}}><Text style={{fontSize:17,color:c.accent}}>{zh?'重置':'Reset'}</Text></Pressable>
   <Text accessibilityRole="header" style={{fontSize:17,fontWeight:'700',color:c.text}}>{zh?'筛选':'Filters'}</Text>
   <Text style={{fontSize:17,color:'transparent'}}>{zh?'重置':'Reset'}</Text>
  </View>}>
  <ScrollView style={{flexGrow:0,flexShrink:1}} contentContainerStyle={{paddingHorizontal:16,paddingTop:4,paddingBottom:16,gap:14}} keyboardShouldPersistTaps="handled">
   <View style={{flexDirection:'row',alignItems:'center',gap:8,height:44,paddingHorizontal:16,borderRadius:22,backgroundColor:c.surface}}>
    <PenIcon name="search" size={17} color={c.muted}/>
    <PlainField accessibilityLabel={zh?'标题或地点':'Title or place'} value={draft.q} onChangeText={v=>set('q',v)} placeholder={zh?'标题或地点':'Title or place'} returnKeyType="search" maxLength={120} clearButtonMode="while-editing" fontSize={16}/>
   </View>
   {showMine?group(zh?'我的':'Mine','mine',[['',all],['organized',zh?'我组织的':'Hosting'],['participating',zh?'我的参与':'Joined'],['saved',zh?'收藏与日程':'Saved & calendar']]):null}
   {group(zh?'类型':'Type','kind',[['',all],['activity',zh?'活动':'Activities'],['study',zh?'学习组队':'Study groups']])}
   {group(zh?'相处方式':'Style','interaction',[['',all],['quiet',interactionLabel('quiet',zh)],['casual',interactionLabel('casual',zh)],['active',interactionLabel('active',zh)]])}
   {group(zh?'语言':'Language','language',[['',all],['zh',zh?'普通话':'Mandarin'],['en','English'],['yue',zh?'粤语':'Cantonese']])}
   <View style={{gap:8}}>
    <Text style={{paddingHorizontal:4,fontSize:13,fontWeight:'600',color:c.muted}}>{zh?'时间（香港）':'Time (Hong Kong)'}</Text>
    <View style={{borderRadius:20,overflow:'hidden',backgroundColor:c.surface}}>
     {(['from','to'] as const).map((key,i)=><Pressable key={key} accessibilityRole="button" accessibilityLabel={`${key==='from'?(zh?'从':'From'):(zh?'到':'To')} ${draft[key]?formatPicked(draft[key],zh):(zh?'不限':'Any')}`} onPress={()=>setPicking(key)} style={({pressed})=>({flexDirection:'row',alignItems:'center',gap:12,paddingVertical:10,paddingHorizontal:16,borderTopWidth:i?0.5:0,borderTopColor:c.border,backgroundColor:pressed?c.fill:'transparent'})}>
      <Text style={{flex:1,fontSize:16,color:c.text}}>{key==='from'?(zh?'从':'From'):(zh?'到':'To')}</Text>
      <View style={{paddingVertical:6,paddingHorizontal:10,borderRadius:10,backgroundColor:c.fill}}><Text style={{fontSize:15,fontWeight:'500',color:draft[key]?c.text:c.muted,fontVariant:['tabular-nums']}}>{draft[key]?formatPicked(draft[key],zh):(zh?'不限':'Any')}</Text></View>
     </Pressable>)}
    </View>
   </View>
   {error?<Notice tone="error" text={error}/>:null}
  </ScrollView>
  <View style={{paddingHorizontal:16,paddingTop:8}}><View style={{flexDirection:'row'}}><PrimaryButton label={zh?'查看结果':'Show results'} onPress={apply}/></View></View>
  {picking?<PickerSheet zh={zh} title={picking==='from'?(zh?'从':'From'):(zh?'到':'To')} value={draft[picking]} mode="datetime" clearable onClose={()=>setPicking(null)} onDone={v=>{const key=picking;setPicking(null);set(key,v);}}/>:null}
 </BottomSheet>;
}

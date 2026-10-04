// Shared chrome for the V3 "life" boards (学业, 成绩分布, 预约场地, 一起时间, 社团, 宿舍服务, 二手, 校园服务, AI 数据):
// glass back circle, centred title, optional right glass action, and an honest "示例数据" footer where no school feed exists yet.
import type {ReactNode} from 'react';
import {Text,View} from 'react-native';
import {CircleButton,PenIcon,usePenColors,type PenIconName} from '../ui/Pen';

export function LifeTop({title,onBack,right,zh}:{title:string;onBack:()=>void;right?:{icon:PenIconName;label:string;onPress:()=>void};zh:boolean}){
 const c=usePenColors();
 return <View style={{flexDirection:'row',alignItems:'center',minHeight:48}}>
  <CircleButton icon="chevron-left" label={zh?'返回':'Back'} onPress={onBack}/>
  <Text accessibilityRole="header" numberOfLines={1} style={{flex:1,textAlign:'center',fontSize:17,fontWeight:'700',color:c.text}}>{title}</Text>
  {right?<CircleButton icon={right.icon} label={right.label} onPress={right.onPress}/>:<View style={{width:44}}/>}
 </View>;
}
export function Pill({label,color}:{label:string;color:string}){
 return <View style={{paddingVertical:3,paddingHorizontal:9,borderRadius:99,backgroundColor:color+'1F'}}><Text style={{fontSize:12,fontWeight:'700',color}}>{label}</Text></View>;
}
export function CodeTile({code,color}:{code:string;color:string}){
 return <View style={{width:40,height:40,borderRadius:20,alignItems:'center',justifyContent:'center',backgroundColor:color+'1F'}}><Text style={{fontSize:11,fontWeight:'800',color}}>{code}</Text></View>;
}
export function Grid({children}:{children:ReactNode}){return <View style={{flexDirection:'row',flexWrap:'wrap',justifyContent:'space-between',rowGap:10}}>{children}</View>;}

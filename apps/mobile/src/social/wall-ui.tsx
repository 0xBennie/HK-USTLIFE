// Shared pieces for Pen boards "V6 / 校园墙" (ddOiF), "V6 / 帖子详情" (kSIaN), "V6 / 发帖" (M6vKMj).
import {Image,Pressable,Text,View} from 'react-native';
import Svg,{Defs,LinearGradient,Rect,Stop} from 'react-native-svg';
import type {WallPost,WallTopic} from '../../../../src/product/social/wall-types';
import {PenIcon,TintChip,usePenColors} from '../ui/Pen';
import {useAppearance} from '../ui/Appearance';
import {dateTimeInZone,monthDayLabel} from '../study/dates';

export const topicMeta:Record<WallTopic,{zh:string;en:string;icon:string;color:string;from:string;to:string}>={
 question:{zh:'提问',en:'Ask',icon:'circle-question-mark',color:'#24467F',from:'#3D63A6',to:'#24467F'},
 buddy:{zh:'找搭子',en:'Buddies',icon:'users',color:'#7A5C8E',from:'#9A7DAE',to:'#7A5C8E'},
 market:{zh:'二手',en:'Market',icon:'shopping-bag',color:'#A9824C',from:'#C8A875',to:'#A9824C'},
 share:{zh:'分享',en:'Share',icon:'sparkles',color:'#2E7D55',from:'#4FA77A',to:'#2E7D55'},
};
export const topicOf=(p:Pick<WallPost,'kind'>&{topic?:WallTopic})=>p.topic??(p.kind==='help'?'question':'share');
const pairs:[string,string][]=[['#C8A875','#A9824C'],['#3D63A6','#24467F'],['#4FA77A','#2E7D55'],['#5C7BB0','#56647D'],['#C8A875','#A9824C'],['#4F6F8C','#34506B']];
export function GradientAvatar({name,size=40}:{name:string;size?:number}){
 const [a,b]=pairs[[...name].reduce((s,ch)=>s+ch.charCodeAt(0),0)%pairs.length];
 const id='av'+a.slice(1)+size;
 return <View style={{width:size,height:size,borderRadius:size/2,overflow:'hidden',alignItems:'center',justifyContent:'center'}}>
  <Svg style={{position:'absolute',width:'100%',height:'100%'}}><Defs><LinearGradient id={id} x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor={a}/><Stop offset="1" stopColor={b}/></LinearGradient></Defs><Rect width="100%" height="100%" fill={`url(#${id})`}/></Svg>
  <Text style={{fontSize:size*0.42,fontWeight:'700',color:'#FFFFFF'}}>{[...name.trim()][0]?.toUpperCase()??'?'}</Text>
 </View>;
}
export function relativeTime(iso:string,zh:boolean){
 const m=Math.max(0,Math.round((Date.now()-Date.parse(iso))/60000));
 if(m<1)return zh?'刚刚':'now';if(m<60)return zh?`${m} 分钟前`:`${m}m`;const h=Math.round(m/60);if(h<24)return zh?`${h} 小时前`:`${h}h`;
 const d=Math.round(h/24);return d<7?(zh?`${d} 天前`:`${d}d`):monthDayLabel(dateTimeInZone(iso,'Asia/Hong_Kong'),zh);
}
export const visibilityText=(v:WallPost['visibility'],zh:boolean)=>v==='members'?(zh?'仅同学可见':'Classmates only'):(zh?'所有人可见':'Everyone');
/** Resolved = green check, closed = grey lock (Pen "V6 / 帖子详情" · 其他状态). Open posts show nothing. */
export function StatusChip({status,zh}:{status:WallPost['status'];zh:boolean}){
 const c=usePenColors();if(status==='open')return null;const done=status==='resolved',col=done?'#2E9E5B':c.muted;
 return <View style={{flexDirection:'row',alignItems:'center',gap:4,paddingVertical:4,paddingHorizontal:10,borderRadius:99,backgroundColor:done?'#2E9E5B1F':c.fill}}><PenIcon name={done?'circle-check':'lock'} size={13} color={col}/><Text style={{fontSize:12,fontWeight:'700',color:col}}>{done?(zh?'已解决':'Solved'):(zh?'已结束':'Closed')}</Text></View>;
}
export function TopicPill({topic,zh}:{topic:WallTopic;zh:boolean}){const t=topicMeta[topic];return <TintChip color={t.color} label={zh?t.zh:t.en} size={12} radius={99} padding={[5,11]}/>;}
/** Pen "V6 / 校园墙" post card: who and when, topic, title, body, replies and status — nothing the server doesn’t have. */
export function WallPostCard({post,zh,onOpen,cover,onAuthor}:{post:WallPost;zh:boolean;onOpen:()=>void;cover?:number;onAuthor?:()=>void}){
 const c=usePenColors(),{reduceMotion}=useAppearance(),topic=topicOf(post);
 return <Pressable accessibilityRole="button" accessibilityLabel={`${post.title}, ${post.author.display_name}`} onPress={onOpen} style={({pressed})=>({gap:12,padding:18,borderRadius:28,borderCurve:'continuous',backgroundColor:c.surface,borderWidth:1,borderColor:c.glassBorder,boxShadow:'0 10px 30px #0000000F',transform:[{scale:pressed&&!reduceMotion?0.985:1}]})}>
  <View style={{flexDirection:'row',alignItems:'center',gap:10}}>
   <Pressable accessibilityRole="button" accessibilityLabel={post.author.display_name} disabled={!onAuthor} onPress={onAuthor} hitSlop={6}><GradientAvatar name={post.author.display_name}/></Pressable>
   <View style={{flex:1,gap:1}}>
    <Text numberOfLines={1} style={{fontSize:15,fontWeight:'700',color:c.text}}>{post.author.display_name}</Text>
    <Text style={{fontSize:12,color:c.muted}}>{relativeTime(post.created_at,zh)} · {visibilityText(post.visibility,zh)}</Text>
   </View>
   <TopicPill topic={topic} zh={zh}/>
  </View>
  <Text numberOfLines={3} style={{fontSize:18,lineHeight:24,fontWeight:'700',color:c.text}}>{post.title}</Text>
  <Text numberOfLines={3} style={{fontSize:15,lineHeight:22,color:c.muted}}>{post.body}</Text>
  {cover?<Image source={cover} resizeMode="cover" style={{width:'100%',height:180,borderRadius:20}}/>:null}
  <View style={{flexDirection:'row',alignItems:'center',gap:18}}>
   <View style={{flexDirection:'row',alignItems:'center',gap:5}}><PenIcon name="message-circle" size={18} color={c.muted}/><Text style={{fontSize:13,fontWeight:'600',color:c.muted}}>{post.reply_count}</Text></View>
   <View style={{flex:1}}/>
   <StatusChip status={post.status} zh={zh}/>
  </View>
 </Pressable>;
}

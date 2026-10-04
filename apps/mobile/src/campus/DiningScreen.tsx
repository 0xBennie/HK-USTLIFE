// Pen board "V6 / 餐厅（现在营业）" (pVLzF): every campus outlet from the CSO restaurants page with "open now"
// computed from the published weekly hours and HK public holidays. Ambiguous official hours are shown as-is.
import {useEffect,useState} from 'react';
import {AppState,Linking,Pressable,Text,View} from 'react-native';
import {NumberFlow} from 'number-flow-react-native';
import {api} from '../runtime';
import {GlassChips,Hero,ListGroup,ListRow,PenIcon,Skeleton,usePenColors} from '../ui/Pen';
import {feel} from '../ui/feel';
import {LifeTop} from '../life/kit';

type Outlet={id:string;name:string;category:string;phone:string|null;hours:string[];path_advisor:string|null;menu:string|null;status:{state:'open'|'closed'|'unknown';today:string|null;closes_at:string|null;opens_at:string|null}};
type Dining={outlets:Outlet[];open_count:number;source:{url:string;special_hours:string}};
type Filter='open'|'all'|'fast'|'cafe'|'grab'|'table';
const KIND:Record<string,{f:Filter;zh:string;en:string;icon:string;color:string}>={
 'Fast Food':{f:'fast',zh:'快餐',en:'Fast food',icon:'utensils',color:'#2E9E5B'},
 'Cafe':{f:'cafe',zh:'咖啡',en:'Café',icon:'coffee',color:'#A9824C'},
 'Grab & Go':{f:'grab',zh:'外带',en:'Grab & go',icon:'shopping-bag',color:'#24467F'},
 'Table Service Restaurant':{f:'table',zh:'餐厅',en:'Restaurant',icon:'utensils-crossed',color:'#7A5C8E'},
};
/** "Monday - Friday 08:00 - 18:30 (Last Order: 18:15)" → "08:00–18:30". */
const shortHours=(line:string|null)=>{const m=line&&/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/.exec(line.replace(/12:00 noon/,'12:00'));return m?`${m[1]}–${m[2]}`:line&&/closed/i.test(line)?null:line;};
let last:Dining|null=null;

export function DiningScreen({zh,onBack,onShops}:{zh:boolean;onBack:()=>void;onShops:()=>void}){
 const c=usePenColors();
 const [d,setD]=useState<Dining|null>(last),[filter,setFilter]=useState<Filter>('open');
 useEffect(()=>{let live=true;const load=()=>void api.request<Dining>('/campus/dining').then(v=>{last=v;if(live)setD(v);}).catch(()=>{});load();
  const t=setInterval(()=>{if(AppState.currentState==='active')load();},60_000);return()=>{live=false;clearInterval(t);};},[]);
 const list=(d?.outlets??[]).filter(o=>filter==='all'||(filter==='open'?o.status.state==='open':KIND[o.category]?.f===filter));
 const groups=filter==='open'?[{key:'open',title:zh?'营业中':'Open now',rows:list}]:[
  {key:'open',title:zh?'营业中':'Open now',rows:list.filter(o=>o.status.state==='open')},
  {key:'closed',title:zh?'现在关门':'Closed now',rows:list.filter(o=>o.status.state==='closed')},
  {key:'unknown',title:zh?'时间请看官网':'Check the official hours',rows:list.filter(o=>o.status.state==='unknown')},
 ].filter(g=>g.rows.length);
 const row=(o:Outlet,last:boolean)=>{
  const k=KIND[o.category],s=o.status,open=s.state==='open';
  const hours=shortHours(s.today);
  const v1=open?(zh?'营业中':'Open'):s.state==='unknown'?(zh?'以官网为准':'See official'):s.opens_at?(zh?`${s.opens_at} 开`:`Opens ${s.opens_at}`):(zh?'今天休息':'Closed today');
  const v2=open&&s.closes_at?(zh?`到 ${s.closes_at}`:`until ${s.closes_at}`):'';
  const sub=s.state==='unknown'?(zh?'官网公布的时间有冲突':'Official hours conflict'):`${zh?k?.zh??o.category:k?.en??o.category}${hours?` · ${hours}`:''}`;
  return <Pressable key={o.id} disabled={!o.path_advisor} onPress={()=>{feel.select();void Linking.openURL(o.path_advisor!);}} accessibilityRole="link" accessibilityLabel={`${o.name}, ${v1}`}
   style={({pressed})=>({flexDirection:'row',alignItems:'center',gap:12,paddingVertical:12,paddingHorizontal:16,backgroundColor:pressed?c.fill:'transparent',borderBottomWidth:last?0:0.5,borderBottomColor:c.border})}>
   <View style={{width:36,height:36,borderRadius:12,alignItems:'center',justifyContent:'center',backgroundColor:(open?k?.color??c.muted:c.muted)+'1F'}}><PenIcon name={k?.icon??'utensils'} size={18} color={open?k?.color??c.muted:c.muted}/></View>
   <View style={{flex:1,gap:2}}><Text numberOfLines={1} style={{fontSize:16,fontWeight:'600',color:c.text}}>{o.name}</Text><Text numberOfLines={1} style={{fontSize:12,color:c.muted}}>{sub}</Text></View>
   <View style={{alignItems:'flex-end',gap:1}}><Text style={{fontSize:14,fontWeight:'700',color:open?c.green:c.muted}}>{v1}</Text>{v2?<Text style={{fontSize:11,fontWeight:'500',color:c.muted}}>{v2}</Text>:null}</View>
  </Pressable>;
 };
 return <View style={{gap:16}}>
  <LifeTop zh={zh} title={zh?'餐厅':'Dining'} onBack={onBack}/>
  {d?<Pressable onPress={()=>void Linking.openURL(d.source.special_hours)} accessibilityRole="link"><Hero label={zh?'现在营业':'Open now'} value={String(d.open_count)} unit={zh?`/ ${d.outlets.length} 家`:`/ ${d.outlets.length}`} chip={zh?'假期与特别时间以 CSO 公布为准':'Holiday hours: see CSO'} chipIcon="info"/></Pressable>:<Skeleton height={150} radius={28}/>}
  <GlassChips label={zh?'筛选':'Filter'} value={filter} onChange={setFilter} items={[{value:'open',label:zh?'营业中':'Open'},{value:'all',label:zh?'全部':'All'},{value:'fast',label:zh?'快餐':'Fast food'},{value:'cafe',label:zh?'咖啡':'Café'},{value:'grab',label:zh?'外带':'Grab & go'},{value:'table',label:zh?'餐厅':'Restaurant'}]}/>
  {d&&!list.length?<Text style={{textAlign:'center',paddingVertical:24,fontSize:15,color:c.muted}}>{filter==='open'?(zh?'现在没有营业的餐厅。':'Nothing is open right now.'):(zh?'没有这一类。':'None in this category.')}</Text>:null}
  {groups.map(g=><View key={g.key} style={{gap:8}}>
   {groups.length>1||filter!=='open'?<Text style={{fontSize:15,fontWeight:'700',color:c.text,paddingHorizontal:4}}>{g.title}</Text>:null}
   <View style={{backgroundColor:c.surface,borderRadius:24,borderCurve:'continuous',overflow:'hidden',borderWidth:1,borderColor:c.glassBorder,boxShadow:'0 6px 20px #0B1A330F'}}>{g.rows.map((o,i)=>row(o,i===g.rows.length-1))}</View>
  </View>)}
  <ListGroup><ListRow icon="shopping-cart" tile="#A9824C" title={zh?'超市与便利店':'Supermarket & stores'} subtitle="Fusion · 7-Eleven" chevron onPress={onShops}/></ListGroup>
  <Text style={{textAlign:'center',fontSize:12,color:c.muted}}>{zh?'资料来源：科大校园服务处（CSO）餐厅页面 · 点按看位置':'Source: HKUST Campus Services Office · tap for location'}</Text>
 </View>;
}

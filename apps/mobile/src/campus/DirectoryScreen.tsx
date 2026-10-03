import {useSceneFocus} from '../navigation/TabScene';
import {useSceneNavigation} from '../navigation/InputProtection';
import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {Linking,Text,TextInput,View} from 'react-native';
import {api,session} from '../runtime';
import type {Language} from '../strings';
import type {directoryData} from '../../../../src/product/campus/directory-data';
import {TargetActions,type CampusTarget} from './TargetActions';
import {EmptyState,FilterPill,IconTile,ListGroup,ListRow,Notice,PageHeader,PenIcon,PillRow,Skeleton,Stagger,Surface,usePenColors} from '../ui/Pen';
type Entry=typeof directoryData[number]&{version:number;freshness:string};
const meta=(cat:string,c:ReturnType<typeof usePenColors>):[string,string]=>cat==='study'?['library',c.indigo]:cat==='shop'?['shopping-bag','#A9824C']:['life-buoy',c.accent];
// Pen "directory" / "place" boards in the V2 list style.
export function DirectoryScreen({language,onBack,onLogin,initialCategory,initialId}:{language:Language;dark:boolean;onBack:()=>void;onLogin:()=>void;initialCategory?:string;initialId?:string}) {
 const sceneActive=useSceneFocus();
 const profile=useSyncExternalStore(session.subscribe,session.snapshot).profile;
 const zh=language==='zh',c=usePenColors();
 const navigate=useSceneNavigation(zh);
 const [entries,setEntries]=useState<Entry[]>([]),[selectedId,setSelectedId]=useState<string|null>(initialId??null),[q,setQ]=useState(''),[category,setCategory]=useState(initialCategory??''),[onlySaved,setOnlySaved]=useState(false),[marks,setMarks]=useState<CampusTarget[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(false);const alive=useRef(true),epoch=useRef(0);
 async function load(){const generation=++epoch.current;setBusy(true);setError(false);try{const [next,saved]=await Promise.all([api.request<Entry[]>('/campus/places'),profile?session.request<CampusTarget[]>('/me/campus/bookmarks'):Promise.resolve([])]);if(alive.current&&generation===epoch.current){setEntries(next);setMarks(saved);}}catch{if(alive.current&&generation===epoch.current)setError(true);}finally{if(alive.current&&generation===epoch.current)setBusy(false);}}
 useEffect(()=>{if(!sceneActive)return;alive.current=true;void load();return()=>{alive.current=false;epoch.current++;};},[profile?.id,sceneActive]);
 const selected=entries.find(e=>e.id===selectedId)??null;
 const visible=entries.filter(e=>(!category||e.category===category)&&(!onlySaved||marks.some(m=>m.target_kind==='place'&&m.target_id===e.id))&&`${e.name.zh} ${e.name.en} ${e.location.zh} ${e.location.en} ${e.description.zh} ${e.description.en}`.toLowerCase().includes(q.trim().toLowerCase()));
 const open=async(url:string)=>{try{await Linking.openURL(url);}catch{setError(true);}};
 if(selectedId){
  const [icon,col]=meta(selected?.category??'service',c);
  return <View style={{gap:18}}>
   <PageHeader onBack={()=>navigate(()=>initialId?onBack():setSelectedId(null))} backLabel={initialId?(zh?'校园':'Campus'):(zh?'地点':'Places')} eyebrow={selected?({study:zh?'学习空间':'Study space',shop:zh?'吃喝与购物':'Food & shops',service:zh?'学生服务':'Student service'} as Record<string,string>)[selected.category]:undefined} title={selected?.name[language]??'…'} subtitle={selected?.location[language]}/>
   {!selected?(busy||!entries.length?<Skeleton height={160}/>:<Notice tone="error" text={zh?'这个地点暂时无法读取。':'This place could not load.'}/>):<>
    {selected.freshness==='stale'?<Notice tone="warning" text={zh?'资料待重新核对，请以官方来源为准。':'Needs review; trust the official source.'}/>:null}
    <View style={{flexDirection:'row',gap:10}}>
     {selected.map_url?<QuickAction icon="navigation" label={zh?'路线':'Route'} primary onPress={()=>void open(selected.map_url!)}/>:null}
     <QuickAction icon="external-link" label={zh?'官网':'Website'} onPress={()=>void open(selected.action_url)}/>
     <QuickAction icon="file-text" label={zh?'来源':'Source'} onPress={()=>void open(selected.source.url)}/>
    </View>
    <Surface style={{gap:10}}>
     <View style={{flexDirection:'row',alignItems:'center',gap:8}}><PenIcon name="clock" size={16} color={c.muted}/><Text style={{fontSize:13,fontWeight:'600',color:c.muted}}>{zh?'官方公布的时间':'Published hours'}</Text></View>
     <Text selectable style={{fontSize:16,lineHeight:24,color:c.text}}>{selected.published_hours[language]}</Text>
     <Text style={{fontSize:12,color:c.muted}}>{zh?'现在是否开放、有没有位置：未知，请以现场为准。':'Open now / availability: unknown — check on site.'}</Text>
    </Surface>
    <Surface style={{gap:8}}><View style={{flexDirection:'row',alignItems:'center',gap:10}}><IconTile icon={icon} color={col}/><Text style={{fontSize:16,fontWeight:'600',color:c.text}}>{zh?'这里可以做什么':'What it’s for'}</Text></View><Text selectable style={{fontSize:15,lineHeight:23,color:c.muted}}>{selected.description[language]}</Text><Text style={{fontSize:12,color:c.tertiary}}>{zh?'最近核对':'Last checked'} {selected.source.retrieved_at.slice(0,10)}</Text></Surface>
    <TargetActions key={selected.id} target={{target_kind:'place',target_id:selected.id}} language={language} dark={false} onLogin={onLogin} onChanged={()=>void load()}/>
   </>}
  </View>;
 }
 return <View style={{gap:18}}>
  <PageHeader onBack={()=>navigate(onBack)} backLabel={zh?'校园':'Campus'} title={zh?'校园生活':'Campus life'} subtitle={zh?'找到地方，也找到它的使用方法。':'Find the place and how to use it.'}/>
  <View style={{flexDirection:'row',alignItems:'center',gap:8,height:44,paddingHorizontal:12,borderRadius:12,backgroundColor:c.fill}}><PenIcon name="search" size={17} color={c.muted}/><TextInput accessibilityLabel={zh?'搜索地点或服务':'Search places'} value={q} onChangeText={setQ} placeholder={zh?'名称、楼层或服务':'Name, floor or service'} placeholderTextColor={c.muted} clearButtonMode="while-editing" style={{flex:1,fontSize:16,color:c.text}}/></View>
  <PillRow>
   {(['','study','shop','service'] as const).map(v=><FilterPill key={v} label={({'':zh?'全部':'All',study:zh?'学习':'Study',shop:zh?'吃喝购物':'Food & shops',service:zh?'服务':'Services'})[v]} selected={category===v} onPress={()=>setCategory(v)}/>)}
   <FilterPill label={zh?'收藏':'Saved'} icon="bookmark" selected={onlySaved} onPress={()=>profile?setOnlySaved(!onlySaved):onLogin()}/>
  </PillRow>
  {error?<Notice tone="error" text={zh?'更新失败，保留的资料可能过时。':'Refresh failed; information may be outdated.'} action={zh?'重试':'Retry'} onAction={()=>void load()}/>:null}
  {busy&&!entries.length?<><Skeleton/><Skeleton/></>:null}
  {!busy&&entries.length>0&&!visible.length?<EmptyState icon="search-x" title={zh?'没有匹配的地点':'No matching places'} body={zh?'换个关键词，或看看全部分类。':'Try another keyword or category.'}/>:null}
  {visible.length?<Stagger index={0}><ListGroup>{visible.map(e=>{const [icon,col]=meta(e.category,c);const saved=marks.some(m=>m.target_kind==='place'&&m.target_id===e.id);return <ListRow key={e.id} icon={icon} tile={col} title={e.name[language]} subtitle={e.location[language]} accessory={saved?<PenIcon name="bookmark" size={15} color={c.orange}/>:undefined} chevron onPress={()=>setSelectedId(e.id)}/>;})}</ListGroup></Stagger>:null}
  <Text style={{paddingHorizontal:16,fontSize:12,color:c.muted}}>{zh?`已核验 ${entries.length} 个地点；营业状态以现场为准。`:`${entries.length} reviewed places; opening status may vary.`}</Text>
 </View>;
}
function QuickAction({icon,label,onPress,primary}:{icon:string;label:string;onPress:()=>void;primary?:boolean}){
 const c=usePenColors();
 return <Surface onPress={onPress} padding={12} label={label} style={{flex:1,alignItems:'center',gap:6,backgroundColor:primary?c.accent:c.surface}}><PenIcon name={icon} size={20} color={primary?'#FFFFFF':c.accent}/><Text style={{fontSize:13,fontWeight:'600',color:primary?'#FFFFFF':c.text}}>{label}</Text></Surface>;
}

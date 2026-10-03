import {useSceneFocus} from '../navigation/TabScene';
import {useSceneNavigation} from '../navigation/InputProtection';
import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {Linking,Text,View} from 'react-native';
import { Button } from '../ui/Primitives';
import { Input } from '../ui/Primitives';
import { Card } from '../ui/Primitives';
import {api,session} from '../runtime';
import {palette,styles} from '../theme';
import type {Language} from '../strings';
import type {directoryData} from '../../../../src/product/campus/directory-data';
import {TargetActions,type CampusTarget} from './TargetActions';
type Entry=typeof directoryData[number]&{version:number;freshness:string};
export function DirectoryScreen({language,dark,onBack,onLogin}:{language:Language;dark:boolean;onBack:()=>void;onLogin:()=>void}) {
 const sceneActive=useSceneFocus();
 const profile=useSyncExternalStore(session.subscribe,session.snapshot).profile;
 const zh=language==='zh',c=palette[dark?'dark':'light'];
 const navigate=useSceneNavigation(zh);
 const [entries,setEntries]=useState<Entry[]>([]),[selected,setSelected]=useState<Entry|null>(null),[q,setQ]=useState(''),[category,setCategory]=useState(''),[onlySaved,setOnlySaved]=useState(false),[marks,setMarks]=useState<CampusTarget[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(false);const alive=useRef(true),epoch=useRef(0);
 async function load(){const generation=++epoch.current;setBusy(true);setError(false);try{const [next,saved]=await Promise.all([api.request<Entry[]>('/campus/places'),profile?session.request<CampusTarget[]>('/me/campus/bookmarks'):Promise.resolve([])]);if(alive.current&&generation===epoch.current){setEntries(next);setMarks(saved);setSelected(old=>old?next.find(e=>e.id===old.id)??{...old,freshness:'stale'}:null);}}catch{if(alive.current&&generation===epoch.current)setError(true);}finally{if(alive.current&&generation===epoch.current)setBusy(false);}}
 useEffect(()=>{if(!sceneActive)return;alive.current=true;void load();return()=>{alive.current=false;epoch.current++;};},[profile?.id,sceneActive]);
 const visible=entries.filter(e=>(!category||e.category===category)&&(!onlySaved||marks.some(m=>m.target_kind==='place'&&m.target_id===e.id))&&`${e.name.zh} ${e.name.en} ${e.location.zh} ${e.location.en} ${e.description.zh} ${e.description.en}`.toLowerCase().includes(q.trim().toLowerCase()));
 const open=async(url:string)=>{try{await Linking.openURL(url);}catch{setError(true);}};
 return <View style={styles.stack}>
  <Button variant="ghost" onPress={()=>navigate(()=>selected?setSelected(null):onBack())}>{selected?(zh?'返回地点目录':'Back to directory'):(zh?'返回交通':'Back to transport')}</Button>
  <Text style={[styles.title,{color:c.text}]}>{zh?'校园地点与服务':'Campus places and services'}</Text>
  <Button variant="secondary" isDisabled={busy} onPress={load}>{busy?(zh?'加载中…':'Loading…'):(zh?'刷新':'Refresh')}</Button>
  {error?<Text accessibilityRole="alert" style={[styles.body,{color:c.danger}]}>{zh?'更新失败，保留的资料可能过时，请联网重试。':'Refresh failed. Retained information may be outdated; reconnect and retry.'}</Text>:null}
  {!selected?<>
   <Input accessibilityLabel={zh?'搜索地点或服务':'Search places or services'} value={q} onChangeText={setQ} placeholder={zh?'名称、楼层或服务':'Name, floor or service'} style={[styles.input,{color:c.text,borderColor:c.border}]}/>
   {(['','study','shop','service'] as const).map(v=><Button key={v} variant={category===v?'primary':'secondary'} onPress={()=>setCategory(v)}>{({'':zh?'全部':'All',study:zh?'学习':'Study',shop:zh?'商店':'Shops',service:zh?'服务':'Services'})[v]}</Button>)}
   <Button variant={onlySaved?'primary':'secondary'} onPress={()=>profile?setOnlySaved(!onlySaved):onLogin()}>{onlySaved?(zh?'✓ 只看收藏':'✓ Saved only'):(zh?'只看收藏':'Saved only')}</Button>
   {!busy&&!visible.length?<Text style={[styles.body,{color:c.muted}]}>{zh?'没有匹配的已核验条目。':'No matching reviewed entries.'}</Text>:null}
   {visible.map(e=><Card key={e.id} style={[styles.card,{backgroundColor:c.surface}]}><Text style={[styles.heading,{color:c.text}]}>{e.name[language]}</Text><Text style={[styles.body,{color:c.muted}]}>{e.location[language]}</Text><Button variant="secondary" onPress={()=>setSelected(e)}>{zh?'查看详情':'View details'}</Button></Card>)}
  </>:<>
    <Text style={[styles.heading,{color:c.text}]}>{selected.name[language]}</Text>
    {selected.freshness==='stale'?<Text style={[styles.body,{color:c.danger}]}>{zh?'资料待重新核对。':'Information needs review.'}</Text>:null}
    <Text style={[styles.body,{color:c.text}]}>{selected.location[language]}\n{selected.description[language]}</Text>
    <Text style={[styles.caption,{color:c.muted}]}>{zh?'官方公布的时间':'Published hours'}</Text><Text style={[styles.body,{color:c.text}]}>{selected.published_hours[language]}</Text>
    <Text style={[styles.caption,{color:c.muted}]}>{zh?'当前开放／空位状态：未知，请核对来源。':'Current opening / availability: unknown. Check the source.'}</Text>
    <Text style={[styles.caption,{color:c.muted}]}>{zh?'最近核对':'Last checked'}: {selected.source.retrieved_at}</Text>
    <Button variant="secondary" onPress={()=>open(selected.action_url)}>{zh?'官方服务／办理入口':'Official service / booking'}</Button>
    <Button variant="ghost" onPress={()=>open(selected.source.url)}>{zh?'查看信息来源':'View source'}</Button>
    {selected.map_url?<Button variant="secondary" onPress={()=>open(selected.map_url!)}>{zh?'官方校园地图':'Official campus map'}</Button>:null}
    <TargetActions key={selected.id} target={{target_kind:'place',target_id:selected.id}} language={language} dark={dark} onLogin={onLogin} onChanged={()=>void load()}/>
  </>}
 </View>;
}

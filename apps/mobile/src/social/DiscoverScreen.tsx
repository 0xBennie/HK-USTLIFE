import {useCallback,useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {AppState,Text,View} from 'react-native';
import {Button} from 'heroui-native/button';
import {Card} from 'heroui-native/card';
import {Input} from 'heroui-native/input';
import {session} from '../runtime';
import {ApiFailure} from '../api';
import {palette,styles} from '../theme';
import type {Language} from '../strings';
import type {Activity} from '../../../../src/product/social/types';
import {dateTimeInZone,parseHongKongInput} from '../study/dates';
import {socialError,participationLabel} from './shared';
import {ActivityForm} from './ActivityForm';
import {ActivityDetail} from './ActivityDetail';
type Filters={q:string;kind:string;interaction:string;language:string;mine:string;from:string;to:string};
export function DiscoverScreen({language,dark,onLogin,initialId,onDismissTarget,onNavigate}:{language:Language;dark:boolean;onLogin:()=>void;initialId:string|null;onDismissTarget:()=>void;onNavigate:()=>void}){
 const zh=language==='zh',c=palette[dark?'dark':'light'],profile=useSyncExternalStore(session.subscribe,session.snapshot).profile;
 const [selected,setSelected]=useState<string|null>(initialId),[creating,setCreating]=useState(false),[filtersOpen,setFiltersOpen]=useState(false);
 const [filters,setFilters]=useState<Filters>({q:'',kind:'',interaction:'',language:'',mine:'',from:'',to:''}),[applied,setApplied]=useState(filters);
 const [items,setItems]=useState<Activity[]>([]),[cursor,setCursor]=useState<string|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');const epoch=useRef(0),lock=useRef(false);
 useEffect(()=>{if(initialId)setSelected(initialId);},[initialId]);
 useEffect(onNavigate,[selected,creating,onNavigate]);
 const load=useCallback(async(next?:string)=>{if(lock.current&&next)return;lock.current=true;const generation=++epoch.current;setBusy(true);setError('');try{
  const query=new URLSearchParams({limit:'20'});for(const [key,value]of Object.entries(applied))if(value)query.set(key,key==='from'||key==='to'?parseHongKongInput(value)!:value);if(next)query.set('cursor',next);
  const page=await session.request<{items:Activity[];next_cursor:string|null}>('/activities?'+query.toString());
  if(generation===epoch.current){setItems(old=>next?[...old,...page.items.filter(x=>!old.some(y=>y.id===x.id))]:page.items);setCursor(page.next_cursor);}
 }catch(e){if(generation===epoch.current){setItems([]);setCursor(null);setError(e instanceof Error&&!(e instanceof ApiFailure)?(zh?'时间格式应为 YYYY-MM-DD HH:mm。':'Use YYYY-MM-DD HH:mm for the time window.'):socialError(e,language));}}finally{if(generation===epoch.current){lock.current=false;setBusy(false);}}},[applied,language]);
 useEffect(()=>{if(selected||creating)return;void load();const listener=AppState.addEventListener('change',state=>{if(state==='active')void load();});return()=>{epoch.current++;lock.current=false;listener.remove();};},[load,selected,creating]);
 if(creating)return <ActivityForm language={language} dark={dark} onBack={()=>setCreating(false)} onSaved={id=>{setCreating(false);setSelected(id);}}/>;
 if(selected)return <ActivityDetail key={selected} id={selected} language={language} dark={dark} onLogin={onLogin} onNavigate={onNavigate} onBack={()=>{setSelected(null);onDismissTarget();}}/>;
 const choose=(key:keyof Filters,value:string)=>setFilters({...filters,[key]:value});
 const options=(key:keyof Filters,values:[string,string][])=> <View style={styles.smallStack}>{values.map(([value,label])=><Button key={value} variant={filters[key]===value?'primary':'secondary'} isDisabled={busy} onPress={()=>choose(key,value)}>{label}</Button>)}</View>;
 return <View style={styles.stack}>
  <Text style={[styles.title,{color:c.text}]}>{zh?'一起做点什么':'Find something to do together'}</Text>
  <Text style={[styles.body,{color:c.muted}]}>{zh?'先看具体时间和相处方式。想参加就报名，不需要先和陌生人聊天。':'Choose a time and interaction style that suit you. Join without needing to message a stranger first.'}</Text>
  <Text style={[styles.caption,{color:c.muted}]}>{zh?'以下均为本地开发演示内容。':'All content here is local development demo content.'}</Text>
  <Button onPress={()=>profile?setCreating(true):onLogin()}>{zh?'发起活动／学习组队':'Start an activity / study group'}</Button>
  <Input accessibilityLabel={zh?'搜索标题或地点':'Search title or place'} value={filters.q} onChangeText={v=>choose('q',v)} placeholder={zh?'标题／地点':'Title / place'} style={[styles.input,{color:c.text,borderColor:c.border}]}/>
  <Button variant="secondary" onPress={()=>setFiltersOpen(!filtersOpen)}>{filtersOpen?(zh?'收起筛选':'Hide filters'):(zh?'类型、语言、时间与我的记录':'Type, language, time and my records')}</Button>
  {filtersOpen?<>
  {options('kind',[['',zh?'全部类型':'All types'],['activity',zh?'活动':'Activities'],['study',zh?'学习组队':'Study groups']])}
  {options('interaction',[['',zh?'所有相处方式':'All interaction styles'],['quiet',zh?'安静共处':'Quiet company'],['casual',zh?'随意交流':'Casual conversation'],['active',zh?'讨论／协作':'Active collaboration']])}
  {options('language',[['',zh?'所有语言':'All languages'],['zh',zh?'普通话':'Mandarin'],['en','English'],['yue',zh?'粤语':'Cantonese']])}
  {profile?options('mine',[['',zh?'发现活动':'Discover activities'],['organized',zh?'我组织的':'My organized activities'],['participating',zh?'我的参与记录':'My participation history'],['saved',zh?'我的收藏／日程':'My bookmarks / calendar']]):null}
  <Text style={[styles.caption,{color:c.muted}]}>{zh?'可选：你愿意参加的香港时间窗口（YYYY-MM-DD HH:mm）。不会分享你的课表。':'Optional Hong Kong time window (YYYY-MM-DD HH:mm). Your timetable is not shared.'}</Text>
  <Input accessibilityLabel={zh?'时间窗开始':'Window start'} value={filters.from} onChangeText={v=>choose('from',v)} placeholder="2026-10-05 10:00" style={[styles.input,{color:c.text,borderColor:c.border}]}/>
  <Input accessibilityLabel={zh?'时间窗结束':'Window end'} value={filters.to} onChangeText={v=>choose('to',v)} placeholder="2026-10-05 18:00" style={[styles.input,{color:c.text,borderColor:c.border}]}/>
  </>:null}
  <Button isDisabled={busy} onPress={()=>{setFiltersOpen(false);if(JSON.stringify(filters)===JSON.stringify(applied))void load();else setApplied({...filters});}}>{busy?(zh?'查询中…':'Loading…'):(zh?'按条件查找／刷新':'Apply filters / refresh')}</Button>
  {error?<Text accessibilityRole="alert" style={[styles.body,{color:c.danger}]}>{error}</Text>:null}
  {!busy&&!error&&!items.length?<Text style={[styles.body,{color:c.muted}]}>{zh?'暂时没有符合条件的活动。你可以放宽条件，或发起自己的小组。':'No matching activities yet. Adjust your filters or start a small group.'}</Text>:null}
  {items.map(a=><Card key={a.id} style={[styles.card,{backgroundColor:c.surface}]}>
   <Text style={[styles.heading,{color:c.text}]}>{a.title}</Text><Text style={[styles.body,{color:c.text}]}>{dateTimeInZone(a.starts_at,'Asia/Hong_Kong')} HKT · {a.location}</Text>
   <Text style={[styles.caption,{color:c.muted}]}>{a.kind==='study'?(zh?'学习组队':'Study group'):(zh?'活动':'Activity')} · {a.counts.confirmed}/{a.capacity} {zh?'已确认':'confirmed'} · {a.counts.waitlisted} {zh?'候补':'waitlisted'}</Text>
   {a.mine?.participation?<Text style={[styles.body,{color:c.text}]}>{participationLabel(a.mine.participation.status,zh)}</Text>:null}
   <Button variant="secondary" onPress={()=>setSelected(a.id)}>{zh?'查看条件与详情':'View requirements and details'}</Button>
  </Card>)}
  {cursor?<Button variant="secondary" isDisabled={busy} onPress={()=>void load(cursor)}>{zh?'加载更多':'Load more'}</Button>:null}
 </View>;
}

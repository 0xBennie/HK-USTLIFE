import {useCallback,useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {AppState,Text,View} from 'react-native';
import {Button} from 'heroui-native/button';
import {Card} from 'heroui-native/card';
import {Input} from 'heroui-native/input';
import {session} from '../runtime';
import {palette,styles} from '../theme';
import type {Language} from '../strings';
import type {WallPost} from '../../../../src/product/social/wall-types';
import {dateTimeInZone} from '../study/dates';
import {wallError,postStatus} from './wall-shared';
import {WallForm} from './WallForm';
import {WallDetail} from './WallDetail';
export function WallScreen({language,dark,onLogin,initialId,onDismissTarget,onNavigate,onDepthChange}:{language:Language;dark:boolean;onLogin:()=>void;initialId:string|null;onDismissTarget:()=>void;onNavigate:()=>void;onDepthChange?:(nested:boolean)=>void}){
 const zh=language==='zh',c=palette[dark?'dark':'light'],profile=useSyncExternalStore(session.subscribe,session.snapshot).profile;
 const [selected,setSelected]=useState(initialId),[creating,setCreating]=useState(false),[q,setQ]=useState(''),[filters,setFilters]=useState({q:'',kind:'',mine:false});
 const [items,setItems]=useState<WallPost[]>([]),[cursor,setCursor]=useState<string|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');const epoch=useRef(0),lock=useRef(false);
 useEffect(()=>{if(initialId){setCreating(false);setSelected(initialId);}},[initialId]);
 useEffect(onNavigate,[selected,creating,onNavigate]);
 useEffect(()=>{onDepthChange?.(selected!==null||creating);},[selected,creating,onDepthChange]);
 const load=useCallback(async(next?:string)=>{if(next&&lock.current)return;lock.current=true;const generation=++epoch.current;setBusy(true);setError('');try{
  const query=new URLSearchParams();if(filters.q)query.set('q',filters.q);if(filters.kind)query.set('kind',filters.kind);if(filters.mine)query.set('mine','true');if(next)query.set('cursor',next);
  const page=await session.request<{items:WallPost[];next_cursor:string|null}>('/posts?'+query.toString());
  if(generation===epoch.current){setItems(old=>next?[...old,...page.items.filter(x=>!old.some(y=>y.id===x.id))]:page.items);setCursor(page.next_cursor);}
 }catch(e){if(generation===epoch.current){setItems([]);setCursor(null);setError(wallError(e,language));}}finally{if(generation===epoch.current){lock.current=false;setBusy(false);}}},[filters,language]);
 useEffect(()=>{if(selected||creating)return;void load();const listener=AppState.addEventListener('change',s=>{if(s==='active')void load();});return()=>{epoch.current++;lock.current=false;listener.remove();};},[load,selected,creating]);
 if(creating)return <WallForm language={language} dark={dark} onBack={()=>setCreating(false)} onSaved={id=>{setCreating(false);setSelected(id);}}/>;
 if(selected)return <WallDetail key={selected} id={selected} language={language} dark={dark} onLogin={onLogin} onNavigate={onNavigate} onBack={()=>{setSelected(null);onDismissTarget();}}/>;
 return <View style={styles.stack}>
  <Text style={[styles.title,{color:c.text}]}>{zh?'校园墙':'Campus wall'}</Text>
  <Text style={[styles.body,{color:c.muted}]}>{zh?'问个小问题，分享一段校园生活。可以只看看，想回复时再加入。':'Ask a small question or share campus life. Browse at your own pace; join a conversation when you want.'}</Text>
  <Text style={[styles.caption,{color:c.muted}]}>{zh?'以下均为本地开发演示内容。':'All content here is local development demo content.'}</Text>
  <Button onPress={()=>profile?setCreating(true):onLogin()}>{zh?'发帖／求助':'Post / ask for help'}</Button>
  <Input accessibilityLabel={zh?'搜索校园墙':'Search campus wall'} value={q} onChangeText={setQ} maxLength={120} style={[styles.input,{color:c.text,borderColor:c.border}]} placeholder={zh?'搜索问题或关键词':'Search questions or keywords'}/>
  <Button variant="secondary" isDisabled={busy} onPress={()=>q===filters.q?void load():setFilters({...filters,q})}>{busy?(zh?'更新中…':'Updating…'):(zh?'搜索／刷新':'Search / refresh')}</Button>
  {(['','help','wall'] as const).map(k=><Button key={k} variant={filters.kind===k?'primary':'secondary'} isDisabled={busy} onPress={()=>setFilters({...filters,kind:k})}>{k==='help'?(zh?'求助与问答':'Help and questions'):k==='wall'?(zh?'分享与讨论':'Sharing and discussion'):(zh?'全部帖子':'All posts')}</Button>)}
  {profile?<Button variant={filters.mine?'primary':'secondary'} isDisabled={busy} onPress={()=>setFilters({...filters,mine:!filters.mine})}>{filters.mine?(zh?'✓ 只看我发布的':'✓ My posts only'):(zh?'查看我发布的':'Show my posts')}</Button>:null}
  {error?<Text accessibilityRole="alert" style={[styles.body,{color:c.danger}]}>{error}</Text>:null}
  {!busy&&!error&&!items.length?<Text style={[styles.body,{color:c.muted}]}>{zh?'还没有符合条件的帖子。可以换个关键词，或留下你的问题。':'No matching posts. Try another keyword or leave a question.'}</Text>:null}
  {items.map(p=><Card key={p.id} style={[styles.card,{backgroundColor:c.surface}]}>
   <Text style={[styles.caption,{color:c.muted}]}>{p.kind==='help'?(zh?'求助':'Help'):(zh?'分享':'Discussion')} · {postStatus(p.status,zh)} · {p.visibility==='public'?(zh?'公开':'Public'):(zh?'登录可见':'Signed-in users')}</Text>
   <Text style={[styles.heading,{color:c.text}]}>{p.title}</Text><Text numberOfLines={3} style={[styles.body,{color:c.text}]}>{p.body}</Text>
   <Text style={[styles.caption,{color:c.muted}]}>{p.author.display_name} · {dateTimeInZone(p.updated_at,'Asia/Hong_Kong')} HKT</Text>
   <Button variant="secondary" onPress={()=>setSelected(p.id)}>{zh?'查看帖子与回复':'View post and replies'}</Button>
  </Card>)}
  {cursor?<Button variant="secondary" isDisabled={busy} onPress={()=>void load(cursor)}>{zh?'加载更多':'Load more'}</Button>:null}
 </View>;
}

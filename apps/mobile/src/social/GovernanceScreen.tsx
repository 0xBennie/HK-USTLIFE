import {useSceneFocus} from '../navigation/TabScene';
import {useCallback,useEffect,useRef,useState} from 'react';
import {Alert,AppState,Text,View} from 'react-native';
import { Button } from '../ui/Primitives';
import { Card } from '../ui/Primitives';
import {session} from '../runtime';
import {palette,styles} from '../theme';
import type {Language} from '../strings';
import type {BlockedUser,ContentReport} from '../../../../src/product/social/governance-types';
import {reportReasonLabel} from './SafetyActions';
import {wallError} from './wall-shared';
import {dateTimeInZone} from '../study/dates';
export function GovernanceScreen({language,dark,onBack}:{language:Language;dark:boolean;onBack:()=>void}){
 const sceneActive=useSceneFocus();
 const zh=language==='zh',c=palette[dark?'dark':'light'];
 const [blocks,setBlocks]=useState<BlockedUser[]>([]),[reports,setReports]=useState<ContentReport[]>([]),[cursor,setCursor]=useState<string|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const epoch=useRef(0),lock=useRef(false),alive=useRef(true);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;epoch.current++;};},[]);
 const load=useCallback(async(next?:string)=>{const generation=++epoch.current;setBusy(true);setError('');try{
  const [users,page]=await Promise.all([session.request<BlockedUser[]>('/me/blocks'),session.request<{items:ContentReport[];next_cursor:string|null}>('/me/reports'+(next?'?cursor='+next:''))]);
  if(alive.current&&generation===epoch.current){setBlocks(users);setReports(old=>next?[...old,...page.items.filter(x=>!old.some(y=>y.id===x.id))]:page.items);setCursor(page.next_cursor);}
 }catch(e){if(alive.current&&generation===epoch.current){setBlocks([]);setReports([]);setCursor(null);setError(wallError(e,language));}}finally{if(alive.current&&generation===epoch.current)setBusy(false);}},[language]);
 useEffect(()=>{if(!sceneActive)return;void load();const listener=AppState.addEventListener('change',s=>{if(s==='active'&&!lock.current)void load();});return()=>{epoch.current++;listener.remove();};},[load,sceneActive]);
 async function unblock(id:string){if(lock.current)return;lock.current=true;epoch.current++;setBusy(true);setError('');try{await session.request(`/me/blocks/${id}`,{method:'DELETE',body:{}});if(alive.current)await load();}catch(e){if(alive.current)setError(wallError(e,language));}finally{lock.current=false;if(alive.current)setBusy(false);}}
 return <View style={styles.stack}>
  <Button variant="ghost" isDisabled={busy} onPress={onBack}>{zh?'返回我的':'Back to my account'}</Button>
  <Text style={[styles.title,{color:c.text}]}>{zh?'举报与屏蔽管理':'Reports and blocked users'}</Text>
  <Button variant="secondary" isDisabled={busy} onPress={()=>void load()}>{busy?(zh?'更新中…':'Updating…'):(zh?'刷新':'Refresh')}</Button>
  {error?<Text accessibilityRole="alert" style={[styles.body,{color:c.danger}]}>{error}</Text>:null}
  <Text style={[styles.heading,{color:c.text}]}>{zh?'我屏蔽的用户':'Users I blocked'}</Text>
  {!busy&&!error&&!blocks.length?<Text style={[styles.body,{color:c.muted}]}>{zh?'目前没有屏蔽任何用户。':'You have not blocked anyone.'}</Text>:null}
  {blocks.map(u=><Card key={u.id} style={[styles.card,{backgroundColor:c.surface}]}><Text style={[styles.body,{color:c.text}]}>{u.display_name}</Text><Button variant="secondary" isDisabled={busy} onPress={()=>Alert.alert(zh?'解除屏蔽？':'Unblock?',zh?'不会恢复之前退出的报名、收藏或日程。如果对方仍屏蔽你，内容依旧不可见。':'Previous signups, bookmarks and calendars are not restored. If they still block you, their content remains hidden.',[{text:zh?'返回':'Go back',style:'cancel'},{text:zh?'解除屏蔽':'Unblock',onPress:()=>void unblock(u.id)}])}>{zh?'解除屏蔽':'Unblock'}</Button></Card>)}
  <Text style={[styles.heading,{color:c.text}]}>{zh?'我的举报':'My reports'}</Text>
  {!busy&&!error&&!reports.length?<Text style={[styles.body,{color:c.muted}]}>{zh?'目前没有举报记录。':'No reports yet.'}</Text>:null}
  {reports.map(r=><Card key={r.id} style={[styles.card,{backgroundColor:c.surface}]}>
   <Text style={[styles.heading,{color:c.text}]}>{r.status==='pending'?(zh?'待处理':'Pending'):r.status==='dismissed'?(zh?'已审阅，未采取措施':'Reviewed, no action'):(zh?'已采取措施':'Action taken')}</Text>
   <Text style={[styles.body,{color:c.text}]}>{reportReasonLabel(r.reason,zh)}</Text><Text style={[styles.caption,{color:c.muted}]}>{dateTimeInZone(r.created_at,'Asia/Hong_Kong')} HKT · {r.id}</Text>
   {r.details?<Text selectable style={[styles.body,{color:c.text}]}>{r.details}</Text>:null}
   {r.resolution?<Text selectable style={[styles.body,{color:c.text}]}>{zh?'处理说明':'Review note'}: {r.resolution}</Text>:null}
  </Card>)}
  {cursor?<Button variant="secondary" isDisabled={busy} onPress={()=>void load(cursor)}>{zh?'加载较早举报':'Load earlier reports'}</Button>:null}
 </View>;
}

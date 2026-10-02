import {useCallback,useEffect,useRef,useState} from 'react';
import {AppState,Text,View} from 'react-native';
import {Button} from 'heroui-native/button';
import {Card} from 'heroui-native/card';
import {session} from '../runtime';
import {palette,styles} from '../theme';
import type {Language} from '../strings';
import type {ActivityNotification} from '../../../../src/product/social/types';
import {socialError} from './shared';
import {dateTimeInZone} from '../study/dates';
export function InboxScreen({language,dark,onActivity}:{language:Language;dark:boolean;onActivity:(id:string)=>void}){
 const zh=language==='zh',c=palette[dark?'dark':'light'],[items,setItems]=useState<ActivityNotification[]>([]),[cursor,setCursor]=useState<number|null>(null),[unread,setUnread]=useState(0),[busy,setBusy]=useState(false),[error,setError]=useState('');const epoch=useRef(0);
 const labels:Record<ActivityNotification['kind'],string>={joined:zh?'报名状态已更新':'Signup updated',waitlisted:zh?'你已加入候补':'You joined the waitlist',promoted:zh?'候补已递补，报名确认':'Your waitlist place is now confirmed',withdrawn:zh?'退出状态已更新':'Withdrawal updated',activity_updated:zh?'活动有变更，请核对时间与条件':'Activity changed; review time and requirements',activity_cancelled:zh?'活动已取消，保存的日程已移除':'Activity cancelled; saved schedule removed',activity_removed:zh?'活动内容已删除':'Activity content removed',comment:zh?'活动讨论有新评论':'New activity comment'};
 const load=useCallback(async(before?:number)=>{const generation=++epoch.current;setBusy(true);setError('');try{const page=await session.request<{items:ActivityNotification[];next_cursor:number|null;unread:number}>('/me/notifications'+(before?`?cursor=${before}`:''));if(generation===epoch.current){setItems(old=>before?[...old,...page.items.filter(x=>!old.some(y=>y.id===x.id))]:page.items);setCursor(page.next_cursor);setUnread(page.unread);}}catch(e){if(generation===epoch.current){setItems([]);setError(socialError(e,language));}}finally{if(generation===epoch.current)setBusy(false);}},[language]);
 useEffect(()=>{void load();const listener=AppState.addEventListener('change',state=>{if(state==='active')void load();});return()=>{epoch.current++;listener.remove();};},[load]);
 async function read(id:number){setBusy(true);try{await session.request(`/me/notifications/${id}/read`,{method:'PATCH',body:{}});await load();}catch(e){setError(socialError(e,language));}finally{setBusy(false);}}
 return <View style={styles.stack}><Text style={[styles.title,{color:c.text}]}>{zh?'消息':'Messages'} · {unread} {zh?'未读':'unread'}</Text><Text style={[styles.caption,{color:c.muted}]}>{zh?'站内消息。系统推送尚未接入。':'In-app messages. Remote push is not connected.'}</Text><Button variant="secondary" isDisabled={busy} onPress={()=>void load()}>{busy?(zh?'更新中…':'Updating…'):(zh?'刷新消息':'Refresh messages')}</Button>
  {error?<Text accessibilityRole="alert" style={[styles.body,{color:c.danger}]}>{error}</Text>:null}
  {!busy&&!error&&!items.length?<Text style={[styles.body,{color:c.muted}]}>{zh?'目前没有消息。':'No messages yet.'}</Text>:null}
  {items.map(m=><Card key={m.id} style={[styles.card,{backgroundColor:c.surface}]}><Text style={[styles.caption,{color:c.muted}]}>{m.read_at?(zh?'已读':'Read'):(zh?'未读':'Unread')} · {dateTimeInZone(m.created_at,'Asia/Hong_Kong')} HKT</Text><Text style={[styles.heading,{color:c.text}]}>{labels[m.kind]}</Text>{m.activity?<><Text style={[styles.body,{color:c.text}]}>{m.activity.title}</Text><Button variant="secondary" onPress={()=>onActivity(m.activity!.id)}>{zh?'查看最新活动状态':'View latest activity state'}</Button></>:<Text style={[styles.body,{color:c.muted}]}>{zh?'内容已删除或当前不可查看。':'Content was removed or is no longer visible.'}</Text>}{!m.read_at?<Button variant="ghost" isDisabled={busy} onPress={()=>void read(m.id)}>{zh?'标为已读':'Mark as read'}</Button>:null}</Card>)}
  {cursor?<Button variant="secondary" isDisabled={busy} onPress={()=>void load(cursor)}>{zh?'加载较早消息':'Load earlier messages'}</Button>:null}
 </View>;
}

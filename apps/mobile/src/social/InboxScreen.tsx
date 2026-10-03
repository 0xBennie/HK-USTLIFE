import {useSceneFocus} from '../navigation/TabScene';
import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {ReconnectionScreen} from './ReconnectionScreen';
import {InboxController} from './inbox-controller';
import {AppState,Text,View} from 'react-native';
import { Button } from '../ui/Primitives';
import { Card } from '../ui/Primitives';
import {session} from '../runtime';
import {palette,styles} from '../theme';
import type {Language} from '../strings';
import type {ActivityNotification} from '../../../../src/product/social/types';
import {socialError} from './shared';
import {ApiFailure} from '../api';
import {dateTimeInZone} from '../study/dates';
export function InboxScreen({language,dark,onActivity,onPost}:{language:Language;dark:boolean;onActivity:(id:string)=>void;onPost:(id:string)=>void}){
 const sceneActive=useSceneFocus();
 const [reconnection,setReconnection]=useState<ActivityNotification['reconnection']>(undefined);
 const zh=language==='zh',c=palette[dark?'dark':'light'];
 const controller=useRef(new InboxController((path,options)=>session.request(path,options))).current;
 const state=useSyncExternalStore(controller.subscribe,controller.snapshot);
 const {items,cursor,unread,phase,error,stale,loaded,pendingRead,notice}=state,busy=phase!=='idle';
 useEffect(()=>()=>controller.invalidate(),[controller]);
 useEffect(()=>{if(!sceneActive)return;void controller.refresh();const listener=AppState.addEventListener('change',value=>{if(value==='active')void controller.refresh();});return()=>listener.remove();},[sceneActive,controller]);
 const labels:Record<ActivityNotification['kind'],string>={reconnection_mutual:zh?'再次同行有更新，请核对当前选择':'Meet-again update; check your current choice',joined:zh?'报名状态已更新':'Signup updated',waitlisted:zh?'你已加入候补':'You joined the waitlist',promoted:zh?'候补已递补，报名确认':'Your waitlist place is now confirmed',withdrawn:zh?'退出状态已更新':'Withdrawal updated',activity_updated:zh?'活动有变更，请核对时间与条件':'Activity changed; review time and requirements',activity_cancelled:zh?'活动已取消，保存的日程已移除':'Activity cancelled; saved schedule removed',activity_removed:zh?'活动内容已删除':'Activity content removed',comment:zh?'活动讨论有新评论':'New activity comment',post_reply:zh?'你的帖子有新回复':'New reply to your post',post_resolved:zh?'你回复的问题已解决':'A question you replied to is resolved'};
 if(reconnection)return <ReconnectionScreen activityId={reconnection.activity_id} peer={{id:reconnection.target_id,display_name:reconnection.display_name}} language={language} dark={dark} backLabel={zh?'返回消息':'Back to messages'} onBack={()=>{setReconnection(undefined);void controller.refresh();}}/>;
 return <View style={styles.stack}><Text style={[styles.title,{color:c.text}]}>{zh?'消息':'Messages'}</Text><Text style={[styles.body,{color:c.muted}]}>{loaded?`${unread} ${zh?'条未读消息':'unread updates'}`:busy?(zh?'正在读取消息':'Loading messages'):(zh?'尚未读取消息':'Messages not loaded')}</Text><Text style={[styles.caption,{color:c.muted}]}>{zh?'站内消息。系统推送尚未接入。':'In-app messages. Remote push is not connected.'}</Text><Button variant="secondary" isDisabled={busy} onPress={()=>void controller.refresh()}>{busy?(zh?'更新中…':'Updating…'):(zh?'刷新消息':'Refresh messages')}</Button>
  {error?<Text accessibilityRole="alert" style={[styles.body,{color:c.danger}]}>{error instanceof ApiFailure&&[401,403,404,410,429].includes(error.status)?socialError(error,language):pendingRead!==null?(zh?'标为已读的结果尚未确认。可以重试同一条标记，或刷新查看当前状态。':'The read status is unconfirmed. Retry the same mark, or refresh to check its current state.'):(zh?'消息暂时无法更新。已加载内容仍然保留，请重试。':'Messages could not update. Loaded messages are retained. Please retry.')}</Text>:null}
  {stale?<Text style={[styles.caption,{color:c.muted}]}>{zh?'下方为上次读取的消息，未读数与内容可能已变化。刷新成功后再打开相关内容。':'These are previously loaded messages. Counts and content may have changed. Refresh successfully before opening linked content.'}</Text>:null}
  {pendingRead!==null&&!busy?<Button variant="secondary" onPress={()=>void controller.markRead(pendingRead)}>{zh?'重试标为已读':'Retry marking as read'}</Button>:null}
  {notice?<Text accessibilityLiveRegion="polite" style={[styles.caption,{color:c.accent}]}>{notice==='read'?(zh?'已标为已读，当前消息列表保留。':'Marked as read. Your loaded messages are retained.'):(zh?'已读取最新消息，请核对当前已读状态。':'Latest messages loaded. Check the current read status.')}</Text>:null}
  {!busy&&!error&&!items.length?<Text style={[styles.body,{color:c.muted}]}>{zh?'目前没有消息。':'No messages yet.'}</Text>:null}
  {items.map(m=><Card key={m.id} style={[styles.card,{backgroundColor:c.surface}]}><Text style={[styles.caption,{color:c.muted}]}>{m.read_at?(zh?'已读':'Read'):(zh?'未读':'Unread')} · {dateTimeInZone(m.created_at,'Asia/Hong_Kong')} HKT</Text><Text style={[styles.heading,{color:c.text}]}>{labels[m.kind]}</Text>{m.reconnection?<><Text style={[styles.body,{color:c.text}]}>{m.reconnection.display_name}</Text><Button variant="secondary" isDisabled={stale||busy} onPress={()=>setReconnection(m.reconnection)}>{zh?'查看再次同行':'View meet-again choice'}</Button></>:m.activity?<><Text style={[styles.body,{color:c.text}]}>{m.activity.title}</Text><Button variant="secondary" isDisabled={stale} onPress={()=>onActivity(m.activity!.id)}>{zh?'查看最新活动状态':'View latest activity state'}</Button></>:m.post?<><Text style={[styles.body,{color:c.text}]}>{m.post.title}</Text><Button variant="secondary" isDisabled={stale} onPress={()=>onPost(m.post!.id)}>{zh?'查看帖子与回复':'View post and replies'}</Button></>:<Text style={[styles.body,{color:c.muted}]}>{zh?'内容已删除或当前不可查看。':'Content was removed or is no longer visible.'}</Text>}{!m.read_at?<Button variant="ghost" isDisabled={busy||pendingRead!==null} onPress={()=>void controller.markRead(m.id)}>{phase==='marking'&&pendingRead===m.id?(zh?'正在标记…':'Marking…'):(zh?'标为已读':'Mark as read')}</Button>:null}</Card>)}
  {cursor?<Button variant="secondary" isDisabled={busy||stale} onPress={()=>void controller.more()}>{phase==='loading-more'?(zh?'正在加载较早消息…':'Loading earlier messages…'):(zh?'加载较早消息':'Load earlier messages')}</Button>:null}
 </View>;
}

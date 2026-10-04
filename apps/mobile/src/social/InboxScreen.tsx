// Pen board "V3 / 消息" (dqbRa): unread hero, Today / Earlier glass groups, mark-all in the top bar.
import {useSceneFocus} from '../navigation/TabScene';
import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {ReconnectionScreen} from './ReconnectionScreen';
import {InboxController} from './inbox-controller';
import {AppState,View} from 'react-native';
import {session} from '../runtime';
import type {Language} from '../strings';
import type {ActivityNotification} from '../../../../src/product/social/types';
import {socialError} from './shared';
import {ApiFailure} from '../api';
import {dateTimeInZone} from '../study/dates';
import {CircleButton,EmptyState,Hero,ListGroup,ListRow,Notice,Section,Skeleton,Stagger,Surface,TopBar,ViewAll,usePenColors,type PenIconName} from '../ui/Pen';
const kindMeta:Record<ActivityNotification['kind'],[PenIconName,string]>={
 joined:['circle-check','#2E9E5B'],promoted:['party-popper','#2E9E5B'],waitlisted:['hourglass','#56647D'],withdrawn:['log-out','#8E8E93'],
 activity_updated:['clock-alert','#D98A1C'],activity_cancelled:['calendar-x','#E5484D'],activity_removed:['trash','#8E8E93'],
 comment:['message-circle','#8E8E93'],post_reply:['message-square-reply','#24467F'],post_resolved:['circle-check-big','#2E9E5B'],reconnection_mutual:['users','#A9824C'],
};
const hkDay=(iso:string)=>dateTimeInZone(iso,'Asia/Hong_Kong').slice(0,10);
export function InboxScreen({language,dark,name,onMe,onActivity,onPost}:{language:Language;dark:boolean;name?:string;onMe?:()=>void;onActivity:(id:string)=>void;onPost:(id:string)=>void}){
 const sceneActive=useSceneFocus();
 const [reconnection,setReconnection]=useState<ActivityNotification['reconnection']>(undefined);
 const zh=language==='zh',c=usePenColors();
 const controller=useRef(new InboxController((path,options)=>session.request(path,options))).current;
 const state=useSyncExternalStore(controller.subscribe,controller.snapshot);
 const {items,cursor,unread,phase,error,stale,loaded,pendingRead}=state,busy=phase!=='idle';
 useEffect(()=>()=>controller.invalidate(),[controller]);
 useEffect(()=>{if(!sceneActive)return;void controller.refresh();const listener=AppState.addEventListener('change',value=>{if(value==='active')void controller.refresh();});return()=>listener.remove();},[sceneActive,controller]);
 const labels:Record<ActivityNotification['kind'],string>={reconnection_mutual:zh?'再次同行有新进展':'Meet-again update',joined:zh?'报名已确认':'You’re in',waitlisted:zh?'已加入候补':'On the waitlist',promoted:zh?'候补转正，报名成功':'Off the waitlist — you’re in',withdrawn:zh?'已退出活动':'You left',activity_updated:zh?'活动时间或安排有变化':'Activity changed',activity_cancelled:zh?'活动已取消':'Activity cancelled',activity_removed:zh?'活动已被删除':'Activity removed',comment:zh?'活动讨论有新评论':'New comment',post_reply:zh?'有人回复了你的帖子':'New reply to your post',post_resolved:zh?'你回复的问题已解决':'A question you answered is solved'};

 if(reconnection)return <ReconnectionScreen activityId={reconnection.activity_id} peer={{id:reconnection.target_id,display_name:reconnection.display_name}} language={language} dark={dark} backLabel={zh?'返回消息':'Back to messages'} onBack={()=>{setReconnection(undefined);void controller.refresh();}}/>;
 const today=hkDay(new Date().toISOString());
 const when=(iso:string)=>{const d=dateTimeInZone(iso,'Asia/Hong_Kong');if(d.slice(0,10)===today)return d.slice(11,16);const days=Math.round((Date.parse(today)-Date.parse(d.slice(0,10)))/86400000);if(days===1)return zh?'昨天':'Yesterday';if(days<7)return new Date(iso).toLocaleDateString(zh?'zh-CN':'en-GB',{weekday:'short',timeZone:'Asia/Hong_Kong'});return d.slice(5,10);};
 function open(m:ActivityNotification){
  if(!m.read_at)void controller.markRead(m.id);
  if(m.reconnection)setReconnection(m.reconnection);else if(m.activity)onActivity(m.activity.id);else if(m.post)onPost(m.post.id);
 }
 // The organizer also receives joined/withdrawn notices for other people's signups.
 const row=(m:ActivityNotification)=>{const host=m.activity?.is_organizer===true;const [icon,tile]=host&&m.kind==='joined'?['user-plus','#2E9E5B'] as [PenIconName,string]:host&&m.kind==='withdrawn'?['user-minus','#8E8E93'] as [PenIconName,string]:kindMeta[m.kind];const target=m.reconnection?.display_name??m.activity?.title??m.post?.title;
  const title=host&&m.kind==='joined'?(zh?'有人报名了你的活动':'Someone joined your activity'):host&&m.kind==='withdrawn'?(zh?'有人退出了你的活动':'Someone left your activity'):labels[m.kind];
  return <ListRow key={m.id} icon={icon} tile={tile} title={title} titleColor={m.read_at?c.muted:undefined} subtitle={target??(zh?'内容已删除或不可查看':'No longer available')} value={when(m.created_at)} accessory={m.read_at?undefined:<View accessibilityLabel={zh?'未读':'Unread'} style={{width:9,height:9,borderRadius:5,backgroundColor:'#24467F'}}/>} disabled={stale||(!target&&!!m.read_at)} onPress={()=>target?open(m):void controller.markRead(m.id)}/>;};
 const fresh=items.filter(m=>hkDay(m.created_at)===today),older=items.filter(m=>hkDay(m.created_at)!==today);
 return <View style={{gap:18}}>
  <TopBar name={name} onAvatar={onMe} title={zh?'消息':'Inbox'} right={<CircleButton icon="check-check" label={zh?'全部标为已读':'Mark all read'} disabled={busy||unread===0} onPress={()=>void controller.markAll()}/>}/>
  <Hero label={zh?'未读':'Unread'} value={loaded?String(unread):'–'} unit={zh?'条':undefined} chip={unread?(zh?'报名、活动变化和回复':'Signups, changes and replies'):(zh?'都看完了':'All caught up')} chipIcon={unread?'bell':'check'} chipColor={unread?undefined:'#2E9E5B'}/>
  {error?<Notice tone="error" text={error instanceof ApiFailure&&[401,403,404,410,429].includes(error.status)?socialError(error,language):pendingRead!==null?(zh?'标为已读的结果尚未确认。':'Read status unconfirmed.'):(zh?'消息暂时无法更新，已加载内容仍保留。':'Could not update; loaded messages kept.')} action={pendingRead!==null?(zh?'重试':'Retry'):(zh?'刷新':'Refresh')} onAction={()=>pendingRead!==null?void controller.markRead(pendingRead):void controller.refresh()}/>:null}
  {stale?<Notice tone="warning" text={zh?'以下是上次读取的消息，刷新成功后再打开。':'Showing earlier messages; refresh before opening.'}/>:null}
  {!loaded&&busy?<><Skeleton height={200} radius={28}/><Skeleton height={140} radius={28}/></>:null}
  {loaded&&!items.length?<Surface><EmptyState icon="inbox" title={zh?'还没有消息':'No messages yet'} body={zh?'报名活动、在校园墙发帖后，回复和变化会出现在这里。':'Replies and activity changes show up here.'}/></Surface>:null}
  {fresh.length?<Stagger index={0}><Section title={zh?'今天':'Today'}><ListGroup>{fresh.map(row)}</ListGroup></Section></Stagger>:null}
  {older.length?<Stagger index={1}><Section title={zh?'更早':'Earlier'}><ListGroup>{older.map(row)}{cursor?<ViewAll label={phase==='loading-more'?(zh?'正在加载…':'Loading…'):(zh?'加载更早消息':'Load earlier')} onPress={()=>void controller.more()}/>:null}</ListGroup></Section></Stagger>:null}
 </View>;
}

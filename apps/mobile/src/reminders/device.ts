import * as Notifications from 'expo-notifications';
import type {NotificationPort} from './controller';
const prefix='campus.local.reminder.v1:';
export const isCampusReminder=(id:string)=>id.startsWith(prefix);
const ours=(id:string)=>isCampusReminder(id)||id.startsWith('campus.local.');
Notifications.setNotificationHandler({handleNotification:async notification=>({shouldPlaySound:false,shouldSetBadge:false,shouldShowBanner:ours(notification.request.identifier),shouldShowList:ours(notification.request.identifier)})});
export const notificationPort:NotificationPort={
 list:async()=>(await Notifications.getAllScheduledNotificationsAsync()).map(n=>({id:n.identifier,owned:isCampusReminder(n.identifier)})),
 cancel:id=>Notifications.cancelScheduledNotificationAsync(id),
 dismissOwned:async()=>{for(const n of await Notifications.getPresentedNotificationsAsync())if(isCampusReminder(n.request.identifier))await Notifications.dismissNotificationAsync(n.request.identifier);},
 permission:async request=>{
  let permission=await Notifications.getPermissionsAsync();
  if(request&&permission.status!=='granted'&&permission.canAskAgain)permission=await Notifications.requestPermissionsAsync({ios:{allowAlert:true,allowBadge:false,allowSound:false}});
  return permission.granted||permission.ios?.status===Notifications.IosAuthorizationStatus.PROVISIONAL?'granted':permission.status==='undetermined'?'undetermined':'denied';
 },
 schedule:(item,context)=>Notifications.scheduleNotificationAsync({
  identifier:prefix+context.owner+':'+encodeURIComponent(item.id),
  content:{title:context.language==='zh'?'Campus · 日程提醒':'Campus · A reminder',body:context.language==='zh'?'你设置的提醒时间到了，打开 App 查看安排。':'Your reminder is due. Open Campus to view your plan.',data:{owner:context.owner,target:item.target,reminder_id:item.id,target_at:item.target_at}},
  trigger:{type:Notifications.SchedulableTriggerInputTypes.DATE,date:new Date(item.fires_at)},
 }),
};

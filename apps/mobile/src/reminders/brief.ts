// Pen board "V3 / 主动推送 · 锁屏" (l5eHBo): the 08:00 morning brief as a real local notification.
// Built on-device from /me/calendar each time the app opens; nothing leaves the phone, no remote push token.
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import {api,session} from '../runtime';
import type {Calendar} from '../study/types';
import {dateTimeInZone} from '../study/dates';

const ID='campus.local.brief.v1';
const key=(owner:string)=>'campus.brief.v1.'+owner;
const hkDate=(ms:number)=>dateTimeInZone(new Date(ms).toISOString(),'Asia/Hong_Kong').slice(0,10);

export async function briefEnabled(owner:string){return (await SecureStore.getItemAsync(key(owner)))==='on';}
export async function setBriefEnabled(owner:string,on:boolean,zh:boolean){
 await SecureStore.setItemAsync(key(owner),on?'on':'off',{keychainAccessible:SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY});
 if(!on){await Notifications.cancelScheduledNotificationAsync(ID).catch(()=>{});return true;}
 return scheduleBrief(owner,zh);
}
/** Next 08:00 Hong Kong time. */
function nextEight(now=Date.now()){
 const today=hkDate(now),at=Date.parse(`${today}T08:00:00+08:00`);
 return at>now+60_000?at:Date.parse(`${hkDate(now+864e5)}T08:00:00+08:00`);
}
export async function composeBrief(dayMs:number,zh:boolean){
 const day=hkDate(dayMs),next=hkDate(dayMs+864e5);
 const cal=await session.request<Calendar>(`/me/calendar?from=${day}&to=${next}&timezone=Asia%2FHong_Kong`);
 const d=cal.days.find(x=>x.date===day);
 const classes=(d?.events??[]).filter(e=>e.kind==='event'&&e.status==='active'&&e.starts_at) as Extract<Calendar['days'][number]['events'][number],{kind:'event'}>[];
 const due=(d?.tasks??[]).filter(t=>t.kind==='task'&&t.status==='open');
 const first=classes.sort((a,b)=>a.starts_at!.localeCompare(b.starts_at!))[0];
 const title=zh?`今天 ${classes.length} 节课，${due.length} 项截止`:`${classes.length} classes, ${due.length} due today`;
 const parts=[first?`${dateTimeInZone(first.starts_at!,'Asia/Hong_Kong').slice(11)} ${first.title}${first.location?` @ ${first.location.split(/[·,]/)[0].trim()}`:''}`:null,due[0]?(zh?`${due[0].title} 今天截止`:`${due[0].title} due today`):null].filter(Boolean);
 try{const w=await api.request<{temperature:number|null;condition:{zh:string;en:string}|null;warnings:{zh:string;en:string}[]}>('/campus/weather');parts.unshift(`${w.temperature??'–'}° ${w.condition?(zh?w.condition.zh:w.condition.en):''}${w.warnings[0]?` · ${zh?w.warnings[0].zh:w.warnings[0].en}`:''}`.trim());}catch{}
 return {title,body:parts.length?parts.join(zh?' · ':' · '):(zh?'今天没有课，也没有截止。':'Nothing scheduled today.')};
}
export async function scheduleBrief(owner:string,zh:boolean){
 const perm=await Notifications.requestPermissionsAsync({ios:{allowAlert:true,allowBadge:false,allowSound:true}});
 if(!perm.granted)return false;
 const at=nextEight();
 const content=await composeBrief(at,zh);
 await Notifications.cancelScheduledNotificationAsync(ID).catch(()=>{});
 await Notifications.scheduleNotificationAsync({identifier:ID,content:{title:`USTLIFE · ${zh?'早报':'Morning brief'}`,subtitle:content.title,body:content.body,data:{owner,kind:'brief'}},trigger:{type:Notifications.SchedulableTriggerInputTypes.DATE,date:new Date(at)}});
 return true;
}
/** Send today's brief in a few seconds so the student can see what it looks like on the lock screen. */
export async function previewBrief(zh:boolean){
 const perm=await Notifications.requestPermissionsAsync({ios:{allowAlert:true,allowBadge:false,allowSound:true}});
 if(!perm.granted)return false;
 const content=await composeBrief(Date.now(),zh);
 await Notifications.scheduleNotificationAsync({identifier:ID+'.preview',content:{title:`USTLIFE · ${zh?'早报':'Morning brief'}`,subtitle:content.title,body:content.body},trigger:{type:Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,seconds:5}});
 return true;
}
/** Re-plan tomorrow's brief from fresh data; call when the app opens. */
export async function refreshBrief(owner:string,zh:boolean){if(await briefEnabled(owner))await scheduleBrief(owner,zh).catch(()=>{});}

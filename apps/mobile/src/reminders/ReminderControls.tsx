import {useSyncExternalStore} from 'react';
import {Linking,Text,View} from 'react-native';
import {Button,Card} from '../ui/Primitives';
import {reminders} from '../runtime';
import {palette,styles} from '../theme';
import type {Language} from '../strings';
export function ReminderPicker({value,onChange,language,dark,disabled=false}:{value:number|null;onChange:(value:number|null)=>void;language:Language;dark:boolean;disabled?:boolean}){
 const zh=language==='zh',c=palette[dark?'dark':'light'];
 const options:(number|null)[]=[null,0,10,30,60];if(value!==null&&!options.includes(value))options.push(value);
 return <View style={styles.smallStack}><Text style={[styles.body,{color:c.text}]}>{zh?'提醒时间':'Reminder time'}</Text><View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>{options.map(minutes=><Button key={minutes??'none'} variant={value===minutes?'primary':'secondary'} isDisabled={disabled} onPress={()=>onChange(minutes)}>{value===minutes?'✓ ':''}{minutes===null?(zh?'不提醒':'None'):minutes===0?(zh?'准时':'At time'):zh?`提前 ${minutes} 分钟`:`${minutes} min before`}</Button>)}</View><Text style={[styles.caption,{color:c.muted}]}>{zh?'保存后生效；需在“我的”中开启本机提醒并允许通知。':'Saved with this item. Enable device reminders in Me and allow notifications.'}</Text></View>;
}
export function ReminderSettings({language,dark}:{language:Language;dark:boolean}){
 const state=useSyncExternalStore(reminders.subscribe,reminders.snapshot),zh=language==='zh',c=palette[dark?'dark':'light'];
 const text=state.phase==='ready'?(zh?`本机已安排 ${state.scheduled} 条提醒`:`${state.scheduled} reminders scheduled on this device`):state.phase==='syncing'?(zh?'正在核对本机提醒…':'Checking device reminders…'):state.phase==='denied'?(zh?'通知尚未获准，学习和活动功能仍可使用。':'Notifications are not allowed. Study and activities still work.'):state.phase==='error'?(state.cleanupPending?(zh?'提醒清理失败，旧提醒可能仍存在。请重试。':'Cleanup failed. Old reminders may remain. Please retry.'):state.stale?(zh?'暂时无法更新，保留了上次提醒；可能尚未反映最新改期。':'Could not refresh. Previous reminders remain and may not reflect recent changes.'):(zh?'本次同步未完成，已清除旧提醒。联网后重试。':'Sync did not complete. Old reminders were cleared. Reconnect and retry.')):(zh?'本机提醒未开启':'Device reminders are off');
 return <Card style={[styles.card,{backgroundColor:c.surface}]}><Text style={[styles.heading,{color:c.text}]}>{zh?'本机日程提醒':'Device reminders'}</Text><Text accessibilityRole={state.phase==='error'?'alert':undefined} style={[styles.body,{color:state.phase==='error'?c.danger:c.text}]}>{text}</Text>
 <Text style={[styles.caption,{color:c.muted}]}>{zh?'只安排未来 14 天最近的最多 60 条提醒。打开 App 时更新；离线或未打开时，其他人改期不能立即更新本机通知。':'Schedules up to 60 reminders in the next 14 days. Refreshes when you open the app. Changes made by others cannot immediately update an offline or closed app.'}</Text>
 {state.deferred||state.warnings?<Text style={[styles.caption,{color:c.muted}]}>{zh?`另有 ${state.deferred} 条等待下次安排，${state.warnings} 个导入系列需检查。`:`${state.deferred} waiting for a later sync; ${state.warnings} imported series need review.`}</Text>:null}
 {state.lastSync?<Text style={[styles.caption,{color:c.muted}]}>{zh?'上次成功同步：':'Last successful sync: '}{new Date(state.lastSync).toLocaleString(zh?'zh-HK':'en-HK',{timeZone:'Asia/Hong_Kong'})} HKT</Text>:null}
 <Button isDisabled={state.phase==='syncing'} onPress={()=>void reminders.refresh(state.enabled?'sync':'enable')}>{state.enabled?(zh?'立即核对提醒':'Sync now'):(zh?'开启本机提醒':'Enable on this device')}</Button>
 {state.phase==='denied'?<Button variant="ghost" onPress={()=>void Linking.openSettings()}>{zh?'打开系统设置':'Open system settings'}</Button>:null}
 {state.enabled||state.phase==='denied'||state.cleanupPending?<Button variant="ghost" isDisabled={state.phase==='syncing'} onPress={()=>void reminders.refresh('disable')}>{zh?'关闭并清除本机提醒':'Disable and clear device reminders'}</Button>:null}
 </Card>;
}

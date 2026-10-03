import {useSyncExternalStore} from 'react';
import {Linking,Switch,Text,View} from 'react-native';
import {Hero,ListGroup,ListRow,PrimaryButton,Section,usePenColors} from '../ui/Pen';
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
 // Pen board "V3 / 自动提醒设置" in V5 style. Only implemented capabilities get real switches; the rest is labelled "即将推出".
 const pc=usePenColors(),busy=state.phase==='syncing';
 const soon=zh?'即将推出':'Coming soon';
 return <View style={{gap:18}}>
  <Hero label={zh?'本机已安排':'Scheduled on this device'} value={String(state.enabled?state.scheduled:0)} unit={zh?'条提醒':'reminders'} chip={state.phase==='ready'?(zh?'已开启 · 打开 App 时自动核对':'On · checked each time you open the app'):text} chipIcon={state.phase==='error'?'circle-alert':state.phase==='denied'?'bell-off':'bell'} chipColor={state.phase==='error'?pc.red:undefined}/>
  {!state.enabled&&state.phase!=='denied'?<PrimaryButton label={zh?'开启本机提醒':'Turn on reminders'} disabled={busy} onPress={()=>void reminders.refresh('enable')}/>:null}
  {state.phase==='denied'?<PrimaryButton label={zh?'在系统设置里允许通知':'Allow in Settings'} onPress={()=>void Linking.openSettings()}/>:null}
  <Section title={zh?'学习':'Study'}><ListGroup>
   <ListRow icon="clock-alert" tile="#E5484D" title={zh?'截止与日程提醒':'Deadline & schedule alerts'} subtitle={zh?'按你在每个截止上设的时间提醒':'At the time you set on each item'} accessory={<Switch value={state.enabled} disabled={busy} onValueChange={on=>void reminders.refresh(on?'enable':'disable')}/>}/>
   <ListRow icon="sunrise" tile="#D98A1C" title={zh?'每日早报 08:00':'Morning brief 08:00'} subtitle={zh?'今天的课、截止、天气':'Classes, deadlines, weather'} value={soon}/>
   <ListRow icon="graduation-cap" tile="#24467F" title={zh?'Canvas 新作业 / 公告':'New Canvas work'} subtitle={zh?'连接学校账号后可用':'After connecting your school account'} value={soon}/>
  </ListGroup></Section>
  <Section title={zh?'生活':'Life'}><ListGroup>
   <ListRow icon="footprints" tile="#4F6F8C" title={zh?'出门提醒':'Time to leave'} subtitle={zh?'按步行时间和下一班车':'Walk time and the next ride'} value={soon}/>
   <ListRow icon="cloud-lightning" tile="#8E8E93" title={zh?'天气警告与停课':'Weather & class suspension'} subtitle={zh?'以校方公告为准':'Following official notices'} value={soon}/>
  </ListGroup></Section>
  {state.enabled||state.cleanupPending?<ListGroup><ListRow icon="refresh-cw" tile="#56647D" title={zh?'立即核对提醒':'Sync now'} disabled={busy} onPress={()=>void reminders.refresh('sync')}/></ListGroup>:null}
  <Text style={{paddingHorizontal:4,fontSize:12,lineHeight:18,color:pc.muted}}>{zh?'只安排未来 14 天内最近的 60 条提醒，打开 App 时更新。':'Up to 60 reminders in the next 14 days, refreshed when you open the app.'}{state.deferred||state.warnings?(zh?` 另有 ${state.deferred} 条等待下次安排。`:` ${state.deferred} more wait for the next sync.`):''}{state.lastSync?(zh?` 上次同步 ${new Date(state.lastSync).toLocaleTimeString('zh-HK',{timeZone:'Asia/Hong_Kong',hour:'2-digit',minute:'2-digit'})}。`:` Last sync ${new Date(state.lastSync).toLocaleTimeString('en-HK',{timeZone:'Asia/Hong_Kong',hour:'2-digit',minute:'2-digit'})}.`):''}</Text>
 </View>;
}

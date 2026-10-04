// Readable wording for imported calendars. The server's series summary carries raw iCalendar values
// (summarizeSeries in src/product/calendar/ics.ts): "2026-09-08T10:30:00" + timezone, "…Z" for UTC,
// "2026-10-22" for all-day, RRULE strings such as "FREQ=WEEKLY;BYDAY=TU,TH;UNTIL=20261218T155959Z".
import type {SeriesSummary} from '../../../../src/product/calendar/types';

export const ZONES=['Asia/Hong_Kong','UTC','Europe/London','America/New_York'] as const;
const ZONE:Record<string,[string,string]>={'Asia/Hong_Kong':['香港时间','Hong Kong time'],UTC:['UTC','UTC'],'Europe/London':['伦敦时间','London time'],'America/New_York':['纽约时间','New York time']};
export const zoneLabel=(tz:string,zh:boolean)=>ZONE[tz]?.[zh?0:1]??tz;

const ZH_DAY='日一二三四五六',EN_DAY=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],BYDAY=['SU','MO','TU','WE','TH','FR','SA'];
const pad=(n:number)=>String(n).padStart(2,'0');
/** Wall-clock parts of a summary time, shown in Hong Kong time when the file used UTC. */
function parts(value:string,tz:string){
 if(/^\d{4}-\d{2}-\d{2}$/.test(value))return {date:value,time:null as string|null,zone:null as string|null};
 const m=/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/.exec(value);if(!m)return null;
 if(value.endsWith('Z')){const d=new Date(Date.parse(value)+8*3600e3);return {date:d.toISOString().slice(0,10),time:`${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`,zone:null};}
 return {date:m[1],time:`${m[2]}:${m[3]}`,zone:tz==='Asia/Hong_Kong'||!ZONE[tz]?null:tz};
}
const weekday=(date:string)=>new Date(date+'T00:00:00Z').getUTCDay();
const day=(date:string,zh:boolean)=>zh?`${Number(date.slice(5,7))} 月 ${Number(date.slice(8,10))} 日 周${ZH_DAY[weekday(date)]}`:new Date(date+'T00:00:00Z').toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short',timeZone:'UTC'});
const monthDay=(date:string,zh:boolean)=>zh?`${Number(date.slice(5,7))} 月 ${Number(date.slice(8,10))} 日`:new Date(date+'T00:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'short',timeZone:'UTC'});
/** "PT1H20M" → minutes. */
const durationMinutes=(d:string)=>{const m=/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/.exec(d);return m?(Number(m[1]||0)*1440+Number(m[2]||0)*60+Number(m[3]||0)):0;};
const addMinutes=(time:string,mins:number)=>{const t=Number(time.slice(0,2))*60+Number(time.slice(3,5))+mins;return `${pad(Math.floor(t/60)%24)}:${pad(t%60)}`;};

export function timeSpan(s:SeriesSummary,zh:boolean){
 const a=parts(s.start,s.timezone);if(!a)return '';
 if(!a.time)return zh?'全天':'All day';
 const b=s.end?parts(s.end,s.timezone):null,end=b?.time??(s.duration?addMinutes(a.time,durationMinutes(s.duration)):null);
 return `${a.time}${end?`–${end}`:''}${a.zone?` ${zoneLabel(a.zone,zh)}`:''}`;
}
export function recurrenceText(s:SeriesSummary,zh:boolean){
 if(!s.recurrence)return null;
 const rule=Object.fromEntries(s.recurrence.split('; ')[0].split(';').map(x=>x.split('=') as [string,string]));
 const every=Number(rule.INTERVAL||1),start=parts(s.start,s.timezone);
 let head:string|null=null;
 if(rule.FREQ==='DAILY')head=every===1?(zh?'每天':'Daily'):(zh?`每 ${every} 天`:`Every ${every} days`);
 else if(rule.FREQ==='WEEKLY'){
  const days=(rule.BYDAY?rule.BYDAY.split(','):start?[BYDAY[weekday(start.date)]]:[]).map(d=>BYDAY.indexOf(d.slice(-2))).filter(i=>i>=0);
  if(days.length&&!rule.BYDAY?.match(/\d/)){const list=zh?days.map(i=>ZH_DAY[i]).join('、'):days.map(i=>EN_DAY[i]).join(', ');head=every===1?(zh?`每周${list}`:`Every ${list}`):(zh?`每 ${every} 周的周${list}`:`Every ${every} weeks on ${list}`);}
 }
 else if(rule.FREQ==='MONTHLY'&&!rule.BYDAY&&!rule.BYSETPOS)head=every===1?(zh?'每月':'Monthly'):(zh?`每 ${every} 个月`:`Every ${every} months`);
 else if(rule.FREQ==='YEARLY'&&!rule.BYDAY)head=zh?'每年':'Yearly';
 if(!head)return zh?'按文件里的规则重复':'Repeats (file rule)';
 let tail='';
 if(rule.UNTIL){const u=/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z?))?$/.exec(rule.UNTIL);if(u){const iso=u[4]?`${u[1]}-${u[2]}-${u[3]}T${u[4]}:${u[5]}:${u[6]}${u[7]?'Z':''}`:`${u[1]}-${u[2]}-${u[3]}`;const p=parts(iso,s.timezone);if(p)tail=zh?` · 到 ${monthDay(p.date,zh)}`:` · until ${monthDay(p.date,zh)}`;}}
 else if(rule.COUNT)tail=zh?` · 共 ${rule.COUNT} 次`:` · ${rule.COUNT} times`;
 return head+tail;
}
/** One-line "when" and one-line "where/extras" for a series. */
export function seriesLines(s:SeriesSummary,zh:boolean){
 const start=parts(s.start,s.timezone),repeat=recurrenceText(s,zh),span=timeSpan(s,zh);
 const when=repeat?(()=>{const [head,...rest]=repeat.split(' · ');return [`${head} ${span}`.trim(),...rest].join(' · ');})():start?`${day(start.date,zh)} ${span}`:span;
 const count=(v:string,sep:string)=>v?v.split(sep).filter(Boolean).length:0;
 const skipped=count(s.excluded,', '),moved=count(s.exceptions,'\n');
 const extra=[s.location,skipped?(zh?`跳过 ${skipped} 次`:`${skipped} skipped`):'',moved?(zh?`${moved} 次单独调整`:`${moved} changed`):'',s.status==='CANCELLED'?(zh?'文件里已取消':'Cancelled in file'):s.status==='TENTATIVE'?(zh?'暂定':'Tentative'):''].filter(Boolean).join(' · ');
 return {when,extra};
}
/** What an update changes, e.g. "地点 Room 4210 → Room 4214". */
export function changeText(before:SeriesSummary,after:SeriesSummary,zh:boolean){
 const out:string[]=[];
 if(before.title!==after.title)out.push(`${zh?'名称':'Title'} ${before.title} → ${after.title}`);
 const bw=seriesLines(before,zh).when,aw=seriesLines(after,zh).when;
 if(bw!==aw)out.push(`${zh?'时间':'Time'} ${bw} → ${aw}`);
 if(before.location!==after.location)out.push(`${zh?'地点':'Place'} ${before.location||'—'} → ${after.location||'—'}`);
 if(!out.length&&(before.excluded!==after.excluded||before.exceptions!==after.exceptions))out.push(zh?'个别日期有调整':'Some dates changed');
 if(!out.length&&before.description!==after.description)out.push(zh?'说明有更新':'Notes changed');
 return out.slice(0,2).join(zh?'；':'; ');
}
const ISSUE:Record<string,[string,string]>={
 FLOATING_TIMEZONE_REQUIRED:['没写时区，请选一个时区再预览','No timezone; choose one and preview again'],
 UNSUPPORTED_RULE:['重复规则太复杂，暂不支持','Repeat rule not supported'],
 UNSUPPORTED_TIMEZONE:['时区无法识别','Unrecognized timezone'],
 EXPANSION_LIMIT:['重复次数太多，超出上限','Too many repeats'],TOO_MANY_EVENTS:['日程太多，超出上限','Too many events'],
 INVALID_DATE:['日期或时间无效','Invalid date or time'],MISSING_START:['缺少开始时间','Missing start time'],INVALID_END:['结束时间早于开始时间','Ends before it starts'],NONEXISTENT_LOCAL_TIME:['这个时间在当地不存在（夏令时）','Time does not exist locally (DST)'],
 DUPLICATE_UID:['文件里有重复的日程','Duplicate events in the file'],DUPLICATE_PROPERTY:['日程里有重复的字段','Duplicate fields in an event'],DUPLICATE_EXCEPTION:['同一天有重复的调整','Duplicate changes for one date'],ORPHAN_EXCEPTION:['有调整找不到对应的日程','A change has no matching event'],INVALID_EXCEPTION:['单次调整无效','Invalid single-date change'],
 UNSUPPORTED_COMPONENT:['不是日程（例如待办），已跳过','Not an event (e.g. a to-do); skipped'],INVALID_EVENT:['日程内容不完整','Incomplete event'],EXPANSION_UNAVAILABLE:['暂时无法展开这组日程','Cannot expand this series right now'],
};
export const issueText=(code:string,zh:boolean)=>ISSUE[code]?.[zh?0:1]??(zh?'无法导入':'Cannot import');

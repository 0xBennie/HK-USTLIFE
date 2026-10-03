import type {CalendarItem} from '../calendar/types.js';
export type Reminder = {id:string;fires_at:string;target_at:string;kind:'event'|'task';target:{kind:'study'|'import'|'activity';id:string};title:string};
export type ReminderFeed = {owner_id:string;generated_at:string;through:string;limit:number;deferred:number;items:Reminder[];import_issues:{source_id:string;series_id:string;title:string;code:string}[]};
export const REMINDER_DAYS=14, REMINDER_LIMIT=60;
export function projectReminders(owner:string,items:CalendarItem[],now:number,issues:ReminderFeed['import_issues']=[]):ReminderFeed {
 const through=now+REMINDER_DAYS*86400_000;
 const reminders=new Map<string,Reminder>();
 for(const item of items){
  if(item.kind!=='event'&&item.kind!=='task')continue;
  if(item.remind_minutes===null||(item.kind==='task'?item.status!=='open':item.status!=='active'||item.all_day))continue;
  if('source_occurrence_missing' in item&&item.source_occurrence_missing)continue;
  const targetAt=item.kind==='task'?item.due_at:item.starts_at;
  if(!targetAt)continue;
  const fire=Date.parse(targetAt)-item.remind_minutes*60_000;
  if(!Number.isFinite(fire)||fire<=now||fire>=through)continue;
  const target:Reminder['target']='activity_origin' in item?{kind:'activity',id:item.activity_origin.id}:'import_origin' in item?{kind:'import',id:item.id}:{kind:'study',id:item.id};
  reminders.set(item.id,{id:item.id,fires_at:new Date(fire).toISOString(),target_at:targetAt,kind:item.kind,target,title:item.title});
 }
 const sorted=[...reminders.values()].sort((a,b)=>a.fires_at.localeCompare(b.fires_at)||a.id.localeCompare(b.id));
 return {owner_id:owner,generated_at:new Date(now).toISOString(),through:new Date(through).toISOString(),limit:REMINDER_LIMIT,deferred:Math.max(0,sorted.length-REMINDER_LIMIT),items:sorted.slice(0,REMINDER_LIMIT),import_issues:issues};
}

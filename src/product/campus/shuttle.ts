import {z} from 'zod';
import {shuttleData} from './shuttle-data.js';
import {calendarDate} from '../learning/schemas.js';
import {ApiError} from '../errors.js';
export type ShuttleSource=typeof shuttleData.source;
export type ShuttleRoute=typeof shuttleData.routes[number]&{source?:ShuttleSource;refresh_due_at?:string};
export type ShuttleCatalog=Omit<typeof shuttleData,'routes'>&{routes:ShuttleRoute[];holiday_refresh_due_at?:string};
export const departureQuery=z.object({at:z.string().datetime({offset:true}).refine(v=>calendarDate.safeParse(v.slice(0,10)).success&&Number.isFinite(Date.parse(v))).optional()}).strict();
export function shuttleRoutes(now=Date.now(),data:ShuttleCatalog=shuttleData) {
  return {...data,freshness:now>=Date.parse(data.refresh_due_at)?'stale':'reviewed_snapshot'};
}
export function plannedDepartures(id:string,at:string,now=Date.now(),data:ShuttleCatalog=shuttleData) {
  const route=data.routes.find(r=>r.id===id);if(!route)throw new ApiError(404,'ROUTE_NOT_FOUND','Route is not in the reviewed catalog.');
  const instant=Date.parse(departureQuery.parse({at}).at!);
  const hk=new Date(instant+8*3600_000),date=hk.toISOString().slice(0,10),weekday=hk.getUTCDay();
  const holiday=data.holidays.find(h=>h.date===date),covered=data.holiday_years.includes(hk.getUTCFullYear());
  const due=route.refresh_due_at??data.refresh_due_at;
  const stale=now>=Date.parse(due)||(route.exclude_public_holidays&&data.holiday_refresh_due_at!==undefined&&now>=Date.parse(data.holiday_refresh_due_at));
  const status=stale?'stale':route.exclude_public_holidays&&!covered?'holiday_coverage_unknown':date<route.valid_from||date>route.valid_to?'outside_service_period':route.exclude_public_holidays&&(holiday||weekday===0)?'public_holiday':!route.weekdays.includes(weekday)?'non_operating_day':'scheduled';
  const timetable=route.departures.map(time=>({local_time:time,scheduled_at:new Date(`${date}T${time}:00+08:00`).toISOString()}));
  const upcoming=status==='scheduled'?timetable.filter(d=>Date.parse(d.scheduled_at)>=instant):[];
  return {route,service_date:date,timezone:'Asia/Hong_Kong',kind:'planned' as const,status:status==='scheduled'&&!upcoming.length?'finished_for_day':status,
    upcoming,timetable,holiday:holiday?.name??(weekday===0?'Sunday':null),source:route.source??data.source,refresh_due_at:due,version:data.version,
    holiday_source:data.holiday_source,holiday_refresh_due_at:data.holiday_refresh_due_at,queried_at:at,generated_at:new Date(now).toISOString(),notices:data.notes};
}
export type ShuttleDepartures=ReturnType<typeof plannedDepartures>;
/** Every shuttle that leaves campus with its next departure: later today, else the first trip of the next service day (≤14 days). */
export function campusShuttles(now=Date.now(),data:ShuttleCatalog=shuttleData) {
  const outbound=data.routes.filter(r=>r.id.startsWith('campus-to-')||r.id.endsWith('-to-east-point-city'));
  const hkMidnight=Date.parse(new Date(now+8*3600_000).toISOString().slice(0,10)+'T00:00:00+08:00');
  return {routes:outbound.map(route=>{
    const today=plannedDepartures(route.id,new Date(now).toISOString(),now,data);
    let next:{service_date:string;local_time:string;scheduled_at:string;today:boolean}|null=today.upcoming[0]?{service_date:today.service_date,...today.upcoming[0],today:true}:null;
    for(let i=1;!next&&today.status!=='stale'&&i<=14;i++){
      const d=plannedDepartures(route.id,new Date(hkMidnight+i*864e5).toISOString(),now,data);
      if(d.status==='scheduled'&&d.upcoming[0])next={service_date:d.service_date,...d.upcoming[0],today:false};
    }
    return {id:route.id,name:route.name,destination:{zh:route.name.zh.split('→').pop()!.trim(),en:route.name.en.split('→').pop()!.trim()},eligibility:route.eligibility,fare_minor:route.fare_minor,
      status:today.status,next,later:next?.today?today.upcoming.slice(1,3).map(u=>u.local_time):[],timetable:route.departures};
  }),source:data.source,generated_at:new Date(now).toISOString()};
}

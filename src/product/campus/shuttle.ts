import {z} from 'zod';
import {shuttleData} from './shuttle-data.js';
import {calendarDate} from '../learning/schemas.js';
import {ApiError} from '../errors.js';
export type ShuttleRoute=typeof shuttleData.routes[number];
export const departureQuery=z.object({at:z.string().datetime({offset:true}).refine(v=>calendarDate.safeParse(v.slice(0,10)).success&&Number.isFinite(Date.parse(v))).optional()}).strict();
export function shuttleRoutes(now=Date.now()) {
  return {...shuttleData,routes:shuttleData.routes,freshness:now>=Date.parse(shuttleData.refresh_due_at)?'stale':'reviewed_snapshot'};
}
export function plannedDepartures(id:string,at:string,now=Date.now(),data=shuttleData) {
  const route=data.routes.find(r=>r.id===id);if(!route)throw new ApiError(404,'ROUTE_NOT_FOUND','Route is not in the reviewed catalog.');
  const instant=Date.parse(departureQuery.parse({at}).at!);
  const hk=new Date(instant+8*3600_000),date=hk.toISOString().slice(0,10),weekday=hk.getUTCDay();
  const holiday=data.holidays.find(h=>h.date===date),covered=data.holiday_years.includes(hk.getUTCFullYear());
  const stale=now>=Date.parse(data.refresh_due_at);
  const status=stale?'stale':!covered?'holiday_coverage_unknown':date<route.valid_from||date>route.valid_to?'outside_service_period':holiday||weekday===0?'public_holiday':!route.weekdays.includes(weekday)?'non_operating_day':'scheduled';
  const timetable=route.departures.map(time=>({local_time:time,scheduled_at:new Date(`${date}T${time}:00+08:00`).toISOString()}));
  const upcoming=status==='scheduled'?timetable.filter(d=>Date.parse(d.scheduled_at)>=instant):[];
  return {route,service_date:date,timezone:'Asia/Hong_Kong',kind:'planned' as const,status:status==='scheduled'&&!upcoming.length?'finished_for_day':status,
    upcoming,timetable,holiday:holiday?.name??(weekday===0?'Sunday':null),source:data.source,refresh_due_at:data.refresh_due_at,version:data.version,
    holiday_source:data.holiday_source,queried_at:at,generated_at:new Date(now).toISOString(),notices:data.notes};
}
export type ShuttleDepartures=ReturnType<typeof plannedDepartures>;

import type {DatabaseSync} from 'node:sqlite';
import {z} from 'zod';
import {calendarDate} from '../learning/schemas.js';
import {transaction} from '../database.js';
import {ApiError} from '../errors.js';
import {shuttleData} from './shuttle-data.js';
import {plannedDepartures,type ShuttleCatalog} from './shuttle.js';
import type {createMaintenanceStore} from './maintenance.js';

const text=z.string().trim().min(1).max(2000);
export const routeFields=z.object({
 name:z.object({zh:text,en:text}).strict(),origin:text,destination:text,
 departures:z.array(z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/)).min(1).max(200).refine(a=>a.every((v,i)=>i===0||v>a[i-1]),'Departure times must be unique and ascending.'),
 fare_minor:z.number().int().min(0).max(100000).nullable(),eligibility:z.enum(['student_only','student_or_staff']),note:z.string().trim().max(2000),
 valid_from:calendarDate,valid_to:calendarDate,weekdays:z.array(z.number().int().min(0).max(6)).min(1).max(7).refine(a=>new Set(a).size===a.length),exclude_public_holidays:z.boolean()
}).strict().refine(v=>v.valid_to>=v.valid_from,'Service end must not precede start.');
const writeBase={revision:z.number().int().positive(),source_check_id:z.string().uuid(),reason:z.string().trim().min(5).max(1000)};
const routeWrite=z.object({...writeBase,fields:routeFields}).strict();
const holidaysWrite=z.object({...writeBase,years:z.array(z.number().int().min(2000).max(2100)).min(1).max(10).refine(a=>new Set(a).size===a.length),holidays:z.array(z.object({date:calendarDate,name:text}).strict()).min(1).max(400)}).strict().superRefine((v,c)=>{
 if(new Set(v.holidays.map(h=>h.date)).size!==v.holidays.length)c.addIssue({code:'custom',message:'Duplicate holiday dates.'});
 if(v.holidays.some(h=>!v.years.includes(Number(h.date.slice(0,4))))||v.years.some(y=>!v.holidays.some(h=>Number(h.date.slice(0,4))===y)))c.addIssue({code:'custom',message:'Every covered year needs reviewed holiday entries; no dates outside coverage.'});
});

export function createShuttleStore(db:DatabaseSync,now:()=>number,maintenance:ReturnType<typeof createMaintenanceStore>){
 const initial:ShuttleCatalog={...shuttleData,routes:shuttleData.routes.map(r=>({...r,source:shuttleData.source,refresh_due_at:shuttleData.refresh_due_at})),holiday_refresh_due_at:new Date(Date.parse(shuttleData.holiday_source.retrieved_at)+30*86400000).toISOString()};
 db.prepare('INSERT OR IGNORE INTO shuttle_catalog(id,revision,payload) VALUES(1,1,?)').run(JSON.stringify(initial));
 function read(){const row=db.prepare('SELECT revision,payload FROM shuttle_catalog WHERE id=1').get() as {revision:number;payload:string};return {revision:row.revision,catalog:JSON.parse(row.payload) as ShuttleCatalog};}
 function current(revision:number){const row=read();if(row.revision!==revision)throw new ApiError(409,'VERSION_CONFLICT','Catalog changed. Reload before saving.');return row;}
 function save(revision:number,catalog:ShuttleCatalog){catalog.version=`maintenance-${revision+1}`;catalog.refresh_due_at=new Date(Math.min(...catalog.routes.map(r=>Date.parse(r.refresh_due_at!)),Date.parse(catalog.holiday_refresh_due_at!))).toISOString();db.prepare('UPDATE shuttle_catalog SET revision=?,payload=? WHERE id=1').run(revision+1,JSON.stringify(catalog));return read();}
 function editRoute(actor:string,id:string,input:unknown){const v=routeWrite.parse(input);return transaction(db,()=>{
  const before=current(v.revision),route=before.catalog.routes.find(r=>r.id===id);if(!route)throw new ApiError(404,'ROUTE_NOT_FOUND','Unknown catalog route.');
  const check=maintenance.requireCheck(v.source_check_id,'shuttle_timetable','catalog');
  const source={url:check.url,retrieved_at:new Date(check.retrieved_at).toISOString(),sha256:check.sha256,status:200};
  const afterRoute={id,...v.fields,source,refresh_due_at:new Date(check.retrieved_at+7*86400000).toISOString()};
  const after=save(v.revision,{...before.catalog,routes:before.catalog.routes.map(r=>r.id===id?afterRoute:r)});
  maintenance.audit(actor,'shuttle',id,'edit_shuttle_route',v.reason,{revision:before.revision,route},{revision:after.revision,route:afterRoute},check.id);return after;
 });}
 function editHolidays(actor:string,input:unknown){const v=holidaysWrite.parse(input);return transaction(db,()=>{
  const before=current(v.revision),check=maintenance.requireCheck(v.source_check_id,'shuttle_holidays','calendar');
  const after=save(v.revision,{...before.catalog,holiday_years:[...v.years].sort((a,b)=>a-b),holidays:[...v.holidays].sort((a,b)=>a.date.localeCompare(b.date)),holiday_source:{url:check.url,sha256:check.sha256,retrieved_at:new Date(check.retrieved_at).toISOString(),status:200},holiday_refresh_due_at:new Date(check.retrieved_at+30*86400000).toISOString()});
  const snapshot=(row:ReturnType<typeof read>)=>({revision:row.revision,years:row.catalog.holiday_years,holidays:row.catalog.holidays,source:row.catalog.holiday_source});
  maintenance.audit(actor,'shuttle_holidays','calendar','edit_shuttle_holidays',v.reason,snapshot(before),snapshot(after),check.id);return after;
 });}
 function preview(id:string,input:unknown){const v=z.object({revision:z.number().int().positive(),fields:routeFields,at:z.string()}).strict().parse(input),row=current(v.revision);if(!row.catalog.routes.some(r=>r.id===id))throw new ApiError(404,'ROUTE_NOT_FOUND','Unknown route.');return plannedDepartures(id,v.at,now(),{...row.catalog,routes:row.catalog.routes.map(r=>r.id===id?{...r,...v.fields}:r)});}
 return {read,editRoute,editHolidays,preview};
}

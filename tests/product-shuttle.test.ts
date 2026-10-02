import {it,expect} from 'vitest';
import {plannedDepartures,departureQuery} from '../src/product/campus/shuttle.js';
import {shuttleData} from '../src/product/campus/shuttle-data.js';
const now=Date.parse(shuttleData.source.retrieved_at)+1000;
it('uses the correct boarding direction and time boundary without inventing live information',()=>{
 const exact=plannedDepartures('hang-hau-to-campus','2026-10-05T08:35:00+08:00',now);expect(exact.kind).toBe('planned');expect(exact.upcoming.map(d=>d.local_time)).toEqual(['08:35','08:40']);
 expect(plannedDepartures('hang-hau-to-campus','2026-10-05T08:40:01+08:00',now)).toMatchObject({status:'finished_for_day',upcoming:[]});
 expect(plannedDepartures('campus-to-hang-hau','2026-10-05T08:40:01+08:00',now).upcoming.map(d=>d.local_time)).toEqual(['18:00','18:05','18:10']);
 expect(plannedDepartures('campus-to-diamond-hill','2026-10-05T20:00:00+08:00',now).upcoming[0].local_time).toBe('22:15');
});
it('handles Hong Kong dates, public holidays, Sundays, Saturday and term boundary',()=>{
 expect(plannedDepartures('hang-hau-to-campus','2026-10-18T23:30:00Z',now)).toMatchObject({service_date:'2026-10-19',status:'public_holiday',upcoming:[]});
 expect(plannedDepartures('hang-hau-to-campus','2026-10-04T08:00:00+08:00',now).status).toBe('public_holiday');
 expect(plannedDepartures('hang-hau-to-campus','2026-10-03T08:00:00+08:00',now).status).toBe('non_operating_day');
 expect(plannedDepartures('hang-hau-to-campus','2026-12-18T08:00:00+08:00',now).status).toBe('scheduled');
 expect(plannedDepartures('hang-hau-to-campus','2026-12-19T08:00:00+08:00',now).status).toBe('outside_service_period');
});
it('suppresses upcoming departures for stale or unverified holiday coverage while retaining labeled timetable',()=>{
 const result=plannedDepartures('hang-hau-to-campus','2026-10-05T08:00:00+08:00',Date.parse(shuttleData.refresh_due_at));expect(result).toMatchObject({status:'stale',upcoming:[]});expect(result.timetable).toHaveLength(3);
 expect(plannedDepartures('hang-hau-to-campus','2028-10-05T08:00:00+08:00',now).status).toBe('holiday_coverage_unknown');
 expect(()=>plannedDepartures('missing','2026-10-05T00:00:00Z',now)).toThrow(/catalog/);
 expect(departureQuery.safeParse({at:'2026-02-30T08:00:00Z'}).success).toBe(false);
});
it('retains all reviewed direction and lunch boarding entries with explicit unknown fare',()=>{
 expect(shuttleData.routes).toHaveLength(24);expect(new Set(shuttleData.routes.map(r=>r.id)).size).toBe(24);
 expect(shuttleData.holidays.filter(h=>h.date.startsWith('2026'))).toHaveLength(17);
 expect(shuttleData.routes.find(r=>r.id==='north-point-to-campus')).toMatchObject({departures:['08:25'],fare_minor:1400});
 expect(shuttleData.routes.filter(r=>r.fare_minor===null)).toHaveLength(3);
});
it('serves reviewed schedules to visitors and rejects unknown routes or invalid timestamps',async()=>{
 const {mkdtempSync,rmSync}=await import('node:fs'),{tmpdir}=await import('node:os'),{join}=await import('node:path');
 const {createProductApp}=await import('../src/product/app.js');const dir=mkdtempSync(join(tmpdir(),'campus-shuttle-'));
 const app=createProductApp({dataDir:dir,now:()=>now});
 try {
   const catalog=await app.inject({url:'/api/v1/transport/routes'});expect(catalog.statusCode).toBe(200);expect(catalog.json().data.routes).toHaveLength(24);
   const query=await app.inject({url:'/api/v1/transport/routes/hang-hau-to-campus/departures?at=2026-10-05T08%3A39%3A00%2B08%3A00'});expect(query.statusCode).toBe(200);expect(query.json().data.upcoming.map((d:any)=>d.local_time)).toEqual(['08:40']);
   expect((await app.inject({url:'/api/v1/transport/routes/unknown/departures'})).statusCode).toBe(404);
   expect((await app.inject({url:'/api/v1/transport/routes/hang-hau-to-campus/departures?at=2026-02-30T00:00:00Z'})).statusCode).toBe(400);
 }finally{await app.close();rmSync(dir,{recursive:true,force:true});}
});

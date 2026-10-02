import {expect,it} from 'vitest';
import {createPublicTransit} from '../src/product/campus/public-transit.js';
const instant=Date.parse('2026-10-03T08:00:00+08:00');
const stamp=(time=instant)=>new Date(time).toISOString();
// Synthetic fixtures exercise the documented schemas; these are not live service claims.
function fixture() {
 let clock=instant,fail='',age=0,gmbEnabled=true,gmbStop=20012474;
 let kmbRows:any[]=[eta()];let gmbRows:any[]=[{eta_seq:1,diff:5,timestamp:stamp(instant+300000),remarks_sc:'未开出',remarks_en:'Scheduled'}];
 const calls:string[]=[];
 const envelope=(type:string,data:unknown)=>({type,version:'1.0',generated_timestamp:stamp(clock-age),data});
 const fake=async(input:string|URL|Request)=>{
  const url=String(input);calls.push(url);if(fail&&url.includes(fail))throw new Error('offline');
  const path=new URL(url).pathname;
  let body:unknown;
  if(path==='/v1/transport/kmb/route/')body=envelope('RouteList',[
   {route:'91M',bound:'O',service_type:'1',orig_en:'Po Lam',orig_sc:'宝琳',dest_en:'Diamond Hill',dest_sc:'钻石山'},
   {route:'91M',bound:'I',service_type:'2',orig_en:'HKUST North',orig_sc:'科大北',dest_en:'Po Lam',dest_sc:'宝琳'},
   {route:'999',bound:'O',service_type:'1',orig_en:'Other',orig_sc:'其他',dest_en:'Other',dest_sc:'其他'}]);
  else if(path==='/v1/transport/kmb/stop')body=envelope('StopList',[{stop:'B002CEF0DBC568F5',name_en:'HKUST South',name_sc:'科大南',lat:'22.3',long:'114.2'}]);
  else if(path.includes('/kmb/route-stop/'))body=envelope('RouteStop',[{route:'91M',bound:'O',service_type:'1',seq:'13',stop:'B002CEF0DBC568F5'},{route:'91M',bound:'O',service_type:'1',seq:'20',stop:'B002CEF0DBC568F5'}]);
  else if(path.includes('/kmb/eta/'))body=envelope('ETA',kmbRows);
  else if(path.startsWith('/route/NT/')){
   const code=path.split('/').at(-1);body=envelope('Route',code==='11M'?[{route_id:2004825,region:'NT',route_code:'11M',description_sc:'正常班次',description_en:'Normal Route',directions:[{route_seq:2,orig_sc:'科大北',orig_en:'HKUST North',dest_sc:'坑口站',dest_en:'Hang Hau',remarks_sc:null,remarks_en:null}]}]:[]);
  }else if(path==='/route-stop/2004825/2')body=envelope('Route-Stop',{route_stops:[{stop_seq:1,stop_id:20012474,name_sc:'科大北',name_en:'HKUST North'}],data_timestamp:stamp(instant-86400000)});
  else if(path==='/eta/route-stop/2004825/2/1')body=envelope('ETA-Route-Stop',gmbEnabled?{enabled:true,stop_id:gmbStop,eta:gmbRows}:{enabled:false,stop_id:gmbStop,description_sc:'暂停预报',description_en:'Prediction suspended'});
  else throw new Error(`Unexpected fixture URL ${url}`);
  return new Response(JSON.stringify(body),{headers:{'Content-Type':'application/json'}});
 };
 const service=createPublicTransit({now:()=>clock,fetch:fake as typeof fetch});
 return {service,calls,fetch:fake as typeof fetch,now:()=>clock,setClock:(n:number)=>clock=n,setAge:(n:number)=>age=n,setFail:(v:string)=>fail=v,setKmb:(rows:any[])=>kmbRows=rows,setGmb:(rows:any[])=>gmbRows=rows,setEnabled:(v:boolean)=>gmbEnabled=v,setStop:(v:number)=>gmbStop=v};
}
function eta(overrides:Record<string,unknown>={}){return {co:'KMB',route:'91M',dir:'O',service_type:1,seq:13,eta_seq:1,eta:stamp(instant+180000),rmk_sc:'',rmk_en:'',data_timestamp:stamp(),...overrides};}
it('discovers variants only within coverage and preserves repeated stop occurrences',async()=>{
 const f=fixture(),catalog=await f.service.catalog();expect(catalog.routes.map(r=>r.id)).toEqual(['kmb:91M:O:1','kmb:91M:I:2','gmb:NT:11M:2004825:2']);
 const stops=await f.service.stops('kmb:91M:O:1');expect(stops.status).toBe('available');expect(stops.stops.map(s=>s.sequence)).toEqual([13,20]);expect(stops.stops[0].id).toBe(stops.stops[1].id);
 expect(f.calls.every(u=>u.startsWith('https://data.etabus.gov.hk/')||u.startsWith('https://data.etagmb.gov.hk/'))).toBe(true);
});
it('filters KMB direction, service type, stop occurrence and operator before showing predictions',async()=>{
 const f=fixture();f.setKmb([eta({dir:'I'}),eta({service_type:2}),eta({seq:20}),eta({route:'91'}),eta({co:'OTHER'}),eta()]);
 const result=await f.service.arrivals('kmb:91M:O:1',13);expect(result.status).toBe('available');expect(result.arrivals).toHaveLength(1);expect(result.arrivals[0].at).toBe(stamp(instant+180000));
 expect(result.stop?.sequence).toBe(13);expect(result.expires_at).toBe(stamp(instant+180000));
});
it('maps GMB route ID, direction and stop sequence and retains scheduled remarks',async()=>{
 const f=fixture(),result=await f.service.arrivals('gmb:NT:11M:2004825:2',1);
 expect(result.status).toBe('available');expect(result.arrivals[0].remark.en).toBe('Scheduled');expect(f.calls).toContain('https://data.etagmb.gov.hk/eta/route-stop/2004825/2/1');
});
it('reports empty/null/past predictions without claiming cancelled service',async()=>{
 const f=fixture();f.setKmb([eta({eta:null,rmk_sc:'查询服务时间',rmk_en:'Check service hours'})]);
 const kmb=await f.service.arrivals('kmb:91M:O:1',13);expect(kmb).toMatchObject({status:'no_predictions',arrivals:[]});expect(kmb.messages[0].en).toBe('Check service hours');
 f.setGmb([]);expect(await f.service.arrivals('gmb:NT:11M:2004825:2',1)).toMatchObject({status:'no_predictions',arrivals:[]});
 f.setClock(instant+20000);f.setKmb([eta({eta:stamp(instant-1000)})]);expect((await f.service.arrivals('kmb:91M:O:1',13)).status).toBe('no_predictions');
});
it('distinguishes disabled prediction service from an empty list and rejects mismatched stop IDs',async()=>{
 const f=fixture();f.setEnabled(false);expect(await f.service.arrivals('gmb:NT:11M:2004825:2',1)).toMatchObject({status:'disabled',messages:[{zh:'暂停预报',en:'Prediction suspended'}],arrivals:[]});
 f.setClock(instant+20000);f.setStop(123);expect((await f.service.arrivals('gmb:NT:11M:2004825:2',1)).status).toBe('unavailable');
});
it('hides stale row timestamps, stale envelopes and future source timestamps',async()=>{
 const f=fixture();f.setKmb([eta({data_timestamp:stamp(instant-180001)})]);expect(await f.service.arrivals('kmb:91M:O:1',13)).toMatchObject({status:'stale',arrivals:[]});
 f.setAge(180001);expect((await f.service.arrivals('gmb:NT:11M:2004825:2',1)).status).toBe('stale');
 f.setClock(instant+20000);f.setAge(-60001);expect((await f.service.arrivals('gmb:NT:11M:2004825:2',1)).status).toBe('stale');
});
it('does not reuse successful predictions after a failed refresh; caches and coalesces requests',async()=>{
 const f=fixture();await Promise.all([f.service.arrivals('kmb:91M:O:1',13),f.service.arrivals('kmb:91M:O:1',13)]);
 expect(f.calls.filter(u=>u.includes('/kmb/eta/'))).toHaveLength(1);
 f.setClock(instant+20000);f.setFail('/kmb/eta/');expect(await f.service.arrivals('kmb:91M:O:1',13)).toMatchObject({status:'unavailable',arrivals:[]});
});
it('reports partial catalog failures, excludes expired metadata and guards unknown routes/stops',async()=>{
 const f=fixture();f.setFail('/route/NT/11B');const c=await f.service.catalog();expect(c.issues).toContainEqual({operator:'gmb',route_code:'11B',reason:'unavailable'});expect(c.routes.length).toBe(3);
 await expect(f.service.stops('kmb:999:O:1')).rejects.toMatchObject({status:404});
 await expect(f.service.arrivals('kmb:91M:O:1',299)).rejects.toMatchObject({status:404});
 f.setClock(instant+86400001);f.setAge(86400001);expect((await f.service.catalog()).routes).toEqual([]);
});
it('refuses malformed schemas and oversized responses instead of returning fake empty service',async()=>{
 for(const body of [{data:[]},'x'.repeat(5_000_001)]){
  const service=createPublicTransit({now:()=>instant,fetch:(async()=>new Response(typeof body==='string'?body:JSON.stringify(body))) as typeof fetch});
  const c=await service.catalog();expect(c.routes).toEqual([]);expect(c.issues.length).toBe(7);
 }
});
it('serves visitors through real HTTP routes and rejects invalid stop sequence or unknown route',async()=>{
 const {createProductApp}=await import('../src/product/app.js'),{mkdtempSync,rmSync}=await import('node:fs'),{tmpdir}=await import('node:os'),{join}=await import('node:path');
 const dir=mkdtempSync(join(tmpdir(),'campus-transit-')),f=fixture(),app=createProductApp({dataDir:dir,now:f.now,transitFetch:f.fetch});
 try {
  expect((await app.inject({url:'/api/v1/transport/public/routes'})).json().data.routes).toHaveLength(3);
  expect((await app.inject({url:'/api/v1/transport/public/routes/kmb%3A91M%3AO%3A1/stops'})).json().data.stops).toHaveLength(2);
  expect((await app.inject({url:'/api/v1/transport/public/routes/kmb%3A91M%3AO%3A1/arrivals?stop_sequence=13'})).json().data.status).toBe('available');
  expect((await app.inject({url:'/api/v1/transport/public/routes/kmb%3A91M%3AO%3A1/arrivals?stop_sequence=0'})).statusCode).toBe(400);
  expect((await app.inject({url:'/api/v1/transport/public/routes/kmb%3A999%3AO%3A1/stops'})).statusCode).toBe(404);
 }finally{await app.close();rmSync(dir,{recursive:true,force:true});}
});
it('native presentation expires predictions while offline and removes passed arrival times',async()=>{
 const {visibleTransitArrivals}=await import('../apps/mobile/src/campus/transit-state');
 const f=fixture(),value=await f.service.arrivals('gmb:NT:11M:2004825:2',1);
 expect(visibleTransitArrivals(value,instant+180000)).toMatchObject({status:'stale',arrivals:[],messages:[]});
 expect(visibleTransitArrivals({...value,arrivals:[{at:stamp(instant+1000),remark:{zh:'',en:''}}]},instant+1001)).toMatchObject({status:'no_predictions',arrivals:[]});
});
it('turns HTTP failures and route-stop schema mismatch into unavailable, not empty success',async()=>{
 const bad=createPublicTransit({now:()=>instant,fetch:(async()=>new Response('{}',{status:503})) as typeof fetch});
 expect((await bad.catalog()).issues).toHaveLength(7);
 const f=fixture();expect(await f.service.stops('kmb:91M:I:2')).toMatchObject({status:'unavailable',stops:[]});
});
it('shows when configured route codes are absent from an otherwise valid provider catalog',async()=>{
 const catalog=await fixture().service.catalog();
 expect(catalog.issues).toContainEqual({operator:'gmb',route_code:'12',reason:'not_listed'});
 expect(catalog.issues).toContainEqual({operator:'kmb',route_code:'291P',reason:'not_listed'});
});

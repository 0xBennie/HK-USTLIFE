import {z} from 'zod';
import {ApiError} from '../errors.js';
import type {PublicRoute,PublicStop,TransitName,TransitSource,TransitCatalog,TransitStops,TransitArrivals,CampusDeparture,CampusDepartures,CampusGate} from './public-transit-types.js';
const KMB='https://data.etabus.gov.hk/v1/transport/kmb',GMB='https://data.etagmb.gov.hk';
const KMB_CODES=['91','91M','91B','91P','291P'],GMB_CODES=['11','11B','11S','104','11M','12'];
const DAY=86400000,ETA_AGE=180000,CLOCK_SKEW=60000;
const str=z.string().max(1000),id=z.string().regex(/^[A-Z0-9]{1,30}$/),numeric=z.string().regex(/^\d{1,4}$/),integer=z.number().int().positive().max(999999999);
const timestamp=z.string().datetime({offset:true}).refine(v=>Number.isFinite(Date.parse(v)));
const nullableText=str.nullish();
const names={orig_sc:str,orig_en:str,dest_sc:str,dest_en:str};
const kmbRoutes=z.array(z.object({route:id,bound:z.enum(['O','I']),service_type:numeric,...names})).max(5000);
const gmbRoutes=z.array(z.object({route_id:integer,region:z.literal('NT'),route_code:id,description_sc:str,description_en:str,directions:z.array(z.object({route_seq:z.union([z.literal(1),z.literal(2)]),...names,remarks_sc:nullableText,remarks_en:nullableText})).max(2)})).max(30);
const coord=z.union([z.string(),z.number()]).transform(Number).pipe(z.number().finite()).optional();
const kmbStops=z.array(z.object({stop:id,name_sc:str,name_en:str,lat:coord,long:coord})).max(20000);
const kmbRouteStops=z.array(z.object({route:id,bound:z.enum(['O','I']),service_type:numeric,seq:numeric,stop:id})).max(300);
const gmbRouteStops=z.object({route_stops:z.array(z.object({stop_seq:integer,stop_id:integer,name_sc:str,name_en:str})).max(300)});
const kmbEtas=z.array(z.object({co:str,route:id,dir:z.enum(['O','I']),service_type:integer,seq:integer,eta:timestamp.nullable(),eta_seq:integer,rmk_sc:nullableText,rmk_en:nullableText,data_timestamp:timestamp})).max(100);
const gmbEtas=z.discriminatedUnion('enabled',[
 z.object({enabled:z.literal(true),stop_id:integer,eta:z.array(z.object({eta_seq:integer,timestamp,remarks_sc:nullableText,remarks_en:nullableText})).max(20)}),
 z.object({enabled:z.literal(false),stop_id:integer,description_sc:nullableText,description_en:nullableText})
]);
const envelope=z.object({type:str,version:z.literal('1.0'),generated_timestamp:timestamp,data:z.unknown()});
type Envelope=z.infer<typeof envelope> & {retrieved_at:string;url:string};
class StaleSource extends Error {}
const name=(zh:string|null|undefined,en:string|null|undefined):TransitName=>({zh:zh??'',en:en??''});
const emptyName=name('','');

export function createPublicTransit(options:{now?:()=>number;fetch?:typeof fetch}={}) {
 const now=options.now??Date.now,fetcher=options.fetch??fetch;
 type Cache={until:number;value?:Envelope;error?:Error};
 const cache=new Map<string,Cache>(),pending=new Map<string,Promise<Envelope>>();
 const iso=()=>new Date(now()).toISOString();
 const isFresh=(stamp:string,age:number)=>{const delta=now()-Date.parse(stamp);return delta>=-CLOCK_SKEW&&delta<age;};
 function source(e:Envelope,age:number):TransitSource {
  if(!isFresh(e.generated_timestamp,age))throw new StaleSource('Source timestamp expired');
  return {url:e.url,retrieved_at:e.retrieved_at,generated_at:e.generated_timestamp,expires_at:new Date(Date.parse(e.generated_timestamp)+age).toISOString()};
 }
 async function load(url:string,ttl:number):Promise<Envelope> {
  const cached=cache.get(url);
  if(cached&&cached.until>now()){if(cached.error)throw cached.error;return cached.value!;}
  if(pending.has(url))return pending.get(url)!;
  if(pending.size>=32)throw new Error('Upstream query capacity reached');
  const operation=Promise.resolve().then(async()=>{
   try {
    // All URLs originate from closed operator templates and validated IDs, never user URLs.
    const response=await fetcher(url,{signal:AbortSignal.timeout(8000),redirect:'error',headers:{Accept:'application/json'}});
    if(!response.ok||!response.body)throw new Error('Operator unavailable');
    if(Number(response.headers.get('content-length'))>5_000_000){await response.body.cancel();throw new Error('Operator response too large');}
    const reader=response.body.getReader(),parts:Uint8Array[]=[];let length=0;
    try {for(;;){const chunk=await reader.read();if(chunk.done)break;length+=chunk.value.length;if(length>5_000_000)throw new Error('Operator response too large');parts.push(chunk.value);}}
    finally {await reader.cancel().catch(()=>{});reader.releaseLock();}
    const bytes=new Uint8Array(length);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length;}
    const value={...envelope.parse(JSON.parse(new TextDecoder().decode(bytes))),retrieved_at:iso(),url};
    cache.set(url,{value,until:now()+ttl});return value;
   }catch(e){const error=e instanceof Error?e:new Error('Operator unavailable');cache.set(url,{error,until:now()+10000});throw error;}
   finally{pending.delete(url);while(cache.size>256)cache.delete(cache.keys().next().value!);}
  });
  pending.set(url,operation);return operation;
 }
 function typed(e:Envelope,type:string){if(e.type!==type)throw new Error('Unexpected operator schema');return e;}
 async function routesFor(operator:'kmb'|'gmb',code?:string):Promise<PublicRoute[]> {
  const e=typed(await load(operator==='kmb'?`${KMB}/route/`:`${GMB}/route/NT/${code}`,DAY),operator==='kmb'?'RouteList':'Route');
  const provenance=source(e,DAY);
  if(operator==='kmb')return kmbRoutes.parse(e.data).filter(r=>KMB_CODES.includes(r.route)).map(r=>({id:`kmb:${r.route}:${r.bound}:${r.service_type}`,operator,code:r.route,direction:r.bound,service_type:r.service_type,origin:name(r.orig_sc,r.orig_en),destination:name(r.dest_sc,r.dest_en),description:name(`服务类型 ${r.service_type}`,`Service type ${r.service_type}`),remark:emptyName,source:provenance}));
  return gmbRoutes.parse(e.data).flatMap(r=>{
   if(r.route_code!==code)throw new Error('Mismatched route code');
   return r.directions.map(d=>({id:`gmb:NT:${code}:${r.route_id}:${d.route_seq}`,operator,code:code!,direction:String(d.route_seq),service_type:String(r.route_id),origin:name(d.orig_sc,d.orig_en),destination:name(d.dest_sc,d.dest_en),description:name(r.description_sc,r.description_en),remark:name(d.remarks_sc,d.remarks_en),source:provenance}));
  });
 }
 async function catalog():Promise<TransitCatalog> {
  const requests:[operator:'kmb'|'gmb',code?:string][]=[['kmb'],...GMB_CODES.map(code=>['gmb',code] as ['gmb',string])];
  const results=await Promise.allSettled(requests.map(([op,code])=>routesFor(op,code)));
  const routes:PublicRoute[]=[],issues:TransitCatalog['issues']=[];
  results.forEach((result,i)=>{
   const [operator,code]=requests[i];
   if(result.status==='fulfilled'){
    routes.push(...result.value);
    for(const expected of code?[code]:KMB_CODES)if(!result.value.some(r=>r.code===expected))issues.push({operator,route_code:expected,reason:'not_listed'});
   }else issues.push({operator,route_code:code??KMB_CODES.join('/'),reason:result.reason instanceof StaleSource?'stale':'unavailable'});
  });
  return {routes,issues,generated_at:iso()};
 }
 async function resolveRoute(routeId:string):Promise<PublicRoute> {
  const k=/^kmb:([A-Z0-9]+):([OI]):(\d{1,4})$/.exec(routeId),g=/^gmb:NT:([A-Z0-9]+):(\d{1,9}):([12])$/.exec(routeId);
  if((!k||!KMB_CODES.includes(k[1]))&&(!g||!GMB_CODES.includes(g[1])))throw new ApiError(404,'ROUTE_NOT_FOUND','Route is outside the supported catalog.');
  const routes=await routesFor(k?'kmb':'gmb',g?.[1]),route=routes.find(r=>r.id===routeId);
  if(!route)throw new ApiError(404,'ROUTE_NOT_FOUND','Route variant is not in the current operator catalog.');
  return route;
 }
 async function stops(routeId:string):Promise<TransitStops> {
  let route:PublicRoute|null=null;
  try {
   route=await resolveRoute(routeId);let stops:PublicStop[],sources:TransitSource[]=[route.source];
   if(route.operator==='kmb'){
    const [list,lookup]=await Promise.all([load(`${KMB}/route-stop/${route.code}/${route.direction==='O'?'outbound':'inbound'}/${route.service_type}`,DAY),load(`${KMB}/stop`,DAY)]);
    typed(list,'RouteStop');typed(lookup,'StopList');sources.push(source(list,DAY),source(lookup,DAY));
    const names=new Map(kmbStops.parse(lookup.data).map(s=>[s.stop,s]));
    stops=kmbRouteStops.parse(list.data).map(s=>{
     if(s.route!==route!.code||s.bound!==route!.direction||s.service_type!==route!.service_type||Number(s.seq)<1)throw new Error('Mismatched route-stop mapping');
     const n=names.get(s.stop);if(!n)throw new Error('Stop missing from operator catalog');return {id:s.stop,sequence:Number(s.seq),name:name(n.name_sc,n.name_en),...(n.lat!==undefined&&n.long!==undefined?{lat:n.lat,lng:n.long}:{})};
    });
   }else{
    const e=typed(await load(`${GMB}/route-stop/${route.service_type}/${route.direction}`,DAY),'Route-Stop');sources.push(source(e,DAY));
    stops=gmbRouteStops.parse(e.data).route_stops.map(s=>({id:String(s.stop_id),sequence:s.stop_seq,name:name(s.name_sc,s.name_en)}));
   }
   if(new Set(stops.map(s=>s.sequence)).size!==stops.length)throw new Error('Ambiguous stop sequence');
   return {route,stops:stops.sort((a,b)=>a.sequence-b.sequence),sources,status:'available',generated_at:iso()};
  }catch(e){if(e instanceof ApiError)throw e;return {route,stops:[],sources:[],status:e instanceof StaleSource?'stale':'unavailable',generated_at:iso()};}
 }
 async function arrivals(routeId:string,sequence:number):Promise<TransitArrivals> {
  if(!Number.isInteger(sequence)||sequence<1||sequence>300)throw new ApiError(400,'INVALID_STOP','Invalid stop sequence.');
  const result:TransitArrivals={route_id:routeId,stop_sequence:sequence,stop:null,status:'unavailable',arrivals:[],messages:[],source:null,expires_at:null,generated_at:iso()};
  const mapping=await stops(routeId);if(mapping.status!=='available')return {...result,status:mapping.status};
  const stop=mapping.stops.find(s=>s.sequence===sequence),route=mapping.route!;
  if(!stop)throw new ApiError(404,'STOP_NOT_FOUND','Stop sequence is not on this route variant.');
  result.stop=stop;
  try {
   const e=await load(route.operator==='kmb'?`${KMB}/eta/${stop.id}/${route.code}/${route.service_type}`:`${GMB}/eta/route-stop/${route.service_type}/${route.direction}/${sequence}`,15000);
   typed(e,route.operator==='kmb'?'ETA':'ETA-Route-Stop');
   result.source=source(e,ETA_AGE);let expiry=Math.min(Date.parse(result.source.expires_at),...mapping.sources.map(s=>Date.parse(s.expires_at)));
   if(route.operator==='kmb'){
    const entries=kmbEtas.parse(e.data).filter(r=>r.co==='KMB'&&r.route===route.code&&r.dir===route.direction&&r.service_type===Number(route.service_type)&&r.seq===sequence);
    for(const r of entries){if(!isFresh(r.data_timestamp,ETA_AGE))throw new StaleSource('Prediction timestamp expired');expiry=Math.min(expiry,Date.parse(r.data_timestamp)+ETA_AGE);}
    for(const r of entries.sort((a,b)=>a.eta_seq-b.eta_seq)){
     const remark=name(r.rmk_sc,r.rmk_en);
     if(r.eta&&Date.parse(r.eta)>=now())result.arrivals.push({at:r.eta,remark});
     else if(remark.zh||remark.en)result.messages.push(remark);
    }
   }else{
    const data=gmbEtas.parse(e.data);if(String(data.stop_id)!==stop.id)throw new Error('Mismatched prediction stop');
    if(!data.enabled){result.status='disabled';result.messages.push(name(data.description_sc,data.description_en));}
    else result.arrivals=data.eta.filter(r=>Date.parse(r.timestamp)>=now()).sort((a,b)=>a.eta_seq-b.eta_seq).map(r=>({at:r.timestamp,remark:name(r.remarks_sc,r.remarks_en)}));
   }
   result.expires_at=new Date(expiry).toISOString();
   if(result.status!=='disabled')result.status=result.arrivals.length?'available':'no_predictions';
   return {...result,generated_at:iso()};
  }catch(e){return {...result,status:e instanceof StaleSource?'stale':'unavailable',arrivals:[],messages:[],expires_at:null,generated_at:iso()};}
 }
 /** Every catalog route variant that departs from an HKUST stop (not ending there), with its next arrivals at that stop. */
 async function campusDepartures():Promise<CampusDepartures> {
  const isCampus=(n:TransitName)=>/科技大[学學]/.test(n.zh)||/SCIENCE|HKUST/i.test(n.en);
  const gateOf=(n:TransitName):CampusGate=>/北|NORTH/i.test(n.zh+n.en)?'north':/南|SOUTH/i.test(n.zh+n.en)?'south':'other';
  const {routes}=await catalog();
  // A few at a time: each route needs its stop list and a prediction, and upstream concurrency is capped.
  const pool=async<T,R>(items:T[],size:number,fn:(t:T)=>Promise<R>)=>{const out:R[]=new Array(items.length);let next=0;await Promise.all(Array.from({length:Math.min(size,items.length)},async()=>{while(next<items.length){const i=next++;out[i]=await fn(items[i]);}}));return out;};
  const rows=await pool(routes,4,async (route):Promise<CampusDeparture|null>=>{
   const mapping=await stops(route.id);
   if(mapping.status!=='available')return null;
   const last=mapping.stops[mapping.stops.length-1];
   const stop=mapping.stops.find(s=>isCampus(s.name)&&s!==last);
   if(!stop)return null;
   const a=await arrivals(route.id,stop.sequence);
   return {route_id:route.id,operator:route.operator,code:route.code,destination:route.destination,description:route.description,gate:gateOf(stop.name),stop,status:a.status,arrivals:a.arrivals.map(x=>x.at),messages:a.messages};
  });
  // KMB service-type variants of one line share the stop and the predictions; keep one row per line, stop and destination.
  const seen=new Set<string>();
  const departures=rows.filter((r):r is CampusDeparture=>r!==null).filter(r=>{const k=`${r.operator}:${r.code}:${r.stop.id}:${r.destination.zh}`;if(seen.has(k))return false;seen.add(k);return true;}).sort((x,y)=>{const a=x.arrivals[0]??'~',b=y.arrivals[0]??'~';return a<b?-1:a>b?1:x.code.localeCompare(y.code);});
  const gates:CampusDepartures['gates']={};
  for(const d of departures)if(d.gate!=='other'&&!gates[d.gate]&&d.stop.lat!==undefined&&d.stop.lng!==undefined)gates[d.gate]={name:d.stop.name,lat:d.stop.lat,lng:d.stop.lng};
  return {departures,gates,generated_at:iso()};
 }
 return {catalog,stops,arrivals,campusDepartures};
}

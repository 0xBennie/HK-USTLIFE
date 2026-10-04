import {api} from '../runtime';
import type {TransitArrivals,TransitName,TransitStops} from '../../../../src/product/campus/public-transit-types';

// Public routes that leave HKUST toward each shuttle destination (operator catalog IDs from /transport/public/routes,
// checked against KMB/GMB on 2026-10-04). Boarding stop and destination labels always come from the operator data.
const alternatives:Record<string,{id:string;code:string;operator:'kmb'|'gmb'}[]>={
 'hang-hau':[{id:'gmb:NT:11M:2004825:2',code:'11M',operator:'gmb'},{id:'kmb:91M:I:2',code:'91M',operator:'kmb'}],
 'tseung-kwan-o':[{id:'kmb:91M:I:2',code:'91M',operator:'kmb'},{id:'gmb:NT:11M:2004825:2',code:'11M',operator:'gmb'}],
 'diamond-hill':[{id:'kmb:91M:O:1',code:'91M',operator:'kmb'},{id:'gmb:NT:11B:2004827:1',code:'11B',operator:'gmb'}],
 'kowloon-tong':[{id:'gmb:NT:11B:2004827:1',code:'11B',operator:'gmb'},{id:'kmb:91P:I:1',code:'91P',operator:'kmb'}],
 'mong-kok':[{id:'kmb:291P:O:1',code:'291P',operator:'kmb'}],
};
export type LiveOption={id:string;code:string;operator:'kmb'|'gmb';gate:TransitName;minutes:number|null;message:TransitName|null};
const isCampusStop=(name:TransitName)=>/科技大[学學]|科大/.test(name.zh)||/SCIENCE|HKUST/i.test(name.en);
/** "香港科技大学(南) (SK950)" → 科大南 → 钻石山站; the interchange suffix is dropped from the destination. */
function gateLabel(stop:TransitName,destination:TransitName):TransitName{
 const zhSide=/\((北站|南站|北|南)\)/.exec(stop.zh)?.[1]??'',enSide=/\((NORTH|SOUTH)\)/i.exec(stop.en)?.[1]??'';
 const zhDest=destination.zh.replace(/公共运输交汇处|公共運輸交匯處/,'').trim(),enDest=destination.en.replace(/\s*PUBLIC TRANSPORT INTERCHANGE/i,'').trim();
 return {zh:`科大${zhSide} → ${zhDest}`,en:`HKUST${enSide?' '+enSide[0]+enSide.slice(1).toLowerCase():''} → ${enDest}`};
}
export async function liveAlternatives(destinationKey:string,signal:{cancelled:boolean}):Promise<LiveOption[]>{
 const list=alternatives[destinationKey]??[];
 const results=await Promise.all(list.map(async (alt):Promise<LiveOption|null>=>{
  try{
   const path=`/transport/public/routes/${encodeURIComponent(alt.id)}`;
   const stops=await api.request<TransitStops>(`${path}/stops`);
   const stop=stops.status==='available'?stops.stops.find(s=>isCampusStop(s.name)):undefined;
   if(!stop||!stops.route||signal.cancelled)return null;
   const arr=await api.request<TransitArrivals>(`${path}/arrivals?stop_sequence=${stop.sequence}`);
   const next=arr.status==='available'?arr.arrivals.map(a=>Date.parse(a.at)).filter(t=>t>=Date.now()).sort((a,b)=>a-b)[0]:undefined;
   const message=arr.messages.find(m=>m.zh||m.en)??null;
   return {...alt,gate:gateLabel(stop.name,stops.route.destination),minutes:next===undefined?null:Math.max(0,Math.round((next-Date.now())/60000)),message};
  }catch{return null;}
 }));
 return results.filter((r):r is LiveOption=>r!==null);
}

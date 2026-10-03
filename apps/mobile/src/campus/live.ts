import {api} from '../runtime';
import type {TransitArrivals,TransitStops} from '../../../../src/product/campus/public-transit-types';

// Public routes that leave HKUST toward each shuttle destination (operator catalog IDs from /transport/public/routes).
const alternatives:Record<string,{id:string;code:string;operator:'kmb'|'gmb';gate:{zh:string;en:string}}[]>={
 'hang-hau':[{id:'gmb:NT:11M:2004825:2',code:'11M',operator:'gmb',gate:{zh:'北闸 → 坑口站',en:'North gate → Hang Hau'}},{id:'kmb:91M:I:2',code:'91M',operator:'kmb',gate:{zh:'北闸 → 宝林',en:'North gate → Po Lam'}}],
 'tseung-kwan-o':[{id:'kmb:91M:I:2',code:'91M',operator:'kmb',gate:{zh:'北闸 → 宝林',en:'North gate → Po Lam'}},{id:'gmb:NT:11M:2004825:2',code:'11M',operator:'gmb',gate:{zh:'北闸 → 坑口站',en:'North gate → Hang Hau'}}],
 'diamond-hill':[{id:'kmb:91M:O:1',code:'91M',operator:'kmb',gate:{zh:'北闸 → 钻石山站',en:'North gate → Diamond Hill'}},{id:'gmb:NT:11B:2004827:1',code:'11B',operator:'gmb',gate:{zh:'北站 → 彩虹站',en:'North → Choi Hung'}}],
 'kowloon-tong':[{id:'gmb:NT:11B:2004827:1',code:'11B',operator:'gmb',gate:{zh:'北站 → 彩虹站',en:'North → Choi Hung'}},{id:'kmb:91P:I:1',code:'91P',operator:'kmb',gate:{zh:'南闸 → 彩虹站',en:'South gate → Choi Hung'}}],
 'mong-kok':[{id:'kmb:291P:O:1',code:'291P',operator:'kmb',gate:{zh:'南闸 → 旺角',en:'South gate → Mong Kok'}}],
};
export type LiveOption={id:string;code:string;operator:'kmb'|'gmb';gate:{zh:string;en:string};minutes:number|null};
const isCampusStop=(name:{zh:string;en:string})=>/科技大[学學]|科大/.test(name.zh)||/SCIENCE|HKUST/i.test(name.en);
export async function liveAlternatives(destinationKey:string,signal:{cancelled:boolean}):Promise<LiveOption[]>{
 const list=alternatives[destinationKey]??[];
 const results=await Promise.all(list.map(async (alt):Promise<LiveOption|null>=>{
  try{
   const path=`/transport/public/routes/${encodeURIComponent(alt.id)}`;
   const stops=await api.request<TransitStops>(`${path}/stops`);
   const stop=stops.status==='available'?stops.stops.find(s=>isCampusStop(s.name)):undefined;
   if(!stop||signal.cancelled)return null;
   const arr=await api.request<TransitArrivals>(`${path}/arrivals?stop_sequence=${stop.sequence}`);
   const next=arr.status==='available'?arr.arrivals.map(a=>Date.parse(a.at)).filter(t=>t>=Date.now()).sort((a,b)=>a-b)[0]:undefined;
   return {...alt,minutes:next===undefined?null:Math.max(0,Math.round((next-Date.now())/60000))};
  }catch{return null;}
 }));
 return results.filter((r):r is LiveOption=>r!==null);
}

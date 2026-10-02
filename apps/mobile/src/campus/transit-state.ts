import type {TransitArrivals} from '../../../../src/product/campus/public-transit-types';
// The screen also expires predictions locally while offline/backgrounded.
export function visibleTransitArrivals(result:TransitArrivals|null,now:number):TransitArrivals|null {
 if(!result)return null;
 if(result.expires_at&&Date.parse(result.expires_at)<=now)return {...result,status:'stale',arrivals:[],messages:[]};
 const arrivals=result.arrivals.filter(a=>Date.parse(a.at)>=now);
 return {...result,arrivals,status:result.status==='available'&&!arrivals.length?'no_predictions':result.status};
}

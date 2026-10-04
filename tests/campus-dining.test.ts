import {expect,it} from 'vitest';
import {dining,outletStatus,parseLine} from '../src/product/campus/dining.js';
const at=(s:string)=>Date.parse(s+'+08:00');
it('parses the CSO line formats',()=>{
 expect([...parseLine('Saturday , Sunday & PH: 08:00 - 19:00')!.days].sort()).toEqual([0,6]);
 expect(parseLine('Saturday , Sunday & PH: 08:00 - 19:00')!.ph).toBe(true);
 expect(parseLine('Sunday - Saturday & PH 07:30 - 21:00 (Last Order: 20:45)')!.days.size).toBe(7);
 expect(parseLine('Sunday & PH - Closed')).toMatchObject({closed:true,ph:true});
 expect(parseLine('Sunday - Saturday 12:00 noon - 21:00')).toMatchObject({open:720,close:1260});
});
it('computes open/closed for weekdays, weekends, holidays and past midnight',()=>{
 const pacific=['Monday - Friday 08:00 - 18:30','Saturday 08:00 - 17:00','Sunday & PH - Closed'];
 expect(outletStatus(pacific,at('2026-10-05T12:00:00'))).toMatchObject({state:'open',closes_at:'18:30'});
 expect(outletStatus(pacific,at('2026-10-05T07:00:00'))).toMatchObject({state:'closed',opens_at:'08:00'});
 expect(outletStatus(pacific,at('2026-10-04T12:00:00')).state).toBe('closed');
 expect(outletStatus(pacific,at('2026-10-19T12:00:00')).state).toBe('closed'); // Chung Yeung holiday (Monday)
 const seafront=['Sunday - Friday 17:00 - 00:30 (Last Order: 00:15)','Saturday & PH - Closed'];
 expect(outletStatus(seafront,at('2026-10-05T00:20:00'))).toMatchObject({state:'open',closes_at:'00:30'});
 expect(outletStatus(seafront,at('2026-10-05T18:00:00'))).toMatchObject({state:'open',closes_at:'00:30'});
});
it('refuses to guess on malformed or overlapping official lines',()=>{
 expect(outletStatus(['Sunday - Saturday 16:00 - 11:00 (Last Order: 22:30)'],at('2026-10-05T20:00:00')).state).toBe('unknown');
 expect(outletStatus(['Monday - Friday 08:00 - 20:00','Sunday - Saturday 08:30 - 19:00'],at('2026-10-05T12:00:00')).state).toBe('unknown');
 expect(dining(at('2026-10-05T12:00:00')).outlets.length).toBeGreaterThan(20);
});

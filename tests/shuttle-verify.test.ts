import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {shuttleData} from '../src/product/campus/shuttle-data.js';
import {verifyShuttlePage,verifyHolidays} from '../src/product/campus/shuttle-verify.js';
import type {ShuttleCatalog} from '../src/product/campus/shuttle.js';
// Fixture: the live CSO student shuttle page as fetched on 2026-10-05.
const html=readFileSync(new URL('./fixtures-cso-shuttle.html',import.meta.url),'utf8');
const catalog=shuttleData as unknown as ShuttleCatalog;
it('confirms every reviewed route against the official page',()=>{
 expect(verifyShuttlePage(html,catalog)).toMatchObject({ok:true,failed:[]});
});
it('refuses to confirm when any route differs from the page',()=>{
 const changed={...catalog,routes:catalog.routes.map(r=>r.id==='campus-to-hang-hau'?{...r,departures:['18:00','18:05','18:15']}:r)};
 expect(verifyShuttlePage(html,changed)).toMatchObject({ok:false,failed:['campus-to-hang-hau']});
});
it('requires every reviewed holiday to still be listed by 1823',()=>{
 const json={vcalendar:[{vevent:catalog.holidays.map(h=>({dtstart:[h.date.replace(/-/g,''),{value:'DATE'}]}))}]};
 expect(verifyHolidays(json,catalog).ok).toBe(true);
 expect(verifyHolidays({vcalendar:[{vevent:[]}]},catalog).ok).toBe(false);
});

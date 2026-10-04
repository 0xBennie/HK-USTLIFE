import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {createEvents,eventTime,parseRss} from '../src/product/campus/events.js';
// Fixture: the live calendar.hkust.edu.hk/events/rss as fetched on 2026-10-05.
const xml=readFileSync(new URL('./fixtures-hkust-events.xml',import.meta.url),'utf8');
it('parses times, dates and venues from the official feed',()=>{
 expect(eventTime('04:30pm - 06:30pm')).toEqual({text:'16:30–18:30',start:'16:30'});
 expect(eventTime('12:00am - 12:00am')).toBeNull();
 const all=parseRss(xml);expect(all.length).toBeGreaterThan(60);
 const blood=all.find(e=>e.title.includes('Blood Donation (6 Oct)'))!;
 expect(blood).toMatchObject({start_date:'2026-10-06',end_date:'2026-10-06',time:'10:00–17:00',venue:'Tsang Shiu Tim Art Hall',on_campus:true});
 expect(all.filter(e=>/how to train your dragon/i.test(e.title)&&e.start_date==='2026-10-08').length).toBeLessThan(3);
});
it('splits upcoming short events from long-running programmes',async()=>{
 const ev=createEvents((async()=>new Response(xml)) as unknown as typeof fetch,()=>Date.parse('2026-10-05T09:00:00+08:00'));
 const r=await ev.list();
 expect(r.upcoming.every(e=>e.end_date>='2026-10-05')).toBe(true);
 expect(r.ongoing.some(e=>e.title.startsWith('Connect Ambassador'))).toBe(true);
 expect(r.upcoming[0].start_date<=r.upcoming[r.upcoming.length-1].start_date).toBe(true);
});

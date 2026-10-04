import {expect,it} from 'vitest';
import {createLibrary,parseHours} from '../src/product/campus/library.js';
// Fixtures copy the shape of the live library endpoints as fetched on 2026-10-05.
const now=Date.parse('2026-10-05T00:40:00+08:00');
const fake=(fail='')=>(async(u:string)=>{const url=String(u);if(fail&&url.includes(fail))throw new Error('offline');
 if(url.includes('gethours'))return new Response(JSON.stringify({status:'OK',data:{hour:[{location_code:'main',location_text:'G/F Entrance',item:[{dates:'5 October 2026',openingHours:'8:00am - 11:00pm'}]},{location_code:'lc',location_text:'Learning Commons',item:[{dates:'5 October 2026',openingHours:'24 Hours'}]}]}}));
 if(url.includes('peoplecount'))return new Response(JSON.stringify([{datetime:'00:00:00',past_count:'191',current_count:'159'},{datetime:'00:15:00',past_count:'180',current_count:'NULL'}]));
 return new Response(JSON.stringify({status:'success',data:{category:'LIBRARY',areas:[{id:'3',area_name:'Group Study Rooms',open_time:'08:00',close_time:'22:30',total:37,booked:'2',available:'37',calendar_link:'https://lbbooking.hkust.edu.hk/calendar/day.php?area=3'},{id:'8',area_name:'LC Study Rooms',open_time:'00:00',close_time:'00:00',total:18,booked:'5',available:'18',calendar_link:'x'},{id:'20',area_name:'Study Pods',open_time:'08:00',close_time:'22:30',total:9,booked:'0',available:'9',calendar_link:'y'}]}}));}) as unknown as typeof fetch;
it('parses published hours',()=>{
 expect(parseHours('8:00am - 11:00pm')).toEqual({open:'08:00',close:'23:00',all_day:false});
 expect(parseHours('24 Hours')).toMatchObject({all_day:true});expect(parseHours('Closed')).toMatchObject({open:null});
});
it('combines hours, latest headcount vs last week and room bookings like the library homepage',async()=>{
 const s=await createLibrary(fake(),()=>now).status();
 expect(s.hours.map(h=>[h.code,h.open_now])).toEqual([['main',false],['lc',true]]);
 expect(s.people).toEqual({now:159,at:'00:00',last_week:191});
 expect(s.rooms).toMatchObject({booked:7,total:55});expect(s.pods).toMatchObject({booked:0,total:9});
});
it('degrades per endpoint when one is down',async()=>{
 const s=await createLibrary(fake('peoplecount'),()=>now).status();expect(s.people).toBeNull();expect(s.hours).toHaveLength(2);
});

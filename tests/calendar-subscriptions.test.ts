import {it,expect,beforeEach,afterEach} from 'vitest';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createProductApp} from '../src/product/app.js';
let dir:string,app:ReturnType<typeof createProductApp>,a:string,title='Group meeting',fetched:string[]=[];
const ics=()=>['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Microsoft//Outlook//EN','BEGIN:VEVENT','UID:evt-1@outlook','DTSTAMP:20261001T000000Z','DTSTART:20261007T060000Z','DTEND:20261007T070000Z','SUMMARY:'+title,'LOCATION:Room 4472','END:VEVENT','END:VCALENDAR',''].join('\r\n');
const OUTLOOK='https://outlook.office365.com/owa/calendar/abc@connect.ust.hk/xyz/calendar.ics';
beforeEach(async()=>{
 title='Group meeting';fetched=[];
 dir=mkdtempSync(join(tmpdir(),'sub-'));app=createProductApp({dataDir:dir,calendarFetch:async input=>{fetched.push(String(input));return new Response(ics(),{status:200,headers:{'content-type':'text/calendar'}});}});
 async function login(email:string){const challenge=(await app.inject({method:'POST',url:'/api/v1/auth/email/challenges',payload:{email}})).json().data;const mail=JSON.parse(readFileSync(join(dir,'mail',challenge.challenge_id+'.json'),'utf8'));return (await app.inject({method:'POST',url:'/api/v1/auth/email/verify',payload:{challenge_id:challenge.challenge_id,code:mail.code}})).json().data.access_token;}
 a=await login('sub-a@example.test');
});
afterEach(async()=>{await app.close();rmSync(dir,{recursive:true,force:true});});
const call=(method:'GET'|'POST'|'DELETE',path:string,body?:object)=>app.inject({method,url:'/api/v1'+path,payload:body,headers:{authorization:'Bearer '+a}});

it('subscribes to a published Outlook calendar and shows its events',async()=>{
 const r=await call('POST','/calendar/subscriptions',{name:'Outlook',url:OUTLOOK.replace('https://','webcal://')});expect(r.statusCode,r.body).toBe(200);
 expect(r.json().data).toMatchObject({name:'Outlook',events:1,imported:1});
 expect(fetched[0]).toBe(OUTLOOK);
 const cal=(await call('GET','/me/calendar?from=2026-10-07&to=2026-10-08&timezone=Asia%2FHong_Kong')).json().data;
 expect(JSON.stringify(cal)).toContain('Group meeting');
 const list=(await call('GET','/calendar/subscriptions')).json().data;expect(list[0]).toMatchObject({name:'Outlook',host:'outlook.office365.com',last_error:null});
 expect(JSON.stringify(list)).not.toContain('xyz');
});

it('refuses hosts outside the calendar allowlist',async()=>{
 for(const url of ['http://outlook.office365.com/a.ics','https://127.0.0.1/a.ics','https://evil.example/a.ics','https://outlook.office365.com:8443/a.ics'])
  expect((await call('POST','/calendar/subscriptions',{name:'x',url})).statusCode).toBe(400);
 expect(fetched).toEqual([]);
});

it('refreshes changes from the source',async()=>{
 await call('POST','/calendar/subscriptions',{name:'Outlook',url:OUTLOOK});
 title='Group meeting (moved)';
 const r=(await call('POST','/calendar/subscriptions/refresh')).json().data;expect(r[0]).toMatchObject({ok:true,imported:1});
 const cal=(await call('GET','/me/calendar?from=2026-10-07&to=2026-10-08&timezone=Asia%2FHong_Kong')).json().data;
 expect(JSON.stringify(cal)).toContain('Group meeting (moved)');
});

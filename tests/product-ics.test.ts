import { describe,it,expect } from 'vitest';
import { parseCalendar,expandSeries } from '../src/product/calendar/ics.js';
const calendar=(...events:string[])=>['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Campus tests//EN',...events,'END:VCALENDAR'].join('\r\n');
const event=(...properties:string[])=>['BEGIN:VEVENT',...properties,'END:VEVENT'].join('\r\n');
const range={from:'2026-10-01',to:'2026-11-01'};
describe('recurrence-aware import parser',()=>{
  it('retains rules and stable recurrence identities across excluded, moved and cancelled classes',()=>{
    const parsed=parseCalendar(calendar(
      event('UID:class-1','SUMMARY:Weekly class','DTSTART;TZID=Asia/Hong_Kong:20261005T090000','DTEND;TZID=Asia/Hong_Kong:20261005T100000','RRULE:FREQ=WEEKLY;COUNT=5','EXDATE;TZID=Asia/Hong_Kong:20261012T090000'),
      event('UID:class-1','RECURRENCE-ID;TZID=Asia/Hong_Kong:20261019T090000','DTSTART;TZID=Asia/Hong_Kong:20261020T110000','DTEND;TZID=Asia/Hong_Kong:20261020T120000','SUMMARY:Moved class'),
      event('UID:class-1','RECURRENCE-ID;TZID=Asia/Hong_Kong:20261026T090000','STATUS:CANCELLED'),
    ));
    expect(parsed.issues).toEqual([]);expect(parsed.series).toHaveLength(1);
    const occurrences=expandSeries(parsed.series[0],range);
    expect(occurrences.map(x=>x.starts_at)).toEqual(['2026-10-05T01:00:00.000Z','2026-10-20T03:00:00.000Z']);
    expect(occurrences[1].recurrence_id).toContain('2026-10-19T09:00:00');
    const future=expandSeries(parsed.series[0],{from:'2026-11-01',to:'2026-11-10'});
    expect(future[0].starts_at).toBe('2026-11-02T01:00:00.000Z');
  });
  it('uses calendar dates for all-day events and preserves genuinely unknown ends',()=>{
    const parsed=parseCalendar(calendar(event('UID:date','SUMMARY:Holiday','DTSTART;VALUE=DATE:20261005','DTEND;VALUE=DATE:20261007'),event('UID:open','DTSTART:20261005T030000Z')));
    const date=expandSeries(parsed.series[0],range)[0],open=expandSeries(parsed.series[1],range)[0];
    expect(date).toMatchObject({all_day:true,start_date:'2026-10-05',end_date:'2026-10-07',starts_at:null});
    expect(open).toMatchObject({starts_at:'2026-10-05T03:00:00.000Z',ends_at:null});
  });
  it('supports duration and weekly multi-day recurrence',()=>{
    const parsed=parseCalendar(calendar(event('UID:multi','DTSTART:20261005T010000Z','DURATION:PT90M','RRULE:FREQ=WEEKLY;BYDAY=MO,WE;COUNT=4')));
    const rows=expandSeries(parsed.series[0],range);
    expect(rows.map(x=>x.starts_at)).toEqual(['2026-10-05T01:00:00.000Z','2026-10-07T01:00:00.000Z','2026-10-12T01:00:00.000Z','2026-10-14T01:00:00.000Z']);
    expect(rows[0].ends_at).toBe('2026-10-05T02:30:00.000Z');
  });
  it('requires a deliberate timezone choice for floating values',()=>{
    const input=calendar(event('UID:float','DTSTART:20261005T090000'));
    expect(parseCalendar(input).issues[0].code).toBe('FLOATING_TIMEZONE_REQUIRED');
    const parsed=parseCalendar(input,'Asia/Hong_Kong');
    expect(expandSeries(parsed.series[0],range)[0].starts_at).toBe('2026-10-05T01:00:00.000Z');
  });
  it('keeps IANA recurring wall clocks stable across daylight saving changes',()=>{
    const parsed=parseCalendar(calendar(event('UID:dst','DTSTART;TZID=America/New_York:20261026T090000','DURATION:PT1H','RRULE:FREQ=WEEKLY;COUNT=2')));
    expect(expandSeries(parsed.series[0],{from:'2026-10-25',to:'2026-11-05'}).map(x=>x.starts_at)).toEqual(['2026-10-26T13:00:00.000Z','2026-11-02T14:00:00.000Z']);
  });
  it('honors a custom timezone defined by the selected file without global registration',()=>{
    const zone=['BEGIN:VTIMEZONE','TZID:Campus/Fixed','BEGIN:STANDARD','DTSTART:19700101T000000','TZOFFSETFROM:+0530','TZOFFSETTO:+0530','END:STANDARD','END:VTIMEZONE'].join('\r\n');
    const parsed=parseCalendar(calendar(zone,event('UID:custom','DTSTART;TZID=Campus/Fixed:20261005T090000')));
    expect(expandSeries(parsed.series[0],range)[0].starts_at).toBe('2026-10-05T03:30:00.000Z');
    expect(parseCalendar(calendar(event('UID:other','DTSTART;TZID=Campus/Fixed:20261005T090000'))).issues[0].code).toBe('UNSUPPORTED_TIMEZONE');
  });
  it.each([
    ['RRULE:FREQ=SECONDLY','UNSUPPORTED_RULE'],
    ['RRULE:FREQ=WEEKLY;BYSETPOS=1','UNSUPPORTED_RULE'],
    ['DTSTART:20260230T090000Z','INVALID_DATE'],
  ])('reports unsupported/invalid values without silent fallback %s',(property,code)=>{
    const props=property.startsWith('DTSTART')?[property]:['DTSTART:20261005T090000Z',property];
    const parsed=parseCalendar(calendar(event('UID:invalid',...props)));
    expect(parsed.series).toHaveLength(0);expect(parsed.issues[0].code).toBe(code);
  });
  it('rejects conflicting masters and orphan exceptions but preserves unrelated good events',()=>{
    const parsed=parseCalendar(calendar(event('UID:dup','DTSTART:20261005T090000Z'),event('UID:dup','DTSTART:20261006T090000Z'),event('UID:orphan','RECURRENCE-ID:20261005T090000Z','STATUS:CANCELLED'),event('UID:good','DTSTART:20261007T090000Z')));
    expect(parsed.series.map(s=>s.uid)).toEqual(['good']);
    expect(parsed.issues.map(i=>i.code)).toEqual(['DUPLICATE_UID','ORPHAN_EXCEPTION']);
  });
  it('marks fingerprint identity and rejects malformed or oversized calendar files',()=>{
    const parsed=parseCalendar(calendar(event('SUMMARY:No UID','DTSTART:20261005T090000Z')));
    expect(parsed.series[0].identity).toBe('fingerprint');
    expect(()=>parseCalendar('not a calendar')).toThrow();
    expect(()=>parseCalendar('x'.repeat(300_000))).toThrow();
    expect(()=>expandSeries(parsed.series[0],{from:'2026-01-01',to:'2028-01-01'})).toThrow();
  });
  it('does not silently accept an impossible local time or conflicting end precision',()=>{
    const gap=parseCalendar(calendar(event('UID:gap','DTSTART;TZID=America/New_York:20260308T023000')));
    expect(gap.series).toHaveLength(0);expect(gap.issues[0].code).toBe('NONEXISTENT_LOCAL_TIME');
    const mismatch=parseCalendar(calendar(event('UID:mismatch','DTSTART;VALUE=DATE:20261005','DTEND:20261006T090000Z')));
    expect(mismatch.issues[0].code).toBe('INVALID_END');
  });
  it('bounds old recurrence traversal and rejects unsafe custom timezone rules before expansion',()=>{
    const old=parseCalendar(calendar(event('UID:old','DTSTART:19000101T090000Z','RRULE:FREQ=DAILY')));
    expect(()=>expandSeries(old.series[0],range)).toThrow(/too many expansion steps/);
    const zone=['BEGIN:VTIMEZONE','TZID:Bad/Zone','BEGIN:STANDARD','DTSTART:19000101T000000','TZOFFSETFROM:+0000','TZOFFSETTO:+0100','RRULE:FREQ=SECONDLY','END:STANDARD','END:VTIMEZONE'].join('\r\n');
    expect(()=>parseCalendar(calendar(zone,event('UID:bad-zone','DTSTART;TZID=Bad/Zone:20261005T090000')))).toThrow(/timezone/i);
  });
  it('keeps tentative source status separate from actual event participation and chooses the first ambiguous wall time',()=>{
    const parsed=parseCalendar(calendar(event('UID:tentative','DTSTART;TZID=America/New_York:20261101T013000','STATUS:TENTATIVE','ATTENDEE;PARTSTAT=NEEDS-ACTION:mailto:student@example.test')));
    expect(expandSeries(parsed.series[0],{from:'2026-11-01',to:'2026-11-02'})[0]).toMatchObject({starts_at:'2026-11-01T05:30:00.000Z',source_status:'tentative',participation:'unknown'});
  });
});

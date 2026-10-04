import {it,expect} from 'vitest';
import {parseCalendar,summarizeSeries} from '../src/product/calendar/ics';
import {changeText,issueText,recurrenceText,seriesLines,zoneLabel} from '../apps/mobile/src/study/ics-text';
const ics=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//test//EN',
 'BEGIN:VEVENT','UID:lec','DTSTAMP:20260901T000000Z','SUMMARY:Lecture','DTSTART;TZID=Asia/Hong_Kong:20260908T103000','DTEND;TZID=Asia/Hong_Kong:20260908T115000','RRULE:FREQ=WEEKLY;BYDAY=TU,TH;UNTIL=20261218T155959Z','EXDATE;TZID=Asia/Hong_Kong:20261020T103000','LOCATION:Room 2465','END:VEVENT',
 'BEGIN:VEVENT','UID:lec','DTSTAMP:20260901T000000Z','RECURRENCE-ID;TZID=Asia/Hong_Kong:20261013T103000','SUMMARY:Lecture','DTSTART;TZID=Asia/Hong_Kong:20261013T140000','DTEND;TZID=Asia/Hong_Kong:20261013T152000','END:VEVENT',
 'BEGIN:VEVENT','UID:exam','DTSTAMP:20260901T000000Z','SUMMARY:Exam','DTSTART:20261020T110000Z','DTEND:20261020T130000Z','END:VEVENT',
 'BEGIN:VEVENT','UID:daily','DTSTAMP:20260901T000000Z','SUMMARY:Daily','DTSTART:20261021T090000','DURATION:PT1H20M','RRULE:FREQ=DAILY;COUNT=3','END:VEVENT',
 'BEGIN:VEVENT','UID:allday','DTSTAMP:20260901T000000Z','SUMMARY:Holiday','DTSTART;VALUE=DATE:20261022','DTEND;VALUE=DATE:20261023','END:VEVENT',
 'END:VCALENDAR'].join('\r\n');
const s=(parseCalendar(ics,'Asia/Hong_Kong').series as any[]).map(summarizeSeries);
it('describes weekly series with UNTIL in Hong Kong, skips and single changes',()=>{
 expect(seriesLines(s[0],true)).toEqual({when:'每周二、四 10:30–11:50 · 到 12 月 18 日',extra:'Room 2465 · 跳过 1 次 · 1 次单独调整'});
 expect(seriesLines(s[0],false).when).toBe('Every Tue, Thu 10:30–11:50 · until 18 Dec');
});
it('shows UTC times in Hong Kong time, durations, counts and all-day dates',()=>{
 expect(seriesLines(s[1],true).when).toBe('10 月 20 日 周二 19:00–21:00');
 expect(seriesLines(s[2],true).when).toBe('每天 09:00–10:20 · 共 3 次');
 expect(seriesLines(s[3],true).when).toBe('10 月 22 日 周四 全天');
});
it('falls back for rules it cannot word, names zones and issues, and explains updates',()=>{
 expect(recurrenceText({...s[0],recurrence:'FREQ=MONTHLY;BYDAY=2TU'},true)).toBe('按文件里的规则重复');
 expect(zoneLabel('Europe/London',true)).toBe('伦敦时间');expect(issueText('UNSUPPORTED_RULE',true)).toBe('重复规则太复杂，暂不支持');expect(issueText('NEW_CODE',true)).toBe('无法导入');
 expect(changeText(s[0],{...s[0],location:'Room 4214'},true)).toBe('地点 Room 2465 → Room 4214');
});

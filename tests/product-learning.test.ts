import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { createProductApp } from '../src/product/app.js';

describe('private learning API', () => {
  let dir: string, alice: string, bob: string;
  let app: ReturnType<typeof createProductApp>;
  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), 'campus-learning-'));
    app = createProductApp({ dataDir: dir });
    async function login(email: string) {
      const c = await app.inject({ method: 'POST', url: '/api/v1/auth/email/challenges', payload: { email } });
      const id = c.json().data.challenge_id;
      const { code } = JSON.parse(readFileSync(join(dir, 'mail', `${id}.json`), 'utf8'));
      return (await app.inject({ method: 'POST', url: '/api/v1/auth/email/verify', payload: { challenge_id: id, code } })).json().data.access_token as string;
    }
    alice = await login('alice@example.test'); bob = await login('bob@example.test');
  });
  afterEach(async () => { await app.close(); rmSync(dir, { recursive: true, force: true }); });
  function call(method: 'GET'|'POST'|'PATCH'|'DELETE', path: string, body?: object, token = alice, key = randomUUID()) {
    return app.inject({ method, url: `/api/v1${path}`, headers: { authorization: `Bearer ${token}`, 'idempotency-key': key }, payload: body });
  }
  async function course() {
    const r = await call('POST', '/study/courses', { title: 'Information Systems', code: 'ISOM5370' });
    expect(r.statusCode).toBe(201); return r.json().data;
  }
  async function item(body: object) {
    const r = await call('POST', '/study/items', body);
    expect(r.statusCode, r.body).toBe(201); return r.json().data;
  }
  it('edits an imported occurrence through its dedicated endpoint and requires explicit source conflict resolution',async()=>{
    const content='BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:personal\r\nDTSTART:20261005T010000Z\r\nSUMMARY:Source title\r\nEND:VEVENT\r\nEND:VCALENDAR';
    const preview=(await call('POST','/calendar/imports/preview',{source_name:'Test',content})).json().data;
    await call('POST',`/calendar/imports/${preview.id}/confirm`,{uids:['personal']});
    const original=(await call('GET','/me/calendar?from=2026-10-05&to=2026-10-06')).json().data.days[0].events[0];
    const path=`/calendar/series/${original.import_origin.series_id}/occurrence`,body={version:original.version,recurrence_id:original.recurrence_id,event:{kind:'event',title:'My date',starts_at:'2026-10-06T04:00:00Z'}};
    expect((await call('PATCH',path,body,bob)).statusCode).toBe(404);expect((await call('PATCH',path,body)).statusCode).toBe(200);expect((await call('PATCH',path,body)).statusCode).toBe(409);
    expect((await call('GET','/me/calendar?from=2026-10-05&to=2026-10-06')).json().data.days[0].events).toEqual([]);
    expect((await call('GET','/me/calendar?from=2026-10-06&to=2026-10-07')).json().data.days[0].events[0]).toMatchObject({title:'My date',locally_modified:true});
    const importedId=original.import_origin.series_id,recurrence_id=original.recurrence_id;
    const cancel=await call('PATCH',`/calendar/series/${importedId}/occurrence/status`,{version:2,recurrence_id,status:'cancelled'});expect(cancel.statusCode,cancel.body).toBe(200);
    expect((await call('GET','/me/calendar?from=2026-10-06&to=2026-10-07')).json().data.days[0].events).toEqual([]);
    const details=await call('GET',`/calendar/sources/${original.import_origin.source_id}`);expect(details.json().data.series[0].overrides[0].payload.status).toBe('cancelled');
    expect((await call('GET',`/calendar/sources/${original.import_origin.source_id}`,undefined,bob)).statusCode).toBe(404);
    expect((await call('PATCH',`/calendar/series/${importedId}/occurrence/status`,{version:3,recurrence_id,status:'active'})).statusCode).toBe(200);
    const update=(await call('POST','/calendar/imports/preview',{source_id:original.import_origin.source_id,content:content.replace('Source title','New source')})).json().data;
    expect((await call('POST',`/calendar/imports/${update.id}/confirm`,{uids:['personal']})).statusCode).toBe(409);
    expect((await call('POST',`/calendar/imports/${update.id}/confirm`,{uids:['personal'],resolutions:{personal:'use_source'}})).statusCode).toBe(200);
    expect((await call('GET','/me/calendar?from=2026-10-05&to=2026-10-06')).json().data.days[0].events[0]).toMatchObject({title:'New source',locally_modified:false});
  });
  it('restoring a date that was only cancelled returns it to the file instead of keeping a private change',async()=>{
    const content='BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:weekly\r\nDTSTART:20261005T010000Z\r\nDTEND:20261005T020000Z\r\nRRULE:FREQ=WEEKLY;COUNT=2\r\nSUMMARY:Lecture\r\nLOCATION:Room 2465\r\nEND:VEVENT\r\nEND:VCALENDAR';
    const preview=(await call('POST','/calendar/imports/preview',{source_name:'Test',content})).json().data;
    await call('POST',`/calendar/imports/${preview.id}/confirm`,{uids:['weekly']});
    const first=(await call('GET','/me/calendar?from=2026-10-05&to=2026-10-06')).json().data.days[0].events[0];
    const path=`/calendar/series/${first.import_origin.series_id}/occurrence/status`,source=`/calendar/sources/${first.import_origin.source_id}`;
    expect((await call('PATCH',path,{version:first.version,recurrence_id:first.recurrence_id,status:'cancelled'})).statusCode).toBe(200);
    expect((await call('GET',source)).json().data.series[0].overrides).toHaveLength(1);
    const restored=await call('PATCH',path,{version:first.version+1,recurrence_id:first.recurrence_id,status:'active'});expect(restored.statusCode,restored.body).toBe(200);
    expect((await call('GET',source)).json().data.series[0].overrides).toEqual([]);
    expect((await call('GET','/me/calendar?from=2026-10-05&to=2026-10-06')).json().data.days[0].events[0]).toMatchObject({title:'Lecture',status:'active',locally_modified:false});
    const update=(await call('POST','/calendar/imports/preview',{source_id:first.import_origin.source_id,content:content.replace('Room 2465','Room 4210')})).json().data;
    expect(update.entries[0].action).toBe('update');
  });
  it('renders imported recurrence exceptions with manual items, stable identity and display timezone', async () => {
    const lines=['BEGIN:VCALENDAR','VERSION:2.0',
      'BEGIN:VEVENT','UID:weekly','DTSTART:20261005T010000Z','DTEND:20261005T020000Z','RRULE:FREQ=WEEKLY;COUNT=4','EXDATE:20261012T010000Z','SUMMARY:Weekly','END:VEVENT',
      'BEGIN:VEVENT','UID:weekly','RECURRENCE-ID:20261019T010000Z','DTSTART:20261020T010000Z','DTEND:20261020T020000Z','SUMMARY:Moved','END:VEVENT',
      'BEGIN:VEVENT','UID:weekly','RECURRENCE-ID:20261026T010000Z','STATUS:CANCELLED','END:VEVENT',
      'BEGIN:VEVENT','UID:all-day','DTSTART;VALUE=DATE:20261006','DTEND;VALUE=DATE:20261008','SUMMARY:Two days','END:VEVENT',
      'BEGIN:VEVENT','UID:unknown-end','DTSTART:20261005T233000Z','SUMMARY:Unknown end','END:VEVENT','END:VCALENDAR'];
    const preview=(await call('POST','/calendar/imports/preview',{source_name:'Calendar',content:lines.join('\r\n')})).json().data;
    expect(preview.issues).toEqual([]);
    expect((await call('POST',`/calendar/imports/${preview.id}/confirm`,{uids:['weekly','all-day','unknown-end']})).statusCode).toBe(200);
    await item({kind:'event',title:'Manual',starts_at:'2026-10-05T04:00:00Z'});
    const result=await call('GET','/me/calendar?from=2026-10-05&to=2026-11-02&timezone=Asia%2FHong_Kong');expect(result.statusCode,result.body).toBe(200);
    const data=result.json().data,day=(d:string)=>data.days.find((x:any)=>x.date===d).events;
    expect(data.import_issues).toEqual([]);expect(day('2026-10-05').map((x:any)=>x.title)).toEqual(['Weekly','Manual']);
    expect(day('2026-10-06').map((x:any)=>x.title)).toEqual(['Two days','Unknown end']);expect(day('2026-10-07')).toHaveLength(1);expect(day('2026-10-08')).toEqual([]);
    expect(day('2026-10-12')).toEqual([]);expect(day('2026-10-19')).toEqual([]);expect(day('2026-10-20')[0]).toMatchObject({title:'Moved',participation:'unknown',recurrence_id:'2026-10-19T01:00:00Z'});expect(day('2026-10-26')).toEqual([]);
    const single=(await call('GET','/me/calendar?from=2026-10-20&to=2026-10-21')).json().data.days[0].events[0];expect(single.id).toBe(day('2026-10-20')[0].id);
    const utc=(await call('GET','/me/calendar?from=2026-10-05&to=2026-10-06&timezone=UTC')).json().data.days[0].events;expect(utc.find((x:any)=>x.title==='Unknown end').ends_at).toBeNull();
    const other=(await call('GET','/me/calendar?from=2026-10-05&to=2026-11-02',undefined,bob)).json().data;expect(other.days.every((d:any)=>d.events.length===0)).toBe(true);
    const source=(await call('GET','/calendar/sources')).json().data[0];await call('DELETE',`/calendar/sources/${source.id}`,{version:source.version});
    expect((await call('GET','/me/calendar?from=2026-10-05&to=2026-10-06')).json().data.days[0].events.map((x:any)=>x.title)).toEqual(['Manual']);
  });
  it('previews and confirms owner-scoped ICS through HTTP, exports and deletes persisted sources', async () => {
    const content='BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:lecture-1\r\nDTSTART:20261005T010000Z\r\nSUMMARY:Imported lecture\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n';
    expect((await call('POST','/calendar/imports/preview',{source_name:'School',content:'bad'})).statusCode).toBe(400);
    const response=await call('POST','/calendar/imports/preview',{source_name:'School',content});
    expect(response.statusCode,response.body).toBe(201);const p=response.json().data;
    expect((await call('GET','/calendar/sources')).json().data).toEqual([]);
    expect((await call('POST',`/calendar/imports/${p.id}/confirm`,{uids:['lecture-1']},bob)).statusCode).toBe(404);
    const result=await call('POST',`/calendar/imports/${p.id}/confirm`,{uids:['lecture-1']});expect(result.statusCode,result.body).toBe(200);
    await app.close();app=createProductApp({dataDir:dir});
    const exported=(await call('GET','/me/export')).json().data;expect(exported.version).toBe(5);expect(exported.calendars[0].series[0].title).toBe('Imported lecture');
    expect((await call('GET','/me/export',undefined,bob)).json().data.calendars).toEqual([]);
    const source=(await call('GET','/calendar/sources')).json().data[0];expect(source.series_count).toBe(1);
    expect((await call('DELETE',`/calendar/sources/${source.id}`,{version:source.version},bob)).statusCode).toBe(404);
    expect((await call('DELETE',`/calendar/sources/${source.id}`,{version:source.version})).statusCode).toBe(200);
    expect((await call('GET','/me/export')).json().data.calendars).toEqual([]);
  });
  it('persists all four learning kinds and includes only the owner data in export after restart', async () => {
    const c = await course();
    await item({ kind: 'event', title: 'Class', course_id: c.id, starts_at: '2026-10-05T09:00:00+08:00' });
    await item({ kind: 'task', title: 'Read chapter', course_id: c.id, due_date: '2026-10-06' });
    await item({ kind: 'note', title: 'Private thought', body: 'Only Alice sees this.' });
    await item({ kind: 'material', title: 'Reference', url: 'https://example.test/reading' });
    await app.close(); app = createProductApp({ dataDir: dir });
    const data = (await call('GET', '/me/export')).json().data;
    expect(data.learning.courses).toHaveLength(1);
    expect(data.learning.items.map((x: any) => x.kind).sort()).toEqual(['event','material','note','task']);
    const other = (await call('GET', '/me/export', undefined, bob)).json().data;
    expect(other.learning).toEqual({ courses: [], items: [] });
    expect(JSON.stringify(other)).not.toContain('Only Alice');
  });
  it('rejects another account reads, edits, deletes and course references with 404', async () => {
    const c = await course(), n = await item({ kind: 'note', title: 'Secret', course_id: c.id });
    for (const path of [`/study/courses/${c.id}`, `/study/items/${n.id}`]) {
      expect((await call('GET', path, undefined, bob)).statusCode).toBe(404);
      expect((await call('PATCH', path, { version: 1, title: 'intruder' }, bob)).statusCode).toBe(404);
      expect((await call('DELETE', path, { version: 1 }, bob)).statusCode).toBe(404);
    }
    expect((await call('POST', '/study/items', { kind: 'task', title: 'Link', course_id: c.id }, bob)).statusCode).toBe(404);
    expect((await call('GET', '/study/items?course_id=' + c.id, undefined, bob)).statusCode).toBe(404);
  });
  it('deduplicates retries atomically, scopes keys to owner and rejects changed bodies', async () => {
    const key = randomUUID(), body = { kind: 'task', title: 'Exactly once' };
    const replies = await Promise.all([call('POST','/study/items',body,alice,key), call('POST','/study/items',body,alice,key)]);
    expect(replies.map(r=>r.statusCode)).toEqual([201,201]);
    expect(replies[0].json().data.id).toBe(replies[1].json().data.id);
    expect((await call('POST','/study/items',{...body,title:'different'},alice,key)).statusCode).toBe(409);
    expect((await call('POST','/study/items',body,bob,key)).statusCode).toBe(201);
    expect((await call('GET','/study/items')).json().data.items).toHaveLength(1);
    const id = replies[0].json().data.id;
    await call('DELETE',`/study/items/${id}`,{version:1});
    expect((await call('POST','/study/items',body,alice,key)).statusCode).toBe(410);
  });
  it('rejects concurrent stale edits/deletes and preserves the winning version', async () => {
    const task = await item({ kind: 'task', title: 'Work' });
    const results = await Promise.all([
      call('PATCH',`/study/items/${task.id}`,{version:1,status:'done'}),
      call('PATCH',`/study/items/${task.id}`,{version:1,title:'stale'}),
    ]);
    expect(results.map(r=>r.statusCode).sort()).toEqual([200,409]);
    expect((await call('GET',`/study/items/${task.id}`)).json().data).toMatchObject({version:2,status:'done',title:'Work'});
    expect((await call('DELETE',`/study/items/${task.id}`,{version:1})).statusCode).toBe(409);
    expect((await call('DELETE',`/study/items/${task.id}`,{version:2})).statusCode).toBe(200);
    expect((await call('GET',`/study/items/${task.id}`)).statusCode).toBe(404);
  });
  it('preserves independent notes and tasks when removing their course', async () => {
    const c = await course();
    const note = await item({kind:'note',title:'My notes',body:'Keep me',course_id:c.id});
    expect((await call('DELETE',`/study/courses/${c.id}`,{version:1})).statusCode).toBe(200);
    expect((await call('GET',`/study/items/${note.id}`)).json().data).toMatchObject({body:'Keep me',course_id:null,version:2});
  });
  it('keeps unknown end times and date-only deadlines without fabricated times', async () => {
    const event = await item({kind:'event',title:'Open end',starts_at:'2026-10-05T09:00:00+08:00'});
    expect(event.ends_at).toBeNull();
    const task = await item({kind:'task',title:'Due Monday',due_date:'2026-10-05'});
    expect(task.due_at).toBeNull(); expect(task.due_date).toBe('2026-10-05');
    const undated = await item({kind:'task',title:'Someday'});
    expect(undated.due_at).toBeNull(); expect(undated.due_date).toBeNull();
  });
  it.each([
    {kind:'event',title:'Bad',starts_at:'2026-02-30T09:00:00+08:00'},
    {kind:'event',title:'Bad',starts_at:'2026-10-05T10:00:00Z',ends_at:'2026-10-05T09:00:00Z'},
    {kind:'event',title:'Bad',all_day:true,start_date:'2026-10-05',end_date:'2026-10-05'},
    {kind:'task',title:'Bad',due_date:'2026-10-05',due_at:'2026-10-05T10:00:00Z'},
    {kind:'task',title:'Bad',due_date:'2026-02-30'},
    {kind:'task',title:'Bad',due_date:'2026-10-05',remind_minutes:15},
    {kind:'material',title:'Bad',url:'javascript:alert(1)'},
    {kind:'material',title:'Bad',url:'https://user:pass@example.test/'},
    {kind:'material',title:'Bad',url:'not a URL'},
    {kind:'event',title:'Bad',starts_at:'2026-10-05T09:00:00+99:99'},
    {kind:'note',title:'Bad',owner_id:'other'},
    {kind:'note',title:'  '},
  ])('rejects invalid record semantics %#', async body => {
    expect((await call('POST','/study/items',body)).statusCode).toBe(400);
  });
  it('returns bounded day/week results with cross-midnight and all-day semantics', async () => {
    await item({kind:'event',title:'Overnight',starts_at:'2026-10-04T23:30:00+08:00',ends_at:'2026-10-05T00:30:00+08:00'});
    await item({kind:'event',title:'All day',all_day:true,start_date:'2026-10-05',end_date:'2026-10-06'});
    await item({kind:'event',title:'Cancelled',starts_at:'2026-10-05T10:00:00+08:00',status:'cancelled'});
    await item({kind:'task',title:'Deadline',due_date:'2026-10-05'});
    await item({kind:'task',title:'Undated'});
    const data = (await call('GET','/me/calendar?from=2026-10-05&to=2026-10-06&timezone=Asia%2FHong_Kong')).json().data;
    expect(data.days).toHaveLength(1);
    expect(data.days[0].events.map((x:any)=>x.title).sort()).toEqual(['All day','Overnight']);
    expect(data.days[0].tasks.map((x:any)=>x.title)).toEqual(['Deadline']);
    expect(data.undated_tasks.map((x:any)=>x.title)).toEqual(['Undated']);
    const tomorrow = (await call('GET','/me/calendar?from=2026-10-06&to=2026-10-07')).json().data;
    expect(tomorrow.days[0].events).toEqual([]);
    expect((await call('GET','/me/calendar?from=2026-01-01&to=2026-12-31')).statusCode).toBe(400);
  });
  it('pages records deterministically and enforces strict pagination inputs', async () => {
    for (let n=0;n<4;n++) await item({kind:'note',title:`Note ${n}`});
    const first = (await call('GET','/study/items?limit=2&kind=note')).json().data;
    const second = (await call('GET',`/study/items?limit=2&kind=note&cursor=${first.next_cursor}`)).json().data;
    expect(new Set([...first.items,...second.items].map(x=>x.id)).size).toBe(4);
    expect(second.next_cursor).toBeNull();
    expect((await call('GET','/study/items?limit=999')).statusCode).toBe(400);
    expect((await call('GET','/study/items?cursor=bad')).statusCode).toBe(400);
  });
  it('handles the exclusive midnight boundary and query timezone while preserving all-day dates',async()=>{
    await item({kind:'event',title:'Ends at midnight',starts_at:'2026-10-04T23:00:00+08:00',ends_at:'2026-10-05T00:00:00+08:00'});
    await item({kind:'event',title:'Morning HK',starts_at:'2026-10-05T00:30:00+08:00'});
    await item({kind:'event',title:'Calendar date',all_day:true,start_date:'2026-10-05'});
    const hk=(await call('GET','/me/calendar?from=2026-10-05&to=2026-10-06')).json().data;
    expect(hk.days[0].events.map((x:any)=>x.title).sort()).toEqual(['Calendar date','Morning HK']);
    const utc=(await call('GET','/me/calendar?from=2026-10-05&to=2026-10-06&timezone=UTC')).json().data;
    expect(utc.days[0].events.map((x:any)=>x.title)).toEqual(['Calendar date']);
  });
  it('requires retry keys and versions and never allows kind changes or foreign reassignment',async()=>{
    const missing=await app.inject({method:'POST',url:'/api/v1/study/items',headers:{authorization:`Bearer ${alice}`},payload:{kind:'task',title:'No key'}});
    expect(missing.statusCode).toBe(400);
    const task=await item({kind:'task',title:'Private task'});
    expect((await call('PATCH',`/study/items/${task.id}`,{title:'No version'})).statusCode).toBe(400);
    expect((await call('PATCH',`/study/items/${task.id}`,{version:1,kind:'note'})).statusCode).toBe(400);
    const foreign=(await call('POST','/study/courses',{title:'Bob course'},bob)).json().data;
    expect((await call('PATCH',`/study/items/${task.id}`,{version:1,course_id:foreign.id})).statusCode).toBe(404);
    expect((await call('GET',`/study/items/${task.id}`)).json().data).toMatchObject({version:1,course_id:null});
  });
  it('deletes all learning and retry records with the account', async () => {
    const c = await course(); await item({kind:'task',title:'Delete with account',course_id:c.id});
    expect((await call('DELETE','/me',{confirmation:'DELETE'})).statusCode).toBe(200);
    await app.close();
    const db = new DatabaseSync(join(dir,'campus.sqlite'));
    for(const table of ['study_courses','study_items','write_keys']) expect(db.prepare(`SELECT count(*) AS n FROM ${table}`).get()!.n).toBe(0);
    db.close(); app = createProductApp({dataDir:dir});
  });
});

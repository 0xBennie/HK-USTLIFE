import {beforeEach,afterEach,it,expect} from 'vitest';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openDatabase} from '../src/product/database.js';
import {createCalendarStore} from '../src/product/calendar/store.js';
let dir:string,db:ReturnType<typeof openDatabase>,store:ReturnType<typeof createCalendarStore>,clock:number;
const event=(uid:string,title=uid)=>`BEGIN:VEVENT\r\nUID:${uid}\r\nDTSTART:20261005T010000Z\r\nSUMMARY:${title}\r\nRRULE:FREQ=WEEKLY;COUNT=12\r\nEND:VEVENT`;
const calendar=(...events:string[])=>`BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${events.join('\r\n')}\r\nEND:VCALENDAR\r\n`;
beforeEach(()=>{dir=mkdtempSync(join(tmpdir(),'calendar-store-'));db=openDatabase(dir);clock=Date.now();store=createCalendarStore(db,()=>clock);for(const id of ['a','b'])db.prepare('INSERT INTO users(id,email,created_at) VALUES(?,?,?)').run(id,id+'@example.test',clock);});
afterEach(()=>{db.close();rmSync(dir,{recursive:true,force:true});});
const initial=()=>store.preview('a',{source_name:'My timetable',content:calendar(event('one'),event('two'))});
it('preview leaves calendar empty; selected confirmation persists original recurrence across restart',()=>{
 const p=initial();expect(store.exportAll('a')).toEqual([]);store.confirm('a',p.id,{uids:['one']});
 db.close();db=openDatabase(dir);store=createCalendarStore(db,()=>clock);
 const result=store.exportAll('a');expect(result[0].series).toHaveLength(1);expect(result[0].series[0].ical).toContain('COUNT=12');expect(store.exportAll('b')).toEqual([]);
});
it('deduplicates confirmation retries and unchanged reimport; partial updates preserve absent UIDs',()=>{
 const p=initial(),r=store.confirm('a',p.id,{uids:['one','two']});expect(store.confirm('a',p.id,{uids:['two','one']})).toEqual(r);
 expect(()=>store.confirm('a',p.id,{uids:['one']})).toThrow(/another selection/);
 const repeat=store.preview('a',{source_id:r.source_id,content:calendar(event('one'))});expect(repeat.entries[0].action).toBe('unchanged');expect(store.confirm('a',repeat.id,{uids:['one']}).imported).toBe(0);
 const update=store.preview('a',{source_id:r.source_id,content:calendar(event('one','New title'))});expect(update.entries[0]).toMatchObject({action:'update',previous_title:'one'});store.confirm('a',update.id,{uids:['one']});
 expect(store.exportAll('a')[0].series.map(s=>s.title)).toEqual(['New title','two']);
});
it('rejects other owner previews, confirmation and deletion',()=>{
 const p=initial();expect(()=>store.confirm('b',p.id,{uids:['one']})).toThrow(/not found/);const r=store.confirm('a',p.id,{uids:['one']});
 expect(()=>store.preview('b',{source_id:r.source_id,content:calendar(event('one'))})).toThrow(/not found/);expect(()=>store.remove('b',r.source_id,2)).toThrow(/not found/);
});
it('expired and invalid selections create no source; fingerprint identity requires explicit review',()=>{
 const p=initial();expect(()=>store.confirm('a',p.id,{uids:['missing']})).toThrow(/preview entries/);clock+=30*60_000;expect(()=>store.confirm('a',p.id,{uids:['one']})).toThrow(/new preview/);expect(store.exportAll('a')).toEqual([]);
 const f=store.preview('a',{source_name:'No UID',content:calendar(event('one').replace('UID:one\r\n',''))});const uid=f.entries[0].series.uid;
 expect(()=>store.confirm('a',f.id,{uids:[uid]})).toThrow(/explicitly/);store.confirm('a',f.id,{uids:[uid],acknowledge_fingerprints:true});expect(store.exportAll('a')).toHaveLength(1);
});
it('stale concurrent previews fail atomically and preserve the winning source',()=>{
 const p=initial(),r=store.confirm('a',p.id,{uids:['one','two']});
 const first=store.preview('a',{source_id:r.source_id,content:calendar(event('one','Winner'))});const second=store.preview('a',{source_id:r.source_id,content:calendar(event('one','Loser'),event('three'))});
 store.confirm('a',first.id,{uids:['one']});expect(()=>store.confirm('a',second.id,{uids:['one','three']})).toThrow(/changed/);expect(store.exportAll('a')[0].series.map(s=>s.title)).toEqual(['Winner','two']);
});
it('source deletion guards versions, removes series and prevents replay resurrection; user deletion cascades previews',()=>{
 const p=initial(),r=store.confirm('a',p.id,{uids:['one']});expect(()=>store.remove('a',r.source_id,1)).toThrow(/changed/);store.remove('a',r.source_id,2);expect(store.exportAll('a')).toEqual([]);expect(()=>store.confirm('a',p.id,{uids:['one']})).toThrow(/deleted/);
 expect(db.prepare('SELECT COUNT(*) AS n FROM calendar_series').get()?.n).toBe(0);db.prepare('DELETE FROM users WHERE id=?').run('a');expect(db.prepare('SELECT COUNT(*) AS n FROM calendar_previews').get()?.n).toBe(0);
});
it('reports failed expansion explicitly while preserving independently expandable series',()=>{
 const old=event('old').replace('20261005T010000Z','19000101T010000Z').replace('FREQ=WEEKLY;COUNT=12','FREQ=DAILY');
 const p=store.preview('a',{source_name:'Mixed',content:calendar(old,event('valid'))});
 expect(p.issues).toEqual([]);store.confirm('a',p.id,{uids:['old','valid']});
 const result=store.occurrences('a',{from:'2026-10-05',to:'2026-10-06'});
 expect(result.items.map(i=>i.title)).toEqual(['valid']);expect(result.issues).toHaveLength(1);expect(result.issues[0]).toMatchObject({title:'old',code:'EXPANSION_UNAVAILABLE'});
});
it('moves one occurrence without changing its siblings and resolves reimport conflicts explicitly',()=>{
 const p=initial(),r=store.confirm('a',p.id,{uids:['one']});let s=store.exportAll('a')[0].series[0];
 const input={kind:'event',title:'My room change',starts_at:'2026-11-10T09:00:00Z',location:'Library'};
 store.editOccurrence('a',s.id,{version:s.version,recurrence_id:'2026-10-05T01:00:00Z',event:input});
 const occurrences=store.occurrences('a',{from:'2026-10-05',to:'2026-10-06'}).items;
 expect(occurrences.some(o=>o.starts_at==='2026-10-05T01:00:00.000Z')).toBe(false);
 expect(store.occurrences('a',{from:'2026-11-10',to:'2026-11-11'}).items.find(o=>o.title==='My room change')).toMatchObject({locally_modified:true,starts_at:'2026-11-10T09:00:00.000Z',source_occurrence_missing:false});
 expect(()=>store.editOccurrence('a',s.id,{version:s.version,recurrence_id:'2026-10-12T01:00:00Z',event:input})).toThrow(/changed/);
 const update=store.preview('a',{source_id:r.source_id,content:calendar(event('one','School update'))});expect(update.entries[0]).toMatchObject({action:'conflict',local_changes:1});
 expect(()=>store.confirm('a',update.id,{uids:['one']})).toThrow(/keep local/);
 store.confirm('a',update.id,{uids:['one'],resolutions:{one:'keep_local'}});
 expect(store.exportAll('a')[0].series[0].overrides).toHaveLength(1);
 const next=store.preview('a',{source_id:r.source_id,content:calendar(event('one','Final source'))});store.confirm('a',next.id,{uids:['one'],resolutions:{one:'use_source'}});
 expect(store.exportAll('a')[0].series[0].overrides).toEqual([]);expect(store.occurrences('a',{from:'2026-10-05',to:'2026-10-06'}).items[0].title).toBe('Final source');
});
it('validates occurrence membership and owner; local edits invalidate pending preview and cascade on deletion',()=>{
 const p=initial(),r=store.confirm('a',p.id,{uids:['one']}),s=store.exportAll('a')[0].series[0];const eventInput={kind:'event',title:'Private',starts_at:'2026-10-05T04:00:00Z'};
 const pending=store.preview('a',{source_id:r.source_id,content:calendar(event('one','New'))});
 for(const owner of ['b','a'])expect(()=>store.editOccurrence(owner,s.id,{version:1,recurrence_id:'2026-10-06T01:00:00Z',event:eventInput})).toThrow(/not found/);
 store.editOccurrence('a',s.id,{version:1,recurrence_id:'2026-10-05T01:00:00Z',event:eventInput});expect(()=>store.confirm('a',pending.id,{uids:['one']})).toThrow(/changed/);
 db.close();db=openDatabase(dir);store=createCalendarStore(db,()=>clock);expect(store.exportAll('a')[0].series[0].overrides[0].payload.title).toBe('Private');
 const source=store.exportAll('a')[0];store.remove('a',source.id,source.version);expect(db.prepare('SELECT COUNT(*) AS n FROM calendar_overrides').get()?.n).toBe(0);
});
it('keeps a locally modified occurrence explicitly when a new source removes it',()=>{
 const p=initial(),r=store.confirm('a',p.id,{uids:['one']}),s=store.exportAll('a')[0].series[0];
 store.editOccurrence('a',s.id,{version:1,recurrence_id:'2026-10-05T01:00:00Z',event:{kind:'event',title:'Keep private appointment',starts_at:'2026-10-05T01:00:00Z'}});
 const changed=store.preview('a',{source_id:r.source_id,content:calendar(event('one').replace('SUMMARY:one','EXDATE:20261005T010000Z\r\nSUMMARY:one'))});
 store.confirm('a',changed.id,{uids:['one'],resolutions:{one:'keep_local'}});
 expect(store.occurrences('a',{from:'2026-10-05',to:'2026-10-06'}).items[0]).toMatchObject({title:'Keep private appointment',locally_modified:true,source_occurrence_missing:true});
});
it('previews readable before/after time and recurrence details without changing stored data',()=>{
 const p=initial(),r=store.confirm('a',p.id,{uids:['one']});
 const changed=store.preview('a',{source_id:r.source_id,content:calendar(event('one','New name').replace('20261005T010000Z','20261005T020000Z'))});
 expect(changed.entries[0]).toMatchObject({summary:{title:'New name',start:'2026-10-05T02:00:00Z',timezone:'UTC',recurrence:'FREQ=WEEKLY;COUNT=12'},previous_summary:{title:'one',start:'2026-10-05T01:00:00Z'}});
 expect(store.exportAll('a')[0].series[0].title).toBe('one');
});
it('cancel/restore and reset are versioned, owner-scoped and recoverable from source detail',()=>{
 const p=initial(),r=store.confirm('a',p.id,{uids:['one']}),s=store.exportAll('a')[0].series[0],rid='2026-10-05T01:00:00Z';
 expect(()=>store.detail('b',r.source_id)).toThrow(/not found/);
 store.setOccurrenceStatus('a',s.id,{version:1,recurrence_id:rid,status:'cancelled'});
 expect(store.detail('a',r.source_id).series[0].overrides[0].payload.status).toBe('cancelled');
 expect(()=>store.resetOccurrence('a',s.id,{version:1,recurrence_id:rid})).toThrow(/Refresh/);
 expect(()=>store.setOccurrenceStatus('b',s.id,{version:2,recurrence_id:rid,status:'active'})).toThrow(/not found/);
 store.setOccurrenceStatus('a',s.id,{version:2,recurrence_id:rid,status:'active'});
 // Restoring a date that was only cancelled returns it to the file: no private record is left behind.
 expect(store.detail('a',r.source_id).series[0]).toMatchObject({version:3,overrides:[]});
 store.setOccurrenceStatus('a',s.id,{version:3,recurrence_id:rid,status:'cancelled'});
 expect(()=>store.resetOccurrence('a',s.id,{version:3,recurrence_id:rid})).toThrow(/Refresh/);
 store.resetOccurrence('a',s.id,{version:4,recurrence_id:rid});
 expect(store.detail('a',r.source_id).series[0]).toMatchObject({version:5,overrides:[]});
 expect(store.occurrences('a',{from:'2026-10-05',to:'2026-10-06'}).items[0]).toMatchObject({locally_modified:false,status:'active'});
});
it('drops raw preview content after confirmation, bounds replay to 24 hours and removes pending source snapshots on deletion',()=>{
 const p=initial();expect(store.getPreview('a',p.id)).toMatchObject({state:'pending'});expect(()=>store.getPreview('b',p.id)).toThrow(/not found/);
 const r=store.confirm('a',p.id,{uids:['one']});expect(store.getPreview('a',p.id)).toMatchObject({state:'confirmed',result:r});
 expect(String(db.prepare('SELECT snapshot FROM calendar_previews WHERE id=?').get(p.id)?.snapshot)).not.toContain('VEVENT');
 const pending=store.preview('a',{source_id:r.source_id,content:calendar(event('one','Pending private title'))});
 store.remove('a',r.source_id,2);expect(()=>store.getPreview('a',pending.id)).toThrow(/not found/);
 clock+=86400_001;expect(()=>store.getPreview('a',p.id)).toThrow(/new preview/);expect(db.prepare('SELECT COUNT(*) AS n FROM calendar_previews').get()?.n).toBe(0);
});
it('limits number of imported sources without partially writing an over-limit confirmation',()=>{
 for(let i=0;i<20;i++){const p=store.preview('a',{source_name:'Source '+i,content:calendar(event('a'+i))});store.confirm('a',p.id,{uids:['a'+i]});}
 const p=initial();expect(()=>store.confirm('a',p.id,{uids:['one']})).toThrow(/20 sources/);expect(store.exportAll('a')).toHaveLength(20);
});

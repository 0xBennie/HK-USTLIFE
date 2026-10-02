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

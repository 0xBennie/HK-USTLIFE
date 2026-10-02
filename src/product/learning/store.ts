import { createHash, randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { z } from 'zod';
import { transaction } from '../database.js';
import { ApiError } from '../errors.js';
import { courseSchema, itemSchema, versionSchema, type CourseInput, type ItemInput, type Stored, type StudyItem } from './schemas.js';

type Collection = 'courses'|'items';
type Row = {id:string;payload:string;version:number;created_at:number;updated_at:number};
const table = (collection:Collection) => collection === 'courses' ? 'study_courses' : 'study_items';
const serialize = <T>(row:Row):Stored<T> => ({...JSON.parse(row.payload),id:row.id,version:row.version,created_at:new Date(row.created_at).toISOString(),updated_at:new Date(row.updated_at).toISOString()});
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') return `{${Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
  return JSON.stringify(value);
}

export function createLearningStore(db:DatabaseSync, now:()=>number) {
  function raw(owner:string, collection:Collection, id:string):Row {
    const row = db.prepare(`SELECT * FROM ${table(collection)} WHERE owner_id=? AND id=?`).get(owner,id) as Row|undefined;
    if (!row) throw new ApiError(404,'NOT_FOUND','Private record not found.');
    return row;
  }
  function get(owner:string, collection:Collection, id:string) { return serialize<CourseInput|ItemInput>(raw(owner,collection,id)); }
  function validateCourse(owner:string, payload:CourseInput|ItemInput) {
    if ('course_id' in payload && payload.course_id) raw(owner,'courses',payload.course_id);
  }
  function create(owner:string, collection:Collection, body:unknown, key:unknown) {
    const retryKey = z.string().min(8).max(128).regex(/^[A-Za-z0-9_-]+$/).parse(key);
    const payload = collection === 'courses' ? courseSchema.parse(body) : itemSchema.parse(body);
    const hash = createHash('sha256').update(canonical(payload)).digest('hex');
    return transaction(db,()=>{
      db.prepare('DELETE FROM write_keys WHERE expires_at<=?').run(now());
      const previous = db.prepare('SELECT fingerprint,resource_id FROM write_keys WHERE owner_id=? AND scope=? AND key=?').get(owner,collection,retryKey);
      if (previous) {
        if (previous.fingerprint !== hash) throw new ApiError(409,'IDEMPOTENCY_CONFLICT','This retry key belongs to different content.');
        try { return get(owner,collection,String(previous.resource_id)); }
        catch(error) { if(error instanceof ApiError && error.status === 404) throw new ApiError(410,'RECORD_REMOVED','The original record was removed; start a new action.'); throw error; }
      }
      validateCourse(owner,payload);
      const id = randomUUID(), stamp = now();
      if(collection === 'courses') db.prepare('INSERT INTO study_courses(id,owner_id,payload,created_at,updated_at) VALUES (?,?,?,?,?)').run(id,owner,JSON.stringify(payload),stamp,stamp);
      else {
        const item = payload as ItemInput;
        db.prepare('INSERT INTO study_items(id,owner_id,course_id,kind,payload,created_at,updated_at) VALUES (?,?,?,?,?,?,?)').run(id,owner,item.course_id,item.kind,JSON.stringify(item),stamp,stamp);
      }
      db.prepare('INSERT INTO write_keys VALUES (?,?,?,?,?,?)').run(owner,collection,retryKey,hash,id,stamp+86400_000);
      return get(owner,collection,id);
    });
  }
  function update(owner:string, collection:Collection, id:string, body:unknown) {
    const input = z.object({version:versionSchema}).passthrough().parse(body);
    const {version,...changes} = input;
    if (!Object.keys(changes).length || 'kind' in changes) throw new ApiError(400,'INVALID_INPUT','Provide editable fields; the record kind cannot change.');
    return transaction(db,()=>{
      const row = raw(owner,collection,id);
      if(row.version !== version) throw new ApiError(409,'VERSION_CONFLICT','This record changed. Reload before editing.');
      const merged = {...JSON.parse(row.payload),...changes};
      const payload = collection === 'courses' ? courseSchema.parse(merged) : itemSchema.parse(merged);
      validateCourse(owner,payload);
      if(collection === 'items') db.prepare('UPDATE study_items SET course_id=? WHERE owner_id=? AND id=?').run((payload as ItemInput).course_id,owner,id);
      db.prepare(`UPDATE ${table(collection)} SET payload=?,version=version+1,updated_at=? WHERE owner_id=? AND id=?`).run(JSON.stringify(payload),now(),owner,id);
      return get(owner,collection,id);
    });
  }
  function remove(owner:string, collection:Collection, id:string, version:number) {
    return transaction(db,()=>{
      const row = raw(owner,collection,id);
      if(row.version !== version) throw new ApiError(409,'VERSION_CONFLICT','This record changed. Reload before deleting.');
      if(collection === 'courses') {
        const items = db.prepare('SELECT * FROM study_items WHERE owner_id=? AND course_id=?').all(owner,id) as Row[];
        for(const item of items) db.prepare('UPDATE study_items SET course_id=NULL,payload=?,version=version+1,updated_at=? WHERE owner_id=? AND id=?')
          .run(JSON.stringify({...JSON.parse(item.payload),course_id:null}),now(),owner,item.id);
      }
      db.prepare(`DELETE FROM ${table(collection)} WHERE owner_id=? AND id=?`).run(owner,id);
      return {deleted:true,id};
    });
  }
  function list(owner:string, collection:Collection, query:{limit:number;cursor?:string;kind?:string;course_id?:string}) {
    if(query.course_id) raw(owner,'courses',query.course_id);
    const clauses = ['owner_id=?']; const args:(string|number)[] = [owner];
    if(query.cursor) { clauses.push('id>?'); args.push(query.cursor); }
    if(query.kind) { clauses.push('kind=?'); args.push(query.kind); }
    if(query.course_id) { clauses.push('course_id=?'); args.push(query.course_id); }
    const rows = db.prepare(`SELECT * FROM ${table(collection)} WHERE ${clauses.join(' AND ')} ORDER BY id LIMIT ?`).all(...args,query.limit+1) as Row[];
    return {items:rows.slice(0,query.limit).map(row=>serialize<CourseInput|ItemInput>(row)),next_cursor:rows.length>query.limit?rows[query.limit-1].id:null};
  }
  function exportAll(owner:string) {
    return {
      courses:(db.prepare('SELECT * FROM study_courses WHERE owner_id=? ORDER BY id').all(owner) as Row[]).map(row=>serialize<CourseInput>(row)),
      items:(db.prepare('SELECT * FROM study_items WHERE owner_id=? ORDER BY id').all(owner) as Row[]).map(row=>serialize<ItemInput>(row)),
    };
  }
  function calendar(owner:string, query:{from:string;to:string;timezone:string}) {
    const items = exportAll(owner).items;
    const formatter = new Intl.DateTimeFormat('en-CA',{timeZone:query.timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
    const local = (timestamp:string) => {
      const p = Object.fromEntries(formatter.formatToParts(new Date(timestamp)).map(p=>[p.type,p.value]));
      return {date:`${p.year}-${p.month}-${p.day}`,midnight:p.hour === '00' && p.minute === '00' && p.second === '00' && new Date(timestamp).getUTCMilliseconds() === 0};
    };
    const days:{date:string;events:StudyItem[];tasks:StudyItem[]}[] = [];
    for(let timestamp=Date.parse(query.from);timestamp<Date.parse(query.to);timestamp+=86400_000) {
      const date = new Date(timestamp).toISOString().slice(0,10);
      const events = items.filter(item=>{
        if(item.kind !== 'event' || item.status !== 'active') return false;
        if(item.all_day) return item.start_date! <= date && (item.end_date ? item.end_date > date : item.start_date === date);
        const start = local(item.starts_at!);
        if(!item.ends_at) return start.date === date;
        const end = local(item.ends_at);
        return start.date <= date && (end.date > date || (end.date === date && !end.midnight));
      }).sort((a,b)=>{
        if(a.kind !== 'event' || b.kind !== 'event') return 0;
        return Number(b.all_day)-Number(a.all_day) || (a.starts_at ?? a.start_date!).localeCompare(b.starts_at ?? b.start_date!) || a.id.localeCompare(b.id);
      });
      const tasks = items.filter(item=>item.kind === 'task' && (item.due_date === date || (item.due_at && local(item.due_at).date === date)));
      days.push({date,events,tasks});
    }
    return {from:query.from,to:query.to,timezone:query.timezone,days,undated_tasks:items.filter(item=>item.kind === 'task' && !item.due_at && !item.due_date && item.status === 'open')};
  }
  return {create,get,update,remove,list,exportAll,calendar};
}

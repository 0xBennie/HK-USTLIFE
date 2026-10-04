import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { z } from 'zod';
import { transaction } from '../database.js';
import { ApiError } from '../errors.js';
import { parseCalendar, expandSeries, occurrenceAt, summarizeSeries, type CalendarSeries, type ImportIssue } from './ics.js';
import type { ImportedEvent,ImportPreview } from './types.js';
import { timezone, itemSchema } from '../learning/schemas.js';

const previewInput=z.object({source_id:z.string().uuid().optional(),source_name:z.string().trim().min(1).max(120).optional(),content:z.string().max(256*1024),floating_timezone:timezone.optional()}).strict()
  .refine(v=>Boolean(v.source_id)!==Boolean(v.source_name),'Choose an existing source or name a new one.');
const confirmationInput=z.object({uids:z.array(z.string().min(1)).min(1).max(500),acknowledge_fingerprints:z.boolean().default(false),resolutions:z.record(z.enum(['keep_local','use_source'])).default({})}).strict()
  .refine(v=>new Set(v.uids).size===v.uids.length,'Duplicate selection.');
type Source={id:string;name:string;version:number;created_at:number};
type Row={id:string;uid:string;definition:string;version:number};
type Entry={summary:ReturnType<typeof summarizeSeries>;previous_summary:ReturnType<typeof summarizeSeries>|null;series:CalendarSeries;expected_version:number|null;action:'new'|'unchanged'|'update'|'conflict';local_changes:number;previous_title:string|null};
type Snapshot={source:Source;existing:boolean;entries:Entry[];issues:ImportIssue[]};
const absent=()=>new ApiError(404,'NOT_FOUND','Calendar resource not found.');
const stale=()=>new ApiError(409,'STALE_PREVIEW','Calendar changed. Generate and review a new preview.');

export function createCalendarStore(db:DatabaseSync,now:()=>number=Date.now) {
  db.prepare('DELETE FROM calendar_previews WHERE expires_at<=?').run(now());
  function overrides(owner:string,seriesId:string) {
    const records=db.prepare('SELECT recurrence_id,payload FROM calendar_overrides WHERE owner_id=? AND series_id=? ORDER BY recurrence_id').all(owner,seriesId) as {recurrence_id:string;payload:string}[];
    return records.map(r=>({recurrence_id:r.recurrence_id,payload:JSON.parse(r.payload) as Extract<z.infer<typeof itemSchema>,{kind:'event'}>}));
  }
  function detail(owner:string,id:string) {
    return {...source(owner,id),series:rows(owner,id).map(r=>({id:r.id,version:r.version,summary:summarizeSeries(JSON.parse(r.definition)),overrides:overrides(owner,r.id)}))};
  }
  function resetOccurrence(owner:string,seriesId:string,input:unknown) {
    const value=z.object({version:z.number().int().positive(),recurrence_id:z.string().min(10).max(40)}).strict().parse(input);
    return transaction(db,()=>{
      const row=db.prepare('SELECT version,source_id FROM calendar_series WHERE owner_id=? AND id=?').get(owner,seriesId) as {version:number;source_id:string}|undefined;
      if(!row)throw absent();if(row.version!==value.version)throw new ApiError(409,'VERSION_CONFLICT','Refresh before resetting this occurrence.');
      if(!db.prepare('DELETE FROM calendar_overrides WHERE owner_id=? AND series_id=? AND recurrence_id=?').run(owner,seriesId,value.recurrence_id).changes)throw absent();
      db.prepare('UPDATE calendar_series SET version=version+1 WHERE owner_id=? AND id=?').run(owner,seriesId);
      db.prepare('UPDATE calendar_sources SET version=version+1 WHERE owner_id=? AND id=?').run(owner,row.source_id);
      return {reset:true,version:row.version+1};
    });
  }
  function setOccurrenceStatus(owner:string,seriesId:string,input:unknown) {
    const value=z.object({version:z.number().int().positive(),recurrence_id:z.string().min(10).max(40),status:z.enum(['active','cancelled'])}).strict().parse(input);
    const row=db.prepare('SELECT definition FROM calendar_series WHERE owner_id=? AND id=?').get(owner,seriesId) as {definition:string}|undefined;
    if(!row)throw absent();
    const local=overrides(owner,seriesId).find(o=>o.recurrence_id===value.recurrence_id);
    let original;
    try {original=occurrenceAt(JSON.parse(row.definition),value.recurrence_id);}catch {throw new ApiError(400,'INVALID_OCCURRENCE','This occurrence cannot be resolved.');}
    if(!local&&!original)throw absent();
    const base=local?.payload??{kind:'event' as const,title:original!.title,body:original!.body,location:original!.location,timezone:timezone.safeParse(original!.timezone).success?original!.timezone:'UTC',all_day:original!.all_day,starts_at:original!.starts_at,ends_at:original!.ends_at,start_date:original!.start_date,end_date:original!.end_date};
    // Restoring a date that was only cancelled drops the private record, so the date follows the file again
    // instead of staying pinned as a local change (which would also block later updates from the file).
    const fields=['title','body','location','all_day','starts_at','ends_at','start_date','end_date'] as const;
    if(value.status==='active'&&local&&original&&fields.every(k=>((local.payload as Record<string,unknown>)[k]??null)===((original as Record<string,unknown>)[k]??null)))
      return resetOccurrence(owner,seriesId,{version:value.version,recurrence_id:value.recurrence_id});
    return editOccurrence(owner,seriesId,{version:value.version,recurrence_id:value.recurrence_id,event:{...base,status:value.status}});
  }
  function editOccurrence(owner:string,seriesId:string,input:unknown) {
    const value=z.object({version:z.number().int().positive(),recurrence_id:z.string().min(10).max(40),event:itemSchema}).strict().parse(input);
    if(value.event.kind!=='event'||value.event.course_id!==null)throw new ApiError(400,'INVALID_OVERRIDE','Only private event fields can override an imported occurrence.');
    return transaction(db,()=>{
      const row=db.prepare('SELECT id,uid,definition,version,source_id FROM calendar_series WHERE owner_id=? AND id=?').get(owner,seriesId) as (Row&{source_id:string})|undefined;
      if(!row)throw absent();if(row.version!==value.version)throw new ApiError(409,'VERSION_CONFLICT','This series changed. Refresh before editing.');
      const existing=overrides(owner,seriesId).find(o=>o.recurrence_id===value.recurrence_id);
      let original;
      try {original=occurrenceAt(JSON.parse(row.definition),value.recurrence_id);}catch {throw new ApiError(400,'INVALID_OCCURRENCE','This occurrence cannot be resolved.');}
      if(!original&&!existing)throw absent();
      const count=db.prepare('SELECT COUNT(*) AS n FROM calendar_overrides WHERE owner_id=?').get(owner) as {n:number};
      if(!existing&&count.n>=200)throw new ApiError(409,'OVERRIDE_LIMIT','At most 200 private occurrence changes. Reset unused changes first.');
      db.prepare('INSERT INTO calendar_overrides(owner_id,series_id,recurrence_id,payload) VALUES(?,?,?,?) ON CONFLICT(owner_id,series_id,recurrence_id) DO UPDATE SET payload=excluded.payload').run(owner,seriesId,value.recurrence_id,JSON.stringify(value.event));
      db.prepare('UPDATE calendar_series SET version=version+1 WHERE owner_id=? AND id=?').run(owner,seriesId);
      db.prepare('UPDATE calendar_sources SET version=version+1 WHERE owner_id=? AND id=?').run(owner,row.source_id);
      return {series_id:seriesId,version:row.version+1,recurrence_id:value.recurrence_id,event:value.event};
    });
  }
  function source(owner:string,id:string):Source {
    const row=db.prepare('SELECT id,name,version,created_at FROM calendar_sources WHERE owner_id=? AND id=?').get(owner,id) as Source|undefined;
    if(!row)throw absent();return row;
  }
  function rows(owner:string,id:string):Row[] {
    return db.prepare('SELECT id,uid,definition,version FROM calendar_series WHERE owner_id=? AND source_id=? ORDER BY uid').all(owner,id) as Row[];
  }
  function readPreview(owner:string,id:string) {
    const row=db.prepare('SELECT snapshot,expires_at,confirmation,result FROM calendar_previews WHERE owner_id=? AND id=?').get(owner,id) as {snapshot:string;expires_at:number;confirmation:string|null;result:string|null}|undefined;
    if(!row)throw absent();
    if(row.expires_at<=now()){db.prepare('DELETE FROM calendar_previews WHERE owner_id=? AND id=?').run(owner,id);throw new ApiError(410,'PREVIEW_EXPIRED','Generate a new preview.');}
    return row;
  }
  function getPreview(owner:string,id:string) {
    const saved=readPreview(owner,id);
    return saved.confirmation?{id,state:'confirmed' as const,result:JSON.parse(saved.result!)}:{id,state:'pending' as const,expires_at:saved.expires_at,...JSON.parse(saved.snapshot) as Snapshot};
  }
  function preview(owner:string,input:unknown) {
    const value=previewInput.parse(input);
    let parsed:ReturnType<typeof parseCalendar>;
    try {parsed=parseCalendar(value.content,value.floating_timezone);}catch {throw new ApiError(400,'INVALID_CALENDAR','The calendar cannot be safely parsed. Check file size, dates and format.');}
    const target=value.source_id?source(owner,value.source_id):{id:randomUUID(),name:value.source_name!,version:1,created_at:now()};
    const previous=new Map(rows(owner,target.id).map(r=>[r.uid,r]));
    const snapshot:Snapshot={source:target,existing:Boolean(value.source_id),issues:parsed.issues,entries:parsed.series.map(series=>{
      const row=previous.get(series.uid),old=row?JSON.parse(row.definition) as CalendarSeries:null;
      const local_changes=row?overrides(owner,row.id).length:0;
      return {summary:summarizeSeries(series),previous_summary:old?summarizeSeries(old):null,series,local_changes,expected_version:row?.version??null,action:!row?'new':old!.fingerprint===series.fingerprint?'unchanged':local_changes?'conflict':'update',previous_title:old?.title??null};
    })};
    const id=randomUUID(),expires_at=now()+30*60_000;
    transaction(db,()=>{
      db.prepare('DELETE FROM calendar_previews WHERE owner_id=? AND expires_at<=?').run(owner,now());
      const count=db.prepare('SELECT COUNT(*) AS n FROM calendar_previews WHERE owner_id=? AND confirmation IS NULL').get(owner) as {n:number};
      if(count.n>=20)throw new ApiError(429,'PREVIEW_LIMIT','Too many pending previews. Wait for older previews to expire.');
      db.prepare('INSERT INTO calendar_previews(id,owner_id,snapshot,expires_at) VALUES(?,?,?,?)').run(id,owner,JSON.stringify(snapshot),expires_at);
    });
    return {id,expires_at,...snapshot} satisfies ImportPreview;
  }
  function confirm(owner:string,id:string,input:unknown) {
    const value=confirmationInput.parse(input),signature=JSON.stringify({...value,uids:[...value.uids].sort(),resolutions:Object.fromEntries(Object.entries(value.resolutions).sort(([a],[b])=>a.localeCompare(b)))});
    return transaction(db,()=>{
      const saved=readPreview(owner,id);
        if(saved.confirmation) {
        if(saved.confirmation!==signature)throw new ApiError(409,'CONFIRMATION_CHANGED','This preview was confirmed with another selection.');
        const result=JSON.parse(saved.result!) as {source_id:string;imported:number};
        try{source(owner,result.source_id);}catch{throw new ApiError(410,'SOURCE_DELETED','The confirmed source was deleted.');}
        return result;
      }
      const snapshot=JSON.parse(saved.snapshot) as Snapshot;
      const entries=value.uids.map(uid=>{const e=snapshot.entries.find(e=>e.series.uid===uid);if(!e)throw new ApiError(400,'INVALID_SELECTION','Select only preview entries.');return e;});
      if(entries.some(e=>e.series.identity==='fingerprint')&&!value.acknowledge_fingerprints)throw new ApiError(409,'IDENTITY_REVIEW_REQUIRED','Review entries without source UIDs explicitly.');
      if(snapshot.existing&&source(owner,snapshot.source.id).version!==snapshot.source.version)throw stale();
      const current=new Map(rows(owner,snapshot.source.id).map(r=>[r.uid,r]));
      for(const entry of entries)if((current.get(entry.series.uid)?.version??null)!==entry.expected_version)throw stale();
      for(const entry of entries)if(entry.action==='conflict'&&!value.resolutions[entry.series.uid])throw new ApiError(409,'LOCAL_CONFLICT','Choose whether to keep local occurrences or use the new source.');
      if(Object.keys(value.resolutions).some(uid=>!entries.some(e=>e.series.uid===uid&&e.action==='conflict')))throw new ApiError(400,'INVALID_RESOLUTION','Resolution must refer to a selected conflict.');
      const sourceCount=db.prepare('SELECT COUNT(*) AS n FROM calendar_sources WHERE owner_id=?').get(owner) as {n:number};
      const seriesCount=db.prepare('SELECT COUNT(*) AS n FROM calendar_series WHERE owner_id=?').get(owner) as {n:number};
      if((!snapshot.existing&&sourceCount.n>=20)||seriesCount.n+entries.filter(e=>e.action==='new').length>2000)throw new ApiError(409,'IMPORT_LIMIT','At most 20 sources and 2000 series. Remove unused sources first.');
      if(!snapshot.existing)db.prepare('INSERT INTO calendar_sources(id,owner_id,name,created_at) VALUES(?,?,?,?)').run(snapshot.source.id,owner,snapshot.source.name,now());
      for(const entry of entries) {
        if(entry.action==='unchanged')continue;
        const row=current.get(entry.series.uid);
        if(row&&value.resolutions[entry.series.uid]==='use_source')db.prepare('DELETE FROM calendar_overrides WHERE owner_id=? AND series_id=?').run(owner,row.id);
        if(row)db.prepare('UPDATE calendar_series SET definition=?,version=version+1 WHERE id=? AND owner_id=?').run(JSON.stringify(entry.series),row.id,owner);
        else db.prepare('INSERT INTO calendar_series(id,owner_id,source_id,uid,definition) VALUES(?,?,?,?,?)').run(randomUUID(),owner,snapshot.source.id,entry.series.uid,JSON.stringify(entry.series));
      }
      db.prepare('UPDATE calendar_sources SET version=version+1 WHERE owner_id=? AND id=?').run(owner,snapshot.source.id);
      const result={source_id:snapshot.source.id,imported:entries.filter(e=>e.action!=='unchanged').length};
      db.prepare('UPDATE calendar_previews SET confirmation=?,result=?,snapshot=?,expires_at=? WHERE owner_id=? AND id=?').run(signature,JSON.stringify(result),JSON.stringify({source:{id:snapshot.source.id}}),now()+86400_000,owner,id);
      return result;
    });
  }
  function exportAll(owner:string) {
    const sources=db.prepare('SELECT id,name,version,created_at FROM calendar_sources WHERE owner_id=? ORDER BY created_at,id').all(owner) as Source[];
    return sources.map(s=>({...s,series:rows(owner,s.id).map(r=>({id:r.id,version:r.version,overrides:overrides(owner,r.id),...JSON.parse(r.definition) as CalendarSeries}))}));
  }
  function occurrences(owner:string,range:{from:string;to:string}) {
    const items:ImportedEvent[]=[],issues:{source_id:string;series_id:string;title:string;code:string}[]=[];
    for(const source of exportAll(owner))for(const series of source.series) {
      try {
        const local=new Map(series.overrides.map(o=>[o.recurrence_id,o]));
        const expanded=expandSeries(series,range).filter(o=>!local.has(o.recurrence_id));
        const projected=[...expanded.map(o=>({...o,locally_modified:false,source_occurrence_missing:false})),...series.overrides.map(o=>({...o.payload,recurrence_id:o.recurrence_id,source_status:'unspecified' as const,participation:'unknown' as const,locally_modified:true,source_occurrence_missing:!occurrenceAt(series,o.recurrence_id)}))];
        if(items.length+projected.length>5000)throw new Error('Calendar range exceeds occurrence limit.');
        for(const occurrence of projected)items.push({...occurrence,kind:'event',id:`ics:${series.id}:${occurrence.recurrence_id}`,version:series.version,course_id:null,remind_minutes:'remind_minutes' in occurrence?occurrence.remind_minutes:null,
          import_origin:{source_id:source.id,source_name:source.name,series_id:series.id,recurrence_id:occurrence.recurrence_id}});
      } catch {issues.push({source_id:source.id,series_id:series.id,title:series.title,code:'EXPANSION_UNAVAILABLE'});}
    }
    return {items,issues};
  }
  function remove(owner:string,id:string,version:number) {
    return transaction(db,()=>{if(source(owner,id).version!==version)throw stale();db.prepare('DELETE FROM calendar_sources WHERE owner_id=? AND id=?').run(owner,id);db.prepare("DELETE FROM calendar_previews WHERE owner_id=? AND confirmation IS NULL AND json_extract(snapshot,'$.source.id')=?").run(owner,id);return {deleted:true};});
  }
  return {preview,confirm,exportAll,remove,occurrences,editOccurrence,detail,resetOccurrence,setOccurrenceStatus,getPreview};
}

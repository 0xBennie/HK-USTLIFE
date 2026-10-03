import {randomUUID} from 'node:crypto';
import type {DatabaseSync} from 'node:sqlite';
import {z} from 'zod';
import {transaction} from '../database.js';
import {ApiError} from '../errors.js';
import {directoryData} from './directory-data.js';
import {shuttleData} from './shuttle-data.js';
export const targetSchema=z.object({target_kind:z.enum(['place','shuttle']),target_id:z.string().min(1).max(100)}).strict();
export const directoryQuery=z.object({q:z.string().trim().max(100).default(''),category:z.enum(['study','shop','service']).optional()}).strict();
type Target=z.infer<typeof targetSchema>;
type Entry=typeof directoryData[number];
type Correction=Target&{id:string;message:string;status:'pending'|'resolved'|'rejected';resolution:string;created_at:number;version:number;reviewed_at:number|null};
export function createDirectoryStore(db:DatabaseSync,now:()=>number) {
  transaction(db,()=>{for(const entry of directoryData)db.prepare('INSERT INTO campus_entries(id,payload) VALUES(?,?) ON CONFLICT(id) DO NOTHING').run(entry.id,JSON.stringify(entry));});
  function entry(id:string) {
    const row=db.prepare('SELECT payload,version FROM campus_entries WHERE id=?').get(id) as {payload:string;version:number}|undefined;
    if(!row)throw new ApiError(404,'PLACE_NOT_FOUND','Place is not in the reviewed directory.');
    const data=JSON.parse(row.payload) as Entry;
    return {...data,version:row.version,freshness:now()>=Date.parse(data.review_due_at)?'stale':'reviewed_snapshot'};
  }
  function list(input:unknown) {
    const query=directoryQuery.parse(input);
    return (db.prepare('SELECT id FROM campus_entries ORDER BY id').all() as {id:string}[]).map(r=>entry(r.id)).filter(e=>(!query.category||e.category===query.category)&&`${e.name.zh} ${e.name.en} ${e.location.zh} ${e.location.en} ${e.description.zh} ${e.description.en}`.toLowerCase().includes(query.q.toLowerCase()));
  }
  function validateTarget(target:Target) {
    if(target.target_kind==='place')entry(target.target_id);
    else if(!shuttleData.routes.some(r=>r.id===target.target_id))throw new ApiError(404,'ROUTE_NOT_FOUND','Route is not in the reviewed catalog.');
  }
  function bookmarks(owner:string) {
    return db.prepare('SELECT target_kind,target_id,created_at FROM campus_bookmarks WHERE owner_id=? ORDER BY created_at DESC,target_kind,target_id').all(owner) as (Target&{created_at:number})[];
  }
  function bookmark(owner:string,input:unknown,save:boolean) {
    const target=targetSchema.parse(input);
    return transaction(db,()=>{
      if(save){validateTarget(target);db.prepare('INSERT INTO campus_bookmarks(owner_id,target_kind,target_id,created_at) VALUES(?,?,?,?) ON CONFLICT(owner_id,target_kind,target_id) DO NOTHING').run(owner,target.target_kind,target.target_id,now());}
      else db.prepare('DELETE FROM campus_bookmarks WHERE owner_id=? AND target_kind=? AND target_id=?').run(owner,target.target_kind,target.target_id);
      return {...target,saved:save};
    });
  }
  function corrections(owner:string) {return db.prepare('SELECT id,target_kind,target_id,message,status,resolution,created_at,version,reviewed_at FROM campus_corrections WHERE owner_id=? ORDER BY created_at DESC,id').all(owner) as Correction[];}
  function correction(owner:string,input:unknown,key:unknown) {
    const value=targetSchema.extend({message:z.string().trim().min(5).max(2000)}).strict().parse(input);
    const requestKey=z.string().min(8).max(128).regex(/^[A-Za-z0-9_-]+$/).parse(key);
    return transaction(db,()=>{
      const previous=db.prepare('SELECT id,target_kind,target_id,message,status,resolution,created_at,version,reviewed_at FROM campus_corrections WHERE owner_id=? AND request_key=?').get(owner,requestKey) as Correction|undefined;
      if(previous){if(previous.message!==value.message||previous.target_kind!==value.target_kind||previous.target_id!==value.target_id)throw new ApiError(409,'IDEMPOTENCY_CONFLICT','Retry key was used with different content.');return previous;}
      validateTarget(value);
      const count=db.prepare('SELECT COUNT(*) AS n FROM campus_corrections WHERE owner_id=? AND created_at>?').get(owner,now()-86400_000) as {n:number};
      if(count.n>=20)throw new ApiError(429,'CORRECTION_LIMIT','At most 20 correction requests per day.');
      const record={id:randomUUID(),...value,status:'pending' as const,resolution:'',created_at:now(),version:1,reviewed_at:null};
      db.prepare('INSERT INTO campus_corrections(id,owner_id,target_kind,target_id,message,created_at,request_key) VALUES(?,?,?,?,?,?,?)').run(record.id,owner,value.target_kind,value.target_id,value.message,record.created_at,requestKey);
      return record;
    });
  }
  return {entry,list,bookmarks,bookmark,corrections,correction,exportAll:(owner:string)=>({bookmarks:bookmarks(owner),corrections:corrections(owner)})};
}

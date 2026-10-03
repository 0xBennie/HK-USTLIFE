import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { z } from 'zod';
import { transaction } from '../database.js';
import { ApiError } from '../errors.js';
import { contractsSchema, parseRecord, personalSchema, schoolListSchema, type Contracts, type Provider, type Personal, type SourceRecord } from './schemas.js';

type Connection = {owner_id:string;provider:Provider;subject:string;consent_version:string;approval_reference:string;generation:number;version:number;revoked_at:number|null};
type Scope = {scope_id:string;state:string;last_attempt_at:number|null;last_success_at:number|null;error_code:string|null;active_run:string|null;lease_until:number|null};
type Row = {id:string;owner_id:string;provider:Provider;scope_id:string;remote_key:string;payload:string;source_state:string;source_updated_at:string|null;source_seen_at:number;version:number};
export type Lease = {owner:string;provider:Provider;scope:string;generation:number;run:string};
const iso = (value:number|null) => value === null ? null : new Date(value).toISOString();
const emptyPersonal = ():Personal => ({notes:'',completed:false,remind_minutes:null,version:0});
const canonical = (value:unknown):string => value && typeof value === 'object'
  ? Array.isArray(value) ? `[${value.map(canonical).join(',')}]` : `{${Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`
  : JSON.stringify(value);

export function createSchoolStore(db:DatabaseSync, now:()=>number, suppliedContracts:Contracts = {}) {
  // Zod creates an isolated validated copy; callers cannot change a running worker's scope policy.
  const contracts = contractsSchema.parse(suppliedContracts);
  const connection = (owner:string, provider:Provider) => db.prepare('SELECT * FROM school_connections WHERE owner_id=? AND provider=?').get(owner,provider) as Connection|undefined;
  function contract(provider:Provider) {
    const c = contracts[provider];
    if (!c?.approval_reference.trim() || !c.consent_version.trim() || !c.scopes.length) throw new ApiError(409,'SCHOOL_APPROVAL_REQUIRED','School approval is required.');
    return c;
  }
  function authorized(owner:string,provider:Provider) {
    const c = contract(provider), row = connection(owner,provider);
    if(!row || row.revoked_at !== null) throw new ApiError(409,'SCHOOL_AUTH_REQUIRED','School authorization is required.');
    if(row.consent_version !== c.consent_version || row.approval_reference !== c.approval_reference) throw new ApiError(409,'SCHOOL_REAUTH_REQUIRED','School authorization must be renewed.');
    if(db.prepare("SELECT 1 FROM school_scopes WHERE owner_id=? AND provider=? AND state='reauth_required' LIMIT 1").get(owner,provider)) {
      throw new ApiError(409,'SCHOOL_REAUTH_REQUIRED','School authorization must be renewed.');
    }
    return row;
  }
  function grant(owner:string,provider:Provider,input:{subject:string;consent_version:string}) {
    const c = contract(provider);
    z.object({subject:z.string().min(1).max(500),consent_version:z.literal(c.consent_version)}).strict().parse(input);
    return transaction(db,()=>{
      const old = connection(owner,provider);
      if(old && old.subject !== input.subject) throw new ApiError(409,'SCHOOL_IDENTITY_MISMATCH','School identity cannot change on this connection.');
      db.prepare(`INSERT INTO school_connections(owner_id,provider,subject,consent_version,approval_reference,generation,version)
        VALUES(?,?,?,?,?,1,1) ON CONFLICT(owner_id,provider) DO UPDATE SET consent_version=excluded.consent_version,
        approval_reference=excluded.approval_reference,generation=generation+1,version=version+1,revoked_at=NULL`)
        .run(owner,provider,input.subject,input.consent_version,c.approval_reference);
      // A new grant invalidates every previous worker, including jobs from a previous process.
      db.prepare("UPDATE school_scopes SET active_run=NULL,lease_until=NULL,state='not_connected',error_code=NULL WHERE owner_id=? AND provider=?").run(owner,provider);
      for(const scope of c.scopes) db.prepare("INSERT OR IGNORE INTO school_scopes(owner_id,provider,scope_id,state) VALUES(?,?,?,'not_connected')").run(owner,provider,scope.id);
      return status(owner).find(s=>s.provider===provider)!;
    });
  }
  function scopeContract(provider:Provider,scope:string) {
    const allowed = contract(provider).scopes.find(s=>s.id===scope);
    if(!allowed) throw new ApiError(409,'SCHOOL_SCOPE_UNAPPROVED','This school data scope is not approved.');
    return allowed;
  }
  function begin(owner:string,provider:Provider,scope:string):Lease {
    return transaction(db,()=>{
      const c = authorized(owner,provider); scopeContract(provider,scope);
      const s = db.prepare('SELECT * FROM school_scopes WHERE owner_id=? AND provider=? AND scope_id=?').get(owner,provider,scope) as Scope|undefined;
      if(!s) throw new ApiError(409,'SCHOOL_REAUTH_REQUIRED','School authorization must include this scope.');
      if(s.active_run && (s.lease_until ?? 0) > now()) throw new ApiError(409,'SYNC_BUSY','A sync is already running for this scope.');
      const run = randomUUID();
      db.prepare("UPDATE school_scopes SET state='syncing',active_run=?,lease_until=?,last_attempt_at=?,error_code=NULL WHERE owner_id=? AND provider=? AND scope_id=?")
        .run(run,now()+300_000,now(),owner,provider,scope);
      return {owner,provider,scope,generation:c.generation,run};
    });
  }
  function current(lease:Lease) {
    try {
      const c = authorized(lease.owner,lease.provider); scopeContract(lease.provider,lease.scope);
      const s = db.prepare('SELECT * FROM school_scopes WHERE owner_id=? AND provider=? AND scope_id=?').get(lease.owner,lease.provider,lease.scope) as Scope|undefined;
      return c.generation === lease.generation && s?.active_run === lease.run && (s.lease_until ?? 0) > now();
    } catch(error) { if(error instanceof ApiError) return false; throw error; }
  }
  function commit(lease:Lease,inputs:unknown[]) {
    const scope = scopeContract(lease.provider,lease.scope);
    const parsed = inputs.map(input=>parseRecord(scope.collection,input));
    if(parsed.length > 10_000 || new Set(parsed.map(r=>r.key)).size !== parsed.length) throw new ApiError(400,'INVALID_SCHOOL_SNAPSHOT','School snapshot has duplicate identities or too many records.');
    return transaction(db,()=>{
      if(!current(lease)) throw new ApiError(409,'SYNC_OBSOLETE','This sync is obsolete.');
      const {owner,provider,scope:scopeId} = lease, stamp = now();
      const existing = db.prepare('SELECT * FROM school_records WHERE owner_id=? AND provider=? AND scope_id=?').all(owner,provider,scopeId) as Row[];
      const byKey = new Map(existing.map(r=>[r.remote_key,r]));
      for(const record of parsed) {
        const old = byKey.get(record.key), payload = canonical(record.payload);
        const changed = old && (old.payload !== payload || old.source_state !== record.state || old.source_updated_at !== record.source_updated_at);
        if(old) db.prepare('UPDATE school_records SET payload=?,source_state=?,source_updated_at=?,source_seen_at=?,version=version+? WHERE id=?')
          .run(payload,record.state,record.source_updated_at,stamp,changed?1:0,old.id);
        else db.prepare('INSERT INTO school_records(id,owner_id,provider,scope_id,remote_key,payload,source_state,source_updated_at,source_seen_at,version) VALUES(?,?,?,?,?,?,?,?,?,1)')
          .run(randomUUID(),owner,provider,scopeId,record.key,payload,record.state,record.source_updated_at,stamp);
        byKey.delete(record.key);
      }
      if(scope.missing === 'remove') for(const row of byKey.values()) {
        if(row.source_state !== 'removed') db.prepare("UPDATE school_records SET source_state='removed',version=version+1,source_seen_at=? WHERE id=?").run(stamp,row.id);
      }
      db.prepare("UPDATE school_scopes SET state='connected',last_success_at=?,active_run=NULL,lease_until=NULL,error_code=NULL WHERE owner_id=? AND provider=? AND scope_id=?")
        .run(stamp,owner,provider,scopeId);
      return {state:'connected' as const,records:parsed.length};
    });
  }
  function fail(lease:Lease,code:'FETCH_FAILED'|'PARTIAL_FETCH'|'INVALID_SNAPSHOT'|'REAUTH_REQUIRED') {
    return transaction(db,()=>{
      if(!current(lease)) return false;
      const state = code === 'REAUTH_REQUIRED' ? 'reauth_required' : code === 'PARTIAL_FETCH' ? 'partial' : 'error';
      db.prepare('UPDATE school_scopes SET state=?,error_code=?,active_run=NULL,lease_until=NULL WHERE owner_id=? AND provider=? AND scope_id=?')
        .run(state,code,lease.owner,lease.provider,lease.scope);
      return true;
    });
  }
  function status(owner:string) {
    return (['sis','canvas'] as const).map(provider=>{
      const c = contracts[provider], row = connection(owner,provider);
      const storedScopes = db.prepare('SELECT * FROM school_scopes WHERE owner_id=? AND provider=? ORDER BY scope_id').all(owner,provider) as Scope[];
      const scopes = (c?.scopes ?? []).map(allowed=>{
        const s=storedScopes.find(row=>row.scope_id===allowed.id);
        if(!s) return {id:allowed.id,state:'not_connected',last_attempt_at:null,last_success_at:null,error_code:null};
        const interrupted=Boolean(s.active_run && (s.lease_until ?? 0)<=now());
        return {id:s.scope_id,state:interrupted?'error':s.state,
          last_attempt_at:iso(s.last_attempt_at),last_success_at:iso(s.last_success_at),
          error_code:interrupted?'SYNC_INTERRUPTED':s.error_code};
      });
      let state:string = 'not_connected';
      if(row?.revoked_at !== null && row?.revoked_at !== undefined) state='revoked';
      else if(!c) state='approval_required';
      else if(row && (row.consent_version!==c.consent_version || row.approval_reference!==c.approval_reference)) state='reauth_required';
      else if(scopes.some(s=>s.state==='reauth_required')) state='reauth_required';
      else if(scopes.some(s=>s.state==='syncing')) state='syncing';
      else if(scopes.length && scopes.every(s=>s.state==='connected')) state='connected';
      else if(scopes.some(s=>s.state==='connected'||s.state==='partial')) state='partial';
      else if(scopes.some(s=>s.state==='error')) state='error';
      const latest = (field:'last_attempt_at'|'last_success_at')=>scopes.map(s=>s[field]).filter((v):v is string=>v!==null).sort().at(-1)??null;
      return {provider,state,availability:c?'configured':'approval_required',version:row?.version??0,consent_version:row?.consent_version??null,
        last_attempt_at:latest('last_attempt_at'),last_success_at:latest('last_success_at'),scopes};
    });
  }
  function raw(owner:string,id:string) {
    const row=db.prepare('SELECT * FROM school_records WHERE owner_id=? AND id=?').get(owner,id) as Row|undefined;
    if(!row) throw new ApiError(404,'NOT_FOUND','School record not found.');
    return row;
  }
  function serialize(row:Row) {
    const p=db.prepare('SELECT notes,completed,remind_minutes,version FROM school_personal WHERE owner_id=? AND record_id=?').get(row.owner_id,row.id);
    const personal:Personal = p ? {notes:String(p.notes),completed:p.completed===1,remind_minutes:p.remind_minutes===null?null:Number(p.remind_minutes),version:Number(p.version)} : emptyPersonal();
    return {id:row.id,provider:row.provider,scope:row.scope_id,remote_key:row.remote_key,payload:JSON.parse(row.payload) as SourceRecord['payload'],
      source_state:row.source_state,source_updated_at:row.source_updated_at,source_seen_at:iso(row.source_seen_at),version:row.version,personal};
  }
  function get(owner:string,id:string) { return serialize(raw(owner,id)); }
  function list(owner:string,query:unknown) {
    const q=schoolListSchema.parse(query),params:(string|number)[]=[owner]; let where='owner_id=?';
    if(q.cursor){where+=' AND id>?';params.push(q.cursor);}
    if(q.provider){where+=' AND provider=?';params.push(q.provider);}
    const rows=db.prepare(`SELECT * FROM school_records WHERE ${where} ORDER BY id LIMIT ?`).all(...params,q.limit+1) as Row[];
    return {items:rows.slice(0,q.limit).map(serialize),next_cursor:rows.length>q.limit?rows[q.limit-1].id:null};
  }
  function annotate(owner:string,id:string,input:unknown) {
    const body=personalSchema.parse(input);
    return transaction(db,()=>{
      const record=get(owner,id),p=record.personal;
      if(p.version!==body.version) throw new ApiError(409,'VERSION_CONFLICT','Personal notes changed. Reload before editing.');
      const next={...p,...body},source=record.payload;
      if(next.remind_minutes!==null && (!('kind' in source) || (source.kind==='event'?!source.starts_at:source.kind==='task'?!source.due_at:true))) {
        throw new ApiError(400,'INVALID_INPUT','A personal reminder needs a timed source record.');
      }
      db.prepare(`INSERT INTO school_personal(record_id,owner_id,notes,completed,remind_minutes,version) VALUES(?,?,?,?,?,1)
        ON CONFLICT(record_id) DO UPDATE SET notes=excluded.notes,completed=excluded.completed,remind_minutes=excluded.remind_minutes,version=school_personal.version+1`)
        .run(id,owner,next.notes,next.completed?1:0,next.remind_minutes);
      return get(owner,id);
    });
  }
  function revoke(owner:string,provider:Provider,version:number,deleteCachedData:boolean) {
    return transaction(db,()=>{
      const row=connection(owner,provider);
      if(!row) throw new ApiError(404,'NOT_FOUND','School connection not found.');
      if(row.version!==version) throw new ApiError(409,'VERSION_CONFLICT','School connection changed. Reload before revoking.');
      db.prepare('UPDATE school_connections SET revoked_at=?,generation=generation+1,version=version+1 WHERE owner_id=? AND provider=?').run(now(),owner,provider);
      db.prepare("UPDATE school_scopes SET active_run=NULL,lease_until=NULL,state='revoked',error_code=NULL WHERE owner_id=? AND provider=?").run(owner,provider);
      if(deleteCachedData) db.prepare('DELETE FROM school_records WHERE owner_id=? AND provider=?').run(owner,provider);
      return {connection:status(owner).find(s=>s.provider===provider)!,cache:deleteCachedData?'deleted':'retained',upstream_revocation:'not_attempted' as const};
    });
  }
  function exportAll(owner:string) {
    const rows=db.prepare('SELECT * FROM school_records WHERE owner_id=? ORDER BY id').all(owner) as Row[];
    return {connections:status(owner),records:rows.map(serialize)};
  }
  return {grant,begin,current,commit,fail,status,list,get,annotate,revoke,exportAll};
}

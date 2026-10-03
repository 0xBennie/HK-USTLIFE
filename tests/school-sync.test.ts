import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from '../src/product/database.js';
import { createSchoolStore } from '../src/product/school/store.js';
import { syncSchoolScope, SchoolAuthorizationExpired } from '../src/product/school/sync.js';

// These are internal normalized adapter fixtures, NOT HKUST response shapes or actual approval.
const contracts = {
  sis: { approval_reference: 'fixture-only', consent_version: 'v1', scopes: [
    { id: 'fall', collection: 'timetable', missing: 'remove' },
    { id: 'spring', collection: 'timetable', missing: 'retain' },
  ] },
  canvas: { approval_reference: 'fixture-only', consent_version: 'v1', scopes: [
    { id: 'courses', collection: 'courses', missing: 'retain' },
    { id: 'assignments', collection: 'assignments', missing: 'remove' },
  ] },
} as const;
const lecture = (key = 'lecture-1', title = 'Lecture') => ({ key, state: 'active', source_updated_at: null,
  payload: { kind: 'event', title, starts_at: '2026-10-05T01:00:00Z' } });
const assignment = (title = 'Essay') => ({ key: 'lecture-1', state: 'active', source_updated_at: '2026-10-03T01:00:00Z',
  payload: { kind: 'task', title, due_at: '2026-10-05T01:00:00Z' } });

describe('school sync with persistent source and personal layers', () => {
  let dir: string, db: ReturnType<typeof openDatabase>, store: ReturnType<typeof createSchoolStore>;
  let stamp: number;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'campus-school-')); db = openDatabase(dir); stamp = Date.parse('2026-10-03T00:00:00Z');
    for (const id of ['alice','bob']) db.prepare('INSERT INTO users(id,email,created_at) VALUES(?,?,?)').run(id, `${id}@example.test`, stamp);
    store = createSchoolStore(db, () => stamp, contracts);
  });
  afterEach(() => { vi.useRealTimers(); db.close(); rmSync(dir, { recursive: true, force: true }); });
  const grant = (provider: 'sis'|'canvas' = 'sis') => store.grant('alice', provider, { subject: `fixture-${provider}-alice`, consent_version: 'v1' });
  const sync = (records: unknown[], scope = 'fall') => syncSchoolScope(store, 'alice', 'sis', scope, async () => ({ records, next_cursor: null }));
  const records = () => store.list('alice', { limit: 100 }).items;

  it('bounds a hung request, aborts its transport, preserves the snapshot and releases the lease', async () => {
    grant(); await sync([lecture('1','Original')]); vi.useFakeTimers();
    let signal:AbortSignal|undefined,finish!:(page:{records:unknown[];next_cursor:null})=>void;
    let outcome:unknown;
    const run=syncSchoolScope(store,'alice','sis','fall',(_cursor,context)=>{
      signal=context?.signal;
      return new Promise(resolve=>{finish=resolve;});
    }).then(value=>{outcome=value;});
    await vi.advanceTimersByTimeAsync(30_001);
    expect(outcome).toEqual({state:'error'});
    expect(signal?.aborted).toBe(true);
    expect(records()[0].payload.title).toBe('Original');
    finish({records:[lecture('1','Too late')],next_cursor:null});await run;
    expect(records()[0].payload.title).toBe('Original');
    await expect(sync([lecture('1','Retry')])).resolves.toMatchObject({state:'connected'});
  });

  it('aborts a hung adapter after revocation without waiting for it to return', async () => {
    grant();vi.useFakeTimers();let signal:AbortSignal|undefined,outcome:unknown;
    const run=syncSchoolScope(store,'alice','sis','fall',(_cursor,context)=>{
      signal=context?.signal;return new Promise(()=>{});
    }).then(value=>{outcome=value;});
    await Promise.resolve();store.revoke('alice','sis',store.status('alice')[0].version,false);
    await vi.advanceTimersByTimeAsync(251);
    expect(outcome).toEqual({state:'obsolete'});expect(signal?.aborted).toBe(true);await run;
    expect(vi.getTimerCount()).toBe(0);
  });

  it('bounds the whole paginated run even when each page stays below the request timeout', async () => {
    grant();await sync([lecture('old','Original')]);vi.useFakeTimers();let outcome:unknown,page=0;
    const run=syncSchoolScope(store,'alice','sis','fall',()=>new Promise(resolve=>{
      const key=String(++page);
      setTimeout(()=>resolve({records:[lecture(key)],next_cursor:key}),29_000);
    })).then(value=>{outcome=value;});
    await vi.advanceTimersByTimeAsync(240_001);
    expect(outcome).toEqual({state:'partial'});await run;
    expect(records()).toHaveLength(1);expect(records()[0].payload.title).toBe('Original');
    expect(store.status('alice')[0].scopes.find(s=>s.id==='fall')?.error_code).toBe('PARTIAL_FETCH');
    await vi.runAllTimersAsync();expect(records()).toHaveLength(1);
  });

  it('blocks unapproved contracts, wrong consent and public identity assumptions', () => {
    const blocked = createSchoolStore(db, () => stamp);
    expect(blocked.status('alice').map(x => x.state)).toEqual(['approval_required','approval_required']);
    expect(() => blocked.grant('alice','sis',{ subject:'anything',consent_version:'v1' })).toThrowError(/approval/i);
    expect(() => store.grant('alice','sis',{ subject:'x',consent_version:'old' })).toThrowError(/consent/i);
    expect(() => store.begin('alice','sis','fall')).toThrowError(/authoriz/i);
    grant(); expect(() => store.begin('alice','sis','unapproved-scope')).toThrowError(/scope/i);
  });

  it('preserves the prior snapshot and success timestamp when a later page fails', async () => {
    grant(); await sync([lecture('1','Original'),lecture('2','Must stay')]);
    stamp += 60_000;
    const result = await syncSchoolScope(store,'alice','sis','fall',async cursor => {
      if (cursor) throw new Error('private raw provider text');
      return { records:[lecture('1','Uncommitted edit')], next_cursor:'page-2' };
    });
    expect(result.state).toBe('partial');
    expect(records().map(x => x.payload.title).sort()).toEqual(['Must stay','Original']);
    const s = store.status('alice')[0];
    expect(s).toMatchObject({ state:'partial',last_success_at:'2026-10-03T00:00:00.000Z',last_attempt_at:'2026-10-03T00:01:00.000Z' });
    expect(JSON.stringify(s)).not.toContain('private raw');
  });

  it('only removes missing records in a complete authoritative scope, preserving private annotations', async () => {
    grant(); await sync([lecture('1','Old'),lecture('2','Removed')]); await sync([lecture('3','Spring')],'spring');
    const old = records().find(x => x.payload.title === 'Old')!;
    store.annotate('alice', old.id, { version:0, notes:'Only my note', completed:true, remind_minutes:10 });
    await sync([lecture('1','New')]); await sync([],'spring');
    const changed = store.get('alice',old.id);
    expect(changed).toMatchObject({ id:old.id,version:2,payload:{title:'New'},personal:{notes:'Only my note',completed:true,remind_minutes:10,version:1} });
    expect(records().find(x => x.payload.title === 'Removed')?.source_state).toBe('removed');
    expect(records().find(x => x.payload.title === 'Spring')?.source_state).toBe('active');
    await sync([lecture('1','New')]); expect(store.get('alice',old.id).version).toBe(2);
  });

  it('keeps source identities distinct across providers and scopes and isolates account reads/edits', async () => {
    grant(); grant('canvas'); await sync([lecture()]); await sync([lecture()],'spring');
    await syncSchoolScope(store,'alice','canvas','assignments',async () => ({records:[assignment()],next_cursor:null}));
    const rows = records(); expect(new Set(rows.map(x => x.id)).size).toBe(3);
    expect(store.list('bob',{limit:100}).items).toEqual([]);
    expect(() => store.get('bob',rows[0].id)).toThrowError(/not found/i);
    expect(() => store.annotate('bob',rows[0].id,{version:0,notes:'intrusion'})).toThrowError(/not found/i);
    const page = store.list('alice',{limit:1});
    expect(page.next_cursor).not.toBeNull();
    expect(store.list('alice',{limit:100,cursor:page.next_cursor!}).items).toHaveLength(2);
  });

  it('invalidates a fetch in flight when the user revokes, including after reconnect', async () => {
    grant(); await sync([lecture()]);
    const old = records()[0];
    const result = await syncSchoolScope(store,'alice','sis','fall',async () => {
      store.revoke('alice','sis',store.status('alice')[0].version,true);
      grant(); return {records:[lecture('resurrected')],next_cursor:null};
    });
    expect(result.state).toBe('obsolete'); expect(records()).toEqual([]);
    expect(() => store.get('alice',old.id)).toThrowError(/not found/i);
    expect(store.status('alice')[0].state).toBe('not_connected');
  });

  it('prevents overlapping and expired workers from overwriting a later successful snapshot', async () => {
    grant(); const lease = store.begin('alice','sis','fall');
    expect(() => store.begin('alice','sis','fall')).toThrowError(/already/i);
    stamp += 6 * 60_000;
    await sync([lecture('current')]);
    expect(() => store.commit(lease,[lecture('stale')])).toThrowError(/obsolete/i);
    expect(records().map(x => x.remote_key)).toEqual(['current']);
    expect(store.fail(lease,'FETCH_FAILED')).toBe(false);
    expect(store.status('alice')[0].scopes.find(x => x.id === 'fall')?.state).toBe('connected');
  });

  it('retains caches on revoke only when chosen, blocks stale personal edits and different identity reuse', async () => {
    grant(); await sync([lecture()]); const row = records()[0];
    store.annotate('alice',row.id,{version:0,notes:'Saved'});
    expect(() => store.annotate('alice',row.id,{version:0,notes:'Lost update'})).toThrowError(/changed/i);
    store.revoke('alice','sis',store.status('alice')[0].version,false);
    expect(store.get('alice',row.id).personal.notes).toBe('Saved');
    expect(store.status('alice')[0].state).toBe('revoked');
    expect(() => store.begin('alice','sis','fall')).toThrowError(/authoriz/i);
    expect(() => store.grant('alice','sis',{subject:'someone-else',consent_version:'v1'})).toThrowError(/identity/i);
  });

  it('rejects duplicate keys, cursor loops and invalid payloads without corrupting a previous snapshot', async () => {
    grant(); await sync([lecture('old')]);
    expect((await sync([lecture('dup'),lecture('dup')])).state).toBe('error');
    expect((await sync([{...lecture(),payload:{kind:'event',title:'Bad',starts_at:'2026-02-30T01:00:00Z'}}])).state).toBe('error');
    const loop = await syncSchoolScope(store,'alice','sis','fall',async () => ({records:[lecture()],next_cursor:'same'}));
    expect(loop.state).toBe('partial'); expect(records().map(x => x.remote_key)).toEqual(['old']);
  });

  it('stops fetching after authorization expires until a new grant, retaining the previous cache', async () => {
    grant(); await sync([lecture()]);
    const expired = await syncSchoolScope(store,'alice','sis','fall',async () => { throw new SchoolAuthorizationExpired(); });
    expect(expired.state).toBe('reauth_required');
    expect(store.status('alice')[0].state).toBe('reauth_required');
    expect(() => store.begin('alice','sis','spring')).toThrowError(/authoriz/i);
    expect(records()).toHaveLength(1);
    grant(); expect((await sync([lecture()])).state).toBe('connected');
  });

  it('distinguishes a retained revocation from an unavailable deployment contract', async () => {
    grant(); await sync([lecture()]);
    store.revoke('alice','sis',store.status('alice')[0].version,false);
    const withoutApproval=createSchoolStore(db,()=>stamp);
    expect(withoutApproval.status('alice')[0]).toMatchObject({state:'revoked',availability:'approval_required'});
    expect(withoutApproval.list('alice',{limit:10}).items).toHaveLength(1);
  });

  it('rejects an impossible source timestamp without replacing the previously successful data', async () => {
    grant(); await sync([lecture('old')]);
    const result=await sync([{...lecture('new'),source_updated_at:'2026-02-30T10:00:00Z'}]);
    expect(result.state).toBe('error');expect(records().map(x=>x.remote_key)).toEqual(['old']);
  });

  it('rejects invalid or duplicate approved scopes before opening a connection', () => {
    expect(()=>createSchoolStore(db,()=>stamp,{sis:{approval_reference:' ',consent_version:'v1',scopes:[]}})).toThrow();
    expect(()=>createSchoolStore(db,()=>stamp,{sis:{...contracts.sis,scopes:[contracts.sis.scopes[0],contracts.sis.scopes[0]]}})).toThrow();
  });

  it('does not call an expanded scope configuration fully connected before the new scope is authorized and fetched', async () => {
    grant(); await sync([lecture()]); await sync([],'spring');
    const expanded=createSchoolStore(db,()=>stamp,{...contracts,sis:{...contracts.sis,scopes:[...contracts.sis.scopes,{id:'new-semester',collection:'timetable',missing:'retain'}]}});
    const state=expanded.status('alice')[0];
    expect(state.state).toBe('partial');
    expect(state.scopes.find(x=>x.id==='new-semester')).toMatchObject({state:'not_connected',last_success_at:null});
    expect(()=>expanded.begin('alice','sis','new-semester')).toThrowError(/authoriz/i);
  });

  it('survives restart and removes every owned school record on account deletion', async () => {
    grant(); await sync([lecture()]); const id = records()[0].id;
    store.annotate('alice',id,{version:0,notes:'Persistent'});
    db.close(); db = openDatabase(dir); store = createSchoolStore(db,() => stamp,contracts);
    expect(store.get('alice',id).personal.notes).toBe('Persistent');
    db.prepare('DELETE FROM users WHERE id=?').run('alice');
    for(const table of ['school_connections','school_scopes','school_records','school_personal']) {
      expect(db.prepare(`SELECT count(*) n FROM ${table}`).get()?.n).toBe(0);
    }
  });
});

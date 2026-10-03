import { ApiError } from '../errors.js';
import type { createSchoolStore } from './store.js';
import type { Provider } from './schemas.js';

export type SchoolPage = {records:unknown[];next_cursor:string|null};
export class SchoolAuthorizationExpired extends Error {}
// fetchPage is a server-owned normalized adapter, never a browser-supplied URL or user ID.
// No network adapter is shipped until the school's actual contract is approved.
export async function syncSchoolScope(store:ReturnType<typeof createSchoolStore>, owner:string, provider:Provider, scope:string,
  fetchPage:(cursor:string|null)=>Promise<SchoolPage>) {
  const lease=store.begin(owner,provider,scope),records:unknown[]=[],seen=new Set<string>();
  let cursor:string|null=null,pages=0,committing=false;
  try {
    while(true) {
      if(!store.current(lease)) return {state:'obsolete' as const};
      if(pages>=100) throw new Error('Page limit');
      const page=await fetchPage(cursor);
      if(!store.current(lease)) return {state:'obsolete' as const};
      if(!Array.isArray(page.records) || (page.next_cursor!==null && (typeof page.next_cursor!=='string'||!page.next_cursor||page.next_cursor.length>2000))) throw new Error('Invalid page envelope');
      records.push(...page.records); pages++;
      if(records.length>10_000 || pages>100) throw new Error('Snapshot limit');
      if(page.next_cursor===null) { committing=true; return store.commit(lease,records); }
      if(seen.has(page.next_cursor)) throw new Error('Cursor loop');
      seen.add(page.next_cursor);cursor=page.next_cursor;
    }
  } catch(error) {
    if(error instanceof ApiError && error.code==='SYNC_OBSOLETE') return {state:'obsolete' as const};
    const code=error instanceof SchoolAuthorizationExpired?'REAUTH_REQUIRED':committing?'INVALID_SNAPSHOT':pages>0?'PARTIAL_FETCH':'FETCH_FAILED';
    if(!store.fail(lease,code)) return {state:'obsolete' as const};
    return {state:code==='REAUTH_REQUIRED'?'reauth_required' as const:code==='PARTIAL_FETCH'?'partial' as const:'error' as const};
  }
}

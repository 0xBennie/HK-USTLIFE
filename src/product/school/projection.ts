import type {SchoolCalendarItem,SchoolIssue} from '../calendar/types.js';
import type {createSchoolStore} from './store.js';
type Snapshot=ReturnType<ReturnType<typeof createSchoolStore>['exportAll']>;
export function projectSchoolCalendar(snapshot:Snapshot) {
 const items:SchoolCalendarItem[]=[],reminder_items:SchoolCalendarItem[]=[],issues:SchoolIssue[]=[];
 for(const connection of snapshot.connections){
  if(connection.availability!=='configured'||connection.state==='revoked')continue;
  for(const scope of connection.scopes) {
   if(scope.last_success_at && (scope.state!=='connected'||connection.state==='reauth_required')) {
    issues.push({provider:connection.provider,scope:scope.id,state:connection.state==='reauth_required'?'reauth_required':scope.state});
   }
  }
 }
 for(const row of snapshot.records){
  const connection=snapshot.connections.find(c=>c.provider===row.provider),scope=connection?.scopes.find(s=>s.id===row.scope);
  if(!connection||connection.availability!=='configured'||['revoked','approval_required','not_connected'].includes(connection.state)||!scope?.last_success_at||row.source_state!=='active')continue;
  const p=row.payload;if(!('kind' in p)||(p.kind!=='event'&&p.kind!=='task'))continue;
  if(p.kind==='event'&&p.status!=='active')continue;
  const healthy=scope.state==='connected'&&connection.state!=='reauth_required';
  const common={id:row.id,version:row.version,created_at:row.source_seen_at!,updated_at:row.source_seen_at!,
   remind_minutes:row.personal.remind_minutes,
   school_origin:{provider:row.provider,scope:row.scope,scope_state:scope.state,connection_state:connection.state,stale:!healthy,
    source_updated_at:row.source_updated_at,source_seen_at:row.source_seen_at!,personal_version:row.personal.version,notes:row.personal.notes}};
  const item:SchoolCalendarItem=p.kind==='task'?{...p,...common,status:row.personal.completed?'done':'open'}:{...p,...common};
  items.push(item);if(healthy)reminder_items.push(item);
 }
 return {items,reminder_items,issues};
}

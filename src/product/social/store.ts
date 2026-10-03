import {blocked,unblockedSql} from './access.js';
import {createWallStore} from './wall.js';
import {createHash,randomUUID} from 'node:crypto';
import type {DatabaseSync} from 'node:sqlite';
import {z} from 'zod';
import {transaction} from '../database.js';
import {ApiError} from '../errors.js';
import {activitySchema,activityQuery,joinSchema,keySchema,preferencesSchema,version} from './schemas.js';
import type {Activity,ActivityInput,ActivityComment,ActivityNotification,NotificationRead,Participation} from './types.js';
import type {ActivityCalendarEvent} from '../calendar/types.js';
type Row={id:string;organizer_id:string;payload:string;visibility:string;status:Activity['status'];moderation_state:string;starts_at:number;ends_at:number;version:number;created_at:number;updated_at:number;display_name:string;banned_at:number|null};
type Part={activity_id:string;user_id:string;status:Participation['status'];queue_order:number;version:number;joined_at:number;updated_at:number};
const canonical=(v:unknown):string=>Array.isArray(v)?`[${v.map(canonical).join(',')}]`:v&&typeof v==='object'?`{${Object.entries(v).sort(([a],[b])=>a.localeCompare(b)).map(([k,val])=>JSON.stringify(k)+':'+canonical(val)).join(',')}}`:JSON.stringify(v);
export function createSocialStore(db:DatabaseSync,now:()=>number){
 const wall=createWallStore(db,now);
 const stamp=(n:number)=>new Date(n).toISOString();
 const select='SELECT a.*,u.display_name,u.banned_at FROM activities a JOIN users u ON u.id=a.organizer_id';
 function raw(id:string,viewer:string|null):Row{
  const row=db.prepare(select+' WHERE a.id=?').get(id) as Row|undefined;
  if(!row||row.moderation_state!=='visible'||row.banned_at!==null||blocked(db,viewer,row.organizer_id)||(row.visibility==='members'&&!viewer))throw new ApiError(404,'ACTIVITY_NOT_FOUND','Activity is not available.');
  return row;
 }
 const part=(id:string,user:string)=>db.prepare('SELECT * FROM activity_participations WHERE activity_id=? AND user_id=?').get(id,user) as Part|undefined;
 function participation(row:Part):Participation{
  return {activity_id:row.activity_id,status:row.status,version:row.version,queue_order:row.queue_order,joined_at:stamp(row.joined_at),updated_at:stamp(row.updated_at),waitlist_position:row.status==='waitlisted'?Number(db.prepare("SELECT COUNT(*) AS n FROM activity_participations WHERE activity_id=? AND status='waitlisted' AND queue_order<=?").get(row.activity_id,row.queue_order)!.n):null};
 }
 function counts(id:string,capacity:number){const rows=db.prepare('SELECT status,COUNT(*) AS n FROM activity_participations WHERE activity_id=? GROUP BY status').all(id);const n=(status:string)=>Number(rows.find(r=>r.status===status)?.n??0);return {confirmed:n('confirmed'),waitlisted:n('waitlisted'),remaining:Math.max(0,capacity-n('confirmed'))};}
 function get(id:string,viewer:string|null):Activity{return present(raw(id,viewer),viewer);}
 function present(r:Row,viewer:string|null):Activity{
  const id=r.id,payload=JSON.parse(r.payload) as ActivityInput,p=viewer?part(id,viewer):undefined,pref=viewer?db.prepare('SELECT * FROM activity_preferences WHERE activity_id=? AND user_id=?').get(id,viewer):undefined;
  return {...payload,id:r.id,version:r.version,status:r.status,ended:r.ends_at<=now(),started:r.starts_at<=now(),is_demo:true,created_at:stamp(r.created_at),updated_at:stamp(r.updated_at),organizer:{id:r.organizer_id,display_name:r.display_name||'Campus member'},counts:counts(id,payload.capacity),mine:viewer?{is_organizer:r.organizer_id===viewer,participation:p?participation(p):null,bookmarked:pref?.bookmarked===1,calendar_saved:pref?.calendar_saved===1,remind_minutes:pref?.remind_minutes==null?null:Number(pref.remind_minutes)}:null};
 }
 function own(id:string,user:string){const row=raw(id,user);if(row.organizer_id!==user)throw new ApiError(403,'ORGANIZER_REQUIRED','Only the organizer can manage this activity.');return row;}
 function checkVersion(row:{version:number},expected:number){if(row.version!==expected)throw new ApiError(409,'VERSION_CONFLICT','This record changed. Reload before continuing.');}
 function notify(owner:string,id:string,kind:ActivityNotification['kind']){db.prepare('INSERT INTO notifications(owner_id,activity_id,kind,created_at) VALUES (?,?,?,?)').run(owner,id,kind,now());}
 function audience(id:string):string[]{return (db.prepare("SELECT user_id FROM activity_participations WHERE activity_id=? AND status IN ('confirmed','waitlisted') UNION SELECT user_id FROM activity_preferences WHERE activity_id=? AND calendar_saved=1").all(id,id) as {user_id:string}[]).map(r=>r.user_id);}
 function broadcast(row:Row,kind:ActivityNotification['kind']){for(const id of audience(row.id))if(id!==row.organizer_id)notify(id,row.id,kind);}
 function receipt<T>(user:string,scope:string,body:unknown,key:unknown,action:()=>string,read:(id:string)=>T):T{
  const retry=keySchema.parse(key),hash=createHash('sha256').update(canonical(body)).digest('hex');
  return transaction(db,()=>{
   db.prepare('DELETE FROM write_keys WHERE expires_at<=?').run(now());
   const previous=db.prepare('SELECT fingerprint,resource_id FROM write_keys WHERE owner_id=? AND scope=? AND key=?').get(user,scope,retry);
   if(previous){if(previous.fingerprint!==hash)throw new ApiError(409,'IDEMPOTENCY_CONFLICT','Retry key already used for different content.');try{return read(String(previous.resource_id));}catch(e){if(e instanceof ApiError&&e.status===404)throw new ApiError(410,'RECORD_REMOVED','Original record is no longer available.');throw e;}}
   const id=action();db.prepare('INSERT INTO write_keys VALUES (?,?,?,?,?,?)').run(user,scope,retry,hash,id,now()+86400000);return read(id);
  });
 }
 function create(user:string,body:unknown,key:unknown){
  const payload=activitySchema.parse(body);
  return receipt(user,'activity:create',payload,key,()=>{
   if(Date.parse(payload.starts_at)<=now())throw new ApiError(400,'PAST_ACTIVITY','Choose a future start time.');
   if(Number(db.prepare('SELECT COUNT(*) AS n FROM activities WHERE organizer_id=? AND created_at>?').get(user,now()-86400000)!.n)>=10)throw new ApiError(429,'ACTIVITY_LIMIT','At most ten new activities per day.');
   const id=randomUUID();db.prepare('INSERT INTO activities(id,organizer_id,payload,visibility,starts_at,ends_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)').run(id,user,JSON.stringify(payload),payload.visibility,Date.parse(payload.starts_at),Date.parse(payload.ends_at),now(),now());return id;
  },id=>get(id,user));
 }
 function list(viewer:string|null,query:z.infer<typeof activityQuery>){
  if(query.mine&&!viewer)throw new ApiError(401,'AUTH_REQUIRED','Sign in to see your activities.');
  const clauses=["a.moderation_state='visible'",'u.banned_at IS NULL'],args:(string|number)[]=[];
  if(!viewer)clauses.push("a.visibility='public'");
  else{clauses.push(unblockedSql('a.organizer_id'));args.push(viewer,viewer);}
  if(!query.mine){clauses.push("a.status!='cancelled'",'a.starts_at>=?');args.push(now());}
  if(query.mine==='organized'){clauses.push('a.organizer_id=?');args.push(viewer!);}
  if(query.mine==='participating'){clauses.push('EXISTS(SELECT 1 FROM activity_participations p WHERE p.activity_id=a.id AND p.user_id=?)');args.push(viewer!);}
  if(query.mine==='saved'){clauses.push('EXISTS(SELECT 1 FROM activity_preferences p WHERE p.activity_id=a.id AND p.user_id=? AND (p.bookmarked=1 OR p.calendar_saved=1))');args.push(viewer!);}
  if(query.q){clauses.push("instr(lower(json_extract(a.payload,'$.title') || ' ' || json_extract(a.payload,'$.location')),lower(?))>0");args.push(query.q);}
  for(const field of ['kind','interaction'] as const)if(query[field]){clauses.push(`json_extract(a.payload,'$.${field}')=?`);args.push(query[field]!);}
  if(query.language){clauses.push("EXISTS(SELECT 1 FROM json_each(a.payload,'$.languages') WHERE value=?)");args.push(query.language);}
  if(query.from){clauses.push('a.starts_at>=?');args.push(Date.parse(query.from));}if(query.to){clauses.push('a.ends_at<=?');args.push(Date.parse(query.to));}
  if(query.cursor){const cursor=raw(query.cursor,viewer);clauses.push('(a.starts_at>? OR (a.starts_at=? AND a.id>?))');args.push(cursor.starts_at,cursor.starts_at,cursor.id);}
  const rows=db.prepare(select+' WHERE '+clauses.join(' AND ')+' ORDER BY a.starts_at,a.id LIMIT ?').all(...args,query.limit+1) as Row[];
  return {items:rows.slice(0,query.limit).map(r=>get(r.id,viewer)),next_cursor:rows.length>query.limit?rows[query.limit-1].id:null};
 }
 function setPreferences(user:string,id:string,body:unknown){const value=preferencesSchema.parse(body);return transaction(db,()=>{const row=raw(id,user);if(value.calendar_saved&&row.status==='cancelled')throw new ApiError(409,'ACTIVITY_CANCELLED','Cancelled activities cannot be added to your calendar.');savePreferences(user,id,value);return get(id,user);});}
 function savePreferences(user:string,id:string,value:z.infer<typeof preferencesSchema>){
  const existing=db.prepare('SELECT 1 FROM activity_preferences WHERE user_id=? AND activity_id=?').get(user,id);
  if(!existing&&Number(db.prepare('SELECT COUNT(*) AS n FROM activity_preferences WHERE user_id=?').get(user)!.n)>=500)throw new ApiError(409,'SAVE_LIMIT','Remove an old saved activity first.');
  db.prepare('INSERT INTO activity_preferences(user_id,activity_id,bookmarked,calendar_saved,remind_minutes) VALUES (?,?,?,?,?) ON CONFLICT(activity_id,user_id) DO UPDATE SET bookmarked=excluded.bookmarked,calendar_saved=excluded.calendar_saved,remind_minutes=excluded.remind_minutes').run(user,id,Number(value.bookmarked),Number(value.calendar_saved),value.remind_minutes);
 }
 function promote(row:Row){
  if(row.status==='cancelled'||row.starts_at<=now()||row.moderation_state!=='visible'||row.banned_at!==null)return;
  const room=counts(row.id,JSON.parse(row.payload).capacity).remaining;
  const waiting=db.prepare("SELECT p.user_id FROM activity_participations p JOIN users u ON u.id=p.user_id WHERE p.activity_id=? AND p.status='waitlisted' AND u.banned_at IS NULL AND "+unblockedSql('p.user_id')+" ORDER BY p.queue_order LIMIT ?").all(row.id,row.organizer_id,row.organizer_id,room);
  for(const p of waiting){db.prepare("UPDATE activity_participations SET status='confirmed',version=version+1,updated_at=? WHERE activity_id=? AND user_id=?").run(now(),row.id,String(p.user_id));notify(String(p.user_id),row.id,'promoted');}
 }
 function join(user:string,id:string,body:unknown,key:unknown){const value=joinSchema.parse(body);return receipt(user,'activity:join:'+id,value,key,()=>{
  const row=raw(id,user);checkVersion(row,value.activity_version);
  if(row.organizer_id===user)throw new ApiError(409,'ALREADY_ORGANIZER','The organizer is separate from participant places.');
  if(row.status!=='open'||row.starts_at<=now())throw new ApiError(409,'SIGNUPS_CLOSED','This activity is not accepting signups.');
  const previous=part(id,user);if(previous&&['confirmed','waitlisted'].includes(previous.status))return id;
  const current=counts(id,JSON.parse(row.payload).capacity);if(current.waitlisted>=100)throw new ApiError(409,'WAITLIST_FULL','The waitlist is full.');
  if(!previous&&Number(db.prepare('SELECT COUNT(*) AS n FROM activity_participations WHERE activity_id=?').get(id)!.n)>=500)throw new ApiError(409,'PARTICIPATION_LIMIT','Participation history limit reached.');
  const status=current.remaining?'confirmed':'waitlisted',order=Number(db.prepare('SELECT COALESCE(MAX(queue_order),0)+1 AS n FROM activity_participations WHERE activity_id=?').get(id)!.n);
  db.prepare('INSERT INTO activity_participations(activity_id,user_id,status,queue_order,joined_at,updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT(activity_id,user_id) DO UPDATE SET status=excluded.status,queue_order=excluded.queue_order,joined_at=excluded.joined_at,updated_at=excluded.updated_at,version=activity_participations.version+1').run(id,user,status,order,now(),now());
  if(value.save_calendar){const pref=db.prepare('SELECT bookmarked,remind_minutes FROM activity_preferences WHERE activity_id=? AND user_id=?').get(id,user);savePreferences(user,id,{bookmarked:pref?.bookmarked===1,calendar_saved:true,remind_minutes:pref?.remind_minutes==null?null:Number(pref.remind_minutes)});}
  notify(user,id,status==='confirmed'?'joined':'waitlisted');notify(row.organizer_id,id,'joined');return id;
 },id=>get(id,user));}
 function withdrawInternal(row:Row,user:string){
  const p=part(row.id,user);if(!p||!['confirmed','waitlisted'].includes(p.status))return;
  db.prepare("UPDATE activity_participations SET status='withdrawn',version=version+1,updated_at=? WHERE activity_id=? AND user_id=?").run(now(),row.id,user);
  db.prepare('UPDATE activity_preferences SET calendar_saved=0,remind_minutes=NULL WHERE activity_id=? AND user_id=?').run(row.id,user);
  notify(user,row.id,'withdrawn');notify(row.organizer_id,row.id,'withdrawn');promote(row);
 }
 function withdraw(user:string,id:string,body:unknown,key:unknown){const value=z.object({participation_version:version}).strict().parse(body);return receipt(user,'activity:withdraw:'+id,value,key,()=>{const row=raw(id,user),p=part(id,user);if(!p)throw new ApiError(404,'PARTICIPATION_NOT_FOUND','No participation found.');checkVersion(p,value.participation_version);withdrawInternal(row,user);return id;},id=>get(id,user));}
 function updateRow(row:Row,body:unknown){
  const {version:expected,status,...changes}=z.object({version,status:z.enum(['open','closed']).optional()}).passthrough().parse(body);
  if('visibility' in changes||'kind' in changes||(!status&&!Object.keys(changes).length))throw new ApiError(400,'INVALID_INPUT','Visibility and kind are fixed after publishing. Provide editable fields.');
  checkVersion(row,expected);if(row.status==='cancelled'||row.starts_at<=now())throw new ApiError(409,'ACTIVITY_LOCKED','This activity can no longer be edited.');
  const value=activitySchema.parse({...JSON.parse(row.payload),...changes});if(Date.parse(value.starts_at)<=now())throw new ApiError(400,'PAST_ACTIVITY','Choose a future start time.');
  if(value.capacity<counts(row.id,value.capacity).confirmed)throw new ApiError(409,'CAPACITY_CONFLICT','Capacity cannot be below confirmed participants.');
  db.prepare('UPDATE activities SET payload=?,starts_at=?,ends_at=?,status=?,version=version+1,updated_at=? WHERE id=?').run(JSON.stringify(value),Date.parse(value.starts_at),Date.parse(value.ends_at),status??row.status,now(),row.id);
  const updated=db.prepare(select+' WHERE a.id=?').get(row.id) as Row;broadcast(updated,'activity_updated');promote(updated);return updated;
 }
 function update(user:string,id:string,body:unknown){return transaction(db,()=>{updateRow(own(id,user),body);return get(id,user);});}
 function cancelRow(row:Row){
  broadcast(row,'activity_cancelled');
  db.prepare("UPDATE activities SET status='cancelled',version=version+1,updated_at=? WHERE id=?").run(now(),row.id);
  db.prepare("UPDATE activity_participations SET status='cancelled',version=version+1,updated_at=? WHERE activity_id=? AND status IN ('confirmed','waitlisted')").run(now(),row.id);
  db.prepare('UPDATE activity_preferences SET calendar_saved=0,remind_minutes=NULL WHERE activity_id=?').run(row.id);
 }
 function cancel(user:string,id:string,body:unknown){const value=z.object({version}).strict().parse(body);return transaction(db,()=>{const row=own(id,user);if(row.status==='cancelled')return get(id,user);checkVersion(row,value.version);cancelRow(row);return get(id,user);});}
 function remove(user:string,id:string,body:unknown){const value=z.object({version}).strict().parse(body);return transaction(db,()=>{const row=own(id,user);checkVersion(row,value.version);broadcast(row,'activity_removed');db.prepare('DELETE FROM activities WHERE id=?').run(id);return {deleted:true};});}
 function roster(user:string,id:string){own(id,user);return (db.prepare('SELECT p.*,u.display_name FROM activity_participations p JOIN users u ON u.id=p.user_id WHERE p.activity_id=? ORDER BY p.queue_order').all(id) as (Part&{display_name:string})[]).map(r=>({...participation(r),user:{id:r.user_id,display_name:r.display_name||'Campus member'}}));}
 function comment(user:string|null,id:string,commentId:number):ActivityComment{raw(id,user);const r=db.prepare("SELECT c.*,u.display_name FROM activity_comments c JOIN users u ON u.id=c.author_id WHERE c.id=? AND c.activity_id=? AND c.moderation_state='visible' AND u.banned_at IS NULL").get(commentId,id);if(!r||blocked(db,user,String(r.author_id)))throw new ApiError(404,'COMMENT_NOT_FOUND','Comment not available.');return {id:Number(r.id),body:String(r.body),version:Number(r.version),created_at:stamp(Number(r.created_at)),author:{id:String(r.author_id),display_name:String(r.display_name)||'Campus member'},can_delete:r.author_id===user};}
 function comments(user:string|null,id:string,before?:number){raw(id,user);const rows=db.prepare("SELECT c.id FROM activity_comments c JOIN users u ON u.id=c.author_id WHERE c.activity_id=? AND c.id<? AND c.moderation_state='visible' AND u.banned_at IS NULL"+(user?' AND '+unblockedSql('c.author_id'):'')+' ORDER BY c.id DESC LIMIT 51').all(id,before??Number.MAX_SAFE_INTEGER,...(user?[user,user]:[]));return {items:rows.slice(0,50).map(r=>comment(user,id,Number(r.id))),next_cursor:rows.length>50?Number(rows[49].id):null};}
 function addComment(user:string,id:string,body:unknown,key:unknown){const value=z.object({body:z.string().trim().min(1).max(2000)}).strict().parse(body);return receipt(user,'activity:comment:'+id,value,key,()=>{
  const row=raw(id,user);if(row.status==='cancelled'||row.ends_at<=now())throw new ApiError(409,'COMMENTS_CLOSED','Comments are closed for this activity.');
  if(Number(db.prepare('SELECT COUNT(*) AS n FROM activity_comments WHERE author_id=? AND created_at>?').get(user,now()-86400000)!.n)>=40)throw new ApiError(429,'COMMENT_LIMIT','Comment limit reached.');
  const result=db.prepare('INSERT INTO activity_comments(activity_id,author_id,body,created_at) VALUES (?,?,?,?)').run(id,user,value.body,now());
  const recipients=new Set([row.organizer_id,...audience(id)]);for(const recipient of recipients)if(recipient!==user&&!blocked(db,recipient,user))notify(recipient,id,'comment');return String(result.lastInsertRowid);
 },cid=>comment(user,id,Number(cid)));}
 function deleteComment(user:string,id:string,cid:number,body:unknown){const value=z.object({version}).strict().parse(body);return transaction(db,()=>{const c=comment(user,id,cid);if(!c.can_delete)throw new ApiError(404,'COMMENT_NOT_FOUND','Comment not available.');checkVersion(c,value.version);db.prepare('DELETE FROM activity_comments WHERE id=?').run(cid);return {deleted:true};});}
 function notifications(user:string,before?:number){const rows=db.prepare('SELECT * FROM notifications WHERE owner_id=? AND id<? ORDER BY id DESC LIMIT 51').all(user,before??Number.MAX_SAFE_INTEGER);const items=rows.slice(0,50).map(r=>{let activity:ActivityNotification['activity']=null;if(r.activity_id){try{const a=get(String(r.activity_id),user);activity={id:a.id,title:a.title};}catch(e){if(!(e instanceof ApiError))throw e;}}let post:ActivityNotification['post']=null;if(r.post_id){try{const p=wall.get(String(r.post_id),user);post={id:p.id,title:p.title};}catch(e){if(!(e instanceof ApiError))throw e;}}return {id:Number(r.id),kind:r.kind as ActivityNotification['kind'],activity,post,created_at:stamp(Number(r.created_at)),read_at:r.read_at==null?null:stamp(Number(r.read_at))};});return {items,next_cursor:rows.length>50?Number(rows[49].id):null,unread:Number(db.prepare('SELECT COUNT(*) AS n FROM notifications WHERE owner_id=? AND read_at IS NULL').get(user)!.n)};}
 function markRead(user:string,id:number):NotificationRead{return transaction(db,()=>{
  const r=db.prepare('UPDATE notifications SET read_at=COALESCE(read_at,?) WHERE id=? AND owner_id=?').run(now(),id,user);
  if(!r.changes)throw new ApiError(404,'NOTIFICATION_NOT_FOUND','Notification not found.');
  const saved=db.prepare('SELECT read_at FROM notifications WHERE id=? AND owner_id=?').get(id,user)!;
  const unread=Number(db.prepare('SELECT COUNT(*) AS n FROM notifications WHERE owner_id=? AND read_at IS NULL').get(user)!.n);
  return {id,read:true,read_at:stamp(Number(saved.read_at)),unread};
 });}
 function calendar(user:string):ActivityCalendarEvent[]{
  const rows=db.prepare(select+" JOIN activity_preferences p ON p.activity_id=a.id WHERE p.user_id=? AND p.calendar_saved=1 AND a.status!='cancelled' AND a.moderation_state='visible' AND u.banned_at IS NULL AND "+unblockedSql('a.organizer_id')).all(user,user,user) as Row[];
  return rows.map(row=>{const a=get(row.id,user),state=a.mine!.is_organizer?'organizer':a.mine!.participation?.status??'not_joined';return {id:'activity:'+a.id,kind:'event',title:a.title,body:a.description,location:a.location,timezone:a.timezone,starts_at:a.starts_at,ends_at:a.ends_at,start_date:null,end_date:null,all_day:false,status:'active',course_id:null,remind_minutes:a.mine!.remind_minutes,version:a.version,created_at:a.created_at,updated_at:a.updated_at,activity_origin:{id:a.id,participation:state}};});
 }
 // Called inside the account-deletion transaction, before the user cascade.
 function deleteAccount(user:string){
  const owned=db.prepare(select+' WHERE a.organizer_id=?').all(user) as Row[];for(const row of owned){broadcast(row,'activity_removed');db.prepare('DELETE FROM activities WHERE id=?').run(row.id);}
  const joined=db.prepare(select+" JOIN activity_participations p ON p.activity_id=a.id WHERE p.user_id=? AND p.status IN ('confirmed','waitlisted')").all(user) as Row[];for(const row of joined)withdrawInternal(row,user);
 }
 // Governance calls these inside its transaction; never start a nested transaction.
 function disconnectUsers(first:string,second:string){
  for(const [organizer,participant] of [[first,second],[second,first]]){
   const rows=db.prepare(select+' WHERE a.organizer_id=?').all(organizer) as Row[];
   for(const row of rows){withdrawInternal(row,participant);db.prepare('DELETE FROM activity_preferences WHERE activity_id=? AND user_id=?').run(row.id,participant);}
  }
 }
 function restrictActivity(id:string){
  const row=db.prepare(select+' WHERE a.id=?').get(id) as Row|undefined;if(!row)return;
  if(row.status!=='cancelled'){
   broadcast(row,'activity_cancelled');
   db.prepare("UPDATE activities SET status='cancelled',version=version+1,updated_at=? WHERE id=?").run(now(),id);
   db.prepare("UPDATE activity_participations SET status='cancelled',version=version+1,updated_at=? WHERE activity_id=? AND status IN ('confirmed','waitlisted')").run(now(),id);
  }
  db.prepare('UPDATE activity_preferences SET calendar_saved=0,remind_minutes=NULL WHERE activity_id=?').run(id);
 }
 function restrictUser(user:string){
  for(const row of db.prepare('SELECT id FROM activities WHERE organizer_id=?').all(user))restrictActivity(String(row.id));
  const joined=db.prepare(select+" JOIN activity_participations p ON p.activity_id=a.id WHERE p.user_id=? AND p.status IN ('confirmed','waitlisted')").all(user) as Row[];
  for(const row of joined)withdrawInternal(row,user);
  db.prepare('UPDATE activity_preferences SET calendar_saved=0,remind_minutes=NULL WHERE user_id=?').run(user);
 }
 // Explicit maintenance authority; never call ordinary organizer routes with another user's ID.
 function requireAdmin(actor:string){const user=db.prepare('SELECT role,banned_at FROM users WHERE id=?').get(actor);if(!user||user.role!=='admin'||user.banned_at!==null)throw new ApiError(403,'ADMIN_REQUIRED','Administrator access required.');}
 function adminRow(id:string){const row=db.prepare(select+' WHERE a.id=?').get(id) as Row|undefined;if(!row)throw new ApiError(404,'ACTIVITY_NOT_FOUND','Activity not found.');return row;}
 function adminView(row:Row){return {...present(row,null),moderation_state:row.moderation_state,organizer_restricted:row.banned_at!==null};}
 function adminGet(actor:string,id:string){requireAdmin(actor);return adminView(adminRow(id));}
 function adminList(actor:string,input:unknown){requireAdmin(actor);const q=z.object({q:z.string().trim().max(120).default(''),status:z.enum(['all','open','closed','cancelled']).default('all'),cursor:z.string().uuid().optional(),limit:z.coerce.number().int().min(1).max(30).default(20)}).strict().parse(input);
  const where=['a.id>?'],args:(string|number)[]=[q.cursor??''];if(q.status!=='all'){where.push('a.status=?');args.push(q.status);}if(q.q){where.push("instr(lower(json_extract(a.payload,'$.title') || ' ' || json_extract(a.payload,'$.location')),lower(?))>0");args.push(q.q);}
  const rows=db.prepare(select+' WHERE '+where.join(' AND ')+' ORDER BY a.id LIMIT ?').all(...args,q.limit+1) as Row[];return {items:rows.slice(0,q.limit).map(adminView),next_cursor:rows.length>q.limit?rows[q.limit-1].id:null};
 }
 function adminHistory(actor:string,id:string){requireAdmin(actor);adminRow(id);return db.prepare('SELECT id,actor_id,action,reason,fields_json,before_version,after_version,created_at FROM activity_maintenance_audit WHERE activity_id=? ORDER BY id DESC LIMIT 50').all(id).map(r=>({...r,fields:JSON.parse(String(r.fields_json)),fields_json:undefined}));}
 function adminChange(actor:string,id:string,input:unknown){requireAdmin(actor);
  const patch=activitySchema.innerType().omit({kind:true,visibility:true}).partial().extend({status:z.enum(['open','closed']).optional()}).strict().refine(v=>Object.keys(v).length>0);
  const base={version,reason:z.string().trim().min(5).max(1000)};
  const value=z.discriminatedUnion('action',[z.object({...base,action:z.literal('edit'),changes:patch}).strict(),z.object({...base,action:z.literal('cancel')}).strict()]).parse(input);
  return transaction(db,()=>{const before=adminRow(id);checkVersion(before,value.version);
   if(before.moderation_state!=='visible'||before.banned_at!==null||before.status==='cancelled')throw new ApiError(409,'ACTIVITY_LOCKED','Restricted or cancelled activities cannot be maintained here.');
   if(value.action==='edit')updateRow(before,{...value.changes,version:value.version});else cancelRow(before);
   if(actor!==before.organizer_id)notify(before.organizer_id,id,value.action==='edit'?'activity_updated':'activity_cancelled');
   const after=adminRow(id);db.prepare('INSERT INTO activity_maintenance_audit(activity_id,actor_id,action,reason,fields_json,before_version,after_version,created_at) VALUES(?,?,?,?,?,?,?,?)').run(id,actor,value.action,value.reason,JSON.stringify(value.action==='edit'?Object.keys(value.changes):['status']),before.version,after.version,now());return adminView(after);
  });
 }
 function exportAll(user:string){return {activities:(db.prepare(select+' WHERE a.organizer_id=?').all(user) as Row[]).map(r=>({id:r.id,...JSON.parse(r.payload),status:r.status,version:r.version,is_demo:true})),participations:db.prepare('SELECT activity_id,status,queue_order,version,joined_at,updated_at FROM activity_participations WHERE user_id=?').all(user),preferences:db.prepare('SELECT activity_id,bookmarked,calendar_saved,remind_minutes FROM activity_preferences WHERE user_id=?').all(user),comments:db.prepare('SELECT id,activity_id,body,created_at FROM activity_comments WHERE author_id=?').all(user),notifications:db.prepare('SELECT id,activity_id,post_id,kind,created_at,read_at FROM notifications WHERE owner_id=?').all(user)};}
 return {adminGet,adminList,adminHistory,adminChange,create,get,list,join,withdraw,update,cancel,remove,setPreferences,roster,comment,comments,addComment,deleteComment,notifications,markRead,calendar,deleteAccount,disconnectUsers,restrictActivity,restrictUser,exportAll};
}

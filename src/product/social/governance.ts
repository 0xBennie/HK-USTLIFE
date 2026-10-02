import {createHash,randomUUID} from 'node:crypto';
import type {DatabaseSync} from 'node:sqlite';
import {z} from 'zod';
import {transaction} from '../database.js';
import {ApiError} from '../errors.js';
import {keySchema,version} from './schemas.js';
import type {createWallStore} from './wall.js';
import type {createSocialStore} from './store.js';
import type {ReportTarget} from './wall-types.js';
import type {ContentReport,BlockedUser} from './governance-types.js';
const targetSchema=z.discriminatedUnion('kind',[
 z.object({kind:z.literal('post'),id:z.string().uuid()}).strict(),
 z.object({kind:z.literal('activity'),id:z.string().uuid()}).strict(),
 z.object({kind:z.literal('reply'),id:z.string().regex(/^[1-9]\d{0,14}$/)}).strict(),
 z.object({kind:z.literal('activity_comment'),id:z.string().regex(/^[1-9]\d{0,14}$/)}).strict(),
]);
const reportSchema=z.object({target:targetSchema,reason:z.enum(['spam','harassment','privacy','misinformation','other']),details:z.string().trim().max(2000).default('')}).strict();
export const reportQuery=z.object({cursor:z.string().uuid().optional(),status:z.enum(['pending','dismissed','action_taken']).optional()}).strict();
type ReportRow={id:string;owner_id:string;target_kind:ReportTarget['kind'];target_id:string;reason:ContentReport['reason'];details:string;status:ContentReport['status'];version:number;created_at:number;resolution:string;reviewed_at:number|null;fingerprint:string};
const stamp=(n:number)=>new Date(n).toISOString();
export function createGovernanceStore(db:DatabaseSync,now:()=>number,wall:ReturnType<typeof createWallStore>,social:ReturnType<typeof createSocialStore>){
 function reportView(r:ReportRow):ContentReport{return {id:r.id,target:{kind:r.target_kind,id:r.target_id},reason:r.reason,details:r.details,status:r.status,version:r.version,created_at:stamp(r.created_at),resolution:r.resolution,reviewed_at:r.reviewed_at===null?null:stamp(r.reviewed_at)};}
 function content(target:ReportTarget){
  const table={post:'wall_posts',reply:'wall_replies',activity:'activities',activity_comment:'activity_comments'}[target.kind];
  const r=db.prepare(`SELECT * FROM ${table} WHERE id=?`).get(target.id);if(!r)return null;
  const author=String(target.kind==='activity'?r.organizer_id:r.author_id);
  return {author_id:author,body:target.kind==='activity'?String(JSON.parse(String(r.payload)).description):String(r.body),title:target.kind==='activity'?String(JSON.parse(String(r.payload)).title):target.kind==='post'?String(r.title):null,moderation_state:String(r.moderation_state),parent_id:target.kind==='reply'?String(r.post_id):target.kind==='activity_comment'?String(r.activity_id):null};
 }
 function visibleTarget(user:string,target:ReportTarget){
  const r=content(target);if(!r)throw new ApiError(404,'CONTENT_NOT_FOUND','Content unavailable.');
  if(target.kind==='post')wall.get(target.id,user);
  else if(target.kind==='reply')wall.reply(Number(target.id),r.parent_id!,user);
  else if(target.kind==='activity')social.get(target.id,user);
  else social.comment(user,r.parent_id!,Number(target.id));
  return r;
 }
 function report(user:string,body:unknown,key:unknown){
  const v=reportSchema.parse(body),k=keySchema.parse(key),fingerprint=createHash('sha256').update(JSON.stringify(v)).digest('hex');
  return transaction(db,()=>{
   const previous=db.prepare('SELECT * FROM content_reports WHERE owner_id=? AND request_key=?').get(user,k) as ReportRow|undefined;
   if(previous){if(previous.fingerprint!==fingerprint)throw new ApiError(409,'IDEMPOTENCY_CONFLICT','This retry key has different content.');return reportView(previous);}
   const target=visibleTarget(user,v.target);
   if(Number(db.prepare('SELECT COUNT(*) AS n FROM content_reports WHERE owner_id=? AND created_at>?').get(user,now()-86400000)!.n)>=20)throw new ApiError(429,'REPORT_LIMIT','Daily report limit reached.');
   const id=randomUUID();db.prepare('INSERT INTO content_reports(id,owner_id,target_kind,target_id,target_author_id,reason,details,created_at,request_key,fingerprint) VALUES (?,?,?,?,?,?,?,?,?,?)').run(id,user,v.target.kind,v.target.id,target.author_id,v.reason,v.details,now(),k,fingerprint);
   return reportView(db.prepare('SELECT * FROM content_reports WHERE id=?').get(id) as ReportRow);
  });
 }
 function reports(user:string|null,query:z.infer<typeof reportQuery>){
  const clauses:string[]=[],args:(string|number)[]=[];
  if(user){clauses.push('owner_id=?');args.push(user);}if(query.status){clauses.push('status=?');args.push(query.status);}
  if(query.cursor){const cursor=db.prepare('SELECT * FROM content_reports WHERE id=?'+(user?' AND owner_id=?':'')).get(query.cursor,...(user?[user]:[])) as ReportRow|undefined;if(!cursor)throw new ApiError(404,'REPORT_NOT_FOUND','Report unavailable.');clauses.push('(created_at<? OR (created_at=? AND id<?))');args.push(cursor.created_at,cursor.created_at,cursor.id);}
  const rows=db.prepare('SELECT * FROM content_reports'+(clauses.length?' WHERE '+clauses.join(' AND '):'')+' ORDER BY created_at DESC,id DESC LIMIT 51').all(...args) as ReportRow[];
  return {items:rows.slice(0,50).map(r=>user?reportView(r):{...reportView(r),reporter_id:r.owner_id,content:content({kind:r.target_kind,id:r.target_id})}),next_cursor:rows.length>50?rows[49].id:null};
 }
 function resolve(actor:string,id:string,body:unknown){
  const v=z.object({version,action:z.enum(['dismiss','hide_content','ban_author']),reason:z.string().trim().min(1).max(1000)}).strict().parse(body);
  return transaction(db,()=>{
   const r=db.prepare('SELECT * FROM content_reports WHERE id=?').get(id) as ReportRow|undefined;
   if(!r)throw new ApiError(404,'REPORT_NOT_FOUND','Report unavailable.');if(r.version!==v.version||r.status!=='pending')throw new ApiError(409,'VERSION_CONFLICT','This report has already changed.');
   const target=content({kind:r.target_kind,id:r.target_id});
   if(v.action!=='dismiss'&&!target)throw new ApiError(410,'CONTENT_REMOVED','Content was deleted; dismiss this report instead.');
   if(v.action==='hide_content'){
    if(r.target_kind==='activity')social.restrictActivity(r.target_id);
    const table={post:'wall_posts',reply:'wall_replies',activity:'activities',activity_comment:'activity_comments'}[r.target_kind];
    db.prepare(`UPDATE ${table} SET moderation_state='hidden',version=version+1 WHERE id=?`).run(r.target_id);
   }
   if(v.action==='ban_author'){
    const author=db.prepare('SELECT role FROM users WHERE id=?').get(target!.author_id);
    if(author?.role==='admin')throw new ApiError(409,'PROTECTED_ADMIN','Administrator accounts cannot be restricted through reports.');
    db.prepare('UPDATE users SET banned_at=? WHERE id=?').run(now(),target!.author_id);
    db.prepare('DELETE FROM sessions WHERE user_id=?').run(target!.author_id);
    social.restrictUser(target!.author_id);
   }
   db.prepare('UPDATE content_reports SET status=?,version=version+1,resolution=?,reviewed_at=?,reviewer_id=? WHERE id=?').run(v.action==='dismiss'?'dismissed':'action_taken',v.reason,now(),actor,id);
   db.prepare('INSERT INTO moderation_audit(report_id,actor_id,action,reason,created_at) VALUES (?,?,?,?,?)').run(id,actor,v.action,v.reason,now());
   return reportView(db.prepare('SELECT * FROM content_reports WHERE id=?').get(id) as ReportRow);
  });
 }
 function blocks(user:string):BlockedUser[]{return db.prepare('SELECT b.target_id,u.display_name,b.created_at FROM user_blocks b JOIN users u ON u.id=b.target_id WHERE b.owner_id=? ORDER BY b.created_at DESC,b.target_id').all(user).map(r=>({id:String(r.target_id),display_name:String(r.display_name)||'Campus member',created_at:stamp(Number(r.created_at))}));}
 function block(user:string,target:string){return transaction(db,()=>{
  if(user===target)throw new ApiError(400,'SELF_BLOCK','You cannot block yourself.');
  if(!db.prepare('SELECT 1 FROM users WHERE id=?').get(target))throw new ApiError(404,'USER_NOT_FOUND','User unavailable.');
  if(db.prepare('SELECT 1 FROM user_blocks WHERE owner_id=? AND target_id=?').get(user,target))return {blocked:true};
  if(Number(db.prepare('SELECT COUNT(*) AS n FROM user_blocks WHERE owner_id=?').get(user)!.n)>=500)throw new ApiError(409,'BLOCK_LIMIT','Block list limit reached.');
  db.prepare('INSERT INTO user_blocks VALUES (?,?,?)').run(user,target,now());social.disconnectUsers(user,target);return {blocked:true};
 });}
 function unblock(user:string,target:string){db.prepare('DELETE FROM user_blocks WHERE owner_id=? AND target_id=?').run(user,target);return {blocked:false};}
 function exportAll(user:string){return {blocks:blocks(user),reports:(db.prepare('SELECT * FROM content_reports WHERE owner_id=? ORDER BY created_at DESC,id DESC').all(user) as ReportRow[]).map(reportView)};}
 return {report,reports,resolve,blocks,block,unblock,exportAll};
}

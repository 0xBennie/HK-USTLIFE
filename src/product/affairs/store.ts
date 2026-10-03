import {createHash,randomUUID} from 'node:crypto';
import type {DatabaseSync} from 'node:sqlite';
import {z} from 'zod';
import {transaction} from '../database.js';
import {ApiError} from '../errors.js';
import {templateSchema,createSchema,patchSchema,acceptSchema,type Template,type PrivateFields} from './schemas.js';

type Row={id:string;owner_id:string;template_id:string;accepted_revision:number;payload:string;version:number;archived:number;created_at:number;updated_at:number};
type Header={id:string;current_revision:number;retired_at:number|null};
const canonical=(v:unknown):string=>Array.isArray(v)?`[${v.map(canonical).join(',')}]`:v!==null&&typeof v==='object'?`{${Object.entries(v).sort(([a],[b])=>a.localeCompare(b)).map(([k,x])=>`${JSON.stringify(k)}:${canonical(x)}`).join(',')}}`:JSON.stringify(v);
const fail=(status:number,code:string,message:string):never=>{throw new ApiError(status,code,message);};
const same=(a:unknown,b:unknown)=>canonical(a)===canonical(b);
export function createAffairsStore(db:DatabaseSync,now:()=>number){
 function header(id:string){return db.prepare('SELECT * FROM affair_templates WHERE id=?').get(id) as Header|undefined;}
 function revision(id:string,rev:number):Template{
  const row=db.prepare('SELECT payload FROM affair_revisions WHERE template_id=? AND revision=?').get(id,rev);
  if(!row)return fail(404,'NOT_FOUND','Template not found.');return JSON.parse(String(row.payload));
 }
 function display(t:Template){return {...t,source_health:t.source_health==='verified'&&Date.parse(t.review_due_at)<=now()?'stale':t.source_health};}
 function available(h:Header,t:Template){
  if(h.retired_at!==null)fail(410,'TEMPLATE_RETIRED','Template retired.');
  if(display(t).source_health!=='verified')fail(409,'SOURCE_REVIEW_REQUIRED','Source requires review.');
 }
 // Trusted content-maintenance boundary only; not exposed to members or generic admin routes.
 function publish(body:unknown,reviewer:string){
  const t=templateSchema.parse(body);z.string().trim().min(1).max(120).parse(reviewer);
  if(Date.parse(t.reviewed_at)>now())fail(400,'INVALID_INPUT','Review cannot be in the future.');
  return transaction(db,()=>{
   const h=header(t.template_id);
   if(h&&t.revision<=h.current_revision)fail(409,'REVISION_EXISTS','Revision already exists or is superseded.');
   if(t.revision!==(h?.current_revision??0)+1)fail(409,'REVISION_GAP','Publish the next revision.');
   if(!h)db.prepare('INSERT INTO affair_templates(id,current_revision) VALUES(?,?)').run(t.template_id,t.revision);
   db.prepare('INSERT INTO affair_revisions VALUES(?,?,?,?,?)').run(t.template_id,t.revision,JSON.stringify(t),reviewer,now());
   db.prepare('UPDATE affair_templates SET current_revision=? WHERE id=?').run(t.revision,t.template_id);
   return display(t);
  });
 }
 function retire(id:string,reviewer:string){z.string().trim().min(1).parse(reviewer);if(!header(id))fail(404,'NOT_FOUND','Template not found.');db.prepare('UPDATE affair_templates SET retired_at=?,retired_by=? WHERE id=?').run(now(),reviewer,id);}
 function raw(owner:string,id:string){const r=db.prepare('SELECT * FROM affair_instances WHERE owner_id=? AND id=?').get(owner,id) as Row|undefined;if(!r)return fail(404,'NOT_FOUND','Private record not found.');return r;}
 function diff(old:Template,next:Template){
  const fields=['title','summary','conditions','materials','deadline','sources','steps'] as const;
  return fields.filter(k=>!same(old[k],next[k])).map(field=>({field,old:old[field],new:next[field]}));
 }
 function get(owner:string,id:string){
  const r=raw(owner,id),h=header(r.template_id)!,old=revision(r.template_id,r.accepted_revision),latest=revision(r.template_id,h.current_revision);
  return {...JSON.parse(r.payload) as PrivateFields,id:r.id,version:r.version,template_id:r.template_id,accepted_revision:r.accepted_revision,current_revision:h.current_revision,
   created_at:new Date(r.created_at).toISOString(),updated_at:new Date(r.updated_at).toISOString(),template:display(old),current_template:display(latest),retired:h.retired_at!==null,
   requires_review:r.accepted_revision!==h.current_revision,change_summary:diff(old,latest),official_status:{status:'unknown' as const,reason:'not_connected' as const}};
 }
 function receipt(owner:string,scope:string,key:unknown,input:unknown,action:()=>ReturnType<typeof get>){
  const k=z.string().min(8).max(128).regex(/^[A-Za-z0-9_-]+$/).parse(key),fingerprint=createHash('sha256').update(canonical(input)).digest('hex');
  return transaction(db,()=>{
   const prior=db.prepare('SELECT * FROM affair_receipts WHERE owner_id=? AND scope=? AND key=?').get(owner,scope,k);
   if(prior){if(prior.fingerprint!==fingerprint)fail(409,'WRITE_KEY_REUSED','Retry key belongs to different content.');
    if(!db.prepare('SELECT id FROM affair_instances WHERE owner_id=? AND id=?').get(owner,String(prior.instance_id)))fail(410,'RECORD_REMOVED','Original record was removed.');
    return get(owner,String(prior.instance_id));}
   const result=action();db.prepare('INSERT INTO affair_receipts VALUES(?,?,?,?,?,?,?)').run(owner,scope,k,fingerprint,result.id,result.version,now());return result;
  });
 }
 function create(owner:string,body:unknown,key:unknown){const input=createSchema.parse(body);return receipt(owner,'create',key,input,()=>{
  const h=header(input.template_id);if(!h)return fail(404,'NOT_FOUND','Template not found.');
  if(input.revision!==h.current_revision)fail(409,'TEMPLATE_CHANGED','Template changed.');const t=revision(h.id,h.current_revision);available(h,t);
  const count=db.prepare('SELECT COUNT(*) AS n FROM affair_instances WHERE owner_id=? AND archived=0').get(owner)!;
  if(Number(count.n)>=100)fail(409,'ACTIVE_LIMIT','Archive an existing affair before adding another.');
  const fields:PrivateFields={label:input.label,step_checks:Object.fromEntries(t.steps.map(s=>[s.id,false])),submission:'not_reported',self_reported_outcome:'unknown',note:'',archived:false};
  const id=randomUUID(),stamp=now();db.prepare('INSERT INTO affair_instances(id,owner_id,template_id,accepted_revision,payload,created_at,updated_at) VALUES(?,?,?,?,?,?,?)').run(id,owner,h.id,h.current_revision,JSON.stringify(fields),stamp,stamp);return get(owner,id);
 });}
 function write(r:Row,fields:PrivateFields,rev=r.accepted_revision){db.prepare('UPDATE affair_instances SET payload=?,archived=?,accepted_revision=?,version=version+1,updated_at=? WHERE id=? AND owner_id=?').run(JSON.stringify(fields),Number(fields.archived),rev,now(),r.id,r.owner_id);}
 function update(owner:string,id:string,body:unknown){const {version,...changes}=patchSchema.parse(body);return transaction(db,()=>{
  const r=raw(owner,id);if(r.version!==version)fail(409,'VERSION_CONFLICT','Record changed; reload before editing.');
  const old=JSON.parse(r.payload) as PrivateFields;
  if(changes.step_checks){const ids=new Set(revision(r.template_id,r.accepted_revision).steps.map(s=>s.id));if(Object.keys(changes.step_checks).some(k=>!ids.has(k)))fail(400,'INVALID_INPUT','Unknown step.');}
  if(old.archived&&changes.archived===false&&Number(db.prepare('SELECT COUNT(*) AS n FROM affair_instances WHERE owner_id=? AND archived=0').get(owner)!.n)>=100)fail(409,'ACTIVE_LIMIT','Active affair limit reached.');
  write(r,{...old,...changes,step_checks:{...old.step_checks,...changes.step_checks}});return get(owner,id);
 });}
 function acceptRevision(owner:string,id:string,body:unknown,key:unknown){const input=acceptSchema.parse(body);return receipt(owner,'accept:'+id,key,input,()=>{
  const r=raw(owner,id),h=header(r.template_id)!;
  if(r.version!==input.instance_version||r.accepted_revision!==input.from_revision)fail(409,'VERSION_CONFLICT','Record changed; reload before accepting.');
  if(input.to_revision!==h.current_revision||input.to_revision<=r.accepted_revision)fail(409,'TEMPLATE_CHANGED','Read the current new revision.');
  const old=revision(h.id,r.accepted_revision),next=revision(h.id,input.to_revision);available(h,next);
  const changed=next.steps.filter(s=>old.steps.some(o=>o.id===s.id&&!same(o,s))).map(s=>s.id);
  if(!same(Object.keys(input.changed_step_choices).sort(),changed.sort()))fail(400,'INVALID_INPUT','Choose for every changed step, and only changed steps.');
  const fields=JSON.parse(r.payload) as PrivateFields;
  const checks=Object.fromEntries(next.steps.map(s=>[s.id,changed.includes(s.id)?input.changed_step_choices[s.id]==='retain'&&!!fields.step_checks[s.id]:!!fields.step_checks[s.id]]));
  const history={from_revision:r.accepted_revision,to_revision:next.revision,old_checks:fields.step_checks,choices:input.changed_step_choices,change_summary:diff(old,next),reason:next.change_reason};
  db.prepare('INSERT INTO affair_acknowledgements VALUES(?,?,?,?)').run(id,r.version+1,JSON.stringify(history),now());
  write(r,{...fields,step_checks:checks},next.revision);return get(owner,id);
 });}
 function remove(owner:string,id:string,version:number){z.number().int().positive().parse(version);return transaction(db,()=>{const r=raw(owner,id);if(r.version!==version)fail(409,'VERSION_CONFLICT','Record changed; reload before deleting.');db.prepare('DELETE FROM affair_instances WHERE owner_id=? AND id=?').run(owner,id);return {deleted:true,id};});}
 function list(owner:string,query:{limit:number;cursor?:string;state:'active'|'archived'}){
  let after:{at:number;id:string}|undefined;
  if(query.cursor){try{after=z.object({at:z.number().int().nonnegative(),id:z.string().uuid()}).strict().parse(JSON.parse(Buffer.from(query.cursor,'base64url').toString('utf8')));}catch{fail(400,'INVALID_INPUT','Invalid cursor.');}}
  const args:(string|number)[]=[owner,Number(query.state==='archived')];
  let where='owner_id=? AND archived=?';if(after){where+=' AND (created_at>? OR (created_at=? AND id>?))';args.push(after.at,after.at,after.id);}
  const rows=db.prepare(`SELECT * FROM affair_instances WHERE ${where} ORDER BY created_at,id LIMIT ?`).all(...args,query.limit+1) as Row[];
  const last=rows[query.limit-1];return {items:rows.slice(0,query.limit).map(r=>get(owner,r.id)),next_cursor:rows.length>query.limit?Buffer.from(JSON.stringify({at:last.created_at,id:last.id})).toString('base64url'):null};
 }
 function template(id:string){const h=header(id);if(!h)return fail(404,'NOT_FOUND','Template not found.');if(h.retired_at!==null)fail(410,'TEMPLATE_RETIRED','Template retired.');return display(revision(id,h.current_revision));}
 function catalog(query:{limit:number;cursor?:string}){const q=z.object({limit:z.number().int().min(1).max(50),cursor:z.string().max(120).optional()}).parse(query);const rows=db.prepare('SELECT * FROM affair_templates WHERE retired_at IS NULL AND id>? ORDER BY id LIMIT ?').all(q.cursor??'',q.limit+1) as Header[];return {items:rows.slice(0,q.limit).map(h=>display(revision(h.id,h.current_revision))),next_cursor:rows.length>q.limit?rows[q.limit-1].id:null};}
 function exportAll(owner:string){return (db.prepare('SELECT id FROM affair_instances WHERE owner_id=? ORDER BY created_at,id').all(owner)).map(r=>({...get(owner,String(r.id)),history:db.prepare('SELECT payload,created_at FROM affair_acknowledgements WHERE instance_id=? ORDER BY version').all(String(r.id)).map(h=>({...JSON.parse(String(h.payload)),acknowledged_at:new Date(Number(h.created_at)).toISOString()}))}));}
 return {publish,retire,catalog,template,list,get,create,update,acceptRevision,remove,exportAll};
}

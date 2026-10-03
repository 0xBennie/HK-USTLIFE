import {z} from 'zod';
import {calendarDate} from '../learning/schemas.js';
const short=z.string().trim().min(1).max(120);
export const text=z.object({zh:z.string().trim().min(1).max(2000),en:z.string().trim().min(1).max(2000)}).strict();
const step=z.object({id:short,text,source_id:short}).strict();
const officialUrl=z.string().url().refine(value=>{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&(u.hostname==='hkust.edu.hk'||u.hostname.endsWith('.hkust.edu.hk'));},'Reviewed HKUST HTTPS source required');
export const templateSchema=z.object({
 template_id:short,revision:z.number().int().positive(),school_id:z.literal('hkust'),title:text,summary:text,
 conditions:z.array(step).max(40),materials:z.array(step).max(40),steps:z.array(step).min(1).max(60),
 sources:z.array(z.object({id:short,url:officialUrl}).strict()).min(1).max(20),
 reviewed_at:z.string().datetime(),review_due_at:z.string().datetime(),source_health:z.enum(['verified','stale','conflict','unavailable']),
 deadline:z.discriminatedUnion('kind',[z.object({kind:z.literal('none')}).strict(),z.object({kind:z.literal('per_user')}).strict(),z.object({kind:z.literal('fixed'),at:z.string().datetime(),source_id:short}).strict()]),
 change_reason:z.string().trim().min(1).max(1000),
}).strict().superRefine((v,ctx)=>{
 if(Date.parse(v.review_due_at)<=Date.parse(v.reviewed_at))ctx.addIssue({code:'custom',message:'Review expiry must follow review'});
 for(const rows of [v.steps,v.conditions,v.materials,v.sources])if(new Set(rows.map(s=>s.id)).size!==rows.length)ctx.addIssue({code:'custom',message:'Duplicate identifier'});
 const sources=new Set(v.sources.map(s=>s.id));
 if([...v.steps,...v.conditions,...v.materials].some(s=>!sources.has(s.source_id))||(v.deadline.kind==='fixed'&&!sources.has(v.deadline.source_id)))ctx.addIssue({code:'custom',message:'Unknown source'});
});
export type Template=z.infer<typeof templateSchema>;
export const createSchema=z.object({template_id:short,revision:z.number().int().positive(),label:z.string().trim().max(120).default('')}).strict();
export const personalDueSchema=z.discriminatedUnion('kind',[
 z.object({kind:z.literal('date'),date:calendarDate,timezone:z.literal('Asia/Hong_Kong')}).strict(),
 z.object({kind:z.literal('time'),at:z.string().datetime({offset:true}).refine(v=>calendarDate.safeParse(v.slice(0,10)).success&&Number.isFinite(Date.parse(v))).transform(v=>new Date(v).toISOString()),timezone:z.literal('Asia/Hong_Kong')}).strict(),
]).nullable();
export const privateSchema=z.object({label:z.string().trim().max(120),step_checks:z.record(z.boolean()),submission:z.enum(['not_reported','self_reported']),self_reported_outcome:z.enum(['unknown','received','approved','rejected','completed']),note:z.string().max(2000),archived:z.boolean(),personal_due:personalDueSchema,calendar_saved:z.boolean(),remind_minutes:z.number().int().min(0).max(10080).nullable()}).strict();
export const patchSchema=privateSchema.partial().extend({version:z.number().int().positive()}).strict().refine(v=>Object.keys(v).length>1,'Provide an editable field');
export const acceptSchema=z.object({instance_version:z.number().int().positive(),from_revision:z.number().int().positive(),to_revision:z.number().int().positive(),changed_step_choices:z.record(z.enum(['retain','reset']))}).strict();
export type PrivateFields=z.infer<typeof privateSchema>;

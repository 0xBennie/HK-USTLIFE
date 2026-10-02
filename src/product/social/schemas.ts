import {z} from 'zod';
import {calendarDate,timezone} from '../learning/schemas.js';
const instant=z.string().datetime({offset:true}).refine(s=>calendarDate.safeParse(s.slice(0,10)).success&&Number.isFinite(Date.parse(s))).transform(s=>new Date(s).toISOString());
export const activitySchema=z.object({
 kind:z.enum(['activity','study']),title:z.string().trim().min(1).max(120),description:z.string().trim().max(5000).default(''),location:z.string().trim().min(1).max(300),
 starts_at:instant,ends_at:instant,timezone:timezone.default('Asia/Hong_Kong'),capacity:z.number().int().min(1).max(50),
 languages:z.array(z.enum(['zh','en','yue'])).min(1).max(3).refine(v=>new Set(v).size===v.length),interaction:z.enum(['quiet','casual','active']).default('casual'),cost_minor:z.number().int().min(0).max(100000).default(0),requirements:z.string().trim().max(2000).default(''),visibility:z.enum(['public','members']),
}).strict().refine(v=>v.ends_at>v.starts_at&&Date.parse(v.ends_at)-Date.parse(v.starts_at)<=7*86400000,'Use an end after start, at most seven days later.');
export const activityQuery=z.object({limit:z.coerce.number().int().min(1).max(50).default(20),cursor:z.string().uuid().optional(),q:z.string().trim().max(120).optional(),kind:z.enum(['activity','study']).optional(),language:z.enum(['zh','en','yue']).optional(),interaction:z.enum(['quiet','casual','active']).optional(),from:instant.optional(),to:instant.optional(),mine:z.enum(['organized','participating','saved']).optional()}).strict().refine(v=>!v.from||!v.to||v.to>v.from);
export const version=z.number().int().positive();
export const preferencesSchema=z.object({bookmarked:z.boolean(),calendar_saved:z.boolean(),remind_minutes:z.number().int().min(0).max(10080).nullable()}).strict().refine(v=>v.calendar_saved||v.remind_minutes===null,'Unsaved activities cannot have reminders.');
export const joinSchema=z.object({activity_version:version,save_calendar:z.boolean().default(false)}).strict();
export const keySchema=z.string().min(8).max(128).regex(/^[A-Za-z0-9_-]+$/);

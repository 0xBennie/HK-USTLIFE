import { z } from 'zod';

export const calendarDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const d = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0,10) === value;
}, 'Invalid calendar date');
const instant = z.string().datetime({ offset: true }).refine(value => calendarDate.safeParse(value.slice(0,10)).success && Number.isFinite(Date.parse(value)))
  .transform(value => new Date(value).toISOString());
export const timezone = z.string().max(100).refine(value => {
  try { new Intl.DateTimeFormat('en', { timeZone: value }); return true; } catch { return false; }
});
const title = z.string().trim().min(1).max(200);
const text = z.string().max(10_000).default('');
const base = { title, course_id: z.string().uuid().nullable().default(null) };
const reminder = z.number().int().min(0).max(10_080).nullable().default(null);
export const courseSchema = z.object({ title, code: z.string().trim().max(40).default(''), description: text }).strict();
const eventSchema = z.object({
  ...base, kind: z.literal('event'), body: text, location: z.string().max(500).default(''),
  timezone: timezone.default('Asia/Hong_Kong'), all_day: z.boolean().default(false),
  starts_at: instant.nullable().default(null), ends_at: instant.nullable().default(null),
  start_date: calendarDate.nullable().default(null), end_date: calendarDate.nullable().default(null),
  status: z.enum(['active','cancelled']).default('active'), remind_minutes: reminder,
}).strict();
const taskSchema = z.object({
  ...base, kind: z.literal('task'), body: text, status: z.enum(['open','done']).default('open'),
  due_at: instant.nullable().default(null), due_date: calendarDate.nullable().default(null),
  remind_minutes: reminder,
  subtasks: z.array(z.object({ id: z.string().uuid(), title, done: z.boolean() }).strict()).max(50).default([]),
}).strict();
const noteSchema = z.object({ ...base, kind: z.literal('note'), body: text }).strict();
const materialSchema = z.object({ ...base, kind: z.literal('material'), body: text,
  url: z.string().url().max(2000).refine(value => { try { const u = new URL(value); return ['https:','http:'].includes(u.protocol) && !u.username && !u.password; } catch { return false; } }),
}).strict();
export const itemSchema = z.discriminatedUnion('kind',[eventSchema,taskSchema,noteSchema,materialSchema]).superRefine((v,ctx) => {
  const issue = (message: string) => ctx.addIssue({code:z.ZodIssueCode.custom,message});
  if (v.kind === 'event') {
    if (v.all_day) {
      if (!v.start_date || v.starts_at || v.ends_at || (v.end_date && v.end_date <= v.start_date)) issue('All-day dates require an exclusive end, without timestamps.');
      if (v.remind_minutes !== null) issue('All-day reminders need an explicit reminder time; not supported by this field.');
    } else {
      if (!v.starts_at || v.start_date || v.end_date || (v.ends_at && v.ends_at <= v.starts_at)) issue('Timed events need a start and a later optional end.');
    }
  }
  if (v.kind === 'task') {
    if (v.due_at && v.due_date) issue('Choose timed or date-only deadline.');
    if (v.remind_minutes !== null && !v.due_at) issue('A timed reminder needs a precise deadline.');
    if (new Set(v.subtasks.map(t=>t.id)).size !== v.subtasks.length) issue('Subtask IDs must be unique.');
  }
});
export const versionSchema = z.number().int().positive();
export const listSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20), cursor: z.string().uuid().optional(),
  kind: z.enum(['event','task','note','material']).optional(), course_id: z.string().uuid().optional(),
}).strict();
export const calendarQuerySchema = z.object({ from: calendarDate, to: calendarDate, timezone: timezone.default('Asia/Hong_Kong') }).strict()
  .refine(v => v.to > v.from && (Date.parse(v.to)-Date.parse(v.from))/86400_000 <= 42, 'Choose a range of 1–42 days.');
export type CourseInput = z.infer<typeof courseSchema>;
export type ItemInput = z.infer<typeof itemSchema>;
export type Stored<T> = T & { id: string; version: number; created_at: string; updated_at: string };
export type StudyItem = Stored<ItemInput>;

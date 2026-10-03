import { z } from 'zod';
import { courseSchema, itemSchema } from '../learning/schemas.js';

export const providerSchema = z.enum(['sis', 'canvas']);
export type Provider = z.infer<typeof providerSchema>;
export type Collection = 'timetable' | 'courses' | 'assignments' | 'events';
export type Contracts = Partial<Record<Provider, {
  readonly approval_reference: string;
  readonly consent_version: string;
  readonly scopes: readonly { readonly id: string; readonly collection: Collection; readonly missing: 'retain' | 'remove' }[];
}>>;
const contractSchema = z.object({
  approval_reference:z.string().trim().min(1).max(500),
  consent_version:z.string().trim().min(1).max(100),
  scopes:z.array(z.object({
    id:z.string().min(1).max(120),
    collection:z.enum(['timetable','courses','assignments','events']),
    missing:z.enum(['retain','remove']),
  }).strict()).min(1).max(100).refine(scopes=>new Set(scopes.map(s=>s.id)).size===scopes.length,'Scope identities must be unique.'),
}).strict();
export const contractsSchema = z.object({sis:contractSchema.optional(),canvas:contractSchema.optional()}).strict()
  .refine(c=>c.sis?.scopes.every(s=>s.collection==='timetable')??true,'SIS scopes must contain timetable records.')
  .refine(c=>c.canvas?.scopes.every(s=>s.collection!=='timetable')??true,'Canvas is not a formal timetable source.');
export const personalSchema = z.object({
  version: z.number().int().nonnegative(),
  notes: z.string().max(10_000).optional(),
  completed: z.boolean().optional(),
  remind_minutes: z.number().int().min(0).max(10_080).nullable().optional(),
}).strict().refine(v => Object.keys(v).length > 1, 'Provide personal fields.');
export const schoolListSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().uuid().optional(),
  provider: providerSchema.optional(),
}).strict();
const envelope = z.object({
  key: z.string().min(1).max(300),
  state: z.enum(['active','cancelled']),
  source_updated_at: z.string().datetime({offset:true}).nullable(),
  payload: z.unknown(),
}).strict();
export function parseRecord(collection: Collection, input: unknown) {
  const row = envelope.parse(input);
  const payload = collection === 'courses' ? courseSchema.parse(row.payload) : itemSchema.parse(row.payload);
  if (collection !== 'courses') {
    const expected = collection === 'assignments' ? 'task' : 'event';
    if (!('kind' in payload) || payload.kind !== expected || payload.course_id !== null || payload.remind_minutes !== null
      || (payload.kind === 'task' && (payload.status !== 'open' || payload.subtasks.length > 0))) {
      throw new Error('Adapter source payload cannot contain private edits or a different collection.');
    }
  }
  return { ...row, payload };
}
export type SourceRecord = ReturnType<typeof parseRecord>;
export type Personal = {notes:string;completed:boolean;remind_minutes:number|null;version:number};

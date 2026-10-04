// Canvas connector using the student's own Canvas personal access token (Canvas → Account → Settings → New access token).
// The token is verified against Canvas, stored AES-256-GCM encrypted with a key derived from the server secret,
// and only used server-side to read the student's planner (assignments, quizzes, discussions with due dates).
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { z } from 'zod';
import { ApiError } from '../errors.js';
import type { createSchoolStore } from './store.js';
import { SchoolAuthorizationExpired, syncSchoolScope, type SchoolPage } from './sync.js';

export const CANVAS_CONTRACT = {
  approval_reference: 'canvas-personal-access-token',
  consent_version: 'canvas-pat-v1',
  scopes: [{ id: 'canvas.planner', collection: 'assignments', missing: 'remove' }],
} as const;
export const CANVAS_BASE = process.env.CANVAS_BASE_URL ?? 'https://canvas.ust.hk';

type Fetch = typeof fetch;
const planner = z.array(z.object({
  plannable_id: z.union([z.number(), z.string()]),
  plannable_type: z.string(),
  plannable_date: z.string().nullable().optional(),
  context_name: z.string().nullable().optional(),
  html_url: z.string().nullable().optional(),
  plannable: z.object({ title: z.string().optional(), name: z.string().optional(), updated_at: z.string().nullable().optional(), due_at: z.string().nullable().optional() }).passthrough(),
  submissions: z.union([z.object({ submitted: z.boolean().optional() }).passthrough(), z.literal(false)]).optional(),
}).passthrough());

export function createCanvasConnector(db: DatabaseSync, dataDir: string, now: () => number, store: ReturnType<typeof createSchoolStore>, fetcher: Fetch = fetch) {
  const key = createHash('sha256').update(readFileSync(join(dataDir, 'auth-secret'))).update('canvas-token-v1').digest();
  const seal = (plain: string) => { const iv = randomBytes(12), c = createCipheriv('aes-256-gcm', key, iv); const body = Buffer.concat([c.update(plain, 'utf8'), c.final()]); return Buffer.concat([iv, c.getAuthTag(), body]).toString('base64'); };
  const open = (sealed: string) => { const raw = Buffer.from(sealed, 'base64'), d = createDecipheriv('aes-256-gcm', key, raw.subarray(0, 12)); d.setAuthTag(raw.subarray(12, 28)); return Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString('utf8'); };
  const tokenOf = (owner: string) => { const row = db.prepare('SELECT token FROM canvas_tokens WHERE owner_id=?').get(owner) as { token: string } | undefined; return row ? open(row.token) : null; };

  async function canvas(token: string, url: string, signal?: AbortSignal) {
    if (!url.startsWith(CANVAS_BASE + '/api/v1/')) throw new Error('Unexpected Canvas URL');
    const res = await fetcher(url, { headers: { authorization: `Bearer ${token}`, accept: 'application/json' }, signal, redirect: 'error' });
    if (res.status === 401 || res.status === 403) throw new SchoolAuthorizationExpired();
    if (!res.ok) throw new Error(`Canvas ${res.status}`);
    const next = /<([^>]+)>;\s*rel="next"/.exec(res.headers.get('link') ?? '')?.[1] ?? null;
    return { body: await res.json() as unknown, next };
  }
  function toRecord(item: z.infer<typeof planner>[number]) {
    const due = item.plannable.due_at ?? item.plannable_date ?? null;
    const title = (item.plannable.title ?? item.plannable.name ?? '').trim();
    if (!due || !title || !['assignment', 'quiz', 'discussion_topic', 'wiki_page', 'calendar_event'].includes(item.plannable_type)) return null;
    const course = (item.context_name ?? '').trim();
    return {
      key: `${item.plannable_type}:${item.plannable_id}`, state: 'active' as const,
      source_updated_at: item.plannable.updated_at ? new Date(item.plannable.updated_at).toISOString() : null,
      payload: { kind: 'task', title: (course ? `${course.split(/\s+/).slice(0, 2).join(' ')} · ${title}` : title).slice(0, 200), body: [course, item.html_url ? `${CANVAS_BASE}${item.html_url}` : ''].filter(Boolean).join('\n').slice(0, 10_000), status: 'open', due_at: new Date(due).toISOString(), due_date: null, remind_minutes: null, subtasks: [], course_id: null },
    };
  }
  async function sync(owner: string) {
    const token = tokenOf(owner);
    if (!token) throw new ApiError(409, 'CANVAS_NOT_CONNECTED', 'Connect Canvas first.');
    const start = new Date(now() - 14 * 864e5).toISOString().slice(0, 10), end = new Date(now() + 120 * 864e5).toISOString().slice(0, 10);
    const first = `${CANVAS_BASE}/api/v1/planner/items?start_date=${start}&end_date=${end}&per_page=100`;
    return syncSchoolScope(store, owner, 'canvas', 'canvas.planner', async (cursor, { signal }): Promise<SchoolPage> => {
      const { body, next } = await canvas(token, cursor ?? first, signal);
      const items = planner.parse(body);
      return { records: items.map(toRecord).filter(r => r !== null), next_cursor: next };
    });
  }
  async function connect(owner: string, rawToken: string) {
    const token = rawToken.trim();
    if (!/^[A-Za-z0-9~_.\-]{20,200}$/.test(token)) throw new ApiError(400, 'CANVAS_TOKEN_INVALID', 'That does not look like a Canvas access token.');
    let me: { id: number | string; name?: string };
    try { me = z.object({ id: z.union([z.number(), z.string()]), name: z.string().optional() }).passthrough().parse((await canvas(token, `${CANVAS_BASE}/api/v1/users/self`)).body); }
    catch (e) { throw e instanceof SchoolAuthorizationExpired ? new ApiError(401, 'CANVAS_TOKEN_REJECTED', 'Canvas rejected this token.') : new ApiError(502, 'CANVAS_UNREACHABLE', 'Canvas could not be reached.'); }
    store.grant(owner, 'canvas', { subject: `canvas:${me.id}`, consent_version: CANVAS_CONTRACT.consent_version });
    db.prepare('INSERT INTO canvas_tokens(owner_id,token,canvas_user,created_at) VALUES (?,?,?,?) ON CONFLICT(owner_id) DO UPDATE SET token=excluded.token,canvas_user=excluded.canvas_user,created_at=excluded.created_at').run(owner, seal(token), String(me.id), now()); // release-check:allow (stores the AES-GCM sealed value, not the plain token)
    const result = await sync(owner);
    return { connected: true, canvas_name: me.name ?? null, sync: result };
  }
  function forget(owner: string) { db.prepare('DELETE FROM canvas_tokens WHERE owner_id=?').run(owner); }
  return { connect, sync, forget, connected: (owner: string) => !!db.prepare('SELECT 1 FROM canvas_tokens WHERE owner_id=?').get(owner) };
}

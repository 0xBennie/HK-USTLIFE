// Calendar subscriptions: a student pastes the published ICS link of their Outlook (HKUST Microsoft 365),
// Google or iCloud calendar; the server fetches it, imports through the normal preview/confirm path and
// refreshes it. Only https links on known calendar hosts are fetched (no arbitrary URLs → no SSRF).
import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { z } from 'zod';
import { ApiError } from '../errors.js';
import type { createCalendarStore } from './store.js';

const HOSTS = [/^outlook\.office365\.com$/, /^outlook\.office\.com$/, /^outlook\.live\.com$/, /^calendar\.google\.com$/, /^p\d+-caldav\.icloud\.com$/];
export const subscriptionInput = z.object({ name: z.string().trim().min(1).max(60), url: z.string().trim().max(2000) }).strict();
export function normaliseCalendarUrl(raw: string) {
  let u: URL;
  try { u = new URL(raw.replace(/^webcals?:\/\//i, 'https://')); } catch { throw new ApiError(400, 'CALENDAR_URL_INVALID', 'Paste the published calendar (ICS) link.'); }
  if (u.protocol !== 'https:' || u.username || u.password || u.port || !HOSTS.some(h => h.test(u.hostname))) throw new ApiError(400, 'CALENDAR_HOST_UNSUPPORTED', 'Use a published Outlook, Google or iCloud calendar link.');
  return u.toString();
}

export function createCalendarSubscriptions(db: DatabaseSync, now: () => number, calendars: ReturnType<typeof createCalendarStore>, fetcher: typeof fetch = fetch) {
  async function download(url: string) {
    const res = await fetcher(url, { headers: { accept: 'text/calendar' }, redirect: 'error', signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new ApiError(502, 'CALENDAR_FETCH_FAILED', 'The calendar link could not be read. Check that it is still published.');
    const text = await res.text();
    if (text.length > 256 * 1024) throw new ApiError(413, 'CALENDAR_TOO_LARGE', 'This calendar is too large to import.');
    if (!/BEGIN:VCALENDAR/.test(text)) throw new ApiError(400, 'CALENDAR_NOT_ICS', 'This link is not a calendar (ICS) feed.');
    return text;
  }
  async function apply(owner: string, content: string, target: { source_id: string } | { source_name: string }) {
    const preview = calendars.preview(owner, { ...target, content, floating_timezone: 'Asia/Hong_Kong' }) as { id: string; source: { id: string }; entries: { series: { uid: string }; action: string }[] };
    const changed = preview.entries.filter(e => e.action !== 'unchanged');
    // Student edits win on conflicts; new and updated events come from the source.
    const result = changed.length
      ? calendars.confirm(owner, preview.id, { uids: changed.map(e => e.series.uid), acknowledge_fingerprints: true, resolutions: Object.fromEntries(changed.filter(e => e.action === 'conflict').map(e => [e.series.uid, 'keep_local'])) }) as { source_id: string; imported: number }
      : { source_id: preview.source.id, imported: 0 };
    return { source_id: result.source_id ?? preview.source.id, imported: result.imported, events: preview.entries.length };
  }
  async function subscribe(owner: string, body: unknown) {
    const v = subscriptionInput.parse(body), url = normaliseCalendarUrl(v.url);
    if (Number((db.prepare('SELECT COUNT(*) AS n FROM calendar_subscriptions WHERE owner_id=?').get(owner) as { n: number }).n) >= 5) throw new ApiError(409, 'SUBSCRIPTION_LIMIT', 'Remove a calendar first (max 5).');
    const r = await apply(owner, await download(url), { source_name: v.name });
    const id = randomUUID();
    db.prepare('INSERT INTO calendar_subscriptions(id,owner_id,source_id,url,last_success_at,created_at) VALUES (?,?,?,?,?,?)').run(id, owner, r.source_id, url, now(), now());
    return { id, name: v.name, source_id: r.source_id, events: r.events, imported: r.imported };
  }
  async function refresh(owner: string, id?: string) {
    const rows = db.prepare('SELECT s.id,s.url,s.source_id,c.name FROM calendar_subscriptions s JOIN calendar_sources c ON c.id=s.source_id WHERE s.owner_id=?' + (id ? ' AND s.id=?' : '')).all(...(id ? [owner, id] : [owner])) as { id: string; url: string; source_id: string; name: string }[];
    if (id && !rows.length) throw new ApiError(404, 'SUBSCRIPTION_NOT_FOUND', 'Calendar not found.');
    const out = [];
    for (const row of rows) {
      try { const r = await apply(owner, await download(row.url), { source_id: row.source_id }); db.prepare('UPDATE calendar_subscriptions SET last_success_at=?,last_error=NULL WHERE id=?').run(now(), row.id); out.push({ id: row.id, ok: true, imported: r.imported }); }
      catch (e) { db.prepare('UPDATE calendar_subscriptions SET last_error=? WHERE id=?').run(e instanceof ApiError ? e.code : 'CALENDAR_FETCH_FAILED', row.id); out.push({ id: row.id, ok: false }); }
    }
    return out;
  }
  function list(owner: string) {
    return (db.prepare('SELECT s.id,s.url,s.source_id,s.last_success_at,s.last_error,c.name FROM calendar_subscriptions s JOIN calendar_sources c ON c.id=s.source_id WHERE s.owner_id=? ORDER BY s.created_at').all(owner) as Record<string, unknown>[])
      .map(r => ({ id: String(r.id), name: String(r.name), source_id: String(r.source_id), host: new URL(String(r.url)).hostname, last_success_at: r.last_success_at == null ? null : new Date(Number(r.last_success_at)).toISOString(), last_error: r.last_error == null ? null : String(r.last_error) }));
  }
  function remove(owner: string, id: string) {
    if (!db.prepare('DELETE FROM calendar_subscriptions WHERE id=? AND owner_id=?').run(id, owner).changes) throw new ApiError(404, 'SUBSCRIPTION_NOT_FOUND', 'Calendar not found.');
    return { id, removed: true };
  }
  return { subscribe, refresh, list, remove };
}

// Real backend for the "life" boards: time-together groups (free slots computed from members' own calendars,
// timetables never shared), crowd-sourced anonymous grade distribution (shown only when n ≥ 10),
// clubs with follows, and verified employers with jobs and info-session RSVPs.
import { randomInt, randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { z } from 'zod';
import { ApiError } from '../errors.js';

export const GRADES = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D', 'F'] as const;
export const MIN_SAMPLE = 10;
type Busy = (user: string, fromIso: string, toIso: string) => { start: number; end: number }[];
const code6 = () => Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[randomInt(32)]).join('');
const courseCode = z.string().trim().toUpperCase().regex(/^[A-Z]{4}\s?\d{4}[A-Z]?$/).transform(v => v.replace(/^([A-Z]{4})\s?/, '$1 '));

export function createLifeStore(db: DatabaseSync, now: () => number, busy: Busy) {
  const name = (id: string) => String((db.prepare('SELECT display_name FROM users WHERE id=?').get(id) as { display_name?: string } | undefined)?.display_name || 'Classmate');
  /* ---------- time together ---------- */
  function groups(user: string) {
    return (db.prepare('SELECT g.id,g.name,g.code,g.owner_id,(SELECT COUNT(*) FROM time_members m2 WHERE m2.group_id=g.id) AS size FROM time_groups g JOIN time_members m ON m.group_id=g.id WHERE m.user_id=? ORDER BY g.created_at DESC').all(user) as { id: string; name: string; code: string; owner_id: string; size: number }[])
      .map(g => ({ id: g.id, name: g.name, code: g.code, size: Number(g.size), is_owner: g.owner_id === user }));
  }
  function createGroup(user: string, body: unknown) {
    const { name: title } = z.object({ name: z.string().trim().min(1).max(40) }).strict().parse(body);
    if (Number((db.prepare('SELECT COUNT(*) AS n FROM time_members WHERE user_id=?').get(user) as { n: number }).n) >= 20) throw new ApiError(409, 'GROUP_LIMIT', 'Leave a group first.');
    const id = randomUUID(); let code = code6();
    while (db.prepare('SELECT 1 FROM time_groups WHERE code=?').get(code)) code = code6();
    db.prepare('INSERT INTO time_groups(id,name,code,owner_id,created_at) VALUES (?,?,?,?,?)').run(id, title, code, user, now());
    db.prepare('INSERT INTO time_members(group_id,user_id,joined_at) VALUES (?,?,?)').run(id, user, now());
    return groups(user).find(g => g.id === id)!;
  }
  function joinGroup(user: string, body: unknown) {
    const { code } = z.object({ code: z.string().trim().toUpperCase().length(6) }).strict().parse(body);
    const g = db.prepare('SELECT id FROM time_groups WHERE code=?').get(code) as { id: string } | undefined;
    if (!g) throw new ApiError(404, 'GROUP_NOT_FOUND', 'No group with this code.');
    if (Number((db.prepare('SELECT COUNT(*) AS n FROM time_members WHERE group_id=?').get(g.id) as { n: number }).n) >= 12) throw new ApiError(409, 'GROUP_FULL', 'This group is full (12).');
    db.prepare('INSERT OR IGNORE INTO time_members(group_id,user_id,joined_at) VALUES (?,?,?)').run(g.id, user, now());
    return groups(user).find(x => x.id === g.id)!;
  }
  function leaveGroup(user: string, id: string) {
    if (!db.prepare('DELETE FROM time_members WHERE group_id=? AND user_id=?').run(id, user).changes) throw new ApiError(404, 'GROUP_NOT_FOUND', 'Group not found.');
    if (!db.prepare('SELECT 1 FROM time_members WHERE group_id=?').get(id)) db.prepare('DELETE FROM time_groups WHERE id=?').run(id);
    return { id, left: true };
  }
  /** Common free 1-hour+ windows, Mon–Fri 09:00–21:00 HKT, next 7 days. Only counts are revealed, never events. */
  function slots(user: string, id: string) {
    const members = (db.prepare('SELECT user_id FROM time_members WHERE group_id=? ORDER BY joined_at').all(id) as { user_id: string }[]).map(r => r.user_id);
    if (!members.includes(user)) throw new ApiError(404, 'GROUP_NOT_FOUND', 'Group not found.');
    const g = db.prepare('SELECT name,code FROM time_groups WHERE id=?').get(id) as { name: string; code: string };
    const hkMidnight = (ms: number) => { const d = new Date(ms + 8 * 3600e3); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - 8 * 3600e3; };
    const start = hkMidnight(now()), end = start + 7 * 864e5;
    const busyBy = new Map(members.map(m => [m, busy(m, new Date(start).toISOString(), new Date(end).toISOString())]));
    const result: { start: string; end: string; free: number; total: number }[] = [];
    for (let day = 0; day < 7; day++) {
      const base = start + day * 864e5, wd = new Date(base + 8 * 3600e3).getUTCDay();
      if (wd === 0 || wd === 6) continue;
      let run: { s: number; e: number; free: number } | null = null;
      for (let h = 9; h < 21; h += 0.5) {
        const s = base + h * 3600e3, e = s + 1800e3;
        if (e <= now()) { run = null; continue; }
        const free = members.filter(m => !(busyBy.get(m) ?? []).some(b => b.start < e && b.end > s)).length;
        if (free === members.length || (members.length >= 3 && free >= members.length - 1)) {
          if (run && run.e === s && run.free === free) run.e = e; else { if (run && run.e - run.s >= 3600e3) result.push({ start: new Date(run.s).toISOString(), end: new Date(run.e).toISOString(), free: run.free, total: members.length }); run = { s, e, free }; }
        } else { if (run && run.e - run.s >= 3600e3) result.push({ start: new Date(run.s).toISOString(), end: new Date(run.e).toISOString(), free: run.free, total: members.length }); run = null; }
      }
      if (run && run.e - run.s >= 3600e3) result.push({ start: new Date(run.s).toISOString(), end: new Date(run.e).toISOString(), free: run.free, total: members.length });
    }
    result.sort((a, b) => (b.free - a.free) || a.start.localeCompare(b.start));
    return { id, name: g.name, code: g.code, members: members.map(m => ({ name: name(m), you: m === user })), slots: result.slice(0, 12) };
  }
  /* ---------- grades ---------- */
  function reportGrade(user: string, body: unknown) {
    const v = z.object({ course: courseCode, term: z.string().regex(/^20\d{2}-\d{2} (Fall|Spring|Summer|Winter)$/), grade: z.enum(GRADES) }).strict().parse(body);
    db.prepare('INSERT INTO grade_reports(user_id,course,term,grade,created_at) VALUES (?,?,?,?,?) ON CONFLICT(user_id,course,term) DO UPDATE SET grade=excluded.grade,created_at=excluded.created_at').run(user, v.course, v.term, v.grade, now());
    return { course: v.course, term: v.term, saved: true };
  }
  function courses(q: string) {
    const rows = db.prepare("SELECT course,COUNT(*) AS n,SUM(CASE WHEN grade IN ('A+','A','A-') THEN 1 ELSE 0 END) AS a FROM grade_reports WHERE course LIKE ? GROUP BY course ORDER BY n DESC LIMIT 50").all(`%${q.trim().toUpperCase()}%`) as { course: string; n: number; a: number }[];
    return rows.map(r => ({ course: r.course, sample: Number(r.n), enough: Number(r.n) >= MIN_SAMPLE, a_share: Number(r.n) >= MIN_SAMPLE ? Math.round(Number(r.a) / Number(r.n) * 1000) / 10 : null }));
  }
  function distribution(course: string) {
    const c = courseCode.parse(course);
    const rows = db.prepare('SELECT grade,COUNT(*) AS n FROM grade_reports WHERE course=? GROUP BY grade').all(c) as { grade: string; n: number }[];
    const total = rows.reduce((s, r) => s + Number(r.n), 0);
    if (total < MIN_SAMPLE) return { course: c, sample: total, enough: false, bars: null };
    return { course: c, sample: total, enough: true, bars: GRADES.map(g => ({ grade: g, share: Math.round(Number(rows.find(r => r.grade === g)?.n ?? 0) / total * 1000) / 10 })) };
  }
  /* ---------- clubs ---------- */
  function clubs(user: string | null, category?: string) {
    return (db.prepare('SELECT c.*,(SELECT COUNT(*) FROM club_follows f WHERE f.club_id=c.id) AS followers,(SELECT 1 FROM club_follows f WHERE f.club_id=c.id AND f.user_id=?) AS mine FROM clubs c WHERE (? IS NULL OR c.category=?) ORDER BY followers DESC,c.name').all(user ?? '', category ?? null, category ?? null) as Record<string, unknown>[])
      .map(c => ({ id: String(c.id), name: String(c.name), category: String(c.category), tags: String(c.tags), url: c.url ? String(c.url) : null, followers: Number(c.followers), following: c.mine === 1 }));
  }
  function follow(user: string, id: string, on: boolean) {
    if (!db.prepare('SELECT 1 FROM clubs WHERE id=?').get(id)) throw new ApiError(404, 'CLUB_NOT_FOUND', 'Club not found.');
    if (on) db.prepare('INSERT OR IGNORE INTO club_follows(club_id,user_id,created_at) VALUES (?,?,?)').run(id, user, now());
    else db.prepare('DELETE FROM club_follows WHERE club_id=? AND user_id=?').run(id, user);
    return clubs(user).find(c => c.id === id)!;
  }
  /* ---------- employers ---------- */
  function employer(user: string | null, id: string) {
    const e = db.prepare('SELECT * FROM employers WHERE id=?').get(id) as Record<string, unknown> | undefined;
    if (!e) throw new ApiError(404, 'EMPLOYER_NOT_FOUND', 'Employer not found.');
    const jobs = db.prepare('SELECT id,title,detail,apply_url FROM employer_jobs WHERE employer_id=? ORDER BY sort').all(id) as { id: string; title: string; detail: string; apply_url: string }[];
    const talks = (db.prepare('SELECT t.*,(SELECT COUNT(*) FROM talk_rsvps r WHERE r.talk_id=t.id) AS going,(SELECT 1 FROM talk_rsvps r WHERE r.talk_id=t.id AND r.user_id=?) AS mine FROM employer_talks t WHERE employer_id=? ORDER BY starts_at').all(user ?? '', id) as Record<string, unknown>[])
      .map(t => ({ id: String(t.id), title: String(t.title), venue: String(t.venue), starts_at: new Date(Number(t.starts_at)).toISOString(), going: Number(t.going), rsvp: t.mine === 1 }));
    return { id, name: String(e.name), tagline: String(e.tagline), verified: e.verified === 1, sample: e.is_sample === 1, quote: e.quote ? String(e.quote) : null, quote_by: e.quote_by ? String(e.quote_by) : null, jobs, talks };
  }
  function employers() { return (db.prepare('SELECT id,name,tagline,is_sample FROM employers ORDER BY created_at DESC').all() as Record<string, unknown>[]).map(e => ({ id: String(e.id), name: String(e.name), tagline: String(e.tagline), sample: e.is_sample === 1 })); }
  function rsvp(user: string, talk: string, on: boolean) {
    const t = db.prepare('SELECT employer_id FROM employer_talks WHERE id=?').get(talk) as { employer_id: string } | undefined;
    if (!t) throw new ApiError(404, 'TALK_NOT_FOUND', 'Session not found.');
    if (on) db.prepare('INSERT OR IGNORE INTO talk_rsvps(talk_id,user_id,created_at) VALUES (?,?,?)').run(talk, user, now());
    else db.prepare('DELETE FROM talk_rsvps WHERE talk_id=? AND user_id=?').run(talk, user);
    return employer(user, t.employer_id).talks.find(x => x.id === talk)!;
  }
  return { groups, createGroup, joinGroup, leaveGroup, slots, reportGrade, courses, distribution, clubs, follow, employers, employer, rsvp };
}

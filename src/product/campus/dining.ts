// Campus restaurants from the CSO page (dining-data.ts) with "open now" computed from the published weekly hours
// and Hong Kong public holidays (1823). When the published lines are ambiguous or malformed (overlapping rules,
// closing before opening without a midnight crossing), status is "unknown" and the official text is shown instead.
import { diningData } from './dining-data.js';
import { shuttleData } from './shuttle-data.js';

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
type Rule = { days: Set<number>; ph: boolean; closed: boolean; open?: number; close?: number; text: string };
const minutes = (h: string, m: string) => Number(h) * 60 + Number(m);

/** "Monday - Friday 07:30 - 19:00", "Saturday , Sunday & PH: 08:00 - 19:00", "Sunday & PH - Closed". */
export function parseLine(line: string): Rule | null {
  const lower = line.toLowerCase().replace(/12:00 noon/, '12:00');
  const time = /(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/.exec(lower);
  const closed = /closed/.test(lower) && !time;
  if (!time && !closed) return null;
  const head = lower.slice(0, time ? time.index : lower.indexOf('closed'));
  const days = new Set<number>();
  for (const m of head.matchAll(/(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\s*-\s*(sunday|monday|tuesday|wednesday|thursday|friday|saturday)/g)) {
    const a = DAYS.indexOf(m[1]), b = DAYS.indexOf(m[2]);
    // "Sunday - Saturday" is the whole week.
    for (let i = a, n = 0; n < 7; i = (i + 1) % 7, n++) { days.add(i); if (i === b) break; }
  }
  for (const m of head.replace(/(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\s*-\s*(sunday|monday|tuesday|wednesday|thursday|friday|saturday)/g, '').matchAll(/sunday|monday|tuesday|wednesday|thursday|friday|saturday/g)) days.add(DAYS.indexOf(m[0]));
  const ph = /\bph\b/.test(head);
  if (!days.size && !ph) return null;
  return { days, ph, closed, ...(time ? { open: minutes(time[1], time[2]), close: minutes(time[3], time[4]) } : {}), text: line };
}

export type OutletStatus = { state: 'open' | 'closed' | 'unknown'; today: string | null; closes_at: string | null; opens_at: string | null };
const hhmm = (m: number) => m === 1440 ? '24:00' : `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
export function outletStatus(lines: readonly string[], now: number): OutletStatus {
  const hk = new Date(now + 8 * 3600e3), date = hk.toISOString().slice(0, 10), wd = hk.getUTCDay(), mins = hk.getUTCHours() * 60 + hk.getUTCMinutes();
  const yesterday = new Date(now + 8 * 3600e3 - 864e5).toISOString().slice(0, 10);
  const isPH = (d: string) => shuttleData.holidays.some(h => h.date === d);
  const rules = lines.map(parseLine);
  const pick = (d: string, w: number) => { const ph = isPH(d); const hits = rules.filter((r): r is Rule => !!r && (ph ? r.ph || (!rules.some(x => x?.ph) && r.days.has(w)) : r.days.has(w))); return hits; };
  const today = pick(date, wd);
  const prev = pick(yesterday, (wd + 6) % 7);
  // A previous-day rule that runs past midnight (e.g. 17:00 - 00:30) can still be open now.
  for (const r of prev) if (prev.length === 1 && r.open !== undefined && r.close !== undefined && r.close < r.open && r.close <= 6 * 60 && mins < r.close) return { state: 'open', today: today[0]?.text ?? null, closes_at: hhmm(r.close), opens_at: null };
  if (today.length !== 1) return { state: 'unknown', today: today.map(r => r.text).join(' / ') || null, closes_at: null, opens_at: null };
  const r = today[0];
  if (r.closed) return { state: 'closed', today: r.text, closes_at: null, opens_at: null };
  const open = r.open!, close = r.close! <= 6 * 60 && r.close! < open ? r.close! + 24 * 60 : r.close!;
  if (close <= open) return { state: 'unknown', today: r.text, closes_at: null, opens_at: null };
  if (mins >= open && mins < close) return { state: 'open', today: r.text, closes_at: hhmm(close), opens_at: null };
  return { state: 'closed', today: r.text, closes_at: null, opens_at: mins < open ? hhmm(open) : null };
}
export function dining(now = Date.now()) {
  const outlets = diningData.outlets.map(o => ({ ...o, status: outletStatus(o.hours, now) }));
  const rank = { open: 0, closed: 1, unknown: 2 } as const;
  outlets.sort((a, b) => rank[a.status.state] - rank[b.status.state] || a.name.localeCompare(b.name));
  return { outlets, open_count: outlets.filter(o => o.status.state === 'open').length, source: diningData.source, generated_at: new Date(now).toISOString() };
}

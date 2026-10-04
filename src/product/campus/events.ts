// Official HKUST University Events from calendar.hkust.edu.hk/events/rss (cached 15 minutes).
// Each item's description carries "When / Time / Where / Organizer" lines; we parse those and drop exact duplicates.
const RSS = 'https://calendar.hkust.edu.hk/events/rss';
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
export type CampusEvent = { id: string; title: string; url: string; start_date: string; end_date: string; time: string | null; start_time: string | null; venue: string | null; organizer: string | null; on_campus: boolean };
const decode = (s: string) => s.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#0?39;|&rsquo;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
/** "5  October  2026" → "2026-10-05". */
const date = (s: string) => { const m = /(\d{1,2})\s+([a-z]+)\s+(\d{4})/i.exec(s); if (!m) return null; const mo = MONTHS.indexOf(m[2].toLowerCase()); return mo < 0 ? null : `${m[3]}-${String(mo + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}`; };
/** "04:30pm - 06:30pm" → { text: "16:30–18:30", start: "16:30" }; all-day placeholders (12:00am - 12:00am) → null. */
export function eventTime(raw: string | undefined) {
  if (!raw) return null;
  const t = (h: string, m: string, ap: string) => { let n = Number(h) % 12; if (ap.toLowerCase() === 'pm') n += 12; return `${String(n).padStart(2, '0')}:${m}`; };
  const m = /(\d{1,2}):(\d{2})\s*(am|pm)\s*-\s*(\d{1,2}):(\d{2})\s*(am|pm)/i.exec(raw);
  if (!m) return null;
  const a = t(m[1], m[2], m[3]), b = t(m[4], m[5], m[6]);
  if (a === '00:00' && (b === '00:00' || b === '23:59')) return null;
  return { text: `${a}–${b}`, start: a === '00:00' ? null : a };
}
const ON_CAMPUS = /HKUST|Academic Building|Shaw Auditorium|Lecture Theat|\bLT-?[A-Z]\b|Lift|Room\s*\d|Rm\s*\d|Library|Atrium|Piazza|Lee Shau Kee|LSK|Tsang Shiu Tim|Language Commons|The Base|Jockey Club|Counseling|Dean of Students|IAS\d|Clear Water Bay/i;
export function parseRss(xml: string): CampusEvent[] {
  const seen = new Set<string>(), out: CampusEvent[] = [];
  for (const item of xml.match(/<item>[\s\S]*?<\/item>/g) ?? []) {
    const pick = (tag: string) => (new RegExp(`<${tag}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]>`).exec(item) ?? [])[1] ?? '';
    const title = decode(pick('title')), url = pick('link').trim(), desc = pick('description');
    const fields: Record<string, string> = {};
    for (const part of desc.split(/<br\s*\/?>/i)) { const m = /^\s*(When|Time|Where|Organizer)\s*:\s*([\s\S]*)$/i.exec(decode(part)); if (m) fields[m[1].toLowerCase()] = m[2].trim(); }
    const [a, b] = (fields.when ?? '').split(/\s+-\s+/);
    const start = a ? date(a) : null, end = b ? date(b) : start;
    if (!title || !url || !start || !end) continue;
    const time = eventTime(fields.time), venue = fields.where || null;
    const key = `${title.toLowerCase()}|${start}|${end}|${time?.text ?? ''}`;
    if (seen.has(key)) continue; seen.add(key);
    out.push({ id: url.replace(/^.*\/events\//, ''), title, url, start_date: start, end_date: end, time: time?.text ?? null, start_time: time?.start ?? null, venue, organizer: fields.organizer || null, on_campus: !!venue && ON_CAMPUS.test(venue) });
  }
  return out;
}
export function createEvents(fetcher: typeof fetch = fetch, now: () => number = Date.now) {
  let cache: { at: number; items: CampusEvent[] } | null = null;
  async function list(days = 14) {
    if (!cache || now() - cache.at > 15 * 60_000) {
      const r = await fetcher(RSS, { signal: AbortSignal.timeout(10_000), headers: { accept: 'application/rss+xml, text/xml' } });
      if (!r.ok) throw new Error('HKUST events ' + r.status);
      cache = { at: now(), items: parseRss(await r.text()) };
    }
    const today = new Date(now() + 8 * 3600e3).toISOString().slice(0, 10), until = new Date(now() + 8 * 3600e3 + days * 864e5).toISOString().slice(0, 10);
    // Single-day and short events in the window; long-running programmes (> 14 days) are listed separately.
    const span = (e: CampusEvent) => (Date.parse(e.end_date) - Date.parse(e.start_date)) / 864e5;
    const inWindow = cache.items.filter(e => e.end_date >= today && e.start_date <= until);
    const upcoming = inWindow.filter(e => span(e) <= 14).sort((x, y) => (x.start_date < today ? today : x.start_date).localeCompare(y.start_date < today ? today : y.start_date) || (x.start_time ?? '99').localeCompare(y.start_time ?? '99'));
    const ongoing = inWindow.filter(e => span(e) > 14);
    return { today, upcoming, ongoing, source: { name: 'HKUST University Events', url: 'https://calendar.hkust.edu.hk/' }, generated_at: new Date(now()).toISOString() };
  }
  return { list };
}

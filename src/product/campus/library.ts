// Live HKUST Library status from the same three endpoints the library homepage (library.hkust.edu.hk) calls:
// today's opening hours, people in the library (today vs the same time last week) and study-room bookings.
// Field meanings were checked against the homepage's own script: `available` is the bookable total and the page
// shows "Booked {booked} / {available}"; `past_count` is labelled "Last Week", `current_count` "Today".
import { z } from 'zod';

const HOURS = 'https://lbcone.hkust.edu.hk/hours/hoursapi/gethours?func=today-hours';
const PEOPLE = 'https://lbapps.hkust.edu.hk/peoplecount/';
const ROOMS = 'https://library.hkust.edu.hk/libraryapi/study-room-count';
const hoursSchema = z.object({ status: z.string(), data: z.object({ hour: z.array(z.object({ location_code: z.string(), location_text: z.string(), item: z.array(z.object({ dates: z.string(), openingHours: z.string() }).passthrough()) })) }) });
const peopleSchema = z.array(z.object({ datetime: z.string(), past_count: z.string(), current_count: z.string() }));
const roomsSchema = z.object({ status: z.string(), data: z.object({ areas: z.array(z.object({ id: z.string(), area_name: z.string(), open_time: z.string(), close_time: z.string(), total: z.number(), booked: z.string(), available: z.string(), calendar_link: z.string() })) }) });

const NAMES: Record<string, { zh: string; en: string }> = { main: { zh: '图书馆（G 楼入口）', en: 'Library (G/F entrance)' }, lc: { zh: 'Learning Commons', en: 'Learning Commons' } };
export type LibraryStatus = {
  hours: { code: string; name: { zh: string; en: string }; text: string; open: string | null; close: string | null; all_day: boolean; open_now: boolean | null }[];
  people: { now: number; at: string; last_week: number | null } | null;
  rooms: { booked: number; total: number; link: string } | null;
  pods: { booked: number; total: number; link: string } | null;
  source: { name: string; url: string }; generated_at: string;
};
/** "8:00am - 11:00pm" → ["08:00","23:00"]; "24 Hours" → all day; anything else stays as text only. */
export function parseHours(text: string) {
  if (/24\s*hours/i.test(text)) return { open: '00:00', close: '24:00', all_day: true };
  const m = /(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s*-\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i.exec(text);
  if (!m) return { open: null, close: null, all_day: false };
  const t = (h: string, mi: string | undefined, ap: string) => { let n = Number(h) % 12; if (ap.toLowerCase() === 'pm') n += 12; return `${String(n).padStart(2, '0')}:${mi ?? '00'}`; };
  return { open: t(m[1], m[2], m[3]), close: t(m[4], m[5], m[6]), all_day: false };
}
export function createLibrary(fetcher: typeof fetch = fetch, now: () => number = Date.now) {
  let cache: { at: number; value: LibraryStatus } | null = null;
  const json = async (url: string) => { const r = await fetcher(url, { signal: AbortSignal.timeout(8000), headers: { accept: 'application/json' } }); if (!r.ok) throw new Error('library ' + r.status); return JSON.parse(await r.text()); };
  async function status(): Promise<LibraryStatus> {
    if (cache && now() - cache.at < 120_000) return cache.value;
    const hk = new Date(now() + 8 * 3600e3).toISOString().slice(11, 16);
    const [h, p, r] = await Promise.allSettled([json(HOURS).then(x => hoursSchema.parse(x)), json(PEOPLE).then(x => peopleSchema.parse(x)), json(ROOMS).then(x => roomsSchema.parse(x))]);
    const hours = h.status === 'fulfilled' ? h.value.data.hour.map(loc => {
      const text = loc.item[0]?.openingHours ?? ''; const parsed = parseHours(text);
      const open_now = parsed.all_day ? true : parsed.open && parsed.close ? hk >= parsed.open && hk < parsed.close : /closed/i.test(text) ? false : null;
      return { code: loc.location_code, name: NAMES[loc.location_code] ?? { zh: loc.location_text, en: loc.location_text }, text, ...parsed, open_now };
    }) : [];
    let people: LibraryStatus['people'] = null;
    if (p.status === 'fulfilled') {
      const latest = [...p.value].reverse().find(x => /^\d+$/.test(x.current_count));
      if (latest) people = { now: Number(latest.current_count), at: latest.datetime.slice(0, 5), last_week: /^\d+$/.test(latest.past_count) ? Number(latest.past_count) : null };
    }
    const sum = (ids: string[]) => { if (r.status !== 'fulfilled') return null; const a = r.value.data.areas.filter(x => ids.includes(x.id)); if (!a.length) return null; return { booked: a.reduce((s, x) => s + Number(x.booked), 0), total: a.reduce((s, x) => s + Number(x.available), 0), link: a[0].calendar_link }; };
    const value: LibraryStatus = { hours, people, rooms: sum(['3', '8']), pods: sum(['20']), source: { name: '科大图书馆 HKUST Library', url: 'https://library.hkust.edu.hk/' }, generated_at: new Date(now()).toISOString() };
    if (hours.length || people || value.rooms) cache = { at: now(), value };
    return value;
  }
  return { status };
}

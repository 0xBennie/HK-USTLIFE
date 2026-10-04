// Live MTR departures at Hang Hau (TKO line) from the MTR Next Train open data API, cached 15 seconds.
// Hang Hau is where the 11M minibus from HKUST North ends, so it is the MTR stop students actually use.
import { z } from 'zod';
import type { TransitName } from './public-transit-types.js';

const URL_ = 'https://rt.data.gov.hk/v1/transport/mtr/getSchedule.php?line=TKL&sta=HAH&lang=TC';
const STATIONS: Record<string, TransitName> = {
  POA: { zh: '宝琳', en: 'Po Lam' }, LHP: { zh: '康城', en: 'LOHAS Park' }, TKO: { zh: '将军澳', en: 'Tseung Kwan O' },
  HAH: { zh: '坑口', en: 'Hang Hau' }, TIK: { zh: '调景岭', en: 'Tiu Keng Leng' }, YAT: { zh: '油塘', en: 'Yau Tong' },
  QUB: { zh: '鲗鱼涌', en: 'Quarry Bay' }, NOP: { zh: '北角', en: 'North Point' },
};
const train = z.object({ dest: z.string(), plat: z.string(), time: z.string(), ttnt: z.string().optional(), valid: z.string().optional() }).passthrough();
const schedule = z.object({ status: z.number().optional(), isdelay: z.string().optional(), message: z.string().optional(), data: z.record(z.string(), z.object({ UP: z.array(train).optional(), DOWN: z.array(train).optional() }).passthrough()).optional() }).passthrough();

export type MtrDirection = { destination: TransitName; platform: string; arrivals: string[] };
export type MtrDepartures = { station: TransitName; line: TransitName; status: 'available' | 'no_predictions' | 'unavailable'; delayed: boolean; directions: MtrDirection[]; source: { name: string; url: string }; generated_at: string };

/** "2026-10-04 22:34:49" in Hong Kong time → ISO instant. */
const hk = (s: string) => new Date(s.replace(' ', 'T') + '+08:00').toISOString();

export function createMtr(fetcher: typeof fetch = fetch, now: () => number = Date.now) {
  let cache: { at: number; value: MtrDepartures } | null = null;
  const base = (status: MtrDepartures['status'], directions: MtrDirection[] = [], delayed = false): MtrDepartures => ({
    station: { zh: '坑口站', en: 'Hang Hau' }, line: { zh: '将军澳线', en: 'Tseung Kwan O line' }, status, delayed, directions,
    source: { name: '港铁 Next Train 开放数据', url: 'https://data.gov.hk/' }, generated_at: new Date(now()).toISOString(),
  });
  async function hangHau(): Promise<MtrDepartures> {
    if (cache && now() - cache.at < 15_000) return cache.value;
    try {
      const res = await fetcher(URL_, { signal: AbortSignal.timeout(8000), headers: { accept: 'application/json' } });
      if (!res.ok) throw new Error('MTR ' + res.status);
      const body = schedule.parse(await res.json());
      const station = body.data?.['TKL-HAH'];
      const groups = [...(station?.UP ?? []), ...(station?.DOWN ?? [])].filter(t => t.valid !== 'N' && STATIONS[t.dest]);
      const byDest = new Map<string, MtrDirection>();
      for (const t of groups) {
        const at = hk(t.time);
        if (Date.parse(at) < now() - 60_000) continue;
        const key = t.dest;
        const d = byDest.get(key) ?? { destination: STATIONS[t.dest], platform: t.plat, arrivals: [] };
        d.arrivals.push(at); byDest.set(key, d);
      }
      const directions = [...byDest.values()].map(d => ({ ...d, arrivals: d.arrivals.sort().slice(0, 3) })).sort((a, b) => a.platform.localeCompare(b.platform) || a.arrivals[0].localeCompare(b.arrivals[0]));
      const value = base(directions.length ? 'available' : 'no_predictions', directions, body.isdelay === 'Y');
      cache = { at: now(), value };
      return value;
    } catch { return base('unavailable'); }
  }
  return { hangHau };
}

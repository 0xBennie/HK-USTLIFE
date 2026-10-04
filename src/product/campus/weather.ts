// Live weather and warnings from the Hong Kong Observatory open data API (data.weather.gov.hk), cached 5 minutes.
// Signal 8+ or a black rainstorm warning means HKUST normally suspends classes; the app labels this "以校方公告为准".
import { z } from 'zod';

const BASE = 'https://data.weather.gov.hk/weatherAPI/opendata/weather.php';
const ICON: Record<number, [string, string]> = {
  50: ['晴', 'Sunny'], 51: ['间有阳光', 'Sunny periods'], 52: ['短暂阳光', 'Sunny intervals'], 53: ['间有阳光，有骤雨', 'Sunny periods, showers'],
  54: ['短暂阳光，有骤雨', 'Sunny intervals, showers'], 60: ['多云', 'Cloudy'], 61: ['密云', 'Overcast'], 62: ['微雨', 'Light rain'], 63: ['雨', 'Rain'],
  64: ['大雨', 'Heavy rain'], 65: ['雷暴', 'Thunderstorms'], 70: ['天色良好', 'Fine'], 71: ['天色良好', 'Fine'], 72: ['天色良好', 'Fine'], 73: ['天色良好', 'Fine'],
  74: ['天色良好', 'Fine'], 75: ['天色良好', 'Fine'], 76: ['大致多云', 'Mainly cloudy'], 77: ['大致天晴', 'Mainly fine'], 80: ['大风', 'Windy'], 81: ['干燥', 'Dry'],
  82: ['潮湿', 'Humid'], 83: ['雾', 'Fog'], 84: ['薄雾', 'Mist'], 85: ['烟霞', 'Haze'], 90: ['热', 'Hot'], 91: ['暖', 'Warm'], 92: ['凉', 'Cool'], 93: ['冷', 'Cold'],
};
const WARN: Record<string, [string, string, 'info' | 'warning' | 'severe']> = {
  TC1: ['一号戒备信号', 'Standby Signal No. 1', 'info'], TC3: ['三号强风信号', 'Strong Wind Signal No. 3', 'warning'],
  TC8NE: ['八号东北烈风或暴风信号', 'No. 8 NE Gale', 'severe'], TC8SE: ['八号东南烈风或暴风信号', 'No. 8 SE Gale', 'severe'],
  TC8NW: ['八号西北烈风或暴风信号', 'No. 8 NW Gale', 'severe'], TC8SW: ['八号西南烈风或暴风信号', 'No. 8 SW Gale', 'severe'],
  TC9: ['九号烈风或暴风风力增强信号', 'No. 9 Increasing Gale', 'severe'], TC10: ['十号飓风信号', 'Hurricane Signal No. 10', 'severe'],
  WRAINA: ['黄色暴雨警告', 'Amber Rainstorm', 'warning'], WRAINR: ['红色暴雨警告', 'Red Rainstorm', 'warning'], WRAINB: ['黑色暴雨警告', 'Black Rainstorm', 'severe'],
  WTS: ['雷暴警告', 'Thunderstorm Warning', 'info'], WHOT: ['酷热天气警告', 'Very Hot Weather', 'info'], WCOLD: ['寒冷天气警告', 'Cold Weather', 'info'],
  WFIRE: ['火灾危险警告', 'Fire Danger', 'info'], WL: ['山泥倾泻警告', 'Landslip Warning', 'warning'], WMSGNL: ['强烈季候风信号', 'Strong Monsoon', 'info'],
  WTMW: ['海啸警告', 'Tsunami Warning', 'severe'], WFNTSA: ['新界北部水浸特别报告', 'Flooding in Northern NT', 'info'], WFROST: ['霜冻警告', 'Frost Warning', 'info'],
};
const current = z.object({
  icon: z.array(z.number()).default([]), updateTime: z.string(),
  temperature: z.object({ data: z.array(z.object({ place: z.string(), value: z.number() })) }),
  humidity: z.object({ data: z.array(z.object({ value: z.number() })) }).optional(),
}).passthrough();
const summary = z.record(z.string(), z.object({ code: z.string().optional(), issueTime: z.string().optional() }).passthrough());

// HKO returns place names in Traditional Chinese (lang=tc); the app shows them in the reader's language.
const PLACE: Record<string, { zh: string; en: string }> = { '西貢': { zh: '西贡', en: 'Sai Kung' }, '將軍澳': { zh: '将军澳', en: 'Tseung Kwan O' }, '京士柏': { zh: '京士柏', en: "King's Park" }, '香港天文台': { zh: '香港天文台', en: 'HK Observatory' } };
export type CampusWeather = {
  station: string; place: { zh: string; en: string }; temperature: number | null; humidity: number | null; condition: { zh: string; en: string } | null; updated_at: string;
  warnings: { code: string; zh: string; en: string; level: 'info' | 'warning' | 'severe'; issued_at: string | null }[];
  classes_may_be_suspended: boolean; source: { name: string; url: string };
};
export function createWeather(fetcher: typeof fetch = fetch, now: () => number = Date.now) {
  let cache: { at: number; value: CampusWeather } | null = null;
  async function get(): Promise<CampusWeather> {
    if (cache && now() - cache.at < 300_000) return cache.value;
    const [cur, warn] = await Promise.all([
      fetcher(`${BASE}?dataType=rhrread&lang=tc`, { signal: AbortSignal.timeout(8000) }).then(r => { if (!r.ok) throw new Error('HKO ' + r.status); return r.json(); }),
      fetcher(`${BASE}?dataType=warnsum&lang=tc`, { signal: AbortSignal.timeout(8000) }).then(r => { if (!r.ok) throw new Error('HKO ' + r.status); return r.json(); }),
    ]);
    const c = current.parse(cur), w = summary.parse(warn);
    const station = c.temperature.data.find(t => t.place === '西貢') ?? c.temperature.data.find(t => t.place === '將軍澳') ?? c.temperature.data[0];
    const icon = c.icon[0];
    const warnings = Object.values(w).map(x => { const code = String(x.code ?? ''); const meta = WARN[code]; return meta ? { code, zh: meta[0], en: meta[1], level: meta[2], issued_at: x.issueTime ?? null } : null; }).filter(x => x !== null);
    const value: CampusWeather = {
      station: station?.place ?? '香港', place: PLACE[station?.place ?? ''] ?? { zh: station?.place ?? '香港', en: 'Hong Kong' }, temperature: station?.value ?? null, humidity: c.humidity?.data[0]?.value ?? null,
      condition: icon && ICON[icon] ? { zh: ICON[icon][0], en: ICON[icon][1] } : null, updated_at: new Date(c.updateTime).toISOString(),
      warnings, classes_may_be_suspended: warnings.some(x => /^TC(8|9|10)/.test(x.code) || x.code === 'WRAINB'),
      source: { name: '香港天文台 Hong Kong Observatory', url: 'https://www.hko.gov.hk/' },
    };
    cache = { at: now(), value };
    return value;
  }
  return { get };
}

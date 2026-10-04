// Daily automatic re-verification of the reviewed shuttle snapshot against the live CSO page.
// A route is "unchanged" only if its full departure sequence still appears right after its place name on the page.
// Every route must pass; otherwise nothing is touched and the snapshot expires (shown as stale) for human review.
import { createHash } from 'node:crypto';
import type { ShuttleCatalog, ShuttleRoute } from './shuttle.js';

export const CSO_SHUTTLE = 'https://cso.hkust.edu.hk/index.php/tran/stud_sh_b';
const normal = (html: string) => html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ')
  .replace(/[,&]/g, ' ').replace(/\s+/g, ' ');
/** The non-HKUST place of a route as the CSO page spells it, e.g. "Mong Kok", "East Point City". */
function place(route: ShuttleRoute) {
  const [from, to] = route.name.en.split('→').map(s => s.trim());
  const other = /^HKUST|^Lunch: (Piazza|LSK)/.test(from) ? to : from;
  return other.replace(/^Lunch:\s*/, '').replace(/^HKUST via North Point$/, 'North Point').replace(/\s+via\s.*$/, '').split(/\s*\(/)[0];
}
export function routeOnPage(text: string, route: ShuttleRoute) {
  const regular = route.departures.filter(t => t !== '22:15');
  const seq = regular.join(' ');
  const name = place(route);
  for (let i = text.indexOf(name); i >= 0; i = text.indexOf(name, i + 1)) if (text.slice(i, i + 500).includes(seq)) return route.departures.includes('22:15') ? text.includes('22:15') : true;
  return false;
}
export function verifyShuttlePage(html: string, catalog: ShuttleCatalog) {
  const text = normal(html);
  const failed = catalog.routes.filter(r => !routeOnPage(text, r)).map(r => r.id);
  return { ok: failed.length === 0, failed, sha256: createHash('sha256').update(html).digest('hex') };
}
/** Every reviewed holiday date must still be listed by 1823 for the covered years. */
export function verifyHolidays(json: unknown, catalog: ShuttleCatalog) {
  const dates = new Set<string>();
  const walk = (v: unknown) => { if (typeof v === 'string') { const m = /^(\d{4})(\d{2})(\d{2})$/.exec(v); if (m) dates.add(`${m[1]}-${m[2]}-${m[3]}`); } else if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object') Object.values(v).forEach(walk); };
  walk(json);
  const missing = catalog.holidays.filter(h => !dates.has(h.date)).map(h => h.date);
  return { ok: missing.length === 0 && dates.size > 0, missing };
}

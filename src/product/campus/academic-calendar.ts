// HKUST Academic Registry, "Calendar Dates in the 2026-27 Academic Year" (confirmed PDF, CWB - July 2026).
// Transcribed by hand from the official PDF; the sha256 pins the exact file. Week numbers follow the PDF:
// week 1 is the first (partial) Sunday–Saturday row of each term.
export const academicCalendarSource = {
  name: { zh: '科大教务处 2026-27 校历', en: 'HKUST Academic Registry calendar 2026-27' },
  url: 'https://registry.hkust.edu.hk/calendar_dates/dates26-27confirmed.pdf',
  page: 'https://registry.hkust.edu.hk/resource-library/calendar-dates-2026-27',
  sha256: 'a8822ce3d4b75d4f288b0331f7d221c7bca252bee768d9305e8683214b58484e',
  retrieved_at: '2026-10-04T15:33:00.000Z',
};
type Name = { zh: string; en: string };
export type Term = { id: string; name: Name; start: string; classes_end: string; end: string; weeks: number; repeat_rows?: string[] };
export type KeyDate = { start: string; end?: string; kind: 'term' | 'enrolment' | 'add_drop' | 'break' | 'exam' | 'holiday' | 'deadline'; name: Name };
export const terms: Term[] = [
  { id: '2026-27-fall', name: { zh: '2026–27 秋季学期', en: '2026–27 Fall' }, start: '2026-09-01', classes_end: '2026-11-30', end: '2026-12-19', weeks: 13 },
  { id: '2026-27-winter', name: { zh: '2026–27 冬季学期', en: '2026–27 Winter' }, start: '2027-01-02', classes_end: '2027-01-29', end: '2027-01-29', weeks: 4 },
  { id: '2026-27-spring', name: { zh: '2026–27 春季学期', en: '2026–27 Spring' }, start: '2027-02-01', classes_end: '2027-05-08', end: '2027-05-28', weeks: 13, repeat_rows: ['2027-03-28'] },
  { id: '2026-27-summer', name: { zh: '2026–27 夏季学期', en: '2026–27 Summer' }, start: '2027-06-14', classes_end: '2027-08-07', end: '2027-08-07', weeks: 8 },
];
const d = (start: string, kind: KeyDate['kind'], zh: string, en: string, end?: string): KeyDate => ({ start, ...(end ? { end } : {}), kind, name: { zh, en } });
export const keyDates: KeyDate[] = [
  d('2026-09-01', 'term', '秋季学期开课', 'Fall Term commences'),
  d('2026-09-01', 'add_drop', '加退选期', 'Add/Drop Period', '2026-09-14'),
  d('2026-09-26', 'holiday', '中秋节翌日', 'The day following Mid-Autumn Festival'),
  d('2026-10-01', 'holiday', '国庆日', 'National Day'),
  d('2026-10-19', 'holiday', '重阳节翌日', 'The day following Chung Yeung Festival'),
  d('2026-11-30', 'term', '秋季学期最后一天上课', 'Last day of Fall Term classes'),
  d('2026-12-01', 'break', '温习周', 'Study Break', '2026-12-05'),
  d('2026-12-07', 'exam', '秋季学期考试', 'Fall Term Examinations', '2026-12-19'),
  d('2026-12-25', 'holiday', '圣诞节', 'Christmas Day'),
  d('2026-12-26', 'holiday', '圣诞节后首个工作日', 'The first weekday after Christmas Day'),
  d('2027-01-01', 'holiday', '元旦', 'The first day of January'),
  d('2027-01-02', 'term', '冬季学期开课', 'Winter Term commences'),
  d('2027-01-26', 'enrolment', '春季选课开始（本科生）', 'Class enrollment starts – UG', '2027-01-27'),
  d('2027-02-01', 'term', '春季学期开课', 'Spring Term commences'),
  d('2027-02-01', 'add_drop', '加退选期', 'Add/Drop Period', '2027-02-17'),
  d('2027-02-06', 'holiday', '农历新年', "Lunar New Year's Day"),
  d('2027-02-08', 'holiday', '农历年初三', 'The third day of Lunar New Year'),
  d('2027-02-09', 'holiday', '农历年初四', 'The fourth day of Lunar New Year'),
  d('2027-03-25', 'break', '期中假期', 'Mid-Term Break', '2027-03-30'),
  d('2027-03-26', 'holiday', '耶稣受难节', 'Good Friday'),
  d('2027-03-27', 'holiday', '耶稣受难节翌日', 'The day following Good Friday'),
  d('2027-03-29', 'holiday', '复活节星期一', 'Easter Monday'),
  d('2027-04-05', 'holiday', '清明节', 'Ching Ming Festival'),
  d('2027-05-01', 'holiday', '劳动节', 'Labor Day'),
  d('2027-05-08', 'term', '春季学期最后一天上课', 'Last day of Spring Term classes'),
  d('2027-05-10', 'break', '温习周', 'Study Break', '2027-05-15'),
  d('2027-05-13', 'holiday', '佛诞', 'The Birthday of the Buddha'),
  d('2027-05-17', 'exam', '春季学期考试', 'Spring Term Examinations', '2027-05-28'),
  d('2027-06-09', 'holiday', '端午节', 'Tuen Ng Festival'),
  d('2027-06-14', 'term', '夏季学期开课', 'Summer Term commences'),
  d('2027-07-01', 'holiday', '香港特别行政区成立纪念日', 'HKSAR Establishment Day'),
];

const dayMs = 864e5;
const hkDate = (ms: number) => new Date(ms + 8 * 3600e3).toISOString().slice(0, 10);
const utc = (date: string) => Date.parse(date + 'T00:00:00Z');
/** Week number as printed in the Registry PDF: Sunday–Saturday rows, week 1 contains the first day of the term.
 *  Rows listed in repeat_rows (the Mid-Term Break) keep the previous number, exactly as the PDF prints them. */
export function termWeek(term: Term, date: string) {
  const start = utc(term.start), firstSunday = start - new Date(start).getUTCDay() * dayMs;
  const row = Math.floor((utc(date) - firstSunday) / (7 * dayMs)) + 1;
  return row - (term.repeat_rows ?? []).filter(r => utc(r) <= utc(date)).length;
}
export function academicStatus(now = Date.now()) {
  const today = hkDate(now);
  const current = terms.find(t => today >= t.start && today <= t.end) ?? null;
  const next = terms.find(t => t.start > today) ?? null;
  const week = current && today <= current.classes_end ? Math.min(current.weeks, termWeek(current, today)) : null;
  const phase = !current ? 'between_terms' : today > current.classes_end ? (keyDates.some(k => k.kind === 'exam' && today >= k.start && today <= (k.end ?? k.start)) ? 'exams' : 'study_break') : 'teaching';
  const holiday = keyDates.find(k => k.kind === 'holiday' && k.start === today) ?? null;
  const upcoming = keyDates.filter(k => (k.end ?? k.start) >= today).slice(0, 6).map(k => ({ ...k, days_until: Math.round((utc(k.start) - utc(today)) / dayMs) }));
  return { today, term: current, week, phase, holiday, next_term: next, upcoming, source: academicCalendarSource };
}

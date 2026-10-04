export function dateInZone(instant:string,timezone='Asia/Hong_Kong') {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(instant)).map(p=>[p.type,p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
export function shiftDate(date:string,days:number) { return new Date(Date.parse(`${date}T00:00:00Z`)+days*86400_000).toISOString().slice(0,10); }
export function hongKongInput(instant:string|null) {
  if(!instant) return '';
  return new Date(Date.parse(instant)+8*3600_000).toISOString().slice(0,16).replace('T',' ');
}
export function dateTimeInZone(instant:string,timezone:string) {
  const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(instant)).map(p=>[p.type,p.value]));
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
}
export function editedInstant(value:string,original:string|null) {
  return original && hongKongInput(original)===value?original:parseHongKongInput(value);
}
export function parseHongKongInput(value:string):string|null {
  if(!value.trim()) return null;
  if(!/^\d{4}-\d{2}-\d{2} [0-2]\d:[0-5]\d$/.test(value)) throw new Error('Invalid date/time');
  const date = new Date(`${value.replace(' ','T')}:00+08:00`);
  if(!Number.isFinite(date.getTime()) || hongKongInput(date.toISOString()) !== value) throw new Error('Invalid date/time');
  return date.toISOString();
}
// Retry identity, not an authentication credential. Keep it until the draft changes.
export const newWriteKey = () => `write-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;

/** Open tasks due from now through the next 7 days (date-only deadlines count as 23:59 HKT). Shared by 我的 and 学业 so both show the same number. */
export function dueWithinWeek(items:{kind:string;status?:string;due_at?:string|null;due_date?:string|null}[],now=Date.now()){
 const end=now+7*864e5;
 return items.filter(i=>{if(i.kind!=='task'||i.status!=='open')return false;const at=i.due_at?Date.parse(i.due_at):i.due_date?Date.parse(`${i.due_date}T23:59:00+08:00`):NaN;return at>=now&&at<=end;}).length;
}
/** "2026-10-03" → "10 月 3 日" / "3 Oct" (the year is left out; these are near dates). */
export function monthDayLabel(date:string,zh:boolean){return zh?`${Number(date.slice(5,7))} 月 ${Number(date.slice(8,10))} 日`:new Date(date.slice(0,10)+'T00:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'short',timeZone:'UTC'});}

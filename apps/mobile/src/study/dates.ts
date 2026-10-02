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

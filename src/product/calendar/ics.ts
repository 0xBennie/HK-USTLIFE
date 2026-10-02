import ICAL from 'ical.js';
import { createHash } from 'node:crypto';
import { calendarDate,calendarQuerySchema,timezone as timezoneSchema } from '../learning/schemas.js';

type Component=InstanceType<typeof ICAL.Component>;
type Time=InstanceType<typeof ICAL.Time>;
type Zone=InstanceType<typeof ICAL.Timezone>;
export type CalendarSeries={uid:string;identity:'uid'|'fingerprint';title:string;ical:string;floating_timezone:string|null;fingerprint:string};
export type ImportIssue={uid:string|null;code:string;message:string};
export type Occurrence={recurrence_id:string;title:string;body:string;location:string;timezone:string;all_day:boolean;starts_at:string|null;ends_at:string|null;start_date:string|null;end_date:string|null;status:'active';source_status:'confirmed'|'tentative'|'unspecified';participation:'unknown'};
class ImportError extends Error { constructor(public code:string,message:string){super(message);} }
const fail=(code:string,message:string):never=>{throw new ImportError(code,message);};
const hash=(text:string)=>createHash('sha256').update(text).digest('hex');
const stringValue=(c:Component,name:string)=>String(c.getFirstPropertyValue(name)??'');

function validDate(raw:unknown) {
  if(typeof raw!=='string'||!/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}Z?)?$/.test(raw)||!calendarDate.safeParse(raw.slice(0,10)).success) fail('INVALID_DATE','Invalid calendar date.');
  const value=raw as string;
  if(value.length>10 && (Number(value.slice(11,13))>23||Number(value.slice(14,16))>59||Number(value.slice(17,19))>59)) fail('INVALID_DATE','Invalid clock time.');
}
function validateZones(root:Component) {
  const zones=root.getAllSubcomponents('vtimezone'),ids=new Set<string>();
  if(zones.length>32)fail('UNSUPPORTED_TIMEZONE','Too many timezone definitions.');
  for(const zone of zones) {
    const id=stringValue(zone,'tzid');
    if(!id||ids.has(id))fail('UNSUPPORTED_TIMEZONE','Missing or duplicate timezone identity.');ids.add(id);
    const parts=zone.getAllSubcomponents();
    if(!parts.length||parts.length>16)fail('UNSUPPORTED_TIMEZONE','Unsupported timezone observance count.');
    for(const part of parts) {
      if(!['standard','daylight'].includes(part.name))fail('UNSUPPORTED_TIMEZONE','Unsupported timezone component.');
      const start=part.getFirstProperty('dtstart')?.toJSON()[3];validDate(start);
      if(Number(String(start).slice(0,4))<1600)fail('UNSUPPORTED_TIMEZONE','Timezone definition is too old.');
      for(const name of ['tzoffsetfrom','tzoffsetto']) {
        const offset=String(part.getFirstProperty(name)?.toJSON()[3]??'');
        if(!/^[+-]\d{2}:\d{2}(:\d{2})?$/.test(offset)||Number(offset.slice(1,3))>23||Number(offset.slice(4,6))>59)fail('UNSUPPORTED_TIMEZONE','Invalid timezone offset.');
      }
      for(const rule of part.getAllProperties('rrule')) {
        const data=rule.toJSON()[3] as Record<string,unknown>;
        if(data.freq!=='YEARLY'||Object.keys(data).some(k=>!['freq','bymonth','byday','bymonthday','until'].includes(k)))fail('UNSUPPORTED_TIMEZONE','Unsupported timezone recurrence rule.');
        for(const key of ['bymonth','byday','bymonthday']) {
          const values=Array.isArray(data[key])?data[key]:data[key]===undefined?[]:[data[key]];
          if(values.length>1)fail('UNSUPPORTED_TIMEZONE','Timezone rule is too complex.');
          if(key==='bymonth'&&values.some(v=>!Number.isInteger(v)||Number(v)<1||Number(v)>12))fail('UNSUPPORTED_TIMEZONE','Invalid timezone month.');
          if(key==='bymonthday'&&values.some(v=>!Number.isInteger(v)||Number(v)===0||Math.abs(Number(v))>31))fail('UNSUPPORTED_TIMEZONE','Invalid timezone month day.');
          if(key==='byday'&&values.some(v=>!/^(-?[1-5])?(MO|TU|WE|TH|FR|SA|SU)$/.test(String(v))))fail('UNSUPPORTED_TIMEZONE','Invalid timezone weekday.');
        }
        if(data.until)validDate(data.until);
      }
      if(part.getAllProperties('rrule').length>1||part.hasProperty('exrule'))fail('UNSUPPORTED_TIMEZONE','Unsupported timezone recurrence combination.');
    }
  }
}
function ianaZone(id:string):Zone {
  if(!timezoneSchema.safeParse(id).success) return fail('UNSUPPORTED_TIMEZONE',`Unknown timezone: ${id}`);
  const zone=new ICAL.Timezone({tzid:id});
  const formatter=new Intl.DateTimeFormat('en-CA',{timeZone:id,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
  const wall=(stamp:number)=>{
    const p=Object.fromEntries(formatter.formatToParts(new Date(stamp)).map(p=>[p.type,Number(p.value)]));
    return Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute,p.second);
  };
  zone.utcOffset=(time:Time)=>{
    const desired=Date.UTC(time.year,time.month-1,time.day,time.hour,time.minute,time.second);
    const offsets=new Set([-36,-12,0,12,36].map(h=>{const stamp=desired+h*3600_000;return wall(stamp)-stamp;}));
    const candidates=[...offsets].map(offset=>({stamp:desired-offset,offset})).filter(c=>wall(c.stamp)===desired).sort((a,b)=>a.stamp-b.stamp);
    if(!candidates.length) return fail('NONEXISTENT_LOCAL_TIME','The local time falls inside a daylight-saving gap; review this event.');
    // RFC 5545 ambiguous wall times refer to the first occurrence.
    return candidates[0].offset/1000;
  };
  return zone;
}
function prepare(root:Component,floating:string|null) {
  const zones=new Map<string,Zone>();
  const getZone=(name:string)=>{
    let zone=zones.get(name);
    if(!zone){zone=root.getTimeZoneByID(name)??ianaZone(name);zones.set(name,zone);}return zone;
  };
  for(const component of root.getAllSubcomponents('vevent')) {
    for(const property of component.getAllProperties()) {
      if(!['date','date-time'].includes(property.type))continue;
      for(const raw of property.toJSON().slice(3))validDate(raw);
      for(const time of property.getValues() as Time[]) {
        if(time.isDate)continue;
        const tz=property.getParameter('tzid');
        if(tz && typeof tz!=='string')fail('UNSUPPORTED_TIMEZONE','Multiple timezone parameters are not supported.');
        if(typeof tz==='string')time.zone=getZone(tz);
        else if(time.zone.tzid!=='UTC') {
          if(!floating)fail('FLOATING_TIMEZONE_REQUIRED','Choose a timezone for floating calendar times.');
          time.zone=getZone(floating!);
        }
      }
    }
    if(!component.hasProperty('dtstart') && stringValue(component,'status').toUpperCase()==='CANCELLED' && component.hasProperty('recurrence-id')) {
      component.addPropertyWithValue('dtstart',(component.getFirstPropertyValue('recurrence-id') as Time).clone());
    }
  }
}
function validateComponent(c:Component,isException:boolean) {
  for(const name of ['uid','dtstart','dtend','duration','rrule','recurrence-id','status','summary'])if(c.getAllProperties(name).length>1)fail('DUPLICATE_PROPERTY',`Repeated ${name} is ambiguous.`);
  if(c.hasProperty('rdate')||c.hasProperty('exrule'))fail('UNSUPPORTED_RULE','RDATE/EXRULE are not supported in this import version.');
  if(c.getFirstProperty('recurrence-id')?.getParameter('range'))fail('UNSUPPORTED_RULE','RANGE exceptions require separate review.');
  if(isException&&c.hasProperty('rrule'))fail('UNSUPPORTED_RULE','An exception cannot introduce another recurring rule.');
  const rule=c.getFirstProperty('rrule');
  if(rule) {
    const data=rule.toJSON()[3] as Record<string,unknown>;
    if(!['DAILY','WEEKLY'].includes(String(data.freq))||Object.keys(data).some(k=>!['freq','count','until','interval','byday','wkst'].includes(k)))fail('UNSUPPORTED_RULE','Only DAILY/WEEKLY rules with COUNT/UNTIL/INTERVAL/BYDAY/WKST are supported.');
    if(data.count!==undefined&&(!Number.isInteger(data.count)||Number(data.count)<1||Number(data.count)>10000))fail('UNSUPPORTED_RULE','COUNT must be between 1 and 10000.');
    if(data.interval!==undefined&&(!Number.isInteger(data.interval)||Number(data.interval)<1||Number(data.interval)>52))fail('UNSUPPORTED_RULE','INTERVAL must be between 1 and 52.');
    if(data.count!==undefined&&data.until!==undefined)fail('UNSUPPORTED_RULE','COUNT and UNTIL cannot both be supplied.');
    if(data.until)validDate(data.until);
    const days=Array.isArray(data.byday)?data.byday:[data.byday];
    if(data.byday!==undefined && days.some(v=>!['MO','TU','WE','TH','FR','SA','SU'].includes(String(v))))fail('UNSUPPORTED_RULE','Only plain weekday BYDAY values are supported.');
  }
  const start=c.getFirstPropertyValue('dtstart') as Time|null;
  if(!start)fail('MISSING_START','Event has no start date.');
  if(!start!.isDate)start!.toUnixTime();
  if(c.hasProperty('dtend')&&c.hasProperty('duration'))fail('INVALID_END','Choose DTEND or DURATION, not both.');
  const end=c.getFirstPropertyValue('dtend') as Time|null;
  if(end&&(end.isDate!==start!.isDate||end.compare(start!)<=0))fail('INVALID_END','End must be later than start with the same date precision.');
  if(c.hasProperty('duration')) {
    const duration=c.getFirstPropertyValue('duration') as InstanceType<typeof ICAL.Duration>;
    if(duration.toSeconds()<=0||(start!.isDate&&duration.toSeconds()%86400!==0))fail('INVALID_END','Duration must be positive and match date precision.');
  }
}
function isMember(master:Component,target:Time) {
  const start=master.getFirstPropertyValue('dtstart') as Time;
  const rule=master.getFirstPropertyValue('rrule') as InstanceType<typeof ICAL.Recur>|null;
  if(!rule)return start.compare(target)===0;
  const iterator=rule.iterator(start);
  for(let steps=0;steps<10000;steps++) {
    const next=iterator.next();if(!next||next.compare(target)>0)return false;if(next.compare(target)===0)return true;
  }
  return fail('EXPANSION_LIMIT','Exception membership needs too many expansion steps.');
}
const isExcluded=(master:Component,target:Time)=>master.getAllProperties('exdate').some(p=>(p.getValues() as Time[]).some(t=>t.compare(target)===0));

export function parseCalendar(content:string,floatingTimezone?:string) {
  if(Buffer.byteLength(content,'utf8')>262144)fail('FILE_TOO_LARGE','Calendar must be at most 256 KiB.');
  if(floatingTimezone&&!timezoneSchema.safeParse(floatingTimezone).success)fail('UNSUPPORTED_TIMEZONE','Choose a recognized timezone.');
  let root:Component;
  try {root=new ICAL.Component(ICAL.parse(content));}catch{ return fail('INVALID_CALENDAR','The file is not a valid iCalendar.'); }
  if(root.name!=='vcalendar'||!/^BEGIN:VCALENDAR\s*$/m.test(content.replace(/\r/g,''))||!content.trimEnd().endsWith('END:VCALENDAR'))fail('INVALID_CALENDAR','A complete VCALENDAR is required.');
  const events=root.getAllSubcomponents('vevent');
  validateZones(root);
  if(events.length>500)fail('TOO_MANY_EVENTS','Import at most 500 event components at once.');
  const issues:ImportIssue[]=[],series:CalendarSeries[]=[];
  for(const c of root.getAllSubcomponents())if(!['vevent','vtimezone'].includes(c.name))issues.push({uid:null,code:'UNSUPPORTED_COMPONENT',message:`${c.name} is not imported.`});
  const groups=new Map<string,{identity:'uid'|'fingerprint';components:Component[]}>();
  for(const component of events) {
    const uid=stringValue(component,'uid');
    const key=uid||`fingerprint:${hash(component.toString())}`;
    if(!groups.has(key))groups.set(key,{identity:uid?'uid':'fingerprint',components:[]});
    groups.get(key)!.components.push(component);
  }
  for(const [uid,group] of groups) {
    try {
      const masters=group.components.filter(c=>!c.hasProperty('recurrence-id'));
      if(masters.length>1)fail('DUPLICATE_UID','Multiple master events use this UID; choose a corrected source.');
      if(!masters.length)fail('ORPHAN_EXCEPTION','Exception has no recurring master in this file.');
      const copy=new ICAL.Component(['vcalendar',[],[]]);copy.addPropertyWithValue('version','2.0');
      for(const zone of root.getAllSubcomponents('vtimezone'))copy.addSubcomponent(new ICAL.Component(JSON.parse(JSON.stringify(zone.toJSON()))));
      for(const component of group.components)copy.addSubcomponent(new ICAL.Component(JSON.parse(JSON.stringify(component.toJSON()))));
      const raw=copy.toString();
      prepare(copy,floatingTimezone??null);
      const ids=new Set<string>();
      for(const c of copy.getAllSubcomponents('vevent')) {
        validateComponent(c,c.hasProperty('recurrence-id'));
        if(c.hasProperty('recurrence-id')) {const id=String(c.getFirstPropertyValue('recurrence-id'));if(ids.has(id))fail('DUPLICATE_EXCEPTION','An occurrence has multiple exceptions.');ids.add(id);}
      }
      const preparedMaster=copy.getAllSubcomponents('vevent').find(c=>!c.hasProperty('recurrence-id'))!;
      for(const c of copy.getAllSubcomponents('vevent').filter(c=>c.hasProperty('recurrence-id'))) {
        if(!isMember(preparedMaster,c.getFirstPropertyValue('recurrence-id') as Time))fail('INVALID_EXCEPTION','Exception does not identify an occurrence of the master rule.');
      }
      series.push({uid,identity:group.identity,title:stringValue(masters[0],'summary')||'Untitled event',ical:raw,floating_timezone:floatingTimezone??null,fingerprint:hash(raw)});
    }catch(error){issues.push({uid,code:error instanceof ImportError?error.code:'INVALID_EVENT',message:error instanceof ImportError?error.message:'This event could not be safely interpreted.'});}
  }
  return {series,issues};
}

function expand(series:CalendarSeries,range:{from:string;to:string},wanted?:string):Occurrence[] {
  calendarQuerySchema.parse({...range,timezone:'UTC'});
  const root=new ICAL.Component(ICAL.parse(series.ical));prepare(root,series.floating_timezone);
  const components=root.getAllSubcomponents('vevent'),master=components.find(c=>!c.hasProperty('recurrence-id'))!;
  if(stringValue(master,'status').toUpperCase()==='CANCELLED')return [];
  const event=new ICAL.Event(master,{strictExceptions:true});
  for(const c of components.filter(c=>c.hasProperty('recurrence-id')))event.relateException(c);
  const iterator=event.iterator();
  const result:Occurrence[]=[],seen=new Set<string>();
  const from=Date.parse(range.from)-86400_000,to=Date.parse(range.to)+86400_000;
  const append=(time:Time)=>{
    if(wanted&&time.toString()!==wanted)return;
    if(isExcluded(master,time))return;
    const detail=event.getOccurrenceDetails(time),c=detail.item.component,start=detail.startDate;
    if(stringValue(c,'status').toUpperCase()==='CANCELLED')return;
    const recurrence_id=time.toString();if(seen.has(recurrence_id))return;seen.add(recurrence_id);
    const explicitEnd=c.hasProperty('dtend')||c.hasProperty('duration');
    const end=explicitEnd?detail.endDate:null;
    const stamp=start.isDate?Date.parse(start.toString()):start.toUnixTime()*1000;
    const endStamp=end?(end.isDate?Date.parse(end.toString()):end.toUnixTime()*1000):stamp;
    if(!wanted&&(start.isDate?(start.toString()>=range.to||(end?end.toString()<=range.from:start.toString()<range.from)):(stamp>=to||endStamp<from)))return;
    const sourceStatus=stringValue(c,'status').toUpperCase();
    result.push({recurrence_id,title:stringValue(c,'summary')||stringValue(master,'summary')||'Untitled event',body:stringValue(c,'description'),location:stringValue(c,'location'),timezone:start.zone.tzid,all_day:start.isDate,starts_at:start.isDate?null:new Date(stamp).toISOString(),ends_at:start.isDate||!end?null:new Date(endStamp).toISOString(),start_date:start.isDate?start.toString():null,end_date:start.isDate&&end?end.toString():null,status:'active',source_status:sourceStatus==='TENTATIVE'?'tentative':sourceStatus==='CONFIRMED'?'confirmed':'unspecified',participation:'unknown'});
  };
  // Exceptions moved into the requested range can originate outside that range.
  for(const c of components.filter(c=>c.hasProperty('recurrence-id')))append(c.getFirstPropertyValue('recurrence-id') as Time);
  for(let steps=0;;steps++) {
    if(steps>=10000)fail('EXPANSION_LIMIT','The recurrence needs too many expansion steps; narrow/review the source.');
    const next=iterator.next();if(!next)break;
    if((next.isDate?Date.parse(next.toString()):next.toUnixTime()*1000)>=to)break;
    append(next);if(result.length>2000)fail('EXPANSION_LIMIT','Too many occurrences in this date range.');
  }
  return result.sort((a,b)=>(a.starts_at??a.start_date!).localeCompare(b.starts_at??b.start_date!)||a.recurrence_id.localeCompare(b.recurrence_id));
}

export function expandSeries(series:CalendarSeries,range:{from:string;to:string}):Occurrence[] {return expand(series,range);}
export function occurrenceAt(series:CalendarSeries,recurrenceId:string):Occurrence|null {
  const date=calendarDate.parse(recurrenceId.slice(0,10));
  const to=new Date(Date.parse(date)+86400_000).toISOString().slice(0,10);
  return expand(series,{from:date,to},recurrenceId)[0]??null;
}

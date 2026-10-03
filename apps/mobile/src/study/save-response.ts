import type {StudyWrite} from './save-controller';

const object=(value:unknown):value is Record<string,unknown>=>Boolean(value)&&typeof value==='object'&&!Array.isArray(value);
const uuid=(value:unknown)=>typeof value==='string'&&/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(value);
function normalized(key:string,value:unknown):unknown {
 if(typeof value!=='string')return value;
 if(key==='title'||key==='code')return value.trim();
 if(['starts_at','ends_at','due_at'].includes(key)&&Number.isFinite(Date.parse(value)))return new Date(value).toISOString();
 return value;
}
/** Compare only submitted fields; the server may add defaults, but must acknowledge this edit. */
function matches(expected:unknown,actual:unknown,key=''):boolean {
 if(Array.isArray(expected))return Array.isArray(actual)&&actual.length===expected.length&&expected.every((v,i)=>matches(v,actual[i]));
 if(object(expected))return object(actual)&&Object.entries(expected).every(([field,value])=>matches(value,actual[field],field));
 return normalized(key,expected)===actual;
}
export function validStudySave(write:StudyWrite,value:unknown):boolean {
 if(!object(value)||!Number.isSafeInteger(value.version)||Number(value.version)<1)return false;
 if(write.method==='PATCH'&&Number(value.version)!==Number(write.body.version)+1)return false;
 const occurrence=/^\/calendar\/series\/([^/]+)\/occurrence$/.exec(write.path);
 if(occurrence)return write.method==='PATCH'&&value.series_id===occurrence[1]&&value.recurrence_id===write.body.recurrence_id&&matches(write.body.event,value.event);
 const resource=/^\/study\/(courses|items)(?:\/([^/]+))?$/.exec(write.path);
 if(!resource||!uuid(value.id)||(write.method==='PATCH'&&value.id!==resource[2]))return false;
 if(resource[1]==='items'&&!['event','task','note','material'].includes(String(value.kind)))return false;
 const {version:_,...fields}=write.body;
 return matches(fields,value);
}

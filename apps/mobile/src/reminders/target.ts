import {dateInZone} from '../study/dates';
export function reminderTarget(data:Record<string,unknown>|undefined,owner:string|null){
 if(!data||!owner||data.owner!==owner||typeof data.target_at!=='string'||!Number.isFinite(Date.parse(data.target_at)))return null;
 const target=data.target as {kind?:unknown;id?:unknown}|null;
 if(!target||typeof target.id!=='string'||target.id.length>500||!['study','import','activity'].includes(String(target.kind)))return null;
 return {kind:target.kind as 'study'|'import'|'activity',id:target.id,date:dateInZone(data.target_at)};
}

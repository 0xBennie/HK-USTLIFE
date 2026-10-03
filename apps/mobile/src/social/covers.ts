import type {ImageSourcePropType} from 'react-native';
import {dateTimeInZone} from '../study/dates';
import type {Activity} from '../../../../src/product/social/types';

// Illustrative covers are the Unsplash photos already placed on the Pen boards (MjoHv cards, lAQTw hero).
// Activities have no uploaded media yet, so the cover follows the interaction style shown on the card tag.
const library=require('../../assets/covers/1741699428083-ddb73b95d1b6.jpg');
const libraryHero=require('../../assets/covers/1731200302668-b4d06901a312.jpg');
const seaside=require('../../assets/covers/1610429790621-3087185b1fc1.jpg');
const studyHall=require('../../assets/covers/1763890965393-1cea435581ab.jpg');
export function activityCover(activity:Pick<Activity,'interaction'>,variant:'card'|'hero'='card'):ImageSourcePropType{
 if(activity.interaction==='quiet')return variant==='hero'?libraryHero:library;
 if(activity.interaction==='casual')return seaside;
 return studyHall;
}
export const interactionLabel=(value:Activity['interaction'],zh:boolean)=>value==='quiet'?(zh?'安静共处':'Quiet company'):value==='casual'?(zh?'随意交流':'Casual'):(zh?'讨论协作':'Collaboration');
export const languageLabel=(values:Activity['languages'],zh:boolean)=>values.map(l=>l==='en'?'English':l==='yue'?(zh?'粤语':'Cantonese'):(zh?'普通话':'Mandarin')).join(' / ');
const hk=(instant:string)=>dateTimeInZone(instant,'Asia/Hong_Kong');
const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
/** Pen card meta: "10.05 16:00" (Hong Kong time). */
export const cardDateTime=(instant:string)=>{const v=hk(instant);return `${v.slice(5,7)}.${v.slice(8,10)} ${v.slice(11)}`;};
/** Pen detail row: "10 月 5 日 · 16:00–17:00"; spans across days keep both dates. */
export function dateRange(start:string,end:string,zh:boolean){
 const a=hk(start),b=hk(end),day=(v:string)=>zh?`${Number(v.slice(5,7))} 月 ${Number(v.slice(8,10))} 日`:`${months[Number(v.slice(5,7))-1]} ${Number(v.slice(8,10))}`;
 return a.slice(0,10)===b.slice(0,10)?`${day(a)} · ${a.slice(11)}–${b.slice(11)}`:`${day(a)} ${a.slice(11)} – ${day(b)} ${b.slice(11)}`;
}

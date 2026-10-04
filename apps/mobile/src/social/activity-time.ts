// Hong Kong wall-clock formatting for activity screens (Pen V6 date tile, info rows, join sheet).
export const hk=(iso:string)=>new Date(Date.parse(iso)+8*3600e3);
export const hhmm=(iso:string)=>hk(iso).toISOString().slice(11,16);
export const dayTitle=(iso:string,zh:boolean)=>{const d=hk(iso);return zh?`${d.getUTCMonth()+1} 月 ${d.getUTCDate()} 日 星期${'日一二三四五六'[d.getUTCDay()]}`:d.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',timeZone:'UTC'});};
export const timeSpan=(start:string,end:string,zh:boolean)=>{const a=hk(start),b=hk(end),same=a.toISOString().slice(0,10)===b.toISOString().slice(0,10);return same?`${hhmm(start)}–${hhmm(end)}`:`${hhmm(start)} – ${zh?`${b.getUTCMonth()+1} 月 ${b.getUTCDate()} 日`:b.toISOString().slice(5,10)} ${hhmm(end)}`;};
export const costText=(minor:number,zh:boolean)=>minor===0?(zh?'免费':'Free'):`HK$${(minor/100).toFixed(minor%100?2:0)}`;

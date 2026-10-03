import {it,expect} from 'vitest';
import {AffairController} from '../apps/mobile/src/affairs/controller';
import {ApiFailure} from '../apps/mobile/src/api';
const initial=()=>({id:'affair',version:1,template_id:'library',accepted_revision:1,current_revision:1,requires_review:false,step_checks:{check:false},label:'',note:'',submission:'not_reported',self_reported_outcome:'unknown',archived:false,personal_due:null,calendar_saved:false,remind_minutes:null,reported_at:null,outcome_recorded_at:null,official_status:{status:'unknown',reason:'not_connected'},template:{title:{zh:'续借',en:'Renewal'},steps:[{id:'check'}]},current_template:{title:{zh:'续借',en:'Renewal'},steps:[{id:'check'}]}});
it('serializes saving and checks exact requested effect before clearing draft',async()=>{
 let value=initial(),writes=0;const c=new AffairController('affair',async(_p,o)=>{if(o?.method){writes++;value={...value,note:'saved',version:2};}return value;});
 expect(await c.save()).toBe(false);await c.refresh();c.edit({note:'saved'});expect(c.protection()).toBe('draft');expect(await c.save()).toBe(true);expect(writes).toBe(1);expect(c.snapshot()).toMatchObject({phase:'ready',draft:{},value:{note:'saved'}});
});
it('does not replay lost writes and preserves draft until explicit recovery choice',async()=>{
 let value=initial(),writes=0;const c=new AffairController('affair',async(_p,o)=>{if(o?.method){writes++;value={...value,note:'saved',version:2};throw Error('lost response');}return value;});
 await c.refresh();c.edit({note:'saved'});await c.save();expect(c.protection()).toBe('uncertain');expect(await c.save()).toBe(false);
 await c.refresh();expect(c.snapshot()).toMatchObject({phase:'review',draft:{note:'saved'},value:{version:2}});expect(writes).toBe(1);c.resolve('use-server');expect(c.protection()).toBe('clear');
});
it('requires deliberate rebase after conflict without overwriting another field',async()=>{
 let value=initial(),writes=0;let last:any;const c=new AffairController('affair',async(_p,o)=>{if(o?.method){writes++;last=o.body;if(writes===1){value={...value,label:'other device',version:2};throw new ApiFailure(409,'VERSION_CONFLICT','changed');}value={...value,...o.body as object,version:3};}return value;});
 await c.refresh();c.edit({note:'my draft'});await c.save();await c.refresh();expect(await c.save()).toBe(false);c.resolve('keep-draft');expect(await c.save()).toBe(true);expect(last).toEqual({version:2,note:'my draft'});expect(c.snapshot().value?.label).toBe('other device');
});
it('rejects wrong-record and false official-success responses, retaining uncertain edits',async()=>{
 let wrong=false;const c=new AffairController('affair',async(_p,o)=>{if(o?.method)return {...initial(),version:2,official_status:{status:'confirmed'}};return wrong?{...initial(),id:'other'}:initial();});
 await c.refresh();c.edit({note:'private'});await c.save();expect(c.snapshot().phase).toBe('uncertain');wrong=true;await c.refresh();expect(c.snapshot()).toMatchObject({phase:'uncertain',draft:{note:'private'}});
});
it('ignores late requests and clears private state after account disposal',async()=>{
 let finish!:(v:unknown)=>void;const c=new AffairController('affair',()=>new Promise(resolve=>{finish=resolve;}));const pending=c.refresh();c.dispose();finish(initial());await pending;expect(c.snapshot()).toMatchObject({phase:'idle',value:null,draft:{}});expect(await c.refresh()).toBe(false);
});
it('accepts normalized equivalent times but rejects another instant in a write response',async()=>{
 let correct=true;const c=new AffairController('affair',async(_p,o)=>o?.method?{...initial(),version:2,personal_due:{kind:'time',at:correct?'2026-10-05T04:00:00.000Z':'2026-10-05T05:00:00.000Z',timezone:'Asia/Hong_Kong'}}:initial());
 await c.refresh();c.edit({personal_due:{kind:'time',at:'2026-10-05T12:00:00+08:00',timezone:'Asia/Hong_Kong'}});expect(await c.save()).toBe(true);
 const wrong=new AffairController('affair',async(_p,o)=>o?.method?{...initial(),version:2,personal_due:{kind:'time',at:'2026-10-05T05:00:00Z',timezone:'Asia/Hong_Kong'}}:initial());
 await wrong.refresh();wrong.edit({personal_due:{kind:'time',at:'2026-10-05T12:00:00+08:00',timezone:'Asia/Hong_Kong'}});expect(await wrong.save()).toBe(false);expect(wrong.snapshot().phase).toBe('uncertain');
});
it('keeps recovery blocked when refresh fails, with no extra write',async()=>{
 let writes=0,failRead=false;const c=new AffairController('affair',async(_p,o)=>{if(o?.method){writes++;throw Error('lost');}if(failRead)throw Error('offline');return initial();});
 await c.refresh();c.edit({note:'pending'});await c.save();failRead=true;await c.refresh();c.resolve('keep-draft');expect(c.snapshot().phase).toBe('uncertain');expect(await c.save()).toBe(false);expect(writes).toBe(1);
});

import {it,expect} from 'vitest';
import {ReconnectionController} from '../apps/mobile/src/social/reconnection-controller';
const initial={activity_id:'activity',target_id:'peer',willing:false,version:0,mutual:false,expired:false,expires_at:null};
it('requires current state, serializes writes and checks the owner choice rather than claiming mutual intent',async()=>{
 let state={...initial},writes=0;const c=new ReconnectionController('activity','peer',async(_path,options)=>{if(options?.method){writes++;state={...state,willing:true,version:1};}return state;});
 expect(await c.choose(true)).toBe(false);await c.refresh();expect(await c.choose(true)).toBe(true);expect(writes).toBe(1);expect(c.snapshot().value).toMatchObject({willing:true,mutual:false,version:1});
});
it('never repeats a lost consent write and recovers by reading the real current choice',async()=>{
 let state={...initial},writes=0;
 const c=new ReconnectionController('activity','peer',async(_path,options)=>{if(options?.method){writes++;state={...state,willing:true,version:1};throw Error('Lost reply');}return state;});
 await c.refresh();expect(await c.choose(true)).toBe(false);expect(c.snapshot().phase).toBe('uncertain');expect(await c.choose(false)).toBe(false);await c.refresh();expect(writes).toBe(1);expect(c.snapshot().value?.willing).toBe(true);
});
it('rejects mismatched responses and preserves an unresolved write when its recovery read fails',async()=>{
 let fail=false;const c=new ReconnectionController('activity','peer',async(_path,options)=>{if(fail)throw Error('offline');return options?.method?{...initial,target_id:'other',version:1,willing:true}:initial;});
 await c.refresh();expect(await c.choose(true)).toBe(false);fail=true;expect(await c.refresh()).toBe(false);expect(c.snapshot().phase).toBe('uncertain');expect(await c.choose(true)).toBe(false);
});

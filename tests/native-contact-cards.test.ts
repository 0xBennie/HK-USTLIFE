import {it,expect,vi} from 'vitest';
import {ContactCardController} from '../apps/mobile/src/social/contact-card-controller.js';
const value=(text='',version=0)=>({activity_id:'event',target_id:'peer',mine:{text,version},peer:{text:'Peer contact'}});
it('requires a read and exact preview before sharing, then confirms persisted text',async()=>{
 const request=vi.fn().mockResolvedValueOnce(value()).mockResolvedValueOnce(value('Chosen contact',1));const c=new ContactCardController('event','peer',request);
 c.edit('Chosen contact');expect(await c.save('Chosen contact')).toBe(false);await c.refresh();expect(await c.save('Other preview')).toBe(false);
 expect(await c.save('Chosen contact')).toBe(true);expect(c.snapshot()).toMatchObject({phase:'ready',dirty:false});expect(request.mock.calls[1][1].body).toEqual({version:0,text:'Chosen contact'});
});
it('preserves drafts on unknown writes and only recovers by reading, without replay',async()=>{
 const request=vi.fn().mockResolvedValueOnce(value()).mockRejectedValueOnce(Error('lost reply')).mockResolvedValueOnce(value('Chosen contact',1));const c=new ContactCardController('event','peer',request);
 await c.refresh();c.edit('Chosen contact');await c.save('Chosen contact');expect(c.snapshot()).toMatchObject({phase:'uncertain',draft:'Chosen contact',value:{peer:null}});expect(await c.save('Chosen contact')).toBe(false);
 await c.refresh();expect(c.snapshot()).toMatchObject({phase:'ready',dirty:false});expect(request).toHaveBeenCalledTimes(3);
});
it('preserves divergent drafts after refresh, supports explicit saved version, and clears peer on failure',async()=>{
 const request=vi.fn().mockResolvedValueOnce(value()).mockResolvedValueOnce(value('Other device',2)).mockRejectedValueOnce(Error('offline'));const c=new ContactCardController('event','peer',request);
 await c.refresh();c.edit('My draft');await c.refresh();expect(c.snapshot()).toMatchObject({draft:'My draft',dirty:true,value:{mine:{version:2}}});c.useSaved();expect(c.snapshot().draft).toBe('Other device');await c.refresh();expect(c.snapshot().value?.peer).toBeNull();
});
it('does not restore contact data from a request completed after backgrounding',async()=>{
 let resolve!:(v:unknown)=>void;const request=vi.fn(()=>new Promise(r=>{resolve=r;}));const c=new ContactCardController('event','peer',request);
 const pending=c.refresh();c.hide();resolve(value());await pending;expect(c.snapshot().value?.peer).toBeNull();c.edit('Mine');expect(await c.save('Mine')).toBe(false);
});
it('rejects wrong target and mismatched write confirmation',async()=>{
 const request=vi.fn().mockResolvedValueOnce({...value(),target_id:'other'}).mockResolvedValueOnce(value()).mockResolvedValueOnce(value('Wrong content',1));const c=new ContactCardController('event','peer',request);
 expect(await c.refresh()).toBe(false);await c.refresh();c.edit('Mine');expect(await c.save('Mine')).toBe(false);expect(c.snapshot().phase).toBe('uncertain');
});

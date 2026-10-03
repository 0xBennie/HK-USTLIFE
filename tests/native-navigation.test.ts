import {it,expect} from 'vitest';
import {NavigationProtections,protectionFor} from '../apps/mobile/src/navigation/protection';

it('protects a retained draft in the destination tab even while another tab is active',()=>{
 const guards=new NavigationProtections();const form=guards.register(0,protectionFor(true,false,false));
 expect(guards.status(2)).toBe('clear');expect(guards.status(0)).toBe('draft');
 const request=guards.register(0,protectionFor(true,true,true));
 expect(guards.status(0)).toBe('busy');request();
 const receipt=guards.register(0,protectionFor(false,false,true));
 expect(guards.status(0)).toBe('uncertain');receipt();expect(guards.status(0)).toBe('draft');
 form();expect(guards.status(0)).toBe('clear');
});
it('cleaning an old effect cannot remove a newer registration for the same scene',()=>{
 const guards=new NavigationProtections();const old=guards.register(2,'draft');
 const fresh=guards.register(2,'busy');old();old();expect(guards.status(2)).toBe('busy');
 fresh();expect(guards.status(2)).toBe('clear');
});
it('unmounting all account-owned scenes removes all navigation guards',()=>{
 const guards=new NavigationProtections();
 const cleanups=[guards.register(0,'draft'),guards.register(2,'uncertain'),guards.register(2,'busy'),guards.register(4,'draft')];
 for(const cleanup of cleanups)cleanup();
 for(let index=0;index<5;index++)expect(guards.status(index)).toBe('clear');
 expect(protectionFor(false,false,false)).toBe('clear');
});

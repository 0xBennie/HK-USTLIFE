import {it,expect} from 'vitest';
import {validSafetyReceipt,type SafetyWrite} from '../apps/mobile/src/social/safety-receipt.js';
const request:SafetyWrite={path:'/reports',method:'POST',key:'retry-key',body:{target:{kind:'contact_card',id:'a'.repeat(32)+'.1'},reason:'privacy',details:' Please review '}};
const receipt={id:'11111111-1111-4111-8111-111111111111',target:{kind:'contact_card',id:'a'.repeat(32)+'.1'},reason:'privacy',details:'Please review',status:'pending',version:1};
it('accepts the matching report including an already resolved idempotent retry',()=>{
 expect(validSafetyReceipt(request,receipt)).toBe(true);
 expect(validSafetyReceipt(request,{...receipt,status:'action_taken',version:2})).toBe(true);
});
it('rejects empty, wrong-target, changed-body and invalid report responses',()=>{
 for(const response of [null,{}, {...receipt,target:{...receipt.target,id:'b'.repeat(32)+'.1'}},{...receipt,details:'Other report'},{...receipt,version:0},{...receipt,status:'unknown'}])expect(validSafetyReceipt(request,response)).toBe(false);
});
it('requires explicit block confirmation instead of accepting any successful response',()=>{
 const block={...request,path:'/me/blocks/person',method:'PUT',body:{}};
 expect(validSafetyReceipt(block,{blocked:true})).toBe(true);
 expect(validSafetyReceipt(block,{blocked:false})).toBe(false);
 expect(validSafetyReceipt(block,{})).toBe(false);
});

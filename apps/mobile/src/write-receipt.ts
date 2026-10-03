import {ApiFailure} from './api';

export const SAFE_REPLAY_MS=23*60*60*1000;
export type WriteReceipt<T=unknown>={body:T;key:string;createdAt:number};
export function writeReceipt<T>(body:T,key:string,now=Date.now()):WriteReceipt<T>{
 return {body:JSON.parse(JSON.stringify(body)) as T,key,createdAt:now};
}
export const reviewRequired=(error:unknown)=>error instanceof ApiFailure&&error.code==='RECEIPT_REVIEW_REQUIRED';
export function ensureReplayable(receipt:WriteReceipt,method:string,now=Date.now()){
 // Only POST operations rely on the server's expiring creation/action receipts.
 const elapsed=now-receipt.createdAt;
 if(method==='POST'&&(!Number.isFinite(elapsed)||elapsed<0||elapsed>=SAFE_REPLAY_MS))throw new ApiFailure(409,'RECEIPT_REVIEW_REQUIRED','Retry window ended. Check the saved record before taking another action.');
}
export const writeRejected=(error:unknown):error is ApiFailure=>error instanceof ApiFailure&&error.status>=400&&error.status<500&&!reviewRequired(error);

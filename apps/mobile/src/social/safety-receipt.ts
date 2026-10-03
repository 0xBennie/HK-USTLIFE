import type {ReportTarget} from '../../../../src/product/social/wall-types';
export type SafetyWrite={path:string;method:string;body:unknown;key:string};
export function validSafetyReceipt(request:SafetyWrite,raw:unknown):boolean{
 if(!raw||typeof raw!=='object')return false;
 const v=raw as Record<string,unknown>;
 if(request.method==='PUT')return v.blocked===true;
 const body=request.body as {target:ReportTarget;reason:string;details:string};
 const target=v.target as ReportTarget|undefined;
 return typeof v.id==='string'&&/^[0-9a-f-]{36}$/i.test(v.id)&&target?.kind===body.target.kind&&target?.id===body.target.id&&v.reason===body.reason&&v.details===body.details.trim()&&Number.isInteger(v.version)&&Number(v.version)>=1&&['pending','dismissed','action_taken'].includes(String(v.status));
}

import type {ReportTarget} from './wall-types.js';
export type ReportReason='spam'|'harassment'|'privacy'|'misinformation'|'other';
export type ContentReport={id:string;target:ReportTarget;reason:ReportReason;details:string;status:'pending'|'dismissed'|'action_taken';version:number;created_at:string;resolution:string;reviewed_at:string|null};
export type BlockedUser={id:string;display_name:string;created_at:string};

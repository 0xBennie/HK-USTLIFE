// What the API returns for a member's private affair. Types only: the mobile app imports this instead of
// the Node-only store (node:sqlite, node:crypto), and the store declares it as its return type.
import type {PrivateFields,Template} from './schemas.js';

/** Template fields compared between the accepted and the current revision. */
export type AffairDiffField='title'|'summary'|'conditions'|'materials'|'deadline'|'sources'|'steps';
export type AffairChange={field:AffairDiffField;old:Template[AffairDiffField];new:Template[AffairDiffField]};
export type AffairDetail=PrivateFields&{
 id:string;version:number;template_id:string;accepted_revision:number;current_revision:number;
 reported_at:string|null;outcome_recorded_at:string|null;created_at:string;updated_at:string;
 template:Template;current_template:Template;retired:boolean;requires_review:boolean;
 change_summary:AffairChange[];official_status:{status:'unknown';reason:'not_connected'};
};

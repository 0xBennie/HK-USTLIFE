import type {StudyItem} from '../learning/schemas.js';
export type ImportedEvent=Omit<Extract<StudyItem,{kind:'event'}>,'created_at'|'updated_at'>&{
  locally_modified:boolean;
  source_occurrence_missing:boolean;
  recurrence_id:string;
  source_status:'confirmed'|'tentative'|'unspecified';
  participation:'unknown';
  import_origin:{source_id:string;source_name:string;series_id:string;recurrence_id:string};
};
export type CalendarItem=StudyItem|ImportedEvent;

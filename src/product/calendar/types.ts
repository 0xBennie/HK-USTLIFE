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
export type SeriesSummary=Record<'title'|'start'|'end'|'duration'|'timezone'|'recurrence'|'excluded'|'exceptions'|'location'|'description'|'status',string>;
export type ImportPreview={
  id:string;expires_at:number;
  source:{id:string;name:string;version:number;created_at:number};existing:boolean;
  issues:{uid:string|null;code:string;message:string}[];
  entries:{series:{uid:string;identity:'uid'|'fingerprint';title:string};summary:SeriesSummary;previous_summary:SeriesSummary|null;expected_version:number|null;action:'new'|'unchanged'|'update'|'conflict';local_changes:number;previous_title:string|null}[];
};

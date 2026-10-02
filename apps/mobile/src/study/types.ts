import type { CalendarItem } from '../../../../src/product/calendar/types';
export type { CalendarItem } from '../../../../src/product/calendar/types';
export type { StudyItem, Stored, CourseInput, ItemInput } from '../../../../src/product/learning/schemas';
import type { Stored, CourseInput, StudyItem } from '../../../../src/product/learning/schemas';
export type Course = Stored<CourseInput>;
export type Calendar = { from:string;to:string;timezone:string; days:{date:string;events:CalendarItem[];tasks:StudyItem[]}[];undated_tasks:StudyItem[];import_issues:{source_id:string;series_id:string;title:string;code:string}[] };

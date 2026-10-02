export type { StudyItem, Stored, CourseInput, ItemInput } from '../../../../src/product/learning/schemas';
import type { Stored, CourseInput, StudyItem } from '../../../../src/product/learning/schemas';
export type Course = Stored<CourseInput>;
export type Calendar = { from:string;to:string;timezone:string; days:{date:string;events:StudyItem[];tasks:StudyItem[]}[];undated_tasks:StudyItem[] };

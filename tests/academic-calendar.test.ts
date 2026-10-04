import {expect,it} from 'vitest';
import {academicStatus,termWeek,terms} from '../src/product/campus/academic-calendar.js';
const at=(s:string)=>Date.parse(s+'T12:00:00+08:00');
it('numbers weeks exactly like the Registry PDF (Sunday–Saturday rows)',()=>{
 const fall=terms[0];
 expect(termWeek(fall,'2026-09-01')).toBe(1);expect(termWeek(fall,'2026-09-05')).toBe(1);expect(termWeek(fall,'2026-09-06')).toBe(2);
 expect(termWeek(fall,'2026-10-04')).toBe(6);expect(termWeek(fall,'2026-11-28')).toBe(13);
 expect(termWeek(terms[2],'2027-02-07')).toBe(2);expect(termWeek(terms[2],'2027-03-01')).toBe(5);expect(termWeek(terms[2],'2027-03-30')).toBe(8);expect(termWeek(terms[2],'2027-04-04')).toBe(9);expect(termWeek(terms[2],'2027-05-08')).toBe(13);
});
it('reports phase, holiday and upcoming key dates',()=>{
 const oct4=academicStatus(at('2026-10-04'));expect(oct4).toMatchObject({week:6,phase:'teaching',holiday:null});expect(oct4.term?.id).toBe('2026-27-fall');
 expect(oct4.upcoming[0]).toMatchObject({start:'2026-10-19',kind:'holiday',days_until:15});
 expect(academicStatus(at('2026-10-19')).holiday?.name.en).toContain('Chung Yeung');
 expect(academicStatus(at('2026-12-03'))).toMatchObject({phase:'study_break',week:null});
 expect(academicStatus(at('2026-12-10')).phase).toBe('exams');
 expect(academicStatus(at('2026-12-28'))).toMatchObject({phase:'between_terms',term:null});expect(academicStatus(at('2026-12-28')).next_term?.id).toBe('2026-27-winter');
});

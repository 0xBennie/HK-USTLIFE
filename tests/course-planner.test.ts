import { describe, expect, it } from 'vitest';

import { planCourseSchedule, type CourseOffering } from '../src/domain/course-planner.js';
import type { Provenance } from '../src/domain/provenance.js';

const source: Provenance = {
  sourceId: 'aro-class-schedule',
  owner: 'Academic Registry Office (ARO)',
  url: 'https://registry.hkust.edu.hk/resource-library/course-offering-and-class-schedule-ug',
  fetchedAt: '2026-08-28T00:00:00.000Z',
  freshness: 'static-link',
};

function offering(overrides: Partial<CourseOffering> = {}): CourseOffering {
  return {
    courseCode: 'COMP2012',
    title: 'Object-Oriented Programming and Data Structures',
    credits: 3,
    required: true,
    source,
    sections: [
      { id: 'L1', label: 'Lecture 1', meetings: [{ day: 'mon', startsAt: '10:00', endsAt: '11:20' }] },
      { id: 'L2', label: 'Lecture 2', meetings: [{ day: 'tue', startsAt: '14:00', endsAt: '15:20' }] },
    ],
    choices: [
      { id: 'L1', sectionIds: ['L1'] },
      { id: 'L2', sectionIds: ['L2'] },
    ],
    ...overrides,
  };
}

describe('HKUST course planner', () => {
  it('keeps only conflict-free section combinations and preserves official provenance', () => {
    const result = planCourseSchedule({
      courses: [
        offering(),
        offering({
          courseCode: 'MATH2011',
          title: 'Calculus',
          sections: [
            { id: 'A', label: 'Class A', meetings: [{ day: 'mon', startsAt: '10:30', endsAt: '11:50' }] },
            { id: 'B', label: 'Class B', meetings: [{ day: 'wed', startsAt: '10:30', endsAt: '11:50' }] },
          ],
          choices: [
            { id: 'A', sectionIds: ['A'] },
            { id: 'B', sectionIds: ['B'] },
          ],
        }),
      ],
      preferences: { maxPlans: 4 },
    });

    expect(result.plans[0]?.courseCodes).toEqual(['COMP2012', 'MATH2011']);
    expect(result.plans.every((plan) => plan.selections.some((selection) => selection.optionId === 'L1') && plan.selections.some((selection) => selection.optionId === 'A'))).toBe(false);
    expect(result.excluded).toEqual(expect.arrayContaining([
      expect.objectContaining({ courseCode: 'MATH2011', optionId: 'A', reason: 'time_conflict' }),
    ]));
    expect(result.plans[0]?.selections[0]?.source).toEqual(source);
    expect(result.planningOnly).toBe(true);
  });

  it('rejects section choices that break a declared lecture-lab matching rule', () => {
    const result = planCourseSchedule({
      courses: [offering({
        courseCode: 'COMP3000',
        sections: [
          { id: 'L1', label: 'Lecture 1', meetings: [{ day: 'thu', startsAt: '09:00', endsAt: '10:20' }] },
          { id: 'LAB1', label: 'Lab 1', meetings: [{ day: 'fri', startsAt: '09:00', endsAt: '10:50' }] },
        ],
        choices: [
          { id: 'lecture-only', sectionIds: ['L1'] },
          { id: 'lecture-with-lab', sectionIds: ['L1', 'LAB1'] },
        ],
        matchingRules: [{ triggerSectionId: 'L1', requiresSectionIds: ['LAB1'], description: 'Lecture 1 requires Lab 1.' }],
      })],
    });

    expect(result.plans).toHaveLength(1);
    expect(result.plans[0]?.selections[0]?.optionId).toBe('lecture-with-lab');
    expect(result.excluded).toEqual(expect.arrayContaining([
      expect.objectContaining({ optionId: 'lecture-only', reason: 'matching_rule' }),
    ]));
  });

  it('ranks plans that keep a preferred day free before otherwise equal alternatives', () => {
    const result = planCourseSchedule({
      courses: [offering({
        sections: [
          { id: 'MON', label: 'Monday class', meetings: [{ day: 'mon', startsAt: '14:00', endsAt: '15:20' }] },
          { id: 'TUE', label: 'Tuesday class', meetings: [{ day: 'tue', startsAt: '14:00', endsAt: '15:20' }] },
        ],
        choices: [
          { id: 'MON', sectionIds: ['MON'] },
          { id: 'TUE', sectionIds: ['TUE'] },
        ],
      })],
      preferences: { preferredFreeDays: ['mon'] },
    });

    expect(result.plans.map((plan) => plan.selections[0]?.optionId)).toEqual(['TUE', 'MON']);
  });

  it('warns when no generated schedule reaches the target credit load', () => {
    const result = planCourseSchedule({
      courses: [offering()],
      preferences: { targetCredits: 12 },
    });

    expect(result.warnings).toContain('No generated plan reaches the requested 12-credit target. Check programme rules and add eligible electives yourself.');
  });
});

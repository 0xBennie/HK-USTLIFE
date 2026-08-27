import type { Provenance } from './provenance.js';

export const weekdays = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type Weekday = (typeof weekdays)[number];

export interface CourseMeeting {
  day: Weekday;
  startsAt: string;
  endsAt: string;
  venue?: string;
}

export interface CourseSection {
  id: string;
  label: string;
  meetings: CourseMeeting[];
}

export interface CourseSectionChoice {
  id: string;
  sectionIds: string[];
  quotaAvailable?: number;
  note?: string;
}

export interface SectionMatchingRule {
  triggerSectionId: string;
  requiresSectionIds: string[];
  description: string;
}

export interface CourseOffering {
  courseCode: string;
  title: string;
  credits: number;
  required: boolean;
  source: Provenance;
  sections: CourseSection[];
  choices: CourseSectionChoice[];
  matchingRules?: SectionMatchingRule[];
}

export interface CoursePlanningPreferences {
  preferredFreeDays?: Weekday[];
  earliestStart?: string;
  latestEnd?: string;
  avoidTimes?: CourseMeeting[];
  targetCredits?: number;
  maxPlans?: number;
}

export interface CoursePlanningRequest {
  courses: CourseOffering[];
  preferences?: CoursePlanningPreferences;
}

export type CoursePlanExclusionReason = 'matching_rule' | 'unknown_section' | 'outside_time_window' | 'avoid_time' | 'time_conflict';

export interface CoursePlanExclusion {
  courseCode: string;
  optionId: string;
  reason: CoursePlanExclusionReason;
  detail: string;
}

export interface PlannedCourseSelection {
  courseCode: string;
  title: string;
  credits: number;
  optionId: string;
  sectionIds: string[];
  meetings: CourseMeeting[];
  quotaAvailable?: number;
  note?: string;
  source: Provenance;
}

export interface CoursePlan {
  courseCodes: string[];
  selections: PlannedCourseSelection[];
  credits: number;
  freeDays: Weekday[];
  score: number;
}

export interface CoursePlanResult {
  planningOnly: true;
  planningNotice: string;
  plans: CoursePlan[];
  excluded: CoursePlanExclusion[];
  warnings: string[];
}

interface RankedPlan extends CoursePlan {
  order: number;
}

function minutes(value: string): number {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) {
    throw new Error(`Course planner requires HH:mm times; received ${value}.`);
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) {
    throw new Error(`Course planner requires a valid time; received ${value}.`);
  }

  return hour * 60 + minute;
}

function overlaps(left: CourseMeeting, right: CourseMeeting): boolean {
  return left.day === right.day
    && minutes(left.startsAt) < minutes(right.endsAt)
    && minutes(right.startsAt) < minutes(left.endsAt);
}

function uniqueExclusions(exclusions: CoursePlanExclusion[]): CoursePlanExclusion[] {
  const seen = new Set<string>();
  return exclusions.filter((exclusion) => {
    const key = `${exclusion.courseCode}|${exclusion.optionId}|${exclusion.reason}|${exclusion.detail}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function toSelection(
  course: CourseOffering,
  option: CourseSectionChoice,
  sectionById: Map<string, CourseSection>,
): PlannedCourseSelection {
  return {
    courseCode: course.courseCode,
    title: course.title,
    credits: course.credits,
    optionId: option.id,
    sectionIds: [...option.sectionIds],
    meetings: option.sectionIds.flatMap((sectionId) => sectionById.get(sectionId)?.meetings ?? []),
    quotaAvailable: option.quotaAvailable,
    note: option.note,
    source: course.source,
  };
}

function validateChoice(
  course: CourseOffering,
  option: CourseSectionChoice,
  preferences: CoursePlanningPreferences,
): CoursePlanExclusion | undefined {
  const sections = new Map(course.sections.map((section) => [section.id, section]));
  const unknownSection = option.sectionIds.find((sectionId) => !sections.has(sectionId));
  if (unknownSection) {
    return {
      courseCode: course.courseCode,
      optionId: option.id,
      reason: 'unknown_section',
      detail: `The option references unknown section ${unknownSection}.`,
    };
  }

  for (const rule of course.matchingRules ?? []) {
    if (option.sectionIds.includes(rule.triggerSectionId)
      && !rule.requiresSectionIds.every((sectionId) => option.sectionIds.includes(sectionId))) {
      return {
        courseCode: course.courseCode,
        optionId: option.id,
        reason: 'matching_rule',
        detail: rule.description,
      };
    }
  }

  const meetings = option.sectionIds.flatMap((sectionId) => sections.get(sectionId)?.meetings ?? []);
  const earliestStart = preferences.earliestStart ? minutes(preferences.earliestStart) : undefined;
  const latestEnd = preferences.latestEnd ? minutes(preferences.latestEnd) : undefined;
  if (meetings.some((meeting) => (earliestStart !== undefined && minutes(meeting.startsAt) < earliestStart)
      || (latestEnd !== undefined && minutes(meeting.endsAt) > latestEnd))) {
    return {
      courseCode: course.courseCode,
      optionId: option.id,
      reason: 'outside_time_window',
      detail: 'The option falls outside the requested daily time window.',
    };
  }

  if (meetings.some((meeting) => (preferences.avoidTimes ?? []).some((avoid) => overlaps(meeting, avoid)))) {
    return {
      courseCode: course.courseCode,
      optionId: option.id,
      reason: 'avoid_time',
      detail: 'The option overlaps a time the student asked to avoid.',
    };
  }

  return undefined;
}

function rankPlan(selections: PlannedCourseSelection[], preferences: CoursePlanningPreferences, order: number): RankedPlan {
  const occupiedDays = new Set(selections.flatMap((selection) => selection.meetings.map((meeting) => meeting.day)));
  const freeDays = weekdays.filter((day) => !occupiedDays.has(day));
  const preferredFreeDays = new Set(preferences.preferredFreeDays ?? []);
  const freeDayScore = freeDays.filter((day) => preferredFreeDays.has(day)).length * 100;
  const credits = selections.reduce((sum, selection) => sum + selection.credits, 0);
  const creditDistance = preferences.targetCredits === undefined ? 0 : Math.abs(preferences.targetCredits - credits) * 10;

  return {
    courseCodes: selections.map((selection) => selection.courseCode),
    selections,
    credits,
    freeDays,
    score: freeDayScore - creditDistance,
    order,
  };
}

/**
 * Plans locally from official course sections that the caller has already normalized.
 * It never reads SIS, reserves a seat, or performs course registration.
 */
export function planCourseSchedule(request: CoursePlanningRequest): CoursePlanResult {
  const preferences = request.preferences ?? {};
  const exclusions: CoursePlanExclusion[] = [];
  const candidates = request.courses.map((course) => {
    const sections = new Map(course.sections.map((section) => [section.id, section]));
    const valid = course.choices.flatMap((option) => {
      const exclusion = validateChoice(course, option, preferences);
      if (exclusion) {
        exclusions.push(exclusion);
        return [];
      }
      return [toSelection(course, option, sections)];
    });

    return course.required ? valid : [undefined, ...valid];
  });

  const ranked: RankedPlan[] = [];
  let order = 0;

  function search(courseIndex: number, selections: PlannedCourseSelection[]): void {
    if (courseIndex === candidates.length) {
      ranked.push(rankPlan(selections, preferences, order));
      order += 1;
      return;
    }

    const course = request.courses[courseIndex];
    for (const candidate of candidates[courseIndex] ?? []) {
      if (!candidate) {
        search(courseIndex + 1, selections);
        continue;
      }

      const conflictingSelection = selections.find((selection) => candidate.meetings.some((meeting) =>
        selection.meetings.some((scheduled) => overlaps(meeting, scheduled))));
      if (conflictingSelection) {
        exclusions.push({
          courseCode: course.courseCode,
          optionId: candidate.optionId,
          reason: 'time_conflict',
          detail: `The option overlaps ${conflictingSelection.courseCode} ${conflictingSelection.optionId}.`,
        });
        continue;
      }

      search(courseIndex + 1, [...selections, candidate]);
    }
  }

  search(0, []);

  const maxPlans = Math.min(Math.max(preferences.maxPlans ?? 5, 1), 20);
  const plans = ranked
    .sort((left, right) => right.score - left.score || left.order - right.order)
    .slice(0, maxPlans)
    .map(({ order: _order, ...plan }) => plan);

  const warnings = [
    'Course times, quotas and eligibility can change. Recheck the official ARO source before acting.',
  ];
  if (plans.length === 0) {
    warnings.unshift('No conflict-free plan was generated from the supplied section choices. Adjust your courses or constraints and try again.');
  }
  if (preferences.targetCredits !== undefined && !plans.some((plan) => plan.credits === preferences.targetCredits)) {
    warnings.push(`No generated plan reaches the requested ${preferences.targetCredits}-credit target. Check programme rules and add eligible electives yourself.`);
  }

  return {
    planningOnly: true,
    planningNotice: 'Planning only: confirm the latest official section data and submit any enrollment yourself in SIS. This tool cannot reserve a place or change your registration.',
    plans,
    excluded: uniqueExclusions(exclusions),
    warnings,
  };
}

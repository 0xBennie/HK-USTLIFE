export type Campus = 'clear-water-bay';

export interface CampusService {
  id: string;
  name: string;
  owner: string;
  campus: Campus;
  url: string;
  purpose: string;
  keywords: string[];
  updatePolicy: string;
}

export interface SkillDefinition {
  slug: string;
  title: string;
  description: string;
  path: string;
  tools: string[];
}

export type PlannableEventKind = 'class' | 'deadline' | 'event';
export type EventSource = 'manual' | 'student_calendar' | 'canvas' | 'outlook';

export interface PlannableEvent {
  id: string;
  title: string;
  kind: PlannableEventKind;
  startsAt: string;
  source: EventSource;
}

export interface ReminderRule {
  id: string;
  eventKinds: PlannableEventKind[];
  minutesBefore: number;
}

export interface ReminderProposal {
  id: string;
  eventId: string;
  title: string;
  scheduledFor: string;
  timezone: string;
  trigger: string;
}

import type { PlannableEvent, ReminderProposal, ReminderRule } from './types.js';

export const defaultReminderRules: ReminderRule[] = [
  { id: 'class-45m', eventKinds: ['class'], minutesBefore: 45 },
  { id: 'deadline-24h', eventKinds: ['deadline'], minutesBefore: 24 * 60 },
  { id: 'deadline-2h', eventKinds: ['deadline'], minutesBefore: 2 * 60 },
];

function formatLeadTime(minutes: number): string {
  if (minutes % 60 === 0) {
    return `${minutes / 60} hour${minutes === 60 ? '' : 's'}`;
  }

  return `${minutes} minutes`;
}

function reminderTitle(event: PlannableEvent, rule: ReminderRule): string {
  const leadTime = formatLeadTime(rule.minutesBefore);

  if (event.kind === 'class') {
    return `Leave for ${event.title} in ${leadTime}`;
  }

  if (event.kind === 'deadline') {
    return `${event.title} is due in ${leadTime}`;
  }

  return `${event.title} starts in ${leadTime}`;
}

export function planReminders(
  events: PlannableEvent[],
  rules: ReminderRule[],
  timezone: string,
): ReminderProposal[] {
  const proposals = new Map<string, ReminderProposal>();

  for (const event of events) {
    const eventTime = Date.parse(event.startsAt);
    if (Number.isNaN(eventTime)) {
      throw new RangeError(`Event ${event.id} has an invalid startsAt value.`);
    }

    for (const rule of rules) {
      if (!rule.eventKinds.includes(event.kind)) {
        continue;
      }

      const id = `${event.id}:${rule.id}`;
      proposals.set(id, {
        id,
        eventId: event.id,
        title: reminderTitle(event, rule),
        scheduledFor: new Date(eventTime - rule.minutesBefore * 60_000).toISOString(),
        timezone,
        trigger: rule.id,
      });
    }
  }

  return [...proposals.values()].sort((left, right) => left.scheduledFor.localeCompare(right.scheduledFor));
}

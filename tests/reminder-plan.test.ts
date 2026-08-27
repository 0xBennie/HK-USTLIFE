import { describe, expect, it } from 'vitest';

import { defaultReminderRules, planReminders } from '../src/domain/reminder-plan.js';

const classEvent = {
  id: 'MATH101-2026-08-28T10:00',
  title: 'MATH101 lecture',
  kind: 'class' as const,
  startsAt: '2026-08-28T10:00:00+08:00',
  source: 'student_calendar' as const,
};

describe('planReminders', () => {
  it('creates only one 45-minute class reminder for duplicate input', () => {
    const reminders = planReminders([classEvent, { ...classEvent }], defaultReminderRules, 'Asia/Hong_Kong');

    expect(reminders).toEqual([
      {
        id: 'MATH101-2026-08-28T10:00:class-45m',
        eventId: 'MATH101-2026-08-28T10:00',
        title: 'Leave for MATH101 lecture in 45 minutes',
        scheduledFor: '2026-08-28T01:15:00.000Z',
        timezone: 'Asia/Hong_Kong',
        trigger: 'class-45m',
      },
    ]);
  });

  it('plans 24-hour and 2-hour deadline reminders in chronological order', () => {
    const reminders = planReminders(
      [
        {
          id: 'COMP201-assignment-1',
          title: 'COMP201 Assignment 1',
          kind: 'deadline',
          startsAt: '2026-09-01T23:59:00+08:00',
          source: 'canvas',
        },
      ],
      defaultReminderRules,
      'Asia/Hong_Kong',
    );

    expect(reminders.map((reminder) => reminder.trigger)).toEqual(['deadline-24h', 'deadline-2h']);
    expect(reminders.map((reminder) => reminder.scheduledFor)).toEqual([
      '2026-08-31T15:59:00.000Z',
      '2026-09-01T13:59:00.000Z',
    ]);
  });
});

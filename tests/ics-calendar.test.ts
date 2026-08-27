import { describe, expect, it } from 'vitest';

import { CalendarParseError, parseIcsCalendar } from '../src/adapters/ics-calendar.js';

describe('parseIcsCalendar', () => {
  it('normalizes a Hong Kong class VEVENT into a student-calendar event', () => {
    const events = parseIcsCalendar(
      [
        'BEGIN:VCALENDAR',
        'BEGIN:VEVENT',
        'UID:math-1',
        'SUMMARY:MATH101 lecture',
        'DTSTART;TZID=Asia/Hong_Kong:20260901T100000',
        'DTEND;TZID=Asia/Hong_Kong:20260901T112000',
        'END:VEVENT',
        'END:VCALENDAR',
      ].join('\r\n'),
      'Asia/Hong_Kong',
    );

    expect(events).toEqual([
      {
        id: 'math-1',
        title: 'MATH101 lecture',
        kind: 'class',
        startsAt: '2026-09-01T10:00:00+08:00',
        source: 'student_calendar',
      },
    ]);
  });

  it('unfolds calendar lines and preserves a marked deadline', () => {
    const events = parseIcsCalendar(
      [
        'BEGIN:VCALENDAR',
        'BEGIN:VEVENT',
        'UID:comp-deadline',
        'SUMMARY:COMP201 Assignment',
        'X-HKUST-KIND:DEAD',
        ' LINE',
        'DTSTART:20260903T235900',
        'END:VEVENT',
        'END:VCALENDAR',
      ].join('\n'),
      'Asia/Hong_Kong',
    );

    expect(events[0]).toMatchObject({
      id: 'comp-deadline',
      kind: 'deadline',
      startsAt: '2026-09-03T23:59:00+08:00',
    });
  });

  it('rejects an invalid timestamp without echoing calendar content', () => {
    expect(() => parseIcsCalendar('BEGIN:VEVENT\nUID:private\nDTSTART:not-a-date\nEND:VEVENT', 'Asia/Hong_Kong'))
      .toThrow(CalendarParseError);
  });
});

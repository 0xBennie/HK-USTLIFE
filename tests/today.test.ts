import { describe, expect, it } from 'vitest';

import { buildToday } from '../src/domain/today.js';

const weather = {
  temperatureC: 28,
  humidityPercent: 82,
  iconCode: 53,
  observedAt: '2026-09-01T08:55:00+08:00',
  updatedAt: '2026-09-01T08:56:00+08:00',
  warnings: ['Thunderstorm Warning'],
  fetchedAt: '2026-09-01T00:56:00.000Z',
  sourceUrl: 'https://data.weather.gov.hk/current',
  warningSourceUrl: 'https://data.weather.gov.hk/warnings',
};

describe('buildToday', () => {
  it('puts urgent weather first, selects the next event, and limits deadlines to 48 hours', () => {
    const brief = buildToday({
      now: new Date('2026-09-01T01:00:00.000Z'),
      weather,
      events: [
        { id: 'later', title: 'COMP201 lecture', kind: 'class', startsAt: '2026-09-01T14:00:00+08:00', source: 'student_calendar' },
        { id: 'math-1', title: 'MATH101 lecture', kind: 'class', startsAt: '2026-09-01T10:00:00+08:00', source: 'student_calendar' },
        { id: 'comp-deadline', title: 'COMP201 assignment', kind: 'deadline', startsAt: '2026-09-02T23:59:00+08:00', source: 'canvas' },
        { id: 'far-deadline', title: 'Later task', kind: 'deadline', startsAt: '2026-09-04T23:59:00+08:00', source: 'canvas' },
      ],
      serviceFacts: [],
    });

    expect(brief.urgent).toEqual(['Thunderstorm Warning']);
    expect(brief.nextEvent?.id).toBe('math-1');
    expect(brief.deadlines.map((event) => event.id)).toEqual(['comp-deadline']);
    expect(brief.sources[0]).toMatchObject({ sourceId: 'hko-current-weather', freshness: 'live' });
  });
});

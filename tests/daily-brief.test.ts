import { describe, expect, it } from 'vitest';

import { buildDailyBrief } from '../src/domain/daily-brief.js';

const weather = {
  temperatureC: 28,
  humidityPercent: 81,
  iconCode: 53,
  observedAt: '2026-08-27T14:00:00+08:00',
  updatedAt: '2026-08-27T14:05:00+08:00',
  warnings: ['Strong Wind Signal No. 3'],
  fetchedAt: '2026-08-27T06:06:00.000Z',
  sourceUrl: 'https://data.weather.gov.hk/current',
  warningSourceUrl: 'https://data.weather.gov.hk/warnings',
};

describe('buildDailyBrief', () => {
  it('orders a student schedule and preserves the weather source boundary', () => {
    const brief = buildDailyBrief({
      date: '2026-08-28',
      generatedAt: '2026-08-27T22:30:00.000Z',
      weather,
      events: [
        {
          id: 'later-class',
          title: 'COMP201 lecture',
          kind: 'class',
          startsAt: '2026-08-28T14:00:00+08:00',
          source: 'student_calendar',
        },
        {
          id: 'early-class',
          title: 'MATH101 tutorial',
          kind: 'class',
          startsAt: '2026-08-28T09:00:00+08:00',
          source: 'student_calendar',
        },
      ],
    });

    expect(brief.schedule.map((event) => event.id)).toEqual(['early-class', 'later-class']);
    expect(brief.sources).toEqual([
      { owner: 'Hong Kong Observatory', url: 'https://data.weather.gov.hk/current', fetchedAt: '2026-08-27T06:06:00.000Z' },
      { owner: 'Hong Kong Observatory', url: 'https://data.weather.gov.hk/warnings', fetchedAt: '2026-08-27T06:06:00.000Z' },
    ]);
  });
});

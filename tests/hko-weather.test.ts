import { describe, expect, it } from 'vitest';

import { CURRENT_WEATHER_URL, WARNINGS_URL, getHongKongWeather } from '../src/adapters/hko-weather.js';

const weatherPayload = {
  temperature: {
    data: [
      { place: 'King\'s Park', value: 29, unit: 'C' },
      { place: 'Hong Kong Observatory', value: 28, unit: 'C' },
    ],
    recordTime: '2026-08-27T14:00:00+08:00',
  },
  humidity: {
    data: [{ place: 'Hong Kong Observatory', value: 81, unit: 'percent' }],
  },
  icon: [53],
  updateTime: '2026-08-27T14:05:00+08:00',
};

const warningPayload = {
  WTCSGNL: {
    name: 'Strong Wind Signal No. 3',
    actionCode: 'ISSUE',
    issueTime: '2026-08-27T13:00:00+08:00',
  },
  WFIRE: {
    name: 'Fire Danger Warning',
    actionCode: 'CANCEL',
    issueTime: '2026-08-27T12:00:00+08:00',
  },
};

describe('getHongKongWeather', () => {
  it('normalizes HKO current weather and active warnings with provenance', async () => {
    const fetcher = async (url: string) => {
      const payload = url === CURRENT_WEATHER_URL ? weatherPayload : warningPayload;
      return new Response(JSON.stringify(payload), { status: 200 });
    };

    const weather = await getHongKongWeather(fetcher, new Date('2026-08-27T06:06:00.000Z'));

    expect(weather).toEqual({
      temperatureC: 28,
      humidityPercent: 81,
      iconCode: 53,
      observedAt: '2026-08-27T14:00:00+08:00',
      updatedAt: '2026-08-27T14:05:00+08:00',
      warnings: ['Strong Wind Signal No. 3'],
      fetchedAt: '2026-08-27T06:06:00.000Z',
      sourceUrl: CURRENT_WEATHER_URL,
      warningSourceUrl: WARNINGS_URL,
    });
  });
});

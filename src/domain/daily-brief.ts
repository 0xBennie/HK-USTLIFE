import type { WeatherSnapshot } from '../adapters/hko-weather.js';
import type { PlannableEvent } from './types.js';

export interface SourceAttribution {
  owner: string;
  url: string;
  fetchedAt: string;
}

export interface DailyBrief {
  date: string;
  generatedAt: string;
  weather: WeatherSnapshot;
  schedule: PlannableEvent[];
  sources: SourceAttribution[];
}

export function buildDailyBrief(input: {
  date: string;
  generatedAt: string;
  weather: WeatherSnapshot;
  events: PlannableEvent[];
}): DailyBrief {
  return {
    date: input.date,
    generatedAt: input.generatedAt,
    weather: input.weather,
    schedule: [...input.events].sort((left, right) => left.startsAt.localeCompare(right.startsAt)),
    sources: [
      {
        owner: 'Hong Kong Observatory',
        url: input.weather.sourceUrl,
        fetchedAt: input.weather.fetchedAt,
      },
      {
        owner: 'Hong Kong Observatory',
        url: input.weather.warningSourceUrl,
        fetchedAt: input.weather.fetchedAt,
      },
    ],
  };
}

import type { WeatherSnapshot } from '../adapters/hko-weather.js';
import { sourceProvenance, type Provenance } from './provenance.js';
import type { CampusService, PlannableEvent } from './types.js';

export interface TodayInput {
  now: Date;
  weather: WeatherSnapshot;
  events: PlannableEvent[];
  serviceFacts: CampusService[];
}

export interface TodayBrief {
  generatedAt: string;
  urgent: string[];
  weather: WeatherSnapshot;
  nextEvent: PlannableEvent | null;
  deadlines: PlannableEvent[];
  serviceFacts: CampusService[];
  sources: Provenance[];
}

function futureEvents(events: PlannableEvent[], now: Date): PlannableEvent[] {
  return events
    .filter((event) => Date.parse(event.startsAt) >= now.getTime())
    .sort((left, right) => left.startsAt.localeCompare(right.startsAt));
}

export function buildToday(input: TodayInput): TodayBrief {
  const upcoming = futureEvents(input.events, input.now);
  const deadlineLimit = input.now.getTime() + 48 * 60 * 60 * 1_000;

  return {
    generatedAt: input.now.toISOString(),
    urgent: [...input.weather.warnings],
    weather: input.weather,
    nextEvent: upcoming.find((event) => event.kind !== 'deadline') ?? null,
    deadlines: upcoming.filter((event) => event.kind === 'deadline' && Date.parse(event.startsAt) <= deadlineLimit),
    serviceFacts: input.serviceFacts.map((service) => ({ ...service, keywords: [...service.keywords] })),
    sources: [
      {
        sourceId: 'hko-current-weather',
        owner: 'Hong Kong Observatory',
        url: input.weather.sourceUrl,
        fetchedAt: input.weather.fetchedAt,
        freshness: 'live',
      },
      {
        sourceId: 'hko-weather-warnings',
        owner: 'Hong Kong Observatory',
        url: input.weather.warningSourceUrl,
        fetchedAt: input.weather.fetchedAt,
        freshness: 'live',
      },
      ...input.serviceFacts.map((service) => sourceProvenance(service, input.now.toISOString(), 'static-link')),
    ],
  };
}

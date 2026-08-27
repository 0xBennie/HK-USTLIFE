import { campusServices } from '../data/source-registry.js';
import type { CampusService } from './types.js';

function queryTerms(query: string): string[] {
  return query.toLowerCase().match(/[a-z0-9-]+/g) ?? [];
}

export function searchCampusServices(query: string): CampusService[] {
  const terms = queryTerms(query);

  return campusServices
    .map((service) => ({
      service,
      score: terms.reduce(
        (score, term) => score + (service.keywords.includes(term) ? 1 : 0),
        0,
      ),
    }))
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score || left.service.name.localeCompare(right.service.name))
    .map(({ service }) => service);
}

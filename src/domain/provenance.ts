import type { CampusService } from './types.js';

export type Freshness = 'live' | 'fetched' | 'static-link';

export interface Provenance {
  sourceId: string;
  owner: string;
  url: string;
  fetchedAt: string;
  freshness: Freshness;
}

export function sourceProvenance(
  source: CampusService,
  fetchedAt: string,
  freshness: Freshness,
): Provenance {
  return {
    sourceId: source.id,
    owner: source.owner,
    url: source.url,
    fetchedAt,
    freshness,
  };
}

import { campusServices } from '../data/source-registry.js';

export type PublicSourceFetcher = (input: string, init?: RequestInit) => Promise<Pick<Response, 'ok' | 'text'>>;

export interface PublicCampusUpdate {
  service: {
    id: string;
    name: string;
    owner: string;
    url: string;
  };
  excerpt: string;
  fetchedAt: string;
}

function textFromHtml(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 2_000);
}

export async function getPublicCampusUpdate(
  serviceId: string,
  fetcher: PublicSourceFetcher = fetch,
  now: Date = new Date(),
): Promise<PublicCampusUpdate> {
  const service = campusServices.find((candidate) => candidate.id === serviceId);
  if (!service) {
    throw new Error(`Unknown campus service id: ${serviceId}`);
  }

  const response = await fetcher(service.url, {
    headers: { 'user-agent': 'hkust-life-mcp/0.1 (public campus update)' },
  });
  if (!response.ok) {
    throw new Error(`Official source is temporarily unavailable: ${service.url}`);
  }

  return {
    service: {
      id: service.id,
      name: service.name,
      owner: service.owner,
      url: service.url,
    },
    excerpt: textFromHtml(await response.text()),
    fetchedAt: now.toISOString(),
  };
}

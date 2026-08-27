export type GraphFetcher = (input: string, init?: RequestInit) => Promise<Pick<Response, 'ok' | 'json'>>;

const GRAPH_ROOT = 'https://graph.microsoft.com/v1.0';
const BASIC_MAIL_SELECT = 'id,subject,from,receivedDateTime,isRead,importance';
const BASIC_CALENDAR_SELECT = 'id,subject,start,end,location,isCancelled,showAs';

export interface OutlookEmailSignal {
  id: string;
  subject: string;
  fromName: string | null;
  fromAddress: string | null;
  receivedAt: string | null;
  isRead: boolean;
  importance: string | null;
}

export interface OutlookCalendarSignal {
  id: string;
  title: string;
  startsAt: string | null;
  endsAt: string | null;
  timezone: string | null;
  location: string | null;
  isCancelled: boolean;
  showAs: string | null;
}

export interface OutlookSignals {
  emails: OutlookEmailSignal[];
  calendarEvents: OutlookCalendarSignal[];
  fetchedAt: string;
  permissions: ['Mail.ReadBasic', 'Calendars.ReadBasic'];
}

interface GraphCollection<T> {
  value?: T[];
}

interface GraphMessage {
  id?: string;
  subject?: string;
  from?: { emailAddress?: { name?: string; address?: string } };
  receivedDateTime?: string;
  isRead?: boolean;
  importance?: string;
}

interface GraphCalendarEvent {
  id?: string;
  subject?: string;
  start?: { dateTime?: string; timeZone?: string };
  end?: { dateTime?: string; timeZone?: string };
  location?: { displayName?: string };
  isCancelled?: boolean;
  showAs?: string;
}

function messageUrl(): string {
  const url = new URL(`${GRAPH_ROOT}/me/mailFolders/inbox/messages`);
  url.searchParams.set('$select', BASIC_MAIL_SELECT);
  url.searchParams.set('$orderby', 'receivedDateTime desc');
  url.searchParams.set('$top', '10');
  return url.toString();
}

function calendarUrl(now: Date): string {
  const url = new URL(`${GRAPH_ROOT}/me/calendarView`);
  const weekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1_000);
  url.searchParams.set('startDateTime', now.toISOString());
  url.searchParams.set('endDateTime', weekLater.toISOString());
  url.searchParams.set('$select', BASIC_CALENDAR_SELECT);
  url.searchParams.set('$orderby', 'start/dateTime');
  return url.toString();
}

async function graphJson(fetcher: GraphFetcher, url: string, accessToken: string): Promise<unknown> {
  const response = await fetcher(url, {
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('Microsoft Graph rejected the read-only request. Reconnect the account or check institutional consent.');
  }

  return response.json();
}

function normalizeMessage(message: GraphMessage): OutlookEmailSignal {
  return {
    id: message.id ?? '',
    subject: message.subject ?? '(no subject)',
    fromName: message.from?.emailAddress?.name ?? null,
    fromAddress: message.from?.emailAddress?.address ?? null,
    receivedAt: message.receivedDateTime ?? null,
    isRead: message.isRead ?? false,
    importance: message.importance ?? null,
  };
}

function normalizeCalendarEvent(event: GraphCalendarEvent): OutlookCalendarSignal {
  return {
    id: event.id ?? '',
    title: event.subject ?? '(no title)',
    startsAt: event.start?.dateTime ?? null,
    endsAt: event.end?.dateTime ?? null,
    timezone: event.start?.timeZone ?? null,
    location: event.location?.displayName ?? null,
    isCancelled: event.isCancelled ?? false,
    showAs: event.showAs ?? null,
  };
}

export async function getOutlookSignals(
  accessToken: string,
  fetcher: GraphFetcher = fetch,
  now: Date = new Date(),
): Promise<OutlookSignals> {
  if (!accessToken.trim()) {
    throw new Error('Outlook is not connected. Complete delegated consent before requesting account signals.');
  }

  const [messages, events] = await Promise.all([
    graphJson(fetcher, messageUrl(), accessToken),
    graphJson(fetcher, calendarUrl(now), accessToken),
  ]);

  return {
    emails: ((messages as GraphCollection<GraphMessage>).value ?? []).map(normalizeMessage),
    calendarEvents: ((events as GraphCollection<GraphCalendarEvent>).value ?? []).map(normalizeCalendarEvent),
    fetchedAt: now.toISOString(),
    permissions: ['Mail.ReadBasic', 'Calendars.ReadBasic'],
  };
}

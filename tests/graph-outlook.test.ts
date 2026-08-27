import { describe, expect, it } from 'vitest';

import { getOutlookSignals } from '../src/adapters/graph-outlook.js';

describe('getOutlookSignals', () => {
  it('requests only basic Outlook headers and calendar fields through delegated read-only calls', async () => {
    const calls: Array<{ url: string; authorization: string | null }> = [];
    const fetcher = async (url: string, init?: RequestInit) => {
      calls.push({ url, authorization: new Headers(init?.headers).get('authorization') });
      if (url.includes('/messages?')) {
        return new Response(
          JSON.stringify({
            value: [
              {
                id: 'mail-1',
                subject: 'COMP201 deadline update',
                from: { emailAddress: { name: 'COMP201', address: 'comp201@connect.ust.hk' } },
                receivedDateTime: '2026-08-27T06:00:00Z',
                isRead: false,
                importance: 'high',
              },
            ],
          }),
          { status: 200 },
        );
      }

      return new Response(
        JSON.stringify({
          value: [
            {
              id: 'event-1',
              subject: 'MATH101 lecture',
              start: { dateTime: '2026-08-28T10:00:00', timeZone: 'Asia/Hong_Kong' },
              end: { dateTime: '2026-08-28T11:20:00', timeZone: 'Asia/Hong_Kong' },
              location: { displayName: 'Room 1013' },
              isCancelled: false,
              showAs: 'busy',
            },
          ],
        }),
        { status: 200 },
      );
    };

    const result = await getOutlookSignals('short-lived-token', fetcher, new Date('2026-08-27T08:00:00.000Z'));

    expect(result).toEqual({
      emails: [
        {
          id: 'mail-1',
          subject: 'COMP201 deadline update',
          fromName: 'COMP201',
          fromAddress: 'comp201@connect.ust.hk',
          receivedAt: '2026-08-27T06:00:00Z',
          isRead: false,
          importance: 'high',
        },
      ],
      calendarEvents: [
        {
          id: 'event-1',
          title: 'MATH101 lecture',
          startsAt: '2026-08-28T10:00:00',
          endsAt: '2026-08-28T11:20:00',
          timezone: 'Asia/Hong_Kong',
          location: 'Room 1013',
          isCancelled: false,
          showAs: 'busy',
        },
      ],
      fetchedAt: '2026-08-27T08:00:00.000Z',
      permissions: ['Mail.ReadBasic', 'Calendars.ReadBasic'],
    });
    expect(calls).toHaveLength(2);
    expect(calls.every((call) => call.authorization === 'Bearer short-lived-token')).toBe(true);
    expect(calls.map((call) => call.url).join(' ')).not.toContain('body');
  });
});

import { describe, expect, it } from 'vitest';

import { getAccountStatus } from '../src/domain/account-status.js';

describe('getAccountStatus', () => {
  it('reports Outlook as awaiting consent when no development token exists', () => {
    const outlook = getAccountStatus({}).find((item) => item.id === 'outlook');

    expect(outlook).toMatchObject({
      id: 'outlook',
      state: 'awaiting_consent',
      mode: 'read_only',
      requiredScopes: ['Mail.ReadBasic', 'Calendars.ReadBasic'],
    });
  });

  it('never represents SIS and Canvas as ready without an institutional integration', () => {
    expect(getAccountStatus({}).filter((item) => item.id === 'sis' || item.id === 'canvas'))
      .toEqual([
        expect.objectContaining({ state: 'institutional_approval_required' }),
        expect.objectContaining({ state: 'institutional_approval_required' }),
      ]);
  });
});

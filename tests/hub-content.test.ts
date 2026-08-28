import { describe, expect, it } from 'vitest';

import { renderConnectModel, renderHomeModel, renderPlanModel } from '../apps/hub/lib/content.js';

describe('Hub student-first content', () => {
  it('starts an unfamiliar student with the onboarding flow', () => {
    expect(renderHomeModel().primaryAction).toMatchObject({
      label: 'I just arrived',
      href: '/start',
    });
    expect(renderHomeModel().actions.map((action) => action.href)).toEqual(expect.arrayContaining([
      '/plan',
      '/skills',
    ]));
  });

  it('states the private-account boundary plainly', () => {
    expect(renderConnectModel().privateDataNotice).toContain('never ask for your password');
    expect(renderConnectModel().connectors.find((connector) => connector.name === 'SIS')?.status).toContain('institutional approval');
  });

  it('keeps timetable screenshots out of the public Hub and course registration out of scope', () => {
    const plan = renderPlanModel();

    expect(plan.screenshotNotice).toContain('not uploaded to the Hub');
    expect(plan.enrollmentNotice).toContain('submit in SIS yourself');
  });
});

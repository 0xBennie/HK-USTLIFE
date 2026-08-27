import { describe, expect, it } from 'vitest';

import { runMcpSmokeCheck } from '../scripts/smoke-mcp.mjs';

describe('MCP stdio smoke check', () => {
  it('advertises the expected tool names over a real stdio MCP process', async () => {
    const names = await runMcpSmokeCheck();

    expect(names).toEqual(
      expect.arrayContaining([
        'hkust_get_weather',
        'hkust_get_daily_brief',
        'hkust_plan_reminders',
        'hkust_get_outlook_signals',
      ]),
    );
  });
});

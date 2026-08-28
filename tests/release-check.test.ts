import { describe, expect, it } from 'vitest';

import { runReleaseCheck, scanTrackedText } from '../scripts/release-check.mjs';

describe('release secret guard', () => {
  it('flags a credential-like assignment but not an ordinary URL setting', async () => {
    await expect(scanTrackedText('DEMO_TOKEN=abc')).resolves.toContain('credential-like assignment'); // release-check:allow
    await expect(scanTrackedText('sourceUrl=https://library.hkust.edu.hk')).resolves.toEqual([]);
  });

  it('matches multi-segment credential names', async () => {
    await expect(scanTrackedText('HKUST_MCP_API_KEY=s3cr3t-real-looking-value-9f2a')).resolves.toContain( // release-check:allow
      'credential-like assignment',
    );
  });

  it('accepts documented placeholder values', async () => {
    await expect(scanTrackedText("HKUST_MCP_API_KEY='replace-with-a-long-random-secret'")).resolves.toEqual([]);
    await expect(scanTrackedText('HKUST_GRAPH_ACCESS_TOKEN=<your-token>')).resolves.toEqual([]);
  });

  it('never echoes the matched value, only the rule name', async () => {
    const findings = await scanTrackedText('CLIENT_SECRET=hunter2-not-a-real-value'); // release-check:allow

    expect(findings).toHaveLength(1);
    expect(findings.join(' ')).not.toContain('hunter2');
  });

  it('reports no findings across the tracked repository', async () => {
    const result = await runReleaseCheck({ cwd: process.cwd(), audit: false });

    expect(result.findings).toEqual([]);
    expect(result.ok).toBe(true);
  });
});

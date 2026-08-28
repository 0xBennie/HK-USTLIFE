import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import { listSkills } from '../src/data/skills-catalog.js';

describe('public release assets', () => {
  it('publishes an MIT license and a private-data disclosure policy', async () => {
    expect(await readFile('LICENSE', 'utf8')).toContain('MIT License');

    const security = await readFile('SECURITY.md', 'utf8');
    expect(security).toContain('Do not include student data');
    expect(security).toContain('security advisory');
  });

  it('requires attributed Clear Water Bay sources from contributors', async () => {
    const contributing = await readFile('CONTRIBUTING.md', 'utf8');
    expect(contributing).toContain('Clear Water Bay');
    expect(contributing).toContain('official');

    const issueTemplate = await readFile('.github/ISSUE_TEMPLATE/source-correction.yml', 'utf8');
    for (const field of ['owner-url', 'observed-date', 'clear-water-bay']) {
      expect(issueTemplate).toContain(field);
    }

    const pullRequestTemplate = await readFile('.github/pull_request_template.md', 'utf8');
    expect(pullRequestTemplate).toContain('npm test');
    expect(pullRequestTemplate).toContain('Clear Water Bay');
  });

  it('documents every skill, the Hub and the data boundaries in the README', async () => {
    const readme = await readFile('README.md', 'utf8');

    for (const skill of listSkills()) {
      expect(readme).toContain(`skills/${skill.slug}`);
    }

    for (const hubPage of ['/start', '/skills', '/plan', '/sources', '/connect', '/api/mcp']) {
      expect(readme).toContain(hubPage);
    }

    expect(readme).toContain('npm run hub');
    expect(readme).toContain('LICENSE');
    expect(readme).not.toContain('/Users/');
  });
});

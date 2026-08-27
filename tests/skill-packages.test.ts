import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { listSkills } from '../src/data/skills-catalog.js';

const expectedSlugs = [
  'hkust-today',
  'hkust-newcomer',
  'hkust-campus-status',
  'hkust-academic',
  'hkust-opportunities',
  'hkust-course-planner',
  'hkust-life-mcp',
];

describe('installable HKUST Skill packages', () => {
  it('keeps the catalogue, required SKILL.md files and UI metadata in sync', async () => {
    expect(listSkills().map((skill) => skill.slug)).toEqual(expectedSlugs);
    expect((await readdir('skills', { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort())
      .toEqual([...expectedSlugs].sort());

    for (const slug of expectedSlugs) {
      const folder = path.join('skills', slug);
      const [skill, metadata] = await Promise.all([
        readFile(path.join(folder, 'SKILL.md'), 'utf8'),
        readFile(path.join(folder, 'agents', 'openai.yaml'), 'utf8'),
      ]);

      expect(skill).toContain(`name: ${slug}`);
      expect(metadata).toContain(`$${slug}`);
      expect(metadata).toContain('allow_implicit_invocation: true');
    }
  });
});

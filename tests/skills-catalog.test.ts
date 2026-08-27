import { describe, expect, it } from 'vitest';

import { findSkill, listSkills } from '../src/data/skills-catalog.js';

describe('HKUST Skills catalogue', () => {
  it('publishes the seven student-facing Skills', () => {
    expect(listSkills().map((skill) => skill.slug)).toEqual([
      'hkust-today',
      'hkust-newcomer',
      'hkust-campus-status',
      'hkust-academic',
      'hkust-opportunities',
      'hkust-course-planner',
      'hkust-life-mcp',
    ]);
  });

  it('makes every listed Skill discoverable at its repository path', () => {
    expect(findSkill('hkust-newcomer')).toMatchObject({
      title: 'HKUST Newcomer',
      path: 'skills/hkust-newcomer',
      tools: ['hkust_build_newcomer_checklist'],
    });
  });
});

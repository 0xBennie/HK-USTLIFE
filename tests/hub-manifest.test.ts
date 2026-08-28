import { describe, expect, it } from 'vitest';

import { listSkills } from '../src/data/skills-catalog.js';
import { toHubSkillCards } from '../apps/hub/lib/catalog.js';

describe('Hub skill manifest', () => {
  it('turns every public Skill into an installable, student-facing card', () => {
    const cards = toHubSkillCards(listSkills());

    expect(cards).toHaveLength(7);
    expect(cards.find((card) => card.slug === 'hkust-course-planner')).toMatchObject({
      title: 'HKUST Course Planner',
      href: '/skills/hkust-course-planner',
      installPath: 'skills/hkust-course-planner',
    });
  });
});

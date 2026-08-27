import { describe, expect, it } from 'vitest';

import { buildNewcomerChecklist } from '../src/domain/newcomer-checklist.js';

describe('buildNewcomerChecklist', () => {
  it('gives a non-local UG without housing only source-linked first-week tasks', () => {
    const items = buildNewcomerChecklist({
      level: 'ug',
      residency: 'non_local',
      housing: 'not_arranged',
      intakeTerm: 'fall',
    });

    expect(items.map((item) => item.sourceId)).toEqual([
      'it-support',
      'housing',
      'academic-registry',
      'international',
    ]);
    expect(items[1]).toMatchObject({ id: 'arrange-housing', priority: 'urgent' });
  });

  it('does not make an already housed local student complete a housing-arrangement task', () => {
    expect(buildNewcomerChecklist({
      level: 'rpg',
      residency: 'local',
      housing: 'off_campus',
      intakeTerm: 'spring',
    }).map((item) => item.id)).not.toContain('arrange-housing');
  });
});

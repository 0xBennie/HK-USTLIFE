import { describe, expect, it } from 'vitest';

import { searchCampusServices } from '../src/domain/source-search.js';

describe('searchCampusServices', () => {
  it('finds the library service from a natural-language query', () => {
    expect(searchCampusServices('where can I study tonight')[0]?.id).toBe('library-hours');
  });

  it('keeps results within the Clear Water Bay main-campus registry', () => {
    expect(searchCampusServices('Guangzhou campus').map((service) => service.campus)).not.toContain('guangzhou');
  });
});

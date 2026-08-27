import { describe, expect, it } from 'vitest';

import { findCampusService } from '../src/data/source-registry.js';
import { sourceProvenance } from '../src/domain/provenance.js';

describe('main-campus source registry', () => {
  it('resolves a declared Clear Water Bay source', () => {
    expect(findCampusService('housing')).toMatchObject({
      campus: 'clear-water-bay',
      owner: 'Student Housing and Residential Life Office (SHRLO)',
    });
  });

  it('keeps the official ARO public class schedule in the main-campus allow-list', () => {
    expect(findCampusService('aro-class-schedule')).toMatchObject({
      campus: 'clear-water-bay',
      owner: 'Academic Registry Office (ARO)',
      url: 'https://registry.hkust.edu.hk/resource-library/course-offering-and-class-schedule-ug',
    });
  });

  it('rejects a source outside the declared main-campus allow-list', () => {
    expect(() => findCampusService('hkust-gz')).toThrow('Unknown main-campus source');
  });

  it('creates a source-attributed provenance record', () => {
    expect(sourceProvenance(findCampusService('housing'), '2026-08-28T00:00:00.000Z', 'fetched')).toEqual({
      sourceId: 'housing',
      owner: 'Student Housing and Residential Life Office (SHRLO)',
      url: 'https://shrl.hkust.edu.hk/',
      fetchedAt: '2026-08-28T00:00:00.000Z',
      freshness: 'fetched',
    });
  });
});

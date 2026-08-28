import { describe, expect, it } from 'vitest';

import { clearLocalProfile, loadLocalProfile, saveLocalProfile, type StorageLike } from '../apps/hub/lib/browser-profile.js';

function memoryStorage(): StorageLike {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

describe('Hub browser-local profile', () => {
  it('stores and clears only the minimal newcomer context in supplied browser storage', () => {
    const storage = memoryStorage();
    const profile = { level: 'ug', residency: 'non_local', housing: 'not_arranged', intakeTerm: 'fall' } as const;

    saveLocalProfile(storage, profile);
    expect(loadLocalProfile(storage)).toEqual(profile);
    clearLocalProfile(storage);
    expect(loadLocalProfile(storage)).toBeNull();
  });

  it('ignores malformed local data instead of treating it as a profile', () => {
    const storage = memoryStorage();
    storage.setItem('hkust-life-profile-v1', '{"level":"undergrad"}');

    expect(loadLocalProfile(storage)).toBeNull();
  });
});

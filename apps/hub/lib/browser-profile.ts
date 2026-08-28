export type BrowserNewcomerProfile = {
  level: 'ug' | 'rpg';
  residency: 'local' | 'non_local' | 'exchange';
  housing: 'on_campus' | 'off_campus' | 'not_arranged';
  intakeTerm: 'fall' | 'spring';
};

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const profileKey = 'hkust-life-profile-v1';

function isProfile(value: unknown): value is BrowserNewcomerProfile {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<BrowserNewcomerProfile>;
  return (candidate.level === 'ug' || candidate.level === 'rpg')
    && (candidate.residency === 'local' || candidate.residency === 'non_local' || candidate.residency === 'exchange')
    && (candidate.housing === 'on_campus' || candidate.housing === 'off_campus' || candidate.housing === 'not_arranged')
    && (candidate.intakeTerm === 'fall' || candidate.intakeTerm === 'spring');
}

export function loadLocalProfile(storage: StorageLike): BrowserNewcomerProfile | null {
  const raw = storage.getItem(profileKey);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isProfile(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveLocalProfile(storage: StorageLike, profile: BrowserNewcomerProfile): void {
  storage.setItem(profileKey, JSON.stringify(profile));
}

export function clearLocalProfile(storage: StorageLike): void {
  storage.removeItem(profileKey);
}

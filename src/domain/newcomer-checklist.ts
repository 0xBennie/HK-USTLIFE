import { findCampusService } from '../data/source-registry.js';

export type StudyLevel = 'ug' | 'rpg';
export type Residency = 'local' | 'non_local' | 'exchange';
export type HousingStatus = 'on_campus' | 'off_campus' | 'not_arranged';
export type IntakeTerm = 'fall' | 'spring';

export interface NewcomerProfile {
  level: StudyLevel;
  residency: Residency;
  housing: HousingStatus;
  intakeTerm: IntakeTerm;
}

export interface ChecklistItem {
  id: string;
  title: string;
  description: string;
  priority: 'urgent' | 'important' | 'normal';
  sourceId: string;
}

interface ChecklistRule extends ChecklistItem {
  applies(profile: NewcomerProfile): boolean;
}

const checklistRules: ChecklistRule[] = [
  {
    id: 'activate-network-account',
    title: 'Set up your HKUST network account',
    description: 'Confirm your student account, SSO and Wi-Fi access before depending on campus systems.',
    priority: 'urgent',
    sourceId: 'it-support',
    applies: () => true,
  },
  {
    id: 'arrange-housing',
    title: 'Arrange your accommodation',
    description: 'Check the official hall or off-campus housing process and its current deadline.',
    priority: 'urgent',
    sourceId: 'housing',
    applies: (profile) => profile.housing === 'not_arranged',
  },
  {
    id: 'review-academic-calendar',
    title: 'Check your academic calendar and registration dates',
    description: 'Save the current term dates, registration window and academic deadlines.',
    priority: 'important',
    sourceId: 'academic-registry',
    applies: () => true,
  },
  {
    id: 'review-international-arrival-support',
    title: 'Review international student support',
    description: 'Check official exchange, visa and arrival guidance that applies to your study status.',
    priority: 'important',
    sourceId: 'international',
    applies: (profile) => profile.residency === 'non_local' || profile.residency === 'exchange',
  },
];

export function buildNewcomerChecklist(profile: NewcomerProfile): ChecklistItem[] {
  return checklistRules
    .filter((rule) => rule.applies(profile))
    .map(({ applies: _applies, ...item }) => {
      findCampusService(item.sourceId);
      return item;
    });
}

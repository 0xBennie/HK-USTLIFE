import type { SkillDefinition } from '../../../src/domain/types';

export interface HubSkillCard {
  slug: string;
  title: string;
  description: string;
  href: string;
  installPath: string;
  tools: string[];
}

export function toHubSkillCards(skills: SkillDefinition[]): HubSkillCard[] {
  return skills.map((skill) => ({
    slug: skill.slug,
    title: skill.title,
    description: skill.description,
    href: `/skills/${skill.slug}`,
    installPath: skill.path,
    tools: [...skill.tools],
  }));
}

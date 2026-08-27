import type { SkillDefinition } from '../domain/types.js';

const skills: SkillDefinition[] = [
  {
    slug: 'hkust-today',
    title: 'HKUST Today',
    description: 'Turn a student schedule, weather and deadlines into a source-attributed plan for today.',
    path: 'skills/hkust-today',
    tools: ['hkust_build_today', 'hkust_plan_reminders'],
  },
  {
    slug: 'hkust-newcomer',
    title: 'HKUST Newcomer',
    description: 'Create a first-week checklist for a Clear Water Bay student from their study and housing context.',
    path: 'skills/hkust-newcomer',
    tools: ['hkust_build_newcomer_checklist'],
  },
  {
    slug: 'hkust-campus-status',
    title: 'HKUST Campus Status',
    description: 'Check official campus services, weather, transport and place information.',
    path: 'skills/hkust-campus-status',
    tools: ['hkust_search_services', 'hkust_get_weather', 'hkust_get_campus_updates'],
  },
  {
    slug: 'hkust-academic',
    title: 'HKUST Academic',
    description: 'Find official academic rules, registration contacts and deadline guidance without changing enrolment.',
    path: 'skills/hkust-academic',
    tools: ['hkust_search_services', 'hkust_get_campus_updates'],
  },
  {
    slug: 'hkust-opportunities',
    title: 'HKUST Opportunities',
    description: 'Discover official events, career, exchange and scholarship contacts that match a student goal.',
    path: 'skills/hkust-opportunities',
    tools: ['hkust_search_services', 'hkust_get_campus_updates'],
  },
  {
    slug: 'hkust-life-mcp',
    title: 'HKUST Life MCP',
    description: 'Route a broad HKUST Clear Water Bay request to the correct public campus tool with provenance.',
    path: 'skills/hkust-life-mcp',
    tools: ['hkust_search_services', 'hkust_get_weather', 'hkust_get_daily_brief'],
  },
];

export function listSkills(): SkillDefinition[] {
  return skills.map((skill) => ({ ...skill, tools: [...skill.tools] }));
}

export function findSkill(slug: string): SkillDefinition | undefined {
  const skill = skills.find((candidate) => candidate.slug === slug);
  return skill ? { ...skill, tools: [...skill.tools] } : undefined;
}

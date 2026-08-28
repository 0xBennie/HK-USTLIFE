import Link from 'next/link';

import type { HubSkillCard } from '../lib/catalog';

export function SkillCard({ skill }: { skill: HubSkillCard }) {
  return (
    <article className="skill-card">
      <p className="eyebrow">{skill.slug.replace('hkust-', '')}</p>
      <h2>{skill.title}</h2>
      <p>{skill.description}</p>
      <div className="tool-list" aria-label={`${skill.title} MCP tools`}>
        {skill.tools.map((tool) => <code key={tool}>{tool}</code>)}
      </div>
      <Link className="text-link" href={skill.href}>Open Skill <span aria-hidden="true">→</span></Link>
    </article>
  );
}

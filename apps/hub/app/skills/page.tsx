import type { Metadata } from 'next';

import { SkillCard } from '../../components/skill-card';
import { toHubSkillCards } from '../../lib/catalog';
import { listSkills } from '../../../../src/data/skills-catalog';

export const metadata: Metadata = { title: 'Skills catalogue', description: 'Install a focused HKUST Clear Water Bay student workflow.' };

export default function SkillsPage() {
  const skills = toHubSkillCards(listSkills());
  return (
    <section className="page-shell section-shell">
      <p className="eyebrow">Skills catalogue</p>
      <h1>Keep only the campus help you need.</h1>
      <p className="page-intro">Each Skill is a small instruction package for Codex, Claude Code or another compatible agent. It routes to public MCP tools for facts and keeps personal material local.</p>
      <div className="skills-grid full-grid">
        {skills.map((skill) => <SkillCard key={skill.slug} skill={skill} />)}
      </div>
    </section>
  );
}

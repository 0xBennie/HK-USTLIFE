import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { toHubSkillCards } from '../../../lib/catalog';
import { listSkills } from '../../../../../src/data/skills-catalog';

export function generateStaticParams() {
  return toHubSkillCards(listSkills()).map((skill) => ({ slug: skill.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const skill = toHubSkillCards(listSkills()).find((candidate) => candidate.slug === slug);
  return skill ? { title: skill.title, description: skill.description } : {};
}

export default async function SkillDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const skill = toHubSkillCards(listSkills()).find((candidate) => candidate.slug === slug);
  if (!skill) notFound();

  return (
    <section className="page-shell section-shell detail-layout">
      <div>
        <p className="eyebrow">Focused agent workflow</p>
        <h1>{skill.title}</h1>
        <p className="page-intro">{skill.description}</p>
      </div>
      <aside className="install-panel">
        <p className="eyebrow">Install from this public repository</p>
        <code>skills/{skill.slug}</code>
        <p>Copy this folder into your agent&apos;s local Skills directory. The package contains no credential or student data.</p>
        <p className="muted">Use a configured public HKUST Life MCP endpoint for live campus facts. Your personal timetable remains local.</p>
      </aside>
      <div className="detail-body">
        <h2>What it can use</h2>
        <ul>
          {skill.tools.map((tool) => <li key={tool}><code>{tool}</code></li>)}
        </ul>
        <h2>Before it acts</h2>
        <p>The Skill labels official data and its source. It asks for only the missing student context, and does not request passwords, MFA, cookies, QR logins or SIS credentials.</p>
        <Link className="text-link" href="/connect">Read the account boundary <span aria-hidden="true">→</span></Link>
      </div>
    </section>
  );
}

import Link from 'next/link';

import { SkillCard } from '../components/skill-card';
import { toHubSkillCards } from '../lib/catalog';
import { renderHomeModel } from '../lib/content';
import { listSkills } from '../../../src/data/skills-catalog';

export default function HomePage() {
  const model = renderHomeModel();
  const cards = toHubSkillCards(listSkills());

  return (
    <>
      <section className="hero section-shell">
        <div className="hero-copy">
          <p className="eyebrow light">Clear Water Bay · student field guide</p>
          <h1>Less scavenger hunt.<br /><em>More campus life.</em></h1>
          <p className="hero-deck">HKUST information is scattered across offices, portals and group chats. This is the quiet place to find the next real action—and the official source behind it.</p>
          <div className="hero-actions">
            <Link className="button button-gold" href={model.primaryAction.href}>{model.primaryAction.label} <span aria-hidden="true">→</span></Link>
            <Link className="button button-ghost" href="/plan">Plan a timetable</Link>
          </div>
        </div>
        <aside className="field-ticket" aria-label="What this Hub does">
          <div className="ticket-row"><span>01</span><p>Find the office<br />that actually owns it.</p></div>
          <div className="ticket-row"><span>02</span><p>See whether the<br />information is fresh.</p></div>
          <div className="ticket-row"><span>03</span><p>Keep your timetable<br />and account private.</p></div>
          <p className="ticket-stamp">STUDENT COPY<br />CWB / HKUST</p>
        </aside>
      </section>

      <section className="action-section section-shell" aria-labelledby="start-heading">
        <div className="section-heading">
          <p className="eyebrow">Choose your next move</p>
          <h2 id="start-heading">Start where you are.</h2>
        </div>
        <div className="action-grid">
          {model.actions.map((action) => (
            <Link className="action-card" href={action.href} key={action.href}>
              <span className="action-tag">{action.tag}</span>
              <h3>{action.label}</h3>
              <p>{action.description}</p>
              <span className="arrow" aria-hidden="true">→</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="trust-strip">
        <div className="section-shell trust-grid">
          <p><strong>Official first.</strong> ARO, CSO, Library, SHRLO and other owners stay attached to the answer.</p>
          <p><strong>Freshness shown.</strong> A missing live source is labeled unavailable, never quietly guessed.</p>
          <p><strong>Private by default.</strong> No password form. No shared mailbox, timetable or SIS data.</p>
        </div>
      </section>

      <section className="skills-preview section-shell" aria-labelledby="skills-heading">
        <div className="section-heading row-heading">
          <div>
            <p className="eyebrow">For the agent you already use</p>
            <h2 id="skills-heading">Seven focused Skills.</h2>
          </div>
          <Link className="text-link" href="/skills">See all Skills <span aria-hidden="true">→</span></Link>
        </div>
        <div className="skills-grid">
          {cards.slice(0, 3).map((skill) => <SkillCard key={skill.slug} skill={skill} />)}
        </div>
      </section>
    </>
  );
}

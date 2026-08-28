import type { Metadata } from 'next';
import Link from 'next/link';

import { NewcomerFlow } from '../../components/newcomer-flow';

export const metadata: Metadata = { title: 'Start at HKUST', description: 'A calm, source-linked first-week checklist for a new Clear Water Bay student.' };

export default function StartPage() {
  return (
    <section className="page-shell section-shell start-layout">
      <div>
        <p className="eyebrow">New here?</p>
        <h1>You do not need to learn every portal today.</h1>
        <p className="page-intro">Start with the things that block real life: account access, housing, your academic calendar and any support that applies to your status.</p>
      </div>
      <ol className="checklist-preview">
        <li><span>1</span><div><strong>Tell your agent four basics.</strong><p>Study level, residency, housing and intake term are enough to filter a first-week checklist.</p></div></li>
        <li><span>2</span><div><strong>Get only source-linked tasks.</strong><p>Each task names the HKUST office that owns the current policy or deadline.</p></div></li>
        <li><span>3</span><div><strong>Keep progress on your device.</strong><p>Your local completion list is not stored by this Hub.</p></div></li>
      </ol>
      <div className="callout">
        <p className="eyebrow">Try the Skill</p>
        <p>Ask your agent: <q>I just arrived at HKUST. What do I need to set up?</q></p>
        <Link className="button button-blue" href="/skills/hkust-newcomer">Open HKUST Newcomer</Link>
      </div>
      <div className="start-flow-wrap"><NewcomerFlow /></div>
    </section>
  );
}

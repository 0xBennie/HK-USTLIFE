import type { Metadata } from 'next';
import Link from 'next/link';

import { renderPlanModel } from '../../lib/content';
import { SourceBadge } from '../../components/source-badge';
import { IcsImport } from '../../components/ics-import';

export const metadata: Metadata = { title: 'Plan my timetable', description: 'Use a timetable screenshot and official ARO sections to make a safe HKUST course plan.' };

export default function PlanPage() {
  const plan = renderPlanModel();
  return (
    <section className="page-shell section-shell">
      <p className="eyebrow">Timetable &amp; course planning</p>
      <h1>Give AI the picture.<br />Keep control of the choices.</h1>
      <p className="page-intro">A screenshot is the fastest way to understand your current timetable. Official ARO course sections make the next-semester plan reliable.</p>

      <div className="plan-grid">
        <article className="plan-step">
          <span>01</span><h2>Drop in your timetable screenshot</h2>
          <p>Use the agent you are already chatting with. It extracts visible classes, times and rooms, then asks once if anything is unclear.</p>
          <p className="privacy-line">{plan.screenshotNotice}</p>
        </article>
        <article className="plan-step">
          <span>02</span><h2>Name your constraints</h2>
          <p>For example: compulsory courses, Friday free, no class before 10, an existing class, target credits, or times to avoid.</p>
        </article>
        <article className="plan-step">
          <span>03</span><h2>Compare official section bundles</h2>
          <p>The planner eliminates clashes and broken lecture/lab pairings, then ranks alternatives around your preferences.</p>
          <SourceBadge owner="Academic Registry Office (ARO)" freshness="official schedule source" />
        </article>
        <article className="plan-step">
          <span>04</span><h2>Confirm and submit yourself</h2>
          <p>{plan.enrollmentNotice}</p>
        </article>
      </div>

      <div className="callout plan-callout">
        <p className="eyebrow">Prompt to copy</p>
        <p><q>I need COMP2012 and MATH2011. Keep Friday free and avoid classes before 10. Read my timetable screenshot first, then use official ARO sections to show me the best options.</q></p>
        <Link className="button button-blue" href="/skills/hkust-course-planner">Open HKUST Course Planner</Link>
      </div>
      <IcsImport />
    </section>
  );
}

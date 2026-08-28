import type { Metadata } from 'next';

import { SourceBadge } from '../../components/source-badge';

export const metadata: Metadata = { title: 'Sources', description: 'See which official HKUST offices the Skills Hub relies on.' };

const sources = [
  ['Academic Registry Office (ARO)', 'Academic calendar, class schedule, course catalog and enrollment guidance.', 'https://registry.hkust.edu.hk/'],
  ['Campus Services Office (CSO)', 'Transport, food, commercial outlets and day-to-day facilities.', 'https://cso.hkust.edu.hk/'],
  ['HKUST Library', 'Service-point hours and study support.', 'https://library.hkust.edu.hk/service-points-hours?language_content_entity=en-gb'],
  ['Student Housing and Residential Life Office (SHRLO)', 'Hall applications, policies, check-in and housing notices.', 'https://shrl.hkust.edu.hk/'],
  ['Hong Kong Observatory (HKO)', 'Weather observations and warning signals used in Today.', 'https://www.hko.gov.hk/'],
];

export default function SourcesPage() {
  return (
    <section className="page-shell section-shell">
      <p className="eyebrow">Source governance</p>
      <h1>No anonymous “campus facts.”</h1>
      <p className="page-intro">Every public answer is tied to an allow-listed, Clear Water Bay source. If a live fetch fails, the Hub says so and leaves you the official link.</p>
      <div className="source-list">
        {sources.map(([owner, description, url]) => (
          <article className="source-row" key={owner}>
            <div><SourceBadge owner={owner} /><h2>{owner}</h2><p>{description}</p></div>
            <a className="text-link" href={url} target="_blank" rel="noreferrer">Open source <span aria-hidden="true">↗</span></a>
          </article>
        ))}
      </div>
    </section>
  );
}

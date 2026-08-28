import type { Metadata } from 'next';

import { renderConnectModel } from '../../lib/content';

export const metadata: Metadata = { title: 'Data & account boundary', description: 'Understand what this Hub can use today and what it will never request.' };

export default function ConnectPage() {
  const model = renderConnectModel();
  return (
    <section className="page-shell section-shell">
      <p className="eyebrow">Data &amp; account boundary</p>
      <h1>Your campus account is not a shortcut.</h1>
      <p className="page-intro">{model.privateDataNotice}</p>
      <div className="connector-grid">
        {model.connectors.map((connector) => (
          <article className="connector-card" key={connector.name}>
            <p className="eyebrow">{connector.status}</p>
            <h2>{connector.name}</h2>
            <p>{connector.detail}</p>
          </article>
        ))}
      </div>
      <div className="boundary-list">
        <div><strong>Public Hub can</strong><p>read allow-listed public sources, make a local planning proposal and show provenance.</p></div>
        <div><strong>Public Hub cannot</strong><p>read your inbox, calendar, Canvas or SIS; change a record; enroll, book, pay or send a notification.</p></div>
      </div>
    </section>
  );
}

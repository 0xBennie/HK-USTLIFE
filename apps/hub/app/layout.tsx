import type { Metadata, Viewport } from 'next';
import Link from 'next/link';

import './globals.css';

export const metadata: Metadata = {
  title: { default: 'HKUST, less scattered', template: '%s · HKUST Skills Hub' },
  description: 'A source-grounded Clear Water Bay student guide, skills catalogue and public MCP.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#073763',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <Link className="brand" href="/" aria-label="HKUST Skills Hub home">
            <span className="brand-mark" aria-hidden="true">HK</span>
            <span><strong>HKUST</strong><small>Clear Water Bay field guide</small></span>
          </Link>
          <nav aria-label="Main navigation">
            <Link href="/start">Start</Link>
            <Link href="/plan">Plan</Link>
            <Link href="/skills">Skills</Link>
            <Link href="/sources">Sources</Link>
          </nav>
        </header>
        <main>{children}</main>
        <footer className="site-footer">
          <p>Clear Water Bay only. Public facts link to their owner; your private information stays with you.</p>
          <Link href="/connect">Data &amp; account boundary</Link>
        </footer>
      </body>
    </html>
  );
}

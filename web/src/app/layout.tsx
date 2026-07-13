import type { Metadata } from 'next';
import './globals.css';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';

export const metadata: Metadata = {
  title: {
    default: 'SailorPath',
    template: '%s · SailorPath',
  },
  description:
    'Sailor career pages and official Singapore Optimist rankings — race history, trajectory, clubs, and regattas.',
  metadataBase: new URL('https://sailorpath.com'),
  openGraph: {
    siteName: 'SailorPath',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SiteHeader />
        <main>
          <div className="shell">{children}</div>
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}

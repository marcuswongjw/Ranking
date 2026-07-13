import Link from 'next/link';
import { getSnapshot } from '@/lib/snapshot';

export const metadata = { title: 'Clubs · SG Optimist' };

export default function ClubsPage() {
  const { clubs } = getSnapshot();

  return (
    <>
      <div className="eyebrow">Discovery</div>
      <h1>Clubs</h1>
      <p className="lede">Auto roster of ranked sailors by club from the official snapshot.</p>
      <div className="club-grid" style={{ marginTop: '1.5rem' }}>
        {clubs.map((c) => (
          <Link key={c.slug} href={`/sg/optimist/clubs/${c.slug}`} className="club-card">
            <strong>{c.name}</strong>
            <span>
              {c.members.length} sailor{c.members.length === 1 ? '' : 's'} in series window
            </span>
          </Link>
        ))}
      </div>
    </>
  );
}

import Link from 'next/link';
import { getFleet, getSnapshot } from '@/lib/snapshot';

export const metadata = {
  title: 'Singapore Optimist',
};

export const revalidate = 60;

export default async function SeriesHubPage() {
  const snap = await getSnapshot();
  const gold = getFleet(snap, 'gold');
  const silver = getFleet(snap, 'silver');

  return (
    <>
      <div className="eyebrow">Singapore · Optimist</div>
      <h1>Choose a fleet series</h1>
      <p className="lede">
        Gold and Silver are ranked separately (best {snap.meta.bestOf} of last{' '}
        {snap.meta.rankingWindow} in each fleet). Official data source:{' '}
        <strong>{snap.meta.source}</strong>
        {snap.meta.exportedAt
          ? ` · updated ${new Date(snap.meta.exportedAt).toLocaleString('en-SG')}`
          : ''}
        .
      </p>

      <div className="club-grid" style={{ marginTop: '1.75rem' }}>
        <Link href="/sg/optimist/gold" className="club-card fleet-card-gold">
          <strong>Gold Fleet</strong>
          <span>
            {gold.standings.length} sailors · {gold.regattas.length} regattas
          </span>
          <span className="fleet-card-cta">Open standings →</span>
        </Link>
        <Link href="/sg/optimist/silver" className="club-card fleet-card-silver">
          <strong>Silver Fleet</strong>
          <span>
            {silver.standings.length} sailors · {silver.regattas.length} regattas
          </span>
          <span className="fleet-card-cta">
            {silver.standings.length ? 'Open standings →' : 'Ready when you add silver regattas →'}
          </span>
        </Link>
      </div>

      <div className="hero-actions" style={{ marginTop: '1.5rem' }}>
        <Link className="btn btn-primary" href="/sg/optimist/rankings">
          Open ranking tool
        </Link>
        <Link className="btn btn-secondary" href="/demo">
          Sample profile
        </Link>
      </div>
    </>
  );
}

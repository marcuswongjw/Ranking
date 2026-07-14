import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getFleet, getSnapshot, isFleetId, seriesBase } from '@/lib/snapshot';
import { FLEET_LABELS, type FleetId } from '@/lib/types';

export const revalidate = 60;

export function generateStaticParams() {
  return [{ fleet: 'gold' }, { fleet: 'silver' }];
}

export async function generateMetadata({ params }: { params: Promise<{ fleet: string }> }) {
  const { fleet } = await params;
  if (!isFleetId(fleet)) return { title: 'Clubs' };
  return { title: `Clubs · ${FLEET_LABELS[fleet]}` };
}

export default async function FleetClubsPage({ params }: { params: Promise<{ fleet: string }> }) {
  const { fleet: fleetParam } = await params;
  if (!isFleetId(fleetParam)) notFound();
  const fleet = fleetParam as FleetId;
  const snap = await getSnapshot();
  const { clubs } = getFleet(snap, fleet);
  const base = seriesBase('sg', 'optimist', fleet);

  return (
    <>
      <div className="eyebrow">{FLEET_LABELS[fleet]} · Clubs</div>
      <h1>Clubs</h1>
      <p className="lede">
        Sailors in the {FLEET_LABELS[fleet].toLowerCase()} ranking window.{' '}
        <Link className="name-link" href={base}>
          ← Standings
        </Link>
      </p>
      <div className="club-grid" style={{ marginTop: '1.5rem' }}>
        {clubs.map((c) => (
          <Link key={c.slug} href={`${base}/clubs/${c.slug}`} className="club-card">
            <strong>{c.name}</strong>
            <span>
              {c.members.length} sailor{c.members.length === 1 ? '' : 's'}
            </span>
          </Link>
        ))}
        {!clubs.length && <p className="muted">No clubs yet for this fleet.</p>}
      </div>
    </>
  );
}

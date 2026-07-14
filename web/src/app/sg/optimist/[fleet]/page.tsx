import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getFleet, getSnapshot, isFleetId, seriesBase } from '@/lib/snapshot';
import { SquadBadge } from '@/components/SquadBadge';
import { FLEET_LABELS, type FleetId } from '@/lib/types';

export const revalidate = 60;

export function generateStaticParams() {
  return [{ fleet: 'gold' }, { fleet: 'silver' }];
}

export async function generateMetadata({ params }: { params: Promise<{ fleet: string }> }) {
  const { fleet } = await params;
  if (!isFleetId(fleet)) return { title: 'Fleet' };
  return { title: `${FLEET_LABELS[fleet]} · SG Optimist` };
}

export default async function FleetStandingsPage({
  params,
}: {
  params: Promise<{ fleet: string }>;
}) {
  const { fleet: fleetParam } = await params;
  if (!isFleetId(fleetParam)) notFound();
  const fleet = fleetParam as FleetId;
  const snap = await getSnapshot();
  const bundle = getFleet(snap, fleet);
  const base = seriesBase('sg', 'optimist', fleet);
  const other: FleetId = fleet === 'gold' ? 'silver' : 'gold';

  return (
    <>
      <div className="eyebrow">SG Optimist · {FLEET_LABELS[fleet]}</div>
      <h1>{FLEET_LABELS[fleet]} standings</h1>
      <p className="lede">
        Best {snap.meta.bestOf} of last {snap.meta.rankingWindow} {FLEET_LABELS[fleet].toLowerCase()}{' '}
        selection regattas. Source: {snap.meta.source}.
      </p>
      <div className="hero-actions">
        <Link className="btn btn-primary" href={`${base}/regattas`}>
          Regattas
        </Link>
        <Link className="btn btn-secondary" href={`${base}/clubs`}>
          Clubs
        </Link>
        <Link className="btn btn-secondary" href={`/sg/optimist/${other}`}>
          Switch to {FLEET_LABELS[other]}
        </Link>
        <Link className="btn btn-secondary" href="/sg/optimist/rankings">
          Ranking tool
        </Link>
      </div>

      {!bundle.standings.length ? (
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <p className="muted" style={{ margin: 0 }}>
            No {FLEET_LABELS[fleet].toLowerCase()} results in the official snapshot yet. In the ranking
            tool, add regattas with Fleet = {FLEET_LABELS[fleet]}, enter results, and save — SailorPath
            updates from Firestore automatically.
          </p>
        </div>
      ) : (
        <div className="table-wrap" style={{ marginTop: '1.5rem' }}>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Sailor</th>
                <th>Club</th>
                <th>Age band</th>
                <th>Squad</th>
                <th>Score</th>
              </tr>
            </thead>
            <tbody>
              {bundle.standings.map((s) => (
                <tr key={s.slug}>
                  <td>{s.rank}</td>
                  <td>
                    <Link className="name-link" href={`/s/${s.slug}`}>
                      {s.name}
                    </Link>
                  </td>
                  <td>{s.club || '—'}</td>
                  <td>{s.ageBand || '—'}</td>
                  <td>
                    <SquadBadge squad={s.squad} />
                  </td>
                  <td>{s.score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

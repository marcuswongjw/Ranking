import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getClub, getFleet, getSnapshot, isFleetId, seriesBase } from '@/lib/snapshot';
import { SquadBadge } from '@/components/SquadBadge';
import { FLEET_LABELS, type FleetId } from '@/lib/types';

export const revalidate = 60;

export async function generateStaticParams() {
  const snap = await getSnapshot();
  const params: { fleet: string; slug: string }[] = [];
  for (const fleet of ['gold', 'silver'] as FleetId[]) {
    for (const c of getFleet(snap, fleet).clubs) {
      params.push({ fleet, slug: c.slug });
    }
  }
  return params;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ fleet: string; slug: string }>;
}) {
  const { fleet, slug } = await params;
  if (!isFleetId(fleet)) return { title: 'Club' };
  const club = await getClub(fleet, slug);
  return { title: club ? `${club.name} · ${FLEET_LABELS[fleet]}` : 'Club' };
}

export default async function ClubDetailPage({
  params,
}: {
  params: Promise<{ fleet: string; slug: string }>;
}) {
  const { fleet: fleetParam, slug } = await params;
  if (!isFleetId(fleetParam)) notFound();
  const fleet = fleetParam as FleetId;
  const club = await getClub(fleet, slug);
  if (!club) notFound();
  const base = seriesBase('sg', 'optimist', fleet);

  return (
    <>
      <div className="eyebrow">
        {FLEET_LABELS[fleet]} · Club
      </div>
      <h1>{club.name}</h1>
      <p className="lede">
        {club.members.length} sailors in this fleet window.{' '}
        <Link className="name-link" href={`${base}/clubs`}>
          ← Clubs
        </Link>
      </p>
      <div className="table-wrap" style={{ marginTop: '1.5rem' }}>
        <table>
          <thead>
            <tr>
              <th>Rank</th>
              <th>Sailor</th>
              <th>Age</th>
              <th>Squad</th>
              <th>Score</th>
            </tr>
          </thead>
          <tbody>
            {club.members.map((m) => (
              <tr key={m.slug}>
                <td>{m.rank}</td>
                <td>
                  <Link className="name-link" href={`/s/${m.slug}`}>
                    {m.name}
                  </Link>
                </td>
                <td>{m.ageBand || '—'}</td>
                <td>
                  <SquadBadge squad={m.squad} />
                </td>
                <td>{m.score}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

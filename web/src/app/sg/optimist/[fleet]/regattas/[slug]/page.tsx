import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getFleet, getRegatta, getSnapshot, isFleetId, seriesBase } from '@/lib/snapshot';
import { formatDate } from '@/lib/format';
import { FLEET_LABELS, type FleetId } from '@/lib/types';

export const revalidate = 60;

export async function generateStaticParams() {
  const snap = await getSnapshot();
  const params: { fleet: string; slug: string }[] = [];
  for (const fleet of ['gold', 'silver'] as FleetId[]) {
    for (const r of getFleet(snap, fleet).regattas) {
      params.push({ fleet, slug: r.slug });
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
  if (!isFleetId(fleet)) return { title: 'Regatta' };
  const reg = await getRegatta(fleet, slug);
  return { title: reg ? reg.name : 'Regatta' };
}

export default async function RegattaDetailPage({
  params,
}: {
  params: Promise<{ fleet: string; slug: string }>;
}) {
  const { fleet: fleetParam, slug } = await params;
  if (!isFleetId(fleetParam)) notFound();
  const fleet = fleetParam as FleetId;
  const reg = await getRegatta(fleet, slug);
  if (!reg) notFound();
  const base = seriesBase('sg', 'optimist', fleet);

  return (
    <>
      <div className="eyebrow">
        {FLEET_LABELS[fleet]} · Regatta
      </div>
      <h1>{reg.name}</h1>
      <p className="lede">
        {formatDate(reg.date)} · fleet size {reg.fleetSize} ·{' '}
        <span className={`badge ${fleet === 'silver' ? 'badge-b' : 'badge-a'}`}>
          {FLEET_LABELS[fleet]}
        </span>{' '}
        <span className="badge badge-official">Official series</span>
      </p>
      <p>
        <Link className="name-link" href={`${base}/regattas`}>
          ← All {FLEET_LABELS[fleet].toLowerCase()} regattas
        </Link>
      </p>
      <div className="table-wrap" style={{ marginTop: '1.5rem' }}>
        <table>
          <thead>
            <tr>
              <th>Rank</th>
              <th>Sailor</th>
              <th>Club</th>
              <th>Nett points</th>
            </tr>
          </thead>
          <tbody>
            {reg.results.map((row, i) => (
              <tr key={`${row.name}-${i}`}>
                <td>{row.place != null ? row.place : '—'}</td>
                <td>
                  {row.sailorSlug ? (
                    <Link className="name-link" href={`/s/${row.sailorSlug}`}>
                      {row.name}
                    </Link>
                  ) : (
                    row.name
                  )}
                </td>
                <td>{row.club || '—'}</td>
                <td>{row.nett ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

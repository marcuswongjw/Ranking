import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getFleet, getSnapshot, isFleetId, seriesBase } from '@/lib/snapshot';
import { formatDate } from '@/lib/format';
import { FLEET_LABELS, type FleetId } from '@/lib/types';

export const revalidate = 60;

export function generateStaticParams() {
  return [{ fleet: 'gold' }, { fleet: 'silver' }];
}

export async function generateMetadata({ params }: { params: Promise<{ fleet: string }> }) {
  const { fleet } = await params;
  if (!isFleetId(fleet)) return { title: 'Regattas' };
  return { title: `Regattas · ${FLEET_LABELS[fleet]}` };
}

export default async function FleetRegattasPage({
  params,
}: {
  params: Promise<{ fleet: string }>;
}) {
  const { fleet: fleetParam } = await params;
  if (!isFleetId(fleetParam)) notFound();
  const fleet = fleetParam as FleetId;
  const snap = await getSnapshot();
  const { regattas } = getFleet(snap, fleet);
  const sorted = [...regattas].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const base = seriesBase('sg', 'optimist', fleet);

  return (
    <>
      <div className="eyebrow">{FLEET_LABELS[fleet]} · Regattas</div>
      <h1>Regattas</h1>
      <p className="lede">
        Selection events in this fleet only.{' '}
        <Link className="name-link" href={base}>
          ← Standings
        </Link>
      </p>
      <div className="table-wrap" style={{ marginTop: '1.5rem' }}>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Event</th>
              <th>Fleet size</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.slug}>
                <td>{formatDate(r.date)}</td>
                <td>
                  <Link className="name-link" href={`${base}/regattas/${r.slug}`}>
                    {r.name}
                  </Link>
                </td>
                <td>{r.fleetSize}</td>
                <td>
                  <Link href={`${base}/regattas/${r.slug}`}>View →</Link>
                </td>
              </tr>
            ))}
            {!sorted.length && (
              <tr>
                <td colSpan={4} className="muted">
                  No regattas yet for {FLEET_LABELS[fleet]}.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

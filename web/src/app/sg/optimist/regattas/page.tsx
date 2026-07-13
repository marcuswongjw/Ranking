import Link from 'next/link';
import { getSnapshot } from '@/lib/snapshot';
import { formatDate } from '@/lib/format';

export const metadata = { title: 'Regattas · SG Optimist' };

export default function RegattasPage() {
  const { regattas } = getSnapshot();
  const sorted = [...regattas].sort((a, b) => String(b.date).localeCompare(String(a.date)));

  return (
    <>
      <div className="eyebrow">Discovery</div>
      <h1>Regattas</h1>
      <p className="lede">Every scored event in the snapshot. Open a regatta for full results.</p>
      <div className="table-wrap" style={{ marginTop: '1.5rem' }}>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Event</th>
              <th>Fleet</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.slug}>
                <td>{formatDate(r.date)}</td>
                <td>
                  <Link className="name-link" href={`/sg/optimist/regattas/${r.slug}`}>
                    {r.name}
                  </Link>
                </td>
                <td>{r.fleetSize}</td>
                <td>
                  <Link href={`/sg/optimist/regattas/${r.slug}`}>View →</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

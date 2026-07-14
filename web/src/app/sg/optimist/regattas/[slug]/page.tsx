import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getRegatta, getSnapshot } from '@/lib/snapshot';
import { formatDate } from '@/lib/format';

export function generateStaticParams() {
  return getSnapshot().regattas.map((r) => ({ slug: r.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const reg = getRegatta(slug);
  return { title: reg ? reg.name : 'Regatta' };
}

export default async function RegattaDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const reg = getRegatta(slug);
  if (!reg) notFound();

  return (
    <>
      <div className="eyebrow">Regatta · SG Optimist</div>
      <h1>{reg.name}</h1>
      <p className="lede">
        {formatDate(reg.date)} · fleet size {reg.fleetSize} ·{' '}
        <span className="badge badge-official">Official series</span>
      </p>
      <div className="table-wrap" style={{ marginTop: '1.5rem' }}>
        <table>
          <thead>
            <tr>
              <th>Rank</th>
              <th>Sailor</th>
              <th>Club</th>
              <th>Nett</th>
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

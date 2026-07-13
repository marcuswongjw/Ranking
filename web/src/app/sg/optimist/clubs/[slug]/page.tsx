import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getClub, getSnapshot } from '@/lib/snapshot';
import { SquadBadge } from '@/components/SquadBadge';

export function generateStaticParams() {
  return getSnapshot().clubs.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const club = getClub(slug);
  return { title: club ? `${club.name} · Club` : 'Club' };
}

export default async function ClubDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const club = getClub(slug);
  if (!club) notFound();

  return (
    <>
      <div className="eyebrow">Club · SG Optimist</div>
      <h1>{club.name}</h1>
      <p className="lede">{club.members.length} sailors currently in the ranking window.</p>
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

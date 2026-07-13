import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSailor, getSnapshot } from '@/lib/snapshot';
import { formatDate, formatPlace } from '@/lib/format';
import { SquadBadge } from '@/components/SquadBadge';
import { TrajectoryChart } from '@/components/TrajectoryChart';

export function generateStaticParams() {
  return getSnapshot().sailors.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const sailor = getSailor(slug);
  if (!sailor) return { title: 'Sailor' };
  return {
    title: sailor.name,
    description: `${sailor.name} · Singapore Optimist · rank #${sailor.rank} · SailorPath`,
  };
}

export default async function SailorProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const sailor = getSailor(slug);
  if (!sailor) notFound();

  const initials = sailor.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('');

  const bestPlace = sailor.results
    .filter((r) => r.place != null && !r.didNotSail)
    .map((r) => r.place as number)
    .sort((a, b) => a - b)[0];

  return (
    <>
      <div className="card profile-hero">
        <div className="avatar" aria-hidden>
          {initials || 'SP'}
        </div>
        <div>
          <div className="eyebrow">SailorPath · SG Optimist</div>
          <h1>{sailor.name}</h1>
          <div className="profile-meta">
            {sailor.club && <span className="chip">{sailor.club}</span>}
            {sailor.ageBand && <span className="chip">Age band {sailor.ageBand}</span>}
            <SquadBadge squad={sailor.squad} />
            <span className="badge badge-official">Official series</span>
          </div>
        </div>
        <div className="rank-pill">
          <strong>#{sailor.rank}</strong>
          <span>National rank</span>
          <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
            Best-3: {sailor.score}
          </div>
        </div>
      </div>

      <div className="grid-2">
        <section className="card">
          <h2>Trajectory</h2>
          <p className="sub">Rank and best-3 score over the series window</p>
          <TrajectoryChart data={sailor.trajectory} />
        </section>
        <section className="card">
          <h2>Personal bests</h2>
          <p className="sub">From official series results only</p>
          <div className="stat-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div className="stat">
              <strong>#{sailor.rank}</strong>
              <span>Current rank</span>
            </div>
            <div className="stat">
              <strong>{sailor.score}</strong>
              <span>Best-3 score</span>
            </div>
            <div className="stat">
              <strong>{bestPlace != null ? formatPlace(bestPlace) : '—'}</strong>
              <span>Best finish (window)</span>
            </div>
            <div className="stat">
              <strong>{sailor.results.filter((r) => !r.didNotSail).length}</strong>
              <span>Events scored</span>
            </div>
          </div>
          <p className="muted" style={{ marginTop: '1rem', fontSize: '0.85rem' }}>
            Birth year is never shown. Self-reported overseas results and claimable usernames
            (sailorpath.com/you) arrive in the next phase.
          </p>
          <p style={{ marginTop: '0.75rem' }}>
            <Link className="name-link" href="/sg/optimist/rankings">
              View live ranking tool →
            </Link>
          </p>
        </section>
      </div>

      <section className="card section">
        <h2>Race history</h2>
        <p className="sub">Ranking-window regattas · place of fleet size</p>
        <div className="timeline">
          {[...sailor.results].reverse().map((r) => (
            <div key={r.regattaId} className="timeline-item">
              <div>
                <strong>
                  <Link className="name-link" href={`/sg/optimist/regattas/${r.regattaId}`}>
                    {r.regattaName}
                  </Link>
                </strong>
                <span>
                  {formatDate(r.date)}
                  {r.didNotSail ? ' · DNS / not sailed' : ''}
                </span>
              </div>
              <div className="place">
                {r.didNotSail ? '—' : formatPlace(r.place, r.fleetSize)}
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

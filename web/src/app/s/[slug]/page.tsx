import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSailor, getSnapshot } from '@/lib/snapshot';
import { formatDate } from '@/lib/format';
import { SquadBadge } from '@/components/SquadBadge';
import { TrajectoryChart } from '@/components/TrajectoryChart';
import { FLEET_LABELS, type FleetId } from '@/lib/types';

export const revalidate = 60;

export async function generateStaticParams() {
  const snap = await getSnapshot();
  return snap.sailors.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const sailor = await getSailor(slug);
  if (!sailor) return { title: 'Sailor' };
  return {
    title: sailor.name,
    description: `${sailor.name} · Singapore Optimist · SailorPath`,
  };
}

export default async function SailorProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const sailor = await getSailor(slug);
  if (!sailor) notFound();

  const initials = sailor.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('');

  const fleetIds = (Object.keys(sailor.fleets || {}) as FleetId[]).filter(
    (f) => f === 'gold' || f === 'silver'
  );
  // Prefer showing gold first
  fleetIds.sort((a, b) => (a === 'gold' ? -1 : b === 'gold' ? 1 : a.localeCompare(b)));

  const primary = fleetIds[0] ? sailor.fleets[fleetIds[0]] : null;

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
            {fleetIds.map((f) => (
              <span key={f} className={`badge ${f === 'silver' ? 'badge-b' : 'badge-a'}`}>
                {FLEET_LABELS[f]}
              </span>
            ))}
            <span className="badge badge-official">Official series</span>
          </div>
        </div>
        {primary && (
          <div className="rank-pill">
            <strong>#{primary.rank}</strong>
            <span>{fleetIds[0] ? FLEET_LABELS[fleetIds[0]] : 'Rank'}</span>
            <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
              Best-3: {primary.score}
            </div>
          </div>
        )}
      </div>

      {fleetIds.map((fleetId) => {
        const block = sailor.fleets[fleetId];
        if (!block) return null;
        const bestPlace = block.results
          .filter((r) => r.place != null && !r.didNotSail)
          .map((r) => r.place as number)
          .sort((a, b) => a - b)[0];

        return (
          <div key={fleetId} className="section">
            <div className="section-head">
              <div>
                <h2>{FLEET_LABELS[fleetId]}</h2>
                <p>
                  Rank #{block.rank} · best-3 {block.score} ·{' '}
                  <Link className="name-link" href={`/sg/optimist/${fleetId}`}>
                    Full standings
                  </Link>
                </p>
              </div>
              <SquadBadge squad={block.squad} />
            </div>

            <div className="grid-2">
              <section className="card">
                <h2>Trajectory</h2>
                <p className="sub">{FLEET_LABELS[fleetId]} series window</p>
                <TrajectoryChart data={block.trajectory} />
              </section>
              <section className="card">
                <h2>Personal bests</h2>
                <p className="sub">Official {FLEET_LABELS[fleetId].toLowerCase()} only</p>
                <div className="stat-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                  <div className="stat">
                    <strong>#{block.rank}</strong>
                    <span>Current rank</span>
                  </div>
                  <div className="stat">
                    <strong>{block.score}</strong>
                    <span>Best-3 score</span>
                  </div>
                  <div className="stat">
                    <strong>{bestPlace != null ? bestPlace : '—'}</strong>
                    <span>Best finish</span>
                  </div>
                  <div className="stat">
                    <strong>{block.results.filter((r) => !r.didNotSail).length}</strong>
                    <span>Events scored</span>
                  </div>
                </div>
              </section>
            </div>

            <section className="card" style={{ marginTop: '1.25rem' }}>
              <h2>Race history</h2>
              <p className="sub">{FLEET_LABELS[fleetId]} · finish rank</p>
              <div className="timeline">
                {[...block.results].reverse().map((r) => (
                  <div key={r.regattaId + fleetId} className="timeline-item">
                    <div>
                      <strong>
                        <Link
                          className="name-link"
                          href={`/sg/optimist/${fleetId}/regattas/${r.regattaId}`}
                        >
                          {r.regattaName}
                        </Link>
                      </strong>
                      <span>
                        {formatDate(r.date)}
                        {r.didNotSail ? ' · DNS / not sailed' : ''}
                        {r.fleetSize ? ` · fleet ${r.fleetSize}` : ''}
                      </span>
                    </div>
                    <div className="place">
                      {r.didNotSail || r.place == null ? '—' : r.place}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        );
      })}

      {!fleetIds.length && (
        <div className="card">
          <p className="muted" style={{ margin: 0 }}>
            No fleet results linked yet.
          </p>
        </div>
      )}
    </>
  );
}

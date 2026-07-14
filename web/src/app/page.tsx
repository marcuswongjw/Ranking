import Link from 'next/link';
import { getSnapshot, seriesBase } from '@/lib/snapshot';
import { SquadBadge } from '@/components/SquadBadge';

export default function HomePage() {
  const snap = getSnapshot();
  const top = snap.standings.slice(0, 10);
  const base = seriesBase(snap.meta.country, snap.meta.classSlug);

  return (
    <>
      <section className="hero">
        <div>
          <div className="eyebrow">SailorPath · Singapore Optimist</div>
          <h1>Every race, kept.</h1>
          <p className="lede">
            Official series standings and sailor career pages — starting with Singapore Optimist.
            Profiles show trajectory, results, and club context. Claim & personal media come next.
          </p>
          <div className="hero-actions">
            <Link className="btn btn-primary" href={`${base}/rankings`}>
              Open rankings
            </Link>
            <Link className="btn btn-secondary" href={`${base}/regattas`}>
              Browse regattas
            </Link>
            <Link className="btn btn-secondary" href="/demo">
              Sample profile
            </Link>
          </div>
        </div>
        <div className="hero-card">
          <div className="stat-grid">
            <div className="stat">
              <strong>{snap.sailors.length}</strong>
              <span>Sailors</span>
            </div>
            <div className="stat">
              <strong>{snap.regattas.length}</strong>
              <span>Regattas</span>
            </div>
            <div className="stat">
              <strong>{snap.clubs.length}</strong>
              <span>Clubs</span>
            </div>
          </div>
          <p className="muted" style={{ marginTop: '1rem', fontSize: '0.85rem' }}>
            Snapshot {new Date(snap.meta.exportedAt).toLocaleString('en-SG')} · best{' '}
            {snap.meta.bestOf} of last {snap.meta.rankingWindow}
          </p>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <div>
            <h2>Current standings</h2>
            <p>Top of the national Optimist series window · click a name for their SailorPath</p>
          </div>
          <Link className="btn btn-secondary" href={base}>
            Full board
          </Link>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Sailor</th>
                <th>Club</th>
                <th>Age</th>
                <th>Squad</th>
                <th>Best-3</th>
              </tr>
            </thead>
            <tbody>
              {top.map((s) => (
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
      </section>
    </>
  );
}

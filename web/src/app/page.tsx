import Link from 'next/link';
import { getFleet, getSnapshot } from '@/lib/snapshot';
import { SquadBadge } from '@/components/SquadBadge';

export const revalidate = 60;

export default async function HomePage() {
  const snap = await getSnapshot();
  const gold = getFleet(snap, 'gold');
  const silver = getFleet(snap, 'silver');
  const top = gold.standings.slice(0, 10);

  return (
    <>
      <section className="hero">
        <div>
          <div className="eyebrow">SailorPath · Singapore Optimist</div>
          <h1>Every race, kept.</h1>
          <p className="lede">
            Official Gold and Silver fleet series, sailor career pages, and the live ranking tool —
            starting with Singapore Optimist.
          </p>
          <div className="hero-actions">
            <Link className="btn btn-primary" href="/sg/optimist/gold">
              Gold standings
            </Link>
            <Link className="btn btn-secondary" href="/sg/optimist/silver">
              Silver standings
            </Link>
            <Link className="btn btn-secondary" href="/demo">
              Sample profile
            </Link>
          </div>
        </div>
        <div className="hero-card">
          <div className="stat-grid">
            <div className="stat">
              <strong>{gold.standings.length}</strong>
              <span>Gold sailors</span>
            </div>
            <div className="stat">
              <strong>{silver.standings.length}</strong>
              <span>Silver sailors</span>
            </div>
            <div className="stat">
              <strong>{gold.regattas.length + silver.regattas.length}</strong>
              <span>Regattas</span>
            </div>
          </div>
          <p className="muted" style={{ marginTop: '1rem', fontSize: '0.85rem' }}>
            Data: {snap.meta.source}
            {snap.meta.exportedAt
              ? ` · ${new Date(snap.meta.exportedAt).toLocaleString('en-SG')}`
              : ''}
          </p>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <div>
            <h2>Gold fleet · current standings</h2>
            <p>Top of the Gold series window · click a name for their SailorPath</p>
          </div>
          <Link className="btn btn-secondary" href="/sg/optimist/gold">
            Full Gold board
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

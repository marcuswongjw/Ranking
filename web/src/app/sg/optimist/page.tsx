import Link from 'next/link';
import { getSnapshot } from '@/lib/snapshot';
import { SquadBadge } from '@/components/SquadBadge';

export const metadata = {
  title: 'Singapore Optimist',
};

export default function SeriesHomePage() {
  const snap = getSnapshot();
  const base = '/sg/optimist';

  return (
    <>
      <div className="eyebrow">Series</div>
      <h1>Singapore · Optimist</h1>
      <p className="lede">
        National series standings (best {snap.meta.bestOf} of last {snap.meta.rankingWindow}),
        regatta results, and club rosters. Sailor pages link from every name.
      </p>
      <div className="hero-actions">
        <Link className="btn btn-primary" href={`${base}/rankings`}>
          Live ranking tool
        </Link>
        <Link className="btn btn-secondary" href={`${base}/regattas`}>
          Regattas
        </Link>
        <Link className="btn btn-secondary" href={`${base}/clubs`}>
          Clubs
        </Link>
      </div>

      <section className="section">
        <div className="section-head">
          <div>
            <h2>Standings</h2>
            <p>From official snapshot · not editable on SailorPath</p>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Sailor</th>
                <th>Club</th>
                <th>Age band</th>
                <th>Squad</th>
                <th>Score</th>
              </tr>
            </thead>
            <tbody>
              {snap.standings.map((s) => (
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

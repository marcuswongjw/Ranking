import Image from 'next/image';
import Link from 'next/link';
import { SquadBadge } from '@/components/SquadBadge';

export const revalidate = 60;

/** Demo-only counters & profiles for the marketing homepage (privacy). */
const DEMO_STATS = {
  sailors: 187,
  regattas: 42,
  upcoming: 6,
};

const FEATURED = [
  {
    name: 'Alex Reyes',
    handle: 'alex-reyes',
    sail: 'SGP 115',
    club: 'SAFYC',
    fleet: 'Gold',
    squad: 'Nat A' as const,
    rank: 6,
    note: 'National squad · demo',
    href: '/demo',
    photo: '/demo/headshot.jpg',
  },
  {
    name: 'Jordan Tan',
    handle: 'jordan-tan',
    sail: 'SGP 208',
    club: 'CSC',
    fleet: 'Gold',
    squad: 'Nat B' as const,
    rank: 24,
    note: 'Club pathway · demo',
    href: '/demo',
    photo: '/demo/action.jpg',
  },
  {
    name: 'Maya Lim',
    handle: 'maya-lim',
    sail: 'SGP 041',
    club: 'RMYC',
    fleet: 'Silver',
    squad: 'DS' as const,
    rank: 12,
    note: 'Silver fleet · demo',
    href: '/demo',
    photo: '/demo/race-reach.jpg',
  },
];

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="home-hero">
        <div className="home-hero-bg" aria-hidden>
          <Image
            src="/home/hero-fleet.jpg"
            alt=""
            fill
            priority
            sizes="100vw"
            className="demo-img-cover"
          />
          <div className="home-hero-scrim" />
        </div>
        <div className="home-hero-inner shell">
          <div className="home-hero-copy">
            <div className="eyebrow home-eyebrow">SailorPath · Singapore Optimist</div>
            <h1>Your sailing legacy, charted.</h1>
            <p className="lede home-lede">
              The digital logbook for competitive youth sailors to track fleet progressions, coordinate
              training plans, and analyze regatta results across local, regional, and international
              regattas.
            </p>
            <div className="hero-actions">
              <Link className="btn btn-primary btn-lg" href="/demo">
                Claim your handle
              </Link>
              <Link className="btn btn-ghost" href="/sg/optimist/gold">
                Browse live standings
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Live fleet stats (demo numbers for privacy on marketing surface) */}
      <section className="shell home-stats-band">
        <div className="home-stats">
          <div className="home-stat">
            <strong>{DEMO_STATS.sailors}</strong>
            <span>Active sailors tracked</span>
          </div>
          <div className="home-stat">
            <strong>{DEMO_STATS.regattas}</strong>
            <span>Regattas on the platform</span>
          </div>
          <div className="home-stat">
            <strong>{DEMO_STATS.upcoming}</strong>
            <span>Upcoming national events</span>
          </div>
        </div>
        <p className="home-stats-note">
          Marketing counters use sample figures. Official series data lives on the fleet boards.
        </p>
      </section>

      {/* Value props */}
      <section className="shell section home-value">
        <div className="section-head">
          <div>
            <h2>Why SailorPath</h2>
            <p>Built for the whole Optimist community — on the water and on shore.</p>
          </div>
        </div>
        <div className="home-value-grid">
          <article className="card home-value-card">
            <div className="home-value-icon" aria-hidden>
              🏆
            </div>
            <h3>For sailors</h3>
            <p>
              Your digital trophy cabinet: Gold or Silver fleet status, National Squad badges, and the
              kit you race — hull, sail, and foils — on a page that looks like you.
            </p>
            <div className="home-mock-cabinet">
              <span className="badge badge-a">Gold Fleet</span>
              <SquadBadge squad="Nat A" />
              <span className="chip">Winner hull</span>
              <span className="chip">J-Sails</span>
            </div>
          </article>
          <article className="card home-value-card">
            <div className="home-value-icon" aria-hidden>
              📊
            </div>
            <h3>For parents</h3>
            <p>
              Replace messy personal spreadsheets. Track national ranking points, squad selection
              windows, and regatta results in one shared source of truth — without hunting through
              group chats.
            </p>
            <ul className="home-bullet">
              <li>Best-3 of 5 series logic, visible</li>
              <li>Gold / Silver membership by period</li>
              <li>Export-ready history for reviews</li>
            </ul>
          </article>
          <article className="card home-value-card">
            <div className="home-value-icon" aria-hidden>
              ⛵
            </div>
            <h3>For the community</h3>
            <p>
              Connect fleets across clubs. See who is racing where, follow series boards, and keep the
              national Optimist calendar honest for coaches, clubs, and sailors.
            </p>
            <ul className="home-bullet">
              <li>Club &amp; regatta directories</li>
              <li>Live ranking tool for officials</li>
              <li>Shared public standings</li>
            </ul>
          </article>
        </div>
      </section>

      {/* Featured profiles — all demo */}
      <section className="shell section">
        <div className="section-head">
          <div>
            <h2>Featured profiles</h2>
            <p>Sample pages only — mix of national squad and club pathway looks. Not real sailors.</p>
          </div>
          <Link className="btn btn-secondary" href="/demo">
            Open full demo profile
          </Link>
        </div>
        <div className="home-featured-grid">
          {FEATURED.map((f) => (
            <Link key={f.handle} href={f.href} className="card home-featured-card">
              <div className="home-featured-photo">
                <Image src={f.photo} alt="" fill sizes="280px" className="demo-img-cover" />
              </div>
              <div className="home-featured-body">
                <div className="home-featured-sail">{f.sail}</div>
                <strong>{f.name}</strong>
                <span className="muted">
                  {f.club} · {f.fleet} · #{f.rank}
                </span>
                <div className="profile-meta" style={{ marginTop: '0.5rem' }}>
                  <SquadBadge squad={f.squad} />
                  <span className="chip">{f.note}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* CTA band */}
      <section className="shell section">
        <div className="home-cta-band">
          <div>
            <h2>Ready to own your handle?</h2>
            <p className="muted">
              Preview a full claimed profile, then explore live Singapore Optimist Gold &amp; Silver
              standings.
            </p>
          </div>
          <div className="hero-actions">
            <Link className="btn btn-primary" href="/demo">
              Claim your handle
            </Link>
            <Link className="btn btn-secondary" href="/sg/optimist">
              Fleet hub
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

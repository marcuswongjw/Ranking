import Image from 'next/image';
import Link from 'next/link';
import { SquadBadge } from '@/components/SquadBadge';
import { FoundingForm } from '@/components/FoundingForm';

export const revalidate = 60;

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
    photo: '/demo/headshot.jpg',
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
    photo: '/demo/headshot.jpg',
  },
];

const PATHWAY = [
  {
    step: '01',
    title: 'Club & Silver',
    body: 'Build race craft in club fleets and the Silver series. Entry dates track when you join each half-year board.',
    href: '/sg/optimist/silver',
    cta: 'Silver board',
  },
  {
    step: '02',
    title: 'Gold Fleet',
    body: 'Promotion into Gold. Official best-3 of 5 window, national ranking points, and regatta history in one place.',
    href: '/sg/optimist/gold',
    cta: 'Gold board',
  },
  {
    step: '03',
    title: 'National squads',
    body: 'DS · Nat B · Nat A selection periods. Locked squad rosters and selection windows for parents and coaches.',
    href: '/sg/optimist/rankings',
    cta: 'Ranking tool',
  },
  {
    step: '04',
    title: 'Regional & Worlds',
    body: 'Asians, Worlds, and major championships — log representation on your SailorPath and keep the story together.',
    href: '/demo',
    cta: 'Sample profile',
  },
];

export default function HomePage() {
  return (
    <>
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
            <div className="eyebrow home-eyebrow">SailorPath · Your athletic identity on the water</div>
            <h1>Your sailing legacy, charted.</h1>
            <p className="lede home-lede">
              The digital logbook for competitive youth sailors — claim a handle, link your official
              ranking profile, and track fleet progressions from Silver to Gold to national teams.
            </p>
            <div className="hero-actions">
              <Link className="btn btn-primary btn-lg" href="/claim">
                Claim your handle
              </Link>
              <Link className="btn btn-ghost" href="/sg/optimist/gold">
                Browse live standings
              </Link>
            </div>
          </div>
        </div>
      </section>

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

      {/* How it works — Podium-style claim path */}
      <section className="shell section">
        <div className="section-head">
          <div>
            <h2>How it works</h2>
            <p>Three steps from account to official sailor link — like claiming an athlete bio.</p>
          </div>
        </div>
        <div className="home-how-grid">
          <article className="card home-how-card">
            <span className="home-how-num">1</span>
            <h3>Create an account</h3>
            <p>Register with email. Parents can manage a sailor’s identity securely.</p>
          </article>
          <article className="card home-how-card">
            <span className="home-how-num">2</span>
            <h3>Claim your handle</h3>
            <p>
              Reserve <code className="inline-code">sailorpath.com/you</code> — your permanent sailing
              identity.
            </p>
          </article>
          <article className="card home-how-card">
            <span className="home-how-num">3</span>
            <h3>Link your sailor</h3>
            <p>Search official rankings and connect your board results to your handle.</p>
          </article>
        </div>
        <div style={{ marginTop: '1.25rem' }}>
          <Link className="btn btn-primary" href="/claim">
            Start claiming
          </Link>
        </div>
      </section>

      {/* Development pathway */}
      <section className="shell section" id="pathway">
        <div className="section-head">
          <div>
            <h2>Development pathway</h2>
            <p>From club fleets to national squads — SailorPath maps the journey.</p>
          </div>
        </div>
        <div className="pathway-rail">
          {PATHWAY.map((p, i) => (
            <article key={p.step} className="pathway-card card">
              <div className="pathway-step">{p.step}</div>
              {i < PATHWAY.length - 1 && <div className="pathway-connector" aria-hidden />}
              <h3>{p.title}</h3>
              <p>{p.body}</p>
              <Link className="fleet-card-cta" href={p.href}>
                {p.cta} →
              </Link>
            </article>
          ))}
        </div>
      </section>

      {/* Value props */}
      <section className="shell section home-value">
        <div className="section-head">
          <div>
            <h2>Why SailorPath</h2>
            <p>Built for sailors, parents, and the wider Optimist community.</p>
          </div>
        </div>
        <div className="home-value-grid">
          <article className="card home-value-card">
            <div className="home-value-icon" aria-hidden>
              🏆
            </div>
            <h3>For sailors</h3>
            <p>
              Digital trophy cabinet: fleet status, squad badges, and kit — on a page that looks like
              you.
            </p>
            <div className="home-mock-cabinet">
              <span className="badge badge-a">Gold Fleet</span>
              <SquadBadge squad="Nat A" />
              <span className="chip">Winner hull</span>
            </div>
          </article>
          <article className="card home-value-card">
            <div className="home-value-icon" aria-hidden>
              📊
            </div>
            <h3>For parents</h3>
            <p>
              Replace messy spreadsheets. Ranking points, squad windows, and regatta history in one
              shared place.
            </p>
          </article>
          <article className="card home-value-card">
            <div className="home-value-icon" aria-hidden>
              ⛵
            </div>
            <h3>For the community</h3>
            <p>
              Connect fleets across clubs. Live standings and the official ranking tool, hosted on
              SailorPath.
            </p>
          </article>
        </div>
      </section>

      {/* Founding membership */}
      <section className="shell section" id="founding">
        <div className="founding-band">
          <div>
            <div className="eyebrow">Early access</div>
            <h2>Founding membership</h2>
            <p className="muted" style={{ maxWidth: '32rem', lineHeight: 1.55 }}>
              Join a limited group of sailors, parents, and coaches shaping SailorPath. Founding
              members get early product updates, a founding badge on their profile, and a direct line
              for feedback. No payment required to join the list.
            </p>
            <ul className="home-bullet">
              <li>Priority claim support</li>
              <li>Input on pathway &amp; profile features</li>
              <li>Founding member recognition</li>
            </ul>
          </div>
          <div className="founding-form-wrap card">
            <h3 style={{ fontSize: '1.05rem', marginBottom: '0.75rem' }}>Join the list</h3>
            <FoundingForm />
          </div>
        </div>
      </section>

      {/* Featured demo profiles */}
      <section className="shell section">
        <div className="section-head">
          <div>
            <h2>Featured profiles</h2>
            <p>Sample pages only — not real sailors. Privacy-safe demos of the product look.</p>
          </div>
          <Link className="btn btn-secondary" href="/demo">
            Open full demo
          </Link>
        </div>
        <div className="home-featured-grid">
          {FEATURED.map((f) => (
            <Link key={f.handle} href={f.href} className="card home-featured-card">
              <div className="home-featured-photo home-featured-photo-portrait">
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

      <section className="shell section">
        <div className="home-cta-band">
          <div>
            <h2>Ready to own your handle?</h2>
            <p className="muted">
              Claim your identity, then explore live Singapore Optimist Gold &amp; Silver standings.
            </p>
          </div>
          <div className="hero-actions">
            <Link className="btn btn-primary" href="/claim">
              Claim your handle
            </Link>
            <Link className="btn btn-secondary" href="/#founding">
              Founding membership
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

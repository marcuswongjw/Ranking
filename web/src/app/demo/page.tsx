import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { SquadBadge } from '@/components/SquadBadge';

export const metadata: Metadata = {
  title: 'Sample profile · Demo',
  description:
    'Preview of a claimed SailorPath profile: identity, stats, trophy case, logbook, and kit — sample data only.',
};

/** Fully fictional demo sailor — not a real athlete. */
const DEMO = {
  name: 'Alexandra “Alex” Reyes',
  handle: 'alex-reyes',
  sailNumber: 'SGP 115',
  club: 'SAFYC',
  school: 'Raffles Girls’ School',
  fleet: 'Gold Fleet',
  squad: 'Nat A' as const,
  age: 13,
  weightKg: 42,
  nationalRank: 6,
  best3: 22,
  totalRegattas: 18,
  bio: 'Competitive Optimist sailor focused on clean starts and heavy-air downwinds. Training out of SAFYC with eyes on regional championships.',
};

const TROPHIES = [
  { event: 'Singapore Youth Sailing Championship', year: '2026', place: 2, label: 'Silver' },
  { event: 'Pesta Sukan Optimist', year: '2025', place: 3, label: 'Bronze' },
  { event: 'National Championships · Gold', year: '2025', place: 1, label: 'Gold' },
];

const BADGES = [
  { id: 'asians', title: 'IODA Asians', detail: 'Thailand · 2025', tone: 'asians' as const },
  { id: 'worlds', title: 'Worlds support', detail: 'Italy · 2025', tone: 'worlds' as const },
  { id: 'nat-a', title: 'National A', detail: 'Jul 2026 locked', tone: 'squad' as const },
];

const LOGBOOK = [
  {
    name: 'Temasek Championship',
    date: '15 Jun 2026',
    place: 4,
    fleet: 98,
    nett: 18,
    races: ['2', '5', '1', '8', '4', '3'],
  },
  {
    name: 'SAFYC Gold Fleet',
    date: '20 Mar 2026',
    place: 7,
    fleet: 86,
    nett: 24,
    races: ['6', '9', '3', '11', '2', '7'],
  },
  {
    name: 'SYSC March',
    date: '15 Mar 2026',
    place: 5,
    fleet: 102,
    nett: 21,
    races: ['4', '2', '8', '5', '6', '1'],
  },
  {
    name: 'Pulau Ujong',
    date: '15 Feb 2026',
    place: 11,
    fleet: 74,
    nett: 32,
    races: ['14', '8', 'BFD', '12', '9', '6'],
  },
  {
    name: 'CSC Gold (Jan)',
    date: '26 Jan 2026',
    place: 9,
    fleet: 98,
    nett: 28,
    races: ['7', '12', '4', '10', '5', '8'],
  },
  {
    name: 'Asian Optimist Championship',
    date: 'Dec 2025',
    place: 18,
    fleet: 120,
    nett: 96,
    races: ['22', '15', '18', '11', '19', '14'],
    overseas: true,
  },
];

const KIT = [
  { label: 'Hull', value: 'Winner Optimist', note: '2024 plate' },
  { label: 'Sail', value: 'J-Sails Race', note: 'Medium cut' },
  { label: 'Foils', value: 'Far East carbon', note: 'Standard tip' },
  { label: 'Spar', value: 'Selden', note: 'Club issue' },
];

const RACE_PHOTOS = [
  { src: '/demo/race-start.jpg', alt: 'Race start line', caption: 'Start · SYSC' },
  { src: '/demo/race-reach.jpg', alt: 'Reaching in breeze', caption: 'Heavy air reach' },
  { src: '/demo/race-gear.jpg', alt: 'Sails on the beach', caption: 'Post-race park' },
  { src: '/demo/race-medals.jpg', alt: 'Medals and trophies', caption: 'Prize table' },
];

function placeClass(n: number) {
  if (n === 1) return 'place-gold';
  if (n === 2) return 'place-silver';
  if (n === 3) return 'place-bronze';
  return '';
}

export default function DemoProfilePage() {
  return (
    <>
      <div className="notice">
        <strong>Sample profile</strong> — fully fictional demo data for design review. Not a real sailor.
        Photos are stock-style placeholders.
      </div>

      {/* A. Header — identity & affiliation */}
      <header className="demo-header card">
        <div className="demo-header-media">
          <div className="demo-action-shot">
            <Image
              src="/demo/action.jpg"
              alt="Action shot — Optimist hiking"
              fill
              sizes="(max-width: 900px) 100vw, 60vw"
              className="demo-img-cover"
              priority
            />
            <span className="demo-photo-tag">Action</span>
          </div>
          <div className="demo-headshot-wrap">
            <Image
              src="/demo/headshot.jpg"
              alt="Profile headshot"
              width={160}
              height={160}
              className="demo-headshot"
              priority
            />
          </div>
        </div>

        <div className="demo-header-body">
          <div className="eyebrow">Demo · Claimed SailorPath</div>
          <h1>{DEMO.name}</h1>
          <p className="demo-sail-number" title="Sail number">
            {DEMO.sailNumber}
          </p>
          <p className="muted demo-bio">{DEMO.bio}</p>
          <div className="profile-meta">
            <span className="chip">{DEMO.club}</span>
            <span className="chip">{DEMO.school}</span>
            <span className="badge badge-a">{DEMO.fleet}</span>
            <SquadBadge squad={DEMO.squad} />
            <span className="badge badge-official">National Training Squad</span>
            <span className="chip">sailorpath.com/{DEMO.handle}</span>
          </div>
        </div>

        <div className="rank-pill demo-rank-pill">
          <strong>#{DEMO.nationalRank}</strong>
          <span>National rank</span>
          <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
            Best-3 · {DEMO.best3}
          </div>
        </div>
      </header>

      {/* B. Tale of the tape */}
      <section className="card section demo-tape">
        <div className="section-head" style={{ marginBottom: '1rem' }}>
          <div>
            <h2>Tale of the tape</h2>
            <p className="sub" style={{ margin: 0 }}>
              Current stats · Optimist class
            </p>
          </div>
        </div>
        <div className="demo-tape-grid">
          <div className="stat">
            <strong>{DEMO.age}</strong>
            <span>Age</span>
          </div>
          <div className="stat">
            <strong>
              {DEMO.weightKg}
              <small className="demo-unit">kg</small>
            </strong>
            <span>Weight</span>
          </div>
          <div className="stat">
            <strong>#{DEMO.nationalRank}</strong>
            <span>National ranking</span>
          </div>
          <div className="stat">
            <strong>{DEMO.totalRegattas}</strong>
            <span>Regattas sailed</span>
          </div>
          <div className="stat">
            <strong>{DEMO.best3}</strong>
            <span>Best-3 score</span>
          </div>
          <div className="stat">
            <strong>Gold</strong>
            <span>Current fleet</span>
          </div>
        </div>
      </section>

      <div className="grid-2 section">
        {/* C. Trophy case */}
        <section className="card">
          <h2>Trophy case</h2>
          <p className="sub">Top-3 finishes at major events · sample</p>
          <div className="demo-trophy-list">
            {TROPHIES.map((t) => (
              <div key={t.event} className="demo-trophy-row">
                <span className={`demo-medal ${placeClass(t.place)}`}>{t.label}</span>
                <div>
                  <strong>{t.event}</strong>
                  <span>
                    {t.year} · {t.place === 1 ? '1st' : t.place === 2 ? '2nd' : '3rd'} overall
                  </span>
                </div>
              </div>
            ))}
          </div>
          <h3 className="demo-h3">Representation badges</h3>
          <div className="demo-badge-row">
            {BADGES.map((b) => (
              <div key={b.id} className={`demo-rep-badge tone-${b.tone}`}>
                <strong>{b.title}</strong>
                <span>{b.detail}</span>
              </div>
            ))}
          </div>
        </section>

        {/* E. Equipment log */}
        <section className="card">
          <h2>Equipment log</h2>
          <p className="sub">The kit · hull, sail &amp; foils</p>
          <div className="demo-kit-grid">
            {KIT.map((k) => (
              <div key={k.label} className="demo-kit-item">
                <span className="demo-kit-label">{k.label}</span>
                <strong>{k.value}</strong>
                <span className="muted">{k.note}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Race photos */}
      <section className="card section">
        <h2>Race photos</h2>
        <p className="sub">Gallery from the season (demo media)</p>
        <div className="demo-photo-grid">
          {RACE_PHOTOS.map((p) => (
            <figure key={p.src} className="demo-photo-card">
              <div className="demo-photo-frame">
                <Image src={p.src} alt={p.alt} fill sizes="(max-width: 600px) 50vw, 25vw" className="demo-img-cover" />
              </div>
              <figcaption>{p.caption}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* D. Logbook */}
      <section className="card section">
        <h2>Logbook</h2>
        <p className="sub">Chronological regatta history · overall, nett &amp; race-by-race</p>
        <div className="demo-logbook">
          {LOGBOOK.map((r) => (
            <article key={r.name + r.date} className="demo-log-item">
              <div className="demo-log-head">
                <div>
                  <strong>{r.name}</strong>
                  <span>
                    {r.date}
                    {r.overseas ? ' · Overseas (self-reported)' : ' · National series'}
                  </span>
                </div>
                <div className="demo-log-place">
                  <strong>
                    {r.place}
                    <span className="demo-of"> / {r.fleet}</span>
                  </strong>
                  <span>Overall</span>
                </div>
              </div>
              <div className="demo-log-meta">
                <span className="chip">Nett {r.nett}</span>
                {r.overseas && <span className="badge badge-ds">Does not affect national rank</span>}
              </div>
              <div className="demo-race-breaks" aria-label="Individual race finishes">
                {r.races.map((score, i) => (
                  <span
                    key={`${r.name}-r${i}`}
                    className={`demo-race-chip ${score === 'BFD' || score === 'DNF' || score === 'DNS' ? 'is-penalty' : ''}`}
                  >
                    <em>R{i + 1}</em> {score}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <p style={{ marginTop: '2rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
        <Link className="btn btn-primary" href="/">
          Back to home
        </Link>
        <Link className="btn btn-secondary" href="/sg/optimist/gold">
          Live Gold standings
        </Link>
      </p>
    </>
  );
}

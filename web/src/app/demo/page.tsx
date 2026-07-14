import Link from 'next/link';
import type { Metadata } from 'next';
import { TrajectoryChart } from '@/components/TrajectoryChart';
import { SquadBadge } from '@/components/SquadBadge';

export const metadata: Metadata = {
  title: 'Sample profile · Demo',
  description: 'Preview of a full SailorPath profile with upcoming features mocked for design review.',
};

/** Mock trajectory for demo only */
const DEMO_TRAJECTORY = [
  { date: '2025-09-01', regatta: 'SAFYC Sep', rank: 28, score: 72 },
  { date: '2025-11-01', regatta: 'CSC Nov', rank: 19, score: 54 },
  { date: '2026-01-15', regatta: 'CSC Gold', rank: 14, score: 41 },
  { date: '2026-03-15', regatta: 'SYSC Mar', rank: 9, score: 28 },
  { date: '2026-06-15', regatta: 'Temasek', rank: 6, score: 22 },
];

const DEMO_SERIES = [
  { name: 'Temasek (Jun 26)', date: '15 Jun 2026', rank: 4, nett: 18 },
  { name: 'SAFYC (Mar 26)', date: '15 Mar 2026', rank: 7, nett: 24 },
  { name: 'SYSC (Mar 26)', date: '15 Mar 2026', rank: 5, nett: 21 },
  { name: 'Pulau Ujong (Feb 26)', date: '15 Feb 2026', rank: 11, nett: 32 },
  { name: 'CSC Gold (Jan 26)', date: '15 Jan 2026', rank: 9, nett: 28 },
];

const DEMO_OVERSEAS = [
  {
    name: 'Asian Optimist Championship',
    place: 'Thailand',
    date: 'Dec 2025',
    rank: 18,
    fleet: 120,
    note: 'First overseas podium race week',
  },
  {
    name: 'World Championships (team support)',
    place: 'Italy',
    date: 'Jul 2025',
    rank: 42,
    fleet: 260,
    note: 'Self-reported · does not affect national rank',
  },
];

const DEMO_MILESTONES = [
  { year: '2026', title: 'First Nat A selection', detail: 'Locked squad · Jul period' },
  { year: '2026', title: 'Biggest rank jump', detail: '+8 places across series window' },
  { year: '2025', title: 'First top-10 national', detail: 'After CSC Gold' },
  { year: '2024', title: 'First national regatta', detail: 'Entered Gold pathway' },
];

const DEMO_PHOTOS = [
  { label: 'Medal ceremony', tone: 'a' },
  { label: 'Starts training', tone: 'b' },
  { label: 'Certificate', tone: 'c' },
  { label: 'Team photo', tone: 'd' },
];

export default function DemoProfilePage() {
  return (
    <>
      <div className="notice">
        <strong>Sample profile</strong> — illustrative only. Shows how a claimed SailorPath page can look
        with bio, goals, overseas results, media, milestones, and private log previews. Not a real sailor.
      </div>

      <div className="card profile-hero">
        <div className="avatar" aria-hidden>
          AR
        </div>
        <div>
          <div className="eyebrow">Demo · SailorPath</div>
          <h1>Alexandra “Alex” Reyes</h1>
          <p className="muted" style={{ margin: '0.4rem 0 0', maxWidth: '36rem' }}>
            Competitive Optimist sailor focused on clean starts and heavy-air downwinds. Training out of
            SAFYC with goals toward regional championships.
          </p>
          <div className="profile-meta">
            <span className="chip">SAFYC</span>
            <span className="chip">Age band 12</span>
            <SquadBadge squad="Nat A" />
            <span className="badge badge-official">Official series</span>
            <span className="badge badge-a">Claimed demo</span>
            <span className="chip">sailorpath.com/alex-reyes</span>
          </div>
        </div>
        <div className="rank-pill">
          <strong>#6</strong>
          <span>National rank</span>
          <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
            Best-3: 22
          </div>
        </div>
      </div>

      <div className="grid-2">
        <section className="card">
          <h2>Trajectory</h2>
          <p className="sub">Rank and best-3 score over time (sample data)</p>
          <TrajectoryChart data={DEMO_TRAJECTORY} />
        </section>
        <section className="card">
          <h2>Personal bests</h2>
          <p className="sub">Official series · sample</p>
          <div className="stat-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div className="stat">
              <strong>#6</strong>
              <span>Current rank</span>
            </div>
            <div className="stat">
              <strong>22</strong>
              <span>Best-3 score</span>
            </div>
            <div className="stat">
              <strong>4</strong>
              <span>Best finish</span>
            </div>
            <div className="stat">
              <strong>12</strong>
              <span>Events this season</span>
            </div>
          </div>
          <h3 style={{ marginTop: '1.25rem', fontSize: '1rem' }}>Sailing goals</h3>
          <ul className="demo-list">
            <li>Top 5 national ranking by Dec 2026</li>
            <li>Qualify for Asian Championships team</li>
            <li>Consistent top-10 in heavy air (15+ kts)</li>
          </ul>
        </section>
      </div>

      <section className="card section">
        <h2>Achievement timeline</h2>
        <p className="sub">Auto milestones + manual highlights (sample)</p>
        <div className="timeline">
          {DEMO_MILESTONES.map((m) => (
            <div key={m.title + m.year} className="timeline-item">
              <div>
                <strong>{m.title}</strong>
                <span>{m.detail}</span>
              </div>
              <div className="place">{m.year}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid-2 section">
        <section className="card">
          <h2>Race history · official</h2>
          <p className="sub">National series · rank + nett points</p>
          <div className="timeline">
            {DEMO_SERIES.map((r) => (
              <div key={r.name} className="timeline-item">
                <div>
                  <strong>{r.name}</strong>
                  <span>
                    {r.date} · nett points {r.nett}
                  </span>
                </div>
                <div className="place">{r.rank}</div>
              </div>
            ))}
          </div>
        </section>
        <section className="card">
          <h2>Overseas &amp; other events</h2>
          <p className="sub">
            <span className="badge badge-ds">Self-reported</span> — does not affect national ranking
          </p>
          <div className="timeline">
            {DEMO_OVERSEAS.map((r) => (
              <div key={r.name} className="timeline-item">
                <div>
                  <strong>{r.name}</strong>
                  <span>
                    {r.place} · {r.date} · {r.note}
                  </span>
                </div>
                <div className="place">{r.rank}</div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="card section">
        <h2>Certificates &amp; race photos</h2>
        <p className="sub">Claimed profiles can upload media (visibility controlled by parent)</p>
        <div className="photo-grid">
          {DEMO_PHOTOS.map((p) => (
            <div key={p.label} className={`photo-tile tone-${p.tone}`}>
              <span>{p.label}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="grid-2 section">
        <section className="card">
          <h2>Upcoming races &amp; goals</h2>
          <p className="sub">Planner (sample)</p>
          <ul className="demo-list">
            <li>
              <strong>SAFYC July</strong> — target top 8 · starts focus
            </li>
            <li>
              <strong>Nationals</strong> — peak week · coach debrief plan
            </li>
            <li>
              <strong>Training camp (Aug)</strong> — dual-trap drills
            </li>
          </ul>
        </section>
        <section className="card">
          <h2>Training log</h2>
          <p className="sub">Private to family / coach (preview only)</p>
          <div className="timeline">
            <div className="timeline-item">
              <div>
                <strong>Water · starts</strong>
                <span>12 Jul · 2.0h · RPE 7 · “Good line bias reads”</span>
              </div>
            </div>
            <div className="timeline-item">
              <div>
                <strong>Fitness · bike</strong>
                <span>11 Jul · 45m · RPE 5</span>
              </div>
            </div>
            <div className="timeline-item">
              <div>
                <strong>Race debrief · Temasek</strong>
                <span>15 Jun · “Lost two places on last run”</span>
              </div>
            </div>
          </div>
        </section>
      </div>

      <p style={{ marginTop: '2rem' }}>
        <Link className="btn btn-primary" href="/sg/optimist">
          Back to real SG Optimist standings
        </Link>{' '}
        <Link className="btn btn-secondary" href="/">
          Home
        </Link>
      </p>
    </>
  );
}

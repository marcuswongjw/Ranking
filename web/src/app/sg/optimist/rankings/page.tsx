import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Official Rankings · SG Optimist',
  description: 'Singapore Optimist national ranking tool — live board and editor, embedded on SailorPath.',
};

/** Canonical Ranking tool (GitHub Pages) — same Firebase cloud as SailorPath. */
const RANKING_APP = 'https://marcuswongjw.github.io/Ranking/';

export default function RankingsEmbedPage() {
  return (
    <div className="rankings-embed-page">
      <div className="rankings-embed-bar">
        <div>
          <div className="eyebrow" style={{ marginBottom: 4 }}>
            Official series tool
          </div>
          <h1 className="rankings-embed-title">SG Optimist rankings</h1>
          <p className="rankings-embed-lede">
            Live board and editor, embedded here. Data is shared via Firebase. Sign in inside the tool to
            edit.
          </p>
        </div>
        <a
          className="btn btn-secondary"
          href={RANKING_APP}
          target="_blank"
          rel="noreferrer"
          title="Open the ranking tool in a full browser tab"
        >
          Open fullscreen ↗
        </a>
      </div>
      <div className="iframe-frame rankings-iframe-frame">
        <iframe
          title="Singapore Optimist Rankings"
          src={RANKING_APP}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>
      <p className="rankings-embed-foot">
        <Link className="name-link" href="/sg/optimist/gold">
          Gold standings
        </Link>
        {' · '}
        <Link className="name-link" href="/sg/optimist/silver">
          Silver standings
        </Link>
        {' · '}
        <Link className="name-link" href="/">
          Home
        </Link>
      </p>
    </div>
  );
}

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Official Rankings · SG Optimist',
  description: 'Singapore Optimist national ranking tool (editor + public board).',
};

/** Ranking SPA URL — GitHub Pages deploy of this monorepo root. */
const RANKING_SPA =
  process.env.NEXT_PUBLIC_RANKING_SPA_URL ||
  'https://marcuswongjw.github.io/Ranking/';

export default function RankingsEmbedPage() {
  return (
    <>
      <div className="eyebrow">Official series tool</div>
      <h1>SG Optimist rankings</h1>
      <p className="lede">
        Full ranking board, regatta management, and analysis. Powered by the existing ranking app —
        SailorPath links sailors from the public standings and profiles.
      </p>
      <p style={{ marginBottom: '1rem' }}>
        <a className="btn btn-secondary" href={RANKING_SPA} target="_blank" rel="noreferrer">
          Open in new tab ↗
        </a>
      </p>
      <div className="iframe-frame">
        <iframe title="Singapore Optimist Rankings" src={RANKING_SPA} />
      </div>
    </>
  );
}

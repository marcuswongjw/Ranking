import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Official Rankings · SG Optimist',
  description: 'Singapore Optimist national ranking tool (editor + public board).',
};

/** Canonical Ranking tool (same Firebase cloud as SailorPath public boards). */
const RANKING_APP = 'https://marcuswongjw.github.io/Ranking/';
/** Same-origin copy kept for offline / alternate embed. */
const RANKING_APP_LOCAL = '/ranking-app/';

export default function RankingsEmbedPage() {
  return (
    <>
      <div className="eyebrow">Official series tool</div>
      <h1>SG Optimist rankings</h1>
      <p className="lede">
        Full ranking board, regattas, and editor. Data lives in Firebase (shared with this site).
        Public SailorPath profiles refresh from the cloud snapshot within about a minute after an editor save.
      </p>
      <p style={{ marginBottom: '1rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
        <a className="btn btn-secondary" href={`${RANKING_APP}#regattas`} target="_blank" rel="noreferrer">
          Open regattas ↗
        </a>
        <a className="btn btn-secondary" href={RANKING_APP} target="_blank" rel="noreferrer">
          Open full tool ↗
        </a>
        <a className="btn btn-secondary" href={RANKING_APP_LOCAL} target="_blank" rel="noreferrer">
          Same-origin tool ↗
        </a>
      </p>
      <div className="iframe-frame">
        <iframe title="Singapore Optimist Rankings" src={RANKING_APP} />
      </div>
    </>
  );
}

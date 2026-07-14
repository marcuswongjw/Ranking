import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Official Rankings · SG Optimist',
  description: 'Singapore Optimist national ranking tool (editor + public board).',
};

/** Same-origin copy of the ranking SPA (synced at build from repo root). */
const RANKING_APP = '/ranking-app/';

export default function RankingsEmbedPage() {
  return (
    <>
      <div className="eyebrow">Official series tool</div>
      <h1>SG Optimist rankings</h1>
      <p className="lede">
        Full ranking board, regattas, and editor — hosted on SailorPath at{' '}
        <code style={{ fontSize: '0.9em' }}>/ranking-app/</code>. This is the live tool (Firebase).
        Public SailorPath profiles use a published snapshot and may lag until export is wired.
      </p>
      <p style={{ marginBottom: '1rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
        <a className="btn btn-secondary" href={`${RANKING_APP}#regattas`} target="_blank" rel="noreferrer">
          Open regattas ↗
        </a>
        <a className="btn btn-secondary" href={RANKING_APP} target="_blank" rel="noreferrer">
          Open full tool ↗
        </a>
      </p>
      <div className="iframe-frame">
        <iframe title="Singapore Optimist Rankings" src={RANKING_APP} />
      </div>
    </>
  );
}

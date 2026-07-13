import Link from 'next/link';

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="shell footer-inner">
        <div>
          <strong>SailorPath</strong>
          <p>Career pages for sailors — starting with Singapore Optimist.</p>
        </div>
        <div className="footer-links">
          <Link href="/sg/optimist/rankings">Official rankings</Link>
          <Link href="/sg/optimist/regattas">Regattas</Link>
          <Link href="/privacy">Privacy</Link>
        </div>
        <p className="footer-note">
          Official series results are read-only. Birth years are never shown publicly.
          Claim &amp; personal media coming soon.
        </p>
      </div>
    </footer>
  );
}

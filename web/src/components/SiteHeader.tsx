import Link from 'next/link';

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="shell header-inner">
        <Link href="/" className="brand">
          <span className="brand-mark">SP</span>
          <span className="brand-text">
            SailorPath
            <small>Your sailing story</small>
          </span>
        </Link>
        <nav className="nav">
          <Link href="/sg/optimist/rankings">Rankings</Link>
          <Link href="/sg/optimist/regattas">Regattas</Link>
          <Link href="/sg/optimist/clubs">Clubs</Link>
          <Link href="/demo">Sample profile</Link>
          <Link href="/sg/optimist" className="nav-cta">
            SG Optimist
          </Link>
        </nav>
      </div>
    </header>
  );
}

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
          <Link href="/sg/optimist">Fleets</Link>
          <Link href="/sg/optimist/gold">Gold</Link>
          <Link href="/sg/optimist/silver">Silver</Link>
          <Link href="/sg/optimist/rankings">Tool</Link>
          <Link href="/demo">Sample</Link>
          <Link href="/sg/optimist" className="nav-cta">
            SG Optimist
          </Link>
        </nav>
      </div>
    </header>
  );
}

import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      { source: '/sg/optimist/regattas', destination: '/sg/optimist/gold/regattas', permanent: false },
      { source: '/sg/optimist/regattas/:slug', destination: '/sg/optimist/gold/regattas/:slug', permanent: false },
      { source: '/sg/optimist/clubs', destination: '/sg/optimist/gold/clubs', permanent: false },
      { source: '/sg/optimist/clubs/:slug', destination: '/sg/optimist/gold/clubs/:slug', permanent: false },
      // Raw SPA under /ranking-app breaks relative assets without a trailing slash
      // and is not a product URL — send everyone to the embedded rankings page.
      { source: '/ranking-app', destination: '/sg/optimist/rankings', permanent: false },
      { source: '/ranking-app/', destination: '/sg/optimist/rankings', permanent: false },
      { source: '/ranking-app/:path*', destination: '/sg/optimist/rankings', permanent: false },
    ];
  },
};

export default nextConfig;

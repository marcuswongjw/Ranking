import type { NextConfig } from 'next';

/** Keep this file ESM-simple — no import.meta / __dirname (breaks Vercel compile). */
const nextConfig: NextConfig = {
  reactStrictMode: true,
};

export default nextConfig;

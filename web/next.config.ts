import type { NextConfig } from 'next';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // Pin workspace root so parent lockfiles don't confuse Turbopack
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;

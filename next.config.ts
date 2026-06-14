import type { NextConfig } from 'next';

const BACKEND = process.env.BACKEND_URL ?? 'http://localhost:8000';

const nextConfig: NextConfig = {
  // ─── CORS-free proxy (OPTION B) ─────────────────────────────────
  async rewrites() {
    return [
      {
        source: '/api/proxy/:path*',
        destination: `${BACKEND}/api/v1/:path*`,
      },
    ];
  },

  // ─── Headers ────────────────────────────────────────────────────
  async headers() {
    return [
      {
        source: '/api/proxy/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin',  value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,DELETE,OPTIONS,PATCH' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
        ],
      },
    ];
  },

  // ─── Turbopack (dev) ────────────────────────────────────────────
  turbopack: {
    resolveExtensions: ['.tsx', '.ts', '.jsx', '.js', '.json', '.css'],
  },

  // ─── Package import optimisation ────────────────────────────────
  // Tree-shakes large icon/chart libs at the module level, so Turbopack
  // doesn't need to crawl hundreds of individual files per import.
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      'recharts',
      '@radix-ui/react-icons',
    ],
  },
};

export default nextConfig;

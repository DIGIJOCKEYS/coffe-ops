/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.NODE_ENV === 'development' ? '.next-dev' : '.next',
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: { unoptimized: true },
  experimental: {
    optimizePackageImports: ['lucide-react', 'date-fns'],
  },
  // Proxy Clerk Frontend API requests through /__clerk.
  //
  // Per official Clerk docs (clerk.com/docs/advanced-usage/using-proxies):
  //   - Requests to /__clerk/* must forward to https://frontend-api.clerk.dev/*
  //   - Three required headers must be added:
  //       Clerk-Proxy-Url  — the full proxy URL
  //       Clerk-Secret-Key — your Clerk secret key
  //       X-Forwarded-For  — original client IP
  //
  // Next.js rewrites run BEFORE middleware, so this executes before any
  // Clerk auth check — breaking the circular dependency.
  async rewrites() {
    return [
      {
        source: '/__clerk/:path*',
        destination: 'https://frontend-api.clerk.dev/:path*',
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/__clerk/:path*',
        headers: [
          {
            key: 'Clerk-Proxy-Url',
            value: 'https://nestation-ops.vercel.app/__clerk',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;

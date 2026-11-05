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
  // Clerk Frontend API Proxy
  //
  // /__clerk/* is rewritten to the internal Route Handler at /api/clerk-proxy/*
  // The Route Handler adds the required Clerk headers (including CLERK_SECRET_KEY)
  // before forwarding to https://frontend-api.clerk.dev.
  //
  // This is necessary because:
  //  1. *.vercel.app does not support arbitrary subdomains (clerk.<domain>)
  //  2. Next.js rewrites() cannot add secret headers to upstream requests
  //  3. createFrontendApiProxyHandlers is not available in @clerk/nextjs@6.x
  async rewrites() {
    return [
      {
        source: '/__clerk/:path*',
        destination: '/api/clerk-proxy/:path*',
      },
    ];
  },
};

module.exports = nextConfig;

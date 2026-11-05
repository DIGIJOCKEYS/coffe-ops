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
  // Proxy Clerk requests for *.vercel.app (no custom subdomain support)
  async rewrites() {
    return [
      {
        source: '/__clerk/:path*',
        destination: 'https://clerk.nestation-ops.vercel.app/:path*',
      },
    ];
  },
};

module.exports = nextConfig;

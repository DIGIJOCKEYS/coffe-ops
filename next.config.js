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

module.exports = nextConfig;

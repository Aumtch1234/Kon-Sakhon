/** @type {import('next').NextConfig} */
const nextConfig = {
    experimental: {
    appDir: true,
  },
  images: {
    domains: ['localhost'],
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '3000',
        pathname: '/uploads/**',
      },
    ],
  },
  // Enable API body parser for file uploads
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
  // Static file serving
  async rewrites() {
    return [
      {
        source: '/uploads/:path*',
        destination: '/uploads/:path*',
      },
    ];
  },
};

export default nextConfig;

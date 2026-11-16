/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@watchparty/shared'],
  async rewrites() {
    const rawBackend = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    const backendOrigin = rawBackend.startsWith('http') ? rawBackend : `https://${rawBackend}`;

    return [
      {
        source: '/api/:path*',
        destination: `${backendOrigin}/api/:path*`,
      },
      {
        source: '/socket.io/:path*',
        destination: `${backendOrigin}/socket.io/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@watchparty/shared'],
  async rewrites() {
    const rawBackend = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'https://watchparty-server-6a3v.onrender.com';
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

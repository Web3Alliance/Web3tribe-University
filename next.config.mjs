/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Performance optimizations
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
  },
  // Enable React strict mode for better performance
  reactStrictMode: true,
  // Optimize bundle size
  swcMinify: true,
  // Enable module preload for faster loading
  experimental: {
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-App-Name',
            value: 'Web3Tribe University',
          },
          {
            key: 'X-App-Developer',
            value: 'Skiibiidarsh',
          },
          {
            key: 'X-App-Developer-Url',
            value: 'https://profiles.pinet.com/profiles/skiibiidarsh',
          },
          {
            key: 'X-App-Repository',
            value: 'https://github.com/Web3Alliance/Web3tribe-University.git',
          },
          {
            key: 'X-App-Website',
            value: 'https://www.tribe.theweb3alliance.org/',
          },
          {
            key: 'X-App-Version',
            value: '1.0.0',
          },
          // Cache static assets
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ]
  },
  // Allow Supabase authentication callbacks
  async redirects() {
    return [
      {
        source: '/auth/callback',
        destination: '/auth/callback',
        permanent: false,
      },
    ]
  },
}

export default nextConfig

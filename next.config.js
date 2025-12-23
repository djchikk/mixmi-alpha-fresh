/** @type {import("next").NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: true
  },
  eslint: {
    ignoreDuringBuilds: true
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'apvdneaduthfbieywwjv.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: 'apvdneaduthfbieywwjv.supabase.co',
        port: '',
        pathname: '/storage/v1/render/image/public/**',
      },
    ],
  },
};

module.exports = nextConfig;

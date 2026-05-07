/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      // Add Supabase Storage host here when set up, e.g.:
      // { protocol: 'https', hostname: '<project>.supabase.co' }
    ],
  },
};

module.exports = nextConfig;

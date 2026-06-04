/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: [
      'kidreqxqapouxndqomdp.supabase.co',  // staging Supabase storage
      // Add your production Supabase subdomain here once you have it:
      // 'YOUR_PRODUCTION_PROJECT_REF.supabase.co',
    ],
  },
};

module.exports = nextConfig;

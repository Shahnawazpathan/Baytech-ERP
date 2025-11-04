import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  // Disable React Strict Mode in both dev and production
  reactStrictMode: false,
  webpack: (config, { dev }) => {
    if (dev) {
      // Disable webpack hot module replacement in dev
      config.watchOptions = {
        ignored: ['**/*'], // Ignore all file changes
      };
    }
    return config;
  },
  eslint: {
    // Ignore ESLint errors during builds
    ignoreDuringBuilds: true,
  },
  // Ensure development features are disabled in production
  productionBrowserSourceMaps: false,
  // Remove any development-related features in production
  experimental: {
    // Disable any experimental features that might show dev tools
  }
};

export default nextConfig;

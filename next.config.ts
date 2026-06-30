import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  outputFileTracingRoot: process.cwd(),

  // Performance optimizations
  // SWC minification is default in Next.js 15+
  poweredByHeader: false, // Remove X-Powered-By header

  // Enable React optimizations
  reactStrictMode: true,

  typescript: {
    ignoreBuildErrors: false,
  },

  // Compiler optimizations
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
  },

  // Image optimization
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60,
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },

  // Experimental features for better performance
  experimental: {
    // optimizeCss: true, // Disabled - requires critters package
    optimizePackageImports: ['recharts', 'lucide-react', '@/components/ui'],
    scrollRestoration: true,
  },

  // Keep secrets server-side. Next's `env` option inlines values into bundles.
  serverExternalPackages: ['@prisma/client', '@prisma/adapter-libsql', '@libsql/client', 'nodemailer'],
  webpack: (config, { dev, isServer }) => {
    if (dev) {
      // Optimize webpack watch for better HMR performance
      config.watchOptions = {
        ignored: ['**/node_modules/**', '**/.git/**', '**/.next/**'], // Only ignore specific directories
        poll: false, // Use native file watching for better performance
        aggregateTimeout: 300, // Delay rebuild after first change
      };
    }

    // Only on client side, ignore server packages
    if (!isServer) {
      config.resolve = config.resolve || {};
      config.resolve.fallback = {
        ...config.resolve.fallback,
        '@libsql/client': false,
        '@prisma/adapter-libsql': false,
        '@prisma/client': false,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
      };
    }

    return config;
  },
  eslint: {
    // Ignore ESLint errors during builds (only in emergency)
    ignoreDuringBuilds: false,
  },
  // Ensure development features are disabled in production
  productionBrowserSourceMaps: false,

  // Security headers
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(self)'
          }
        ]
      }
    ];
  }
};

export default nextConfig;

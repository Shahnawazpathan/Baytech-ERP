import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  output: 'standalone',
  typescript: {
    ignoreBuildErrors: true,
  },
  // Disable React Strict Mode in both dev and production
  reactStrictMode: false,
  // Add environment variables for build time
  env: {
    TURSO_DATABASE_URL: process.env.TURSO_DATABASE_URL || 'libsql://baytech-shahnawazpathan.aws-ap-south-1.turso.io',
    TURSO_AUTH_TOKEN: process.env.TURSO_AUTH_TOKEN || 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3NjI0OTM1OTIsImlkIjoiZmJlMjM5MzktYzc4OC00OWQzLWEzYzEtNjU5YTIyZDNhZTBjIiwicmlkIjoiYzNjY2Y4MDctYmVjOS00ZWNmLWJhZDItNzQ1NjkwMjJkZWYwIn0.iONfkGJQnBcIDl0ncthJnRktWkUBNV9sr2km2eKHEgd0UzNtdSE709py9CgA4CDozdEYvQgct90zw4H9pFqSDw',
  },
  experimental: {
    serverComponentsExternalPackages: [
      '@libsql/client',
      '@prisma/adapter-libsql',
      '@prisma/client',
      '@prisma/engines',
    ],
    outputFileTracingIncludes: {
      '/api/**/*': ['./node_modules/@libsql/client/http/**/*'],
    },
    outputFileTracingExcludes: {
      '/api/**/*': ['./node_modules/@libsql/darwin-arm64/**/*', './node_modules/@libsql/linux-x64/**/*', './node_modules/@libsql/win32-x64/**/*'],
    },
  },
  webpack: (config, { dev, isServer }) => {
    if (dev) {
      // Disable webpack hot module replacement in dev
      config.watchOptions = {
        ignored: ['**/*'], // Ignore all file changes
      };
    }

    // Add loaders for problematic file types
    config.module = config.module || {};
    config.module.rules = config.module.rules || [];

    config.module.rules.push({
      test: /\.(md|txt)$/,
      use: 'raw-loader',
    });

    config.module.rules.push({
      test: /LICENSE$/,
      use: 'raw-loader',
    });

    config.module.rules.push({
      test: /\.node$/,
      use: 'file-loader',
    });

    config.module.rules.push({
      test: /\.d\.ts$/,
      use: 'null-loader',
    });

    // Handle Prisma native bindings - exclude from webpack bundling
    if (isServer) {
      // Externalize Prisma native bindings on server side
      config.externals = config.externals || [];
      config.externals.push({
        '.prisma/client/index-browser': '@prisma/client/index-browser',
        '@prisma/client': 'commonjs @prisma/client',
        '@prisma/engines': 'commonjs @prisma/engines',
      });

      // Ignore platform-specific binaries that webpack tries to include
      config.plugins = config.plugins || [];
      config.plugins.push(
        new (require('webpack').IgnorePlugin)({
          resourceRegExp: /^\.\/darwin-arm64$|^\.\/darwin-x64$|^\.\/linux-arm64$|^\.\/linux-x64$|^\.\/win32-x64$/,
          contextRegExp: /@prisma\/client/,
        })
      );
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
    // Ignore ESLint errors during builds
    ignoreDuringBuilds: true,
  },
  // Ensure development features are disabled in production
  productionBrowserSourceMaps: false,
};

export default nextConfig;

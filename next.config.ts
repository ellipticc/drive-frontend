import { withSentryConfig } from '@sentry/nextjs';
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: false,
  images: {
    unoptimized: true,
  },
  compress: true, // Enable gzip compression
  poweredByHeader: false, // Remove X-Powered-By header for security
  experimental: {
    optimizeCss: true, // Optimize CSS
  },
  webpack: (config) => {
    // Set externals for modules that can't be bundled on server
    config.externals = config.externals || [];
    config.externals.push(
      '@noble/post-quantum'
    );

    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      crypto: false,
    };

    return config;
  },
  turbopack: {},
};

const sentryOptions = {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: "drive-41",

  project: "node-express",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,
  // tunnelRoute: "/monitoring",

  // Webpack-based configuration replacing deprecated options
  webpack: {
    // Automatically tree-shake Sentry logger statements to reduce bundle size
    treeshake: {
      removeDebugLogging: true,
    },
    automaticVercelMonitors: true,
  },
};

export default withSentryConfig(nextConfig, sentryOptions as Parameters<typeof withSentryConfig>[1]);

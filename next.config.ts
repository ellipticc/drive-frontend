import { withSentryConfig } from '@sentry/nextjs';
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  trailingSlash: false,
  productionBrowserSourceMaps: true,
  images: {
    unoptimized: true,
  },
  compress: true, // Enable gzip compression
  poweredByHeader: false, // Remove X-Powered-By header for security
  experimental: {
    optimizeCss: true, // Optimize CSS
    scrollRestoration: true, // Better navigation performance
  },
  webpack: (config) => {
    // config.externals.push(
    //   '@noble/post-quantum'
    // );

    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      crypto: false,
    };

    // Completely exclude Sentry Session Replay / rrweb from the client bundle.
    // Even with replaysSessionSampleRate: 0, the replay packages still load and
    // patch native DOM methods (insertBefore, removeChild, appendChild) which
    // causes React's fiber reconciler to crash with NotFoundError.
    config.resolve.alias = {
      ...config.resolve.alias,
      '@sentry-internal/replay': false,
      '@sentry-internal/replay-canvas': false,
      'rrweb': false,
      'rrweb-snapshot': false,
    };

    // CSS optimization
    if (!config.optimization) config.optimization = {};
    config.optimization.splitChunks = {
      ...config.optimization.splitChunks,
      cacheGroups: {
        ...config.optimization.splitChunks?.cacheGroups,
        // Separate CSS chunks for better caching
        styles: {
          name: 'styles',
          test: /\.css$/,
          chunks: 'all',
          enforce: true,
        },
        // Separate vendor chunks (exclude worker files — they need self-contained bundles)
        vendor: {
          test: (module: any) => {
            if (!module.resource) return false;
            // Don't split vendor code that workers depend on
            if (/[\\/]workers[\\/]/.test(module.issuer?.resource || '')) return false;
            return /[\\/]node_modules[\\/]/.test(module.resource);
          },
          name: 'vendors',
          chunks: 'all',
          priority: 10,
        },
        // Separate large libraries
        'react-vendor': {
          test: /[\\/]node_modules[\\/](react|react-dom|next)[\\/]/,
          name: 'react-vendor',
          chunks: 'all',
          priority: 20,
        },
      },
    };

    // Enable webpack optimizations
    config.optimization = {
      ...config.optimization,
      moduleIds: 'deterministic', // Better long-term caching
      chunkIds: 'deterministic', // Better long-term caching
      // Minimize bundle size
      minimize: true,
      // Remove unused code
      usedExports: true,
      // Merge duplicate chunks
      mergeDuplicateChunks: true,
    };

    return config;
  },
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
    // Disable automatic Vercel monitors to prevent duplicate events
    automaticVercelMonitors: false,
  },
};

export default withSentryConfig(nextConfig, sentryOptions as Parameters<typeof withSentryConfig>[1]);

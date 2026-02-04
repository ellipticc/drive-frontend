import { withSentryConfig } from '@sentry/nextjs';
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
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
        // Separate vendor chunks
        vendor: {
          test: /[\\/]node_modules[\\/]/,
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
    automaticVercelMonitors: true,
  },
};

export default withSentryConfig(nextConfig, sentryOptions as Parameters<typeof withSentryConfig>[1]);

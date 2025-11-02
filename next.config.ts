import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // output: 'export', // Removed for dynamic routing support
  trailingSlash: false,
  images: {
    unoptimized: true,
  },
  webpack: (config, { isServer }) => {
    // Exclude libopaque from SSR - it MUST only run on client
    if (isServer) {
      // This prevents Next.js from even attempting to parse libopaque imports during SSR
      config.module.rules.push({
        test: /libopaque/,
        loader: 'ignore-loader',
      });
    }

    // Set externals for modules that can't be bundled on server
    config.externals = config.externals || [];
    config.externals.push(
      'libopaque',
      '@noble/post-quantum'
    );

    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      crypto: false,
    };

    // Enable WebAssembly support
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      topLevelAwait: true,
    };

    // Handle Web Workers as assets
    config.module.rules.push({
      test: /\.worker\.(js|ts)$/,
      type: 'asset/resource',
      generator: {
        filename: 'static/workers/[hash][ext]',
      },
    });

    // Handle WASM files properly
    config.module.rules.push({
      test: /\.wasm$/,
      type: 'webassembly/async',
    });

    return config;
  },
  turbopack: {},
};

export default nextConfig;
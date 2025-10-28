import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // output: 'export', // Removed for dynamic routing support
  trailingSlash: false,
  images: {
    unoptimized: true,
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Ignore Node.js modules in client-side bundles
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      };
    }

    // Exclude @noble/post-quantum from bundling
    config.externals = config.externals || [];
    config.externals.push({
      '@noble/post-quantum': '@noble/post-quantum'
    });

    // Enable WebAssembly experiments for argon2-browser and zstd-wasm
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };

    // Handle Web Workers as assets
    config.module.rules.push({
      test: /\.worker\.(js|ts)$/,
      type: 'asset/resource',
      generator: {
        filename: 'static/workers/[hash][ext]',
      },
    });

    // Handle WASM files
    config.module.rules.push({
      test: /\.wasm$/,
      type: 'asset/resource',
      generator: {
        filename: 'static/wasm/[hash][ext]',
      },
    });

    return config;
  },
  turbopack: {},
};

export default nextConfig;
import { withSentryConfig } from '@sentry/nextjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
    trailingSlash: false,
    productionBrowserSourceMaps: true,
    images: {
        unoptimized: true,
    },
    compress: true, // Enable gzip compression
    experimental: {
        // optimizeCss: true, // Disable to ensure Webpack
    },
    webpack: (config) => {
        config.resolve.fallback = {
            ...config.resolve.fallback,
            fs: false,
            path: false,
            crypto: false,
        };

        // Completely exclude Sentry Session Replay / rrweb from the client bundle.
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
                // Separate vendor chunks
                vendor: {
                    test: (module) => {
                        if (!module.resource) return false;
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
    org: "drive-41",
    project: "node-express",
    silent: !process.env.CI,
    widenClientFileUpload: true,
    webpack: {
        treeshake: {
            removeDebugLogging: true,
        },
        automaticVercelMonitors: false,
    },
};

export default withSentryConfig(nextConfig, sentryOptions);

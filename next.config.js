/** @type {import('next').NextConfig} */
const nextConfig = {
    // Disable source maps in production for security and smaller bundle size
    productionBrowserSourceMaps: false,

    // Optimize for production
    poweredByHeader: false,

    // Enable React strict mode for better development experience
    reactStrictMode: true,

    // Compiler options
    compiler: {
        // Remove console.log in production
        removeConsole: process.env.NODE_ENV === 'production' ? {
            exclude: ['error', 'warn'],
        } : false,
    },
};

module.exports = nextConfig;

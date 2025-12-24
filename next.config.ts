// File Path = warehouse-frontend/next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,

  // Performance optimizations
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },

  // Faster builds with SWC
  swcMinify: true,

  // Optimize images
  images: {
    unoptimized: false,
  },
};

export default nextConfig;

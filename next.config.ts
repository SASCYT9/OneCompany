import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Для Docker standalone output
  output: 'standalone',
  
  // Оптимізація для продакшену
  compress: true,
  
  // Experimental features
  experimental: {
    optimizeCss: true,
  },
};

export default nextConfig;

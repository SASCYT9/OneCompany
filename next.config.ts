import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  // Для Docker standalone output
  output: 'standalone',
  
  // Оптимізація для продакшену
  compress: true,
  poweredByHeader: false, // Security: remove X-Powered-By header
  
  // Images configuration - optimized for SEO & performance
  images: {
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns: [],
    formats: ['image/avif', 'image/webp'], // Modern image formats
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days cache
  },
  
  // HTTP Headers for SEO & Security
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
      {
        // Cache static assets
        source: '/branding/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // Cache logos
        source: '/logos/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
  
  // Experimental features
  experimental: {
    optimizeCss: false,
  },
  async redirects() {
    return [
      {
        source: '/',
        destination: '/ua',
        permanent: true
      },
      {
        source: '/categories',
        destination: '/ua/categories',
        permanent: true
      },
      {
        source: '/categories/:slug*',
        destination: '/ua/categories/:slug*',
        permanent: true
      },
      {
        source: '/about',
        destination: '/ua/about',
        permanent: true
      },
      {
        source: '/auto',
        destination: '/ua/auto',
        permanent: true
      },
      {
        source: '/moto',
        destination: '/ua/moto',
        permanent: true
      },
      {
        source: '/brands',
        destination: '/ua/brands',
        permanent: true
      },
      {
        source: '/contact',
        destination: '/ua/contact',
        permanent: true
      },
      {
        source: '/choice',
        destination: '/ua/choice',
        permanent: true
      }
    ];
  }
};

export default withNextIntl(nextConfig);

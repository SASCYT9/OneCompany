import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  // Для Docker standalone output
  output: 'standalone',
  
  // Оптимізація для продакшену
  compress: true,
  
  // Images configuration
  images: {
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns: [],
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
        permanent: false
      },
      {
        source: '/categories',
        destination: '/ua/categories',
        permanent: false
      },
      {
        source: '/categories/:slug*',
        destination: '/ua/categories/:slug*',
        permanent: false
      },
      {
        source: '/about',
        destination: '/ua/about',
        permanent: false
      },
      {
        source: '/auto',
        destination: '/ua/auto',
        permanent: false
      },
      {
        source: '/moto',
        destination: '/ua/moto',
        permanent: false
      },
      {
        source: '/brands',
        destination: '/ua/brands',
        permanent: false
      },
      {
        source: '/contact',
        destination: '/ua/contact',
        permanent: false
      },
      {
        source: '/choice',
        destination: '/ua/choice',
        permanent: false
      }
    ];
  }
};

export default withNextIntl(nextConfig);

import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const isProd = process.env.NODE_ENV === 'production';

const STATIC_REMOTE_IMAGE_HOSTS = [
  'cdn.shopify.com',
  'www.racechip.eu',
  'www.brabus.com',
  'burgertuning.com',
  'www.burgertuning.com',
  'www.jb4tech.com',
  'www.do88.se',
  'gp-portal.eu',
  'images.unsplash.com',
  'kwsuspension.shop',
  'fiexhaust.shop',
  'eventuri.shop',
  'smgassets.blob.core.windows.net',
  'parts.ford.com',
  'www.akrapovic.com',
  'www.brembo.com',
  'cobrasport.com',
  'www.aim-sportline.com',
  'fuel-it.com',
  'www.fuel-it.com',
  'onecompany.global',
  'one-company.com.ua',
  'd3pd3d30e33rxi.cloudfront.net',
];

function parseHostname(value: string | null | undefined) {
  const normalized = String(value ?? '').trim();
  if (!normalized) {
    return null;
  }

  try {
    return new URL(normalized.startsWith('http') ? normalized : `https://${normalized}`).hostname.toLowerCase();
  } catch {
    return null;
  }
}

const configuredRemoteImageHosts = (process.env.NEXT_IMAGE_REMOTE_HOSTS || '')
  .split(',')
  .map((entry) => parseHostname(entry))
  .filter((hostname): hostname is string => Boolean(hostname));

const remoteImageHosts = Array.from(
  new Set([...STATIC_REMOTE_IMAGE_HOSTS, ...configuredRemoteImageHosts])
);

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'self'",
  // Next/React + current analytics snippets rely on inline scripts/styles.
  "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://connect.facebook.net https://www.clarity.ms https://www.google-analytics.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https:",
  "connect-src 'self' https://www.google-analytics.com https://region1.google-analytics.com https://www.googletagmanager.com https://connect.facebook.net https://www.facebook.com https://www.clarity.ms https://c.clarity.ms https://bank.gov.ua",
  "frame-src 'self' https://www.googletagmanager.com https://player.vimeo.com https://maps.google.com https://www.youtube.com https://www.youtube-nocookie.com",
  'upgrade-insecure-requests',
].join('; ');

const MEDIA_ROUTE_TRACE_INCLUDES = [
  'public/media/media.json',
  'public/media/*',
];
const MEDIA_ROUTE_TRACE_EXCLUDES = [
  'public/media/shop/**/*',
  'public/images/**/*',
  'public/videos/**/*',
  'public/branding/**/*',
  'public/logos/**/*',
  'public/models/**/*',
  'Design/**/*',
  'backups/**/*',
  'docs/**/*',
  'tests/**/*',
  'wiki/**/*',
];

const VIDEO_UPLOAD_TRACE_INCLUDES = ['public/videos/uploads/**/*'];
const VIDEO_UPLOAD_TRACE_EXCLUDES = [
  'public/images/**/*',
  'public/videos/shop/**/*',
  'public/branding/**/*',
  'public/logos/**/*',
  'public/models/**/*',
  'Design/**/*',
  'backups/**/*',
  'docs/**/*',
  'tests/**/*',
  'wiki/**/*',
];

const nextConfig: NextConfig = {
  // Для Docker standalone output
  output: 'standalone',

  // Оптимізація для продакшену
  compress: true,
  poweredByHeader: false, // Security: remove X-Powered-By header
  outputFileTracingIncludes: {
    'api/media': MEDIA_ROUTE_TRACE_INCLUDES,
    'api/media/[id]': MEDIA_ROUTE_TRACE_INCLUDES,
    'api/admin/shop/media': MEDIA_ROUTE_TRACE_INCLUDES,
    'api/admin/shop/media/[id]': MEDIA_ROUTE_TRACE_INCLUDES,
    'api/admin/upload-video': VIDEO_UPLOAD_TRACE_INCLUDES,
  },
  outputFileTracingExcludes: {
    'api/media': MEDIA_ROUTE_TRACE_EXCLUDES,
    'api/media/[id]': MEDIA_ROUTE_TRACE_EXCLUDES,
    'api/admin/shop/media': MEDIA_ROUTE_TRACE_EXCLUDES,
    'api/admin/shop/media/[id]': MEDIA_ROUTE_TRACE_EXCLUDES,
    'api/admin/upload-video': VIDEO_UPLOAD_TRACE_EXCLUDES,
  },

  // Images configuration - optimized for SEO & performance
  images: {
    dangerouslyAllowSVG: false,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns: [
      ...remoteImageHosts.map((hostname) => ({
        protocol: 'https' as const,
        hostname,
      })),
    ],
    formats: ['image/avif', 'image/webp'], // Modern image formats
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days cache
  },

  // HTTP Headers for SEO & Security
  async headers() {
    return [
      {
        // Keep admin tooling out of search results
        source: '/admin',
        headers: [
          {
            key: 'X-Robots-Tag',
            value: 'noindex, nofollow, noarchive',
          },
        ],
      },
      {
        // Keep admin tooling out of search results
        source: '/admin/:path*',
        headers: [
          {
            key: 'X-Robots-Tag',
            value: 'noindex, nofollow, noarchive',
          },
        ],
      },
      {
        // Telegram mini app is not intended for organic indexing
        source: '/telegram-app',
        headers: [
          {
            key: 'X-Robots-Tag',
            value: 'noindex, nofollow, noarchive',
          },
        ],
      },
      {
        // Telegram mini app is not intended for organic indexing
        source: '/telegram-app/:path*',
        headers: [
          {
            key: 'X-Robots-Tag',
            value: 'noindex, nofollow, noarchive',
          },
        ],
      },
      {
        // APIs must not be indexed
        source: '/api/:path*',
        headers: [
          {
            key: 'X-Robots-Tag',
            value: 'noindex, nofollow, noarchive',
          },
        ],
      },
      {
        source: '/:path*',
        headers: [
          ...(isProd
            ? [
                {
                  key: 'Content-Security-Policy',
                  value: CONTENT_SECURITY_POLICY,
                },
              ]
            : []),
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
      {
        // Cache images
        source: '/images/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // Cache videos
        source: '/videos/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // Cache 3D models
        source: '/models/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },

  async redirects() {
    return [
      {
        source: '/ua/blog/one-company-dtskmdmjfgf',
        destination: '/ua/blog',
        permanent: true,
      },
      {
        source: '/en/blog/one-company-dtskmdmjfgf',
        destination: '/en/blog',
        permanent: true,
      },
      {
        source: '/blog/one-company-dtskmdmjfgf',
        destination: '/ua/blog',
        permanent: true,
      },
    ];
  },

  // Experimental features
  experimental: {
    optimizeCss: true,
    // Keep build parallel enough to stay fast, but avoid exhausting the DB pool during prerendering.
    cpus: 4,
  },
  // redirects removed to allow middleware to handle routing dynamically
};

export default withNextIntl(nextConfig);

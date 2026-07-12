import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { SHOP_PRODUCT_LEGACY_PREFIX_ROUTES } from "./src/lib/storefrontRouteRegistry";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const isProd = process.env.NODE_ENV === "production";
const isVercel = process.env.VERCEL === "1" || process.env.VERCEL === "true";

const STATIC_REMOTE_IMAGE_HOSTS = [
  "cdn.shopify.com",
  "cdn11.bigcommerce.com",
  "www.racechip.eu",
  "www.brabus.com",
  "burgertuning.com",
  "www.burgertuning.com",
  "www.jb4tech.com",
  "www.do88.se",
  "www.do88performance.eu",
  "gp-portal.eu",
  "images.unsplash.com",
  "kwsuspension.shop",
  "fiexhaust.shop",
  "eventuri.shop",
  "smgassets.blob.core.windows.net",
  "parts.ford.com",
  "www.akrapovic.com",
  "www.brembo.com",
  "cobrasport.com",
  "www.aim-sportline.com",
  "fuel-it.com",
  "www.fuel-it.com",
  "onecompany.global",
  "one-company.com.ua",
  "d3pd3d30e33rxi.cloudfront.net",
  "d1sfhav1wboke3.azureedge.net",
  "cdn.sanity.io",
  "houseofurban.co.uk",
];

function parseHostname(value: string | null | undefined) {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    return null;
  }

  try {
    return new URL(
      normalized.startsWith("http") ? normalized : `https://${normalized}`
    ).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function normalizeAbsoluteUrl(value: string | null | undefined) {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    return null;
  }

  const candidate = normalized.startsWith("http") ? normalized : `https://${normalized}`;

  try {
    return new URL(candidate).toString();
  } catch {
    return null;
  }
}

const configuredRemoteImageHosts = (process.env.NEXT_IMAGE_REMOTE_HOSTS || "")
  .split(",")
  .map((entry) => parseHostname(entry))
  .filter((hostname): hostname is string => Boolean(hostname));

const remoteImageHosts = Array.from(
  new Set([...STATIC_REMOTE_IMAGE_HOSTS, ...configuredRemoteImageHosts])
);

const normalizedSiteUrl =
  normalizeAbsoluteUrl(process.env.NEXT_PUBLIC_SITE_URL) ?? "https://onecompany.global/";
const normalizedNextAuthUrl =
  normalizeAbsoluteUrl(process.env.NEXTAUTH_URL) ??
  normalizeAbsoluteUrl(process.env.VERCEL_URL) ??
  normalizedSiteUrl;
const normalizedNextAuthUrlInternal =
  normalizeAbsoluteUrl(process.env.NEXTAUTH_URL_INTERNAL) ?? normalizedNextAuthUrl;

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
  "media-src 'self' data: blob: https://*.public.blob.vercel-storage.com https://d1sfhav1wboke3.azureedge.net",
  "connect-src 'self' https://www.google-analytics.com https://region1.google-analytics.com https://www.googletagmanager.com https://connect.facebook.net https://www.facebook.com https://www.clarity.ms https://c.clarity.ms https://bank.gov.ua",
  "frame-src 'self' https://www.googletagmanager.com https://player.vimeo.com https://maps.google.com https://www.youtube.com https://www.youtube-nocookie.com",
  "upgrade-insecure-requests",
].join("; ");

const MEDIA_ROUTE_TRACE_INCLUDES = ["public/media/media.json", "public/media/*"];
const MEDIA_ROUTE_TRACE_EXCLUDES = [
  "public/media/shop/**/*",
  "public/images/**/*",
  "public/videos/**/*",
  "public/branding/**/*",
  "public/logos/**/*",
  "public/models/**/*",
  "Design/**/*",
  "backups/**/*",
  "docs/**/*",
  "tests/**/*",
  "wiki/**/*",
];

const VIDEO_UPLOAD_TRACE_INCLUDES = ["public/videos/uploads/**/*"];
const VIDEO_UPLOAD_TRACE_EXCLUDES = [
  "public/images/**/*",
  "public/videos/shop/**/*",
  "public/branding/**/*",
  "public/logos/**/*",
  "public/models/**/*",
  "Design/**/*",
  "backups/**/*",
  "docs/**/*",
  "tests/**/*",
  "wiki/**/*",
];

const SHOP_PRODUCT_ROUTE_TRACE_EXCLUDES = [
  "public/images/shop/urban/**/*",
  "public/images/shop/ilmberger/**/*",
  "reference/urban-shopify-theme/**/*",
];

const PAGED_LISTING_PATHS = [
  "/shop/adro/collections",
  "/shop/brabus/products",
  "/shop/burger/products",
  "/shop/csf/collections",
  "/shop/girodisc/catalog",
  "/shop/ipe/collections",
  "/shop/ohlins/catalog",
  "/shop/racechip/catalog",
] as const;

// Broad excludes for admin API routes that don't need any storefront media.
// Without this, Next.js's output-tracing greedily bundles public/images for
// any route that touches an asset path, blowing past the 300 MB Function
// size limit. Forged references route in particular went to 1.04 GB.
const ADMIN_API_NO_MEDIA_EXCLUDES = [
  "public/images/**/*",
  "public/videos/**/*",
  "public/branding/**/*",
  "public/models/**/*",
  "Design/**/*",
  "backups/**/*",
  "docs/**/*",
  "tests/**/*",
  "wiki/**/*",
];

const fileBackedMediaTracingIncludes: Record<string, string[]> | undefined = isVercel
  ? undefined
  : {
      "api/media": MEDIA_ROUTE_TRACE_INCLUDES,
      "api/media/[id]": MEDIA_ROUTE_TRACE_INCLUDES,
      "api/admin/shop/media": MEDIA_ROUTE_TRACE_INCLUDES,
      "api/admin/shop/media/[id]": MEDIA_ROUTE_TRACE_INCLUDES,
      "api/admin/upload-video": VIDEO_UPLOAD_TRACE_INCLUDES,
    };

const fileBackedMediaTracingExcludes: Record<string, string[]> = {
  ...(isVercel
    ? {}
    : {
        "api/media": MEDIA_ROUTE_TRACE_EXCLUDES,
        "api/media/[id]": MEDIA_ROUTE_TRACE_EXCLUDES,
        "api/admin/shop/media": MEDIA_ROUTE_TRACE_EXCLUDES,
        "api/admin/shop/media/[id]": MEDIA_ROUTE_TRACE_EXCLUDES,
        "api/admin/upload-video": VIDEO_UPLOAD_TRACE_EXCLUDES,
      }),
  "[locale]/shop/[slug]": SHOP_PRODUCT_ROUTE_TRACE_EXCLUDES,
  "[locale]/shop/urban/products/[slug]": SHOP_PRODUCT_ROUTE_TRACE_EXCLUDES,
  "[locale]/shop/ilmberger/products/[slug]": SHOP_PRODUCT_ROUTE_TRACE_EXCLUDES,
  "/[locale]/shop/[slug]": SHOP_PRODUCT_ROUTE_TRACE_EXCLUDES,
  "/[locale]/shop/urban/products/[slug]": SHOP_PRODUCT_ROUTE_TRACE_EXCLUDES,
  "/[locale]/shop/ilmberger/products/[slug]": SHOP_PRODUCT_ROUTE_TRACE_EXCLUDES,
  // Admin API endpoints that ballooned to 1+ GB when tracing pulled in
  // every public/images file. Explicit per-route excludes.
  "api/admin/shop/forged/references": ADMIN_API_NO_MEDIA_EXCLUDES,
  "api/admin/shop/forged/references/[slug]/generation": ADMIN_API_NO_MEDIA_EXCLUDES,
};

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],

  // Для Docker standalone output
  output: isVercel ? undefined : "standalone",

  env: {
    NEXTAUTH_URL: normalizedNextAuthUrl,
    NEXTAUTH_URL_INTERNAL: normalizedNextAuthUrlInternal,
  },

  // Оптимізація для продакшену
  compress: true,
  poweredByHeader: false, // Security: remove X-Powered-By header
  // Local media libraries live on disk and can exceed Vercel's 250 MB function limit.
  outputFileTracingIncludes: fileBackedMediaTracingIncludes,
  outputFileTracingExcludes: fileBackedMediaTracingExcludes,

  // Images configuration - optimized for SEO & performance
  images: {
    dangerouslyAllowSVG: false,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns: [
      ...remoteImageHosts.map((hostname) => ({
        protocol: "https" as const,
        hostname,
      })),
      // Vercel Blob storage — admin product images live here
      {
        protocol: "https" as const,
        hostname: "**.public.blob.vercel-storage.com",
      },
    ],
    formats: ["image/avif", "image/webp"], // Modern image formats
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    // Next 16 requires explicit allowlist for the `quality` prop. Without
    // this Next falls back to default 75 silently for any q={85|90} usage.
    qualities: [75, 85, 90],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days cache
  },

  // HTTP Headers for SEO & Security
  async headers() {
    return [
      {
        // Keep admin tooling out of search results
        source: "/admin",
        headers: [
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow, noarchive",
          },
        ],
      },
      {
        // Keep admin tooling out of search results
        source: "/admin/:path*",
        headers: [
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow, noarchive",
          },
        ],
      },
      {
        // Telegram mini app is not intended for organic indexing
        source: "/telegram-app",
        headers: [
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow, noarchive",
          },
        ],
      },
      {
        // Telegram mini app is not intended for organic indexing
        source: "/telegram-app/:path*",
        headers: [
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow, noarchive",
          },
        ],
      },
      {
        // APIs must not be indexed
        source: "/api/:path*",
        headers: [
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow, noarchive",
          },
        ],
      },
      {
        // Quote/checkout flow is transactional, not for organic indexing
        source: "/quote",
        headers: [
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow, noarchive",
          },
        ],
      },
      {
        source: "/quote/:path*",
        headers: [
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow, noarchive",
          },
        ],
      },
      {
        // Turn14 hub is a 700k-part live proxy — keep crawlers out so
        // they don't waste budget on dynamic search permutations.
        source: "/:locale(ua|en)/shop/turn14/:path*",
        headers: [
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow, noarchive",
          },
        ],
      },
      {
        source: "/:locale(ua|en)/shop/turn14",
        headers: [
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow, noarchive",
          },
        ],
      },
      {
        source: "/:locale(ua|en)/admin/:path*",
        headers: [
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow, noarchive",
          },
        ],
      },
      {
        source: "/:locale(ua|en)/shop/:surface(account|cart|checkout|stock)/:path*",
        headers: [
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow, noarchive",
          },
        ],
      },
      {
        source: "/:path*",
        headers: [
          ...(isProd
            ? [
                {
                  key: "Content-Security-Policy",
                  value: CONTENT_SECURITY_POLICY,
                },
                {
                  // HTTPS-only for the next 12 months + apply to all
                  // subdomains. preload makes the entry eligible for
                  // Chrome's HSTS preload list once submitted at
                  // hstspreload.org.
                  key: "Strict-Transport-Security",
                  value: "max-age=31536000; includeSubDomains; preload",
                },
              ]
            : []),
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "origin-when-cross-origin",
          },
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
      {
        // Cache static assets
        source: "/branding/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/catalog-index/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
      {
        source: "/catalog-index/manifest.json",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, s-maxage=300, must-revalidate" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
      {
        // Cache logos
        source: "/logos/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        // Cache images
        source: "/images/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        // Cache videos
        source: "/videos/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        // Cache 3D models
        source: "/models/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },

  async redirects() {
    // 41 brand-detail URLs (`/{locale}/brands/{slug}`) returned 5xx in Jan 2026
    // when the route existed but Prisma failed; route was later removed so they
    // now 404. GSC still reports them as 5xx (last crawled Jan 2026). Source:
    // GSC 5xx drilldown 2026-05-22.
    const deadBrandSlugs = [
      "alpha-racing",
      "are-dry-sump",
      "arp-racingparts",
      "arrow",
      "aston-martin",
      "borla",
      "brixton-wheels",
      "capit",
      "dinan",
      "eventuri",
      "gruppe-m",
      "harrop",
      "healtech",
      "heico",
      "hm-quickshifter",
      "ixil",
      "kline-innovation",
      "kooks-headers",
      "mamba-turbo",
      "modena-engineering",
      "motiv-motorsport",
      "mountune",
      "racefoxx",
      "rotobox",
      "ryft",
      "s2-concept",
      "silly-rabbit-motorsport",
      "spool-performance",
      "starlane",
      "strasse-wheels",
      "supersprint",
      "tss",
      "valtermoto",
      "verus-engineering",
      "vorsteiner",
      "wald",
    ];

    return [
      ...PAGED_LISTING_PATHS.flatMap((path) => [
        {
          source: `/:locale(ua|en)${path}`,
          destination: `/:locale${path}`,
          permanent: true,
          has: [{ type: "query" as const, key: "page", value: "1" }],
        },
        {
          source: `/:locale(ua|en)${path}`,
          destination: `/:locale${path}/page/:pageNumber`,
          permanent: true,
          has: [
            {
              type: "query" as const,
              key: "page",
              value: "(?<pageNumber>(?:[2-9]|[1-9][0-9]+))",
            },
          ],
        },
      ]),
      ...SHOP_PRODUCT_LEGACY_PREFIX_ROUTES.map(({ prefix, segment }) => ({
        source: `/:locale(ua|en)/shop/:slug(${prefix}.*)`,
        destination: `/:locale/shop/${segment}/products/:slug`,
        permanent: true,
      })),
      {
        source: "/:locale(ua|en)/admin/shop/turn14-sync",
        destination: "/admin/shop/turn14-sync",
        permanent: true,
      },
      {
        source: "/ua/blog/one-company-dtskmdmjfgf",
        destination: "/ua/blog",
        permanent: true,
      },
      {
        source: "/en/blog/one-company-dtskmdmjfgf",
        destination: "/en/blog",
        permanent: true,
      },
      {
        source: "/blog/one-company-dtskmdmjfgf",
        destination: "/ua/blog",
        permanent: true,
      },
      {
        source: "/:locale(ua|en)/brands/adro",
        destination: "/:locale/shop/adro",
        permanent: true,
      },
      {
        source: "/:locale(ua|en)/brands/one-company-forged",
        destination: "/:locale/brands",
        permanent: true,
      },
      {
        source: `/:locale(ua|en)/brands/:slug(${deadBrandSlugs.join("|")})`,
        destination: "/:locale/brands",
        permanent: true,
      },
    ];
  },

  // Experimental features
  experimental: {
    optimizeCss: true,
    // Smaller server-side React bundle.
    optimizeServerReact: true,
    // Keep build parallel enough to stay fast, but avoid exhausting the DB pool during prerendering.
    cpus: 1,
    // Tree-shake & barrel-optimize popular packages — meaningfully smaller client bundles.
    optimizePackageImports: [
      "framer-motion",
      "lucide-react",
      "gsap",
      "@gsap/react",
      "date-fns",
      "lodash-es",
      "@radix-ui/react-icons",
      "lenis",
      "react-hook-form",
      "zustand",
      "@vercel/analytics",
      "next-intl",
    ],
  },
  // redirects removed to allow middleware to handle routing dynamically
};

export default withNextIntl(nextConfig);

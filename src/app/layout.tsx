import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import { ThemeProvider } from "@/components/ui/ThemeProvider";
import AuthProvider from "@/components/AuthProvider";
import { IBM_Plex_Mono, Unbounded, Bebas_Neue } from "next/font/google";
import {
  OrganizationSchema,
  WebSiteSchema,
  LocalBusinessSchema,
} from "@/components/seo/StructuredData";
import GoogleAnalytics from "@/components/analytics/GoogleAnalytics";
import MicrosoftClarity from "@/components/analytics/MicrosoftClarity";
import MetaPixel from "@/components/analytics/MetaPixel";
import { Analytics } from "@vercel/analytics/react";
import { siteConfig } from "@/lib/seo";
// Root layout should be lean; navigation is rendered inside locale layout to access translations

const siteUrl = siteConfig.url;

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#000000",
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title:
    "OneCompany — Premium Auto & Moto Tuning | Akrapovic, Brabus, Mansory | Worldwide Shipping",
  description:
    "Official distributor 200+ premium tuning brands: Akrapovic, Brabus, Mansory, HRE, KW, Ohlins. Exhaust systems, suspension, wheels, carbon fiber. Worldwide shipping USA, Europe, Ukraine.",
  keywords: [
    "OneCompany",
    "One Company Global",
    "premium auto tuning",
    "premium moto tuning",
    "performance parts",
    "exhaust systems",
    "suspension upgrade",
    "forged wheels",
    "carbon body kit",
    "chip tuning",
    "Akrapovic",
    "Brabus",
    "Mansory",
    "HRE Wheels",
    "KW Suspension",
    "Ohlins",
    "Brembo",
    "тюнінг Київ",
    "тюнінг авто Україна",
    "доставка по Україні та світу",
    "тюнінг мото Україна",
  ],
  authors: [{ name: "OneCompany", url: siteUrl }],
  creator: "OneCompany",
  publisher: "OneCompany - Premium Auto & Moto Tuning Worldwide",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  alternates: {
    canonical: siteUrl,
    languages: {
      en: `${siteUrl}/en`,
      uk: `${siteUrl}/ua`,
      "x-default": `${siteUrl}/ua`,
    },
  },
  openGraph: {
    title: "OneCompany — Premium Auto & Moto Tuning | 200+ Brands | Worldwide Shipping",
    description:
      "Official distributor of Akrapovic, Brabus, Mansory, HRE, KW, Ohlins. Exhaust systems, suspension, wheels, carbon fiber. USA, Europe, Middle East shipping.",
    type: "website",
    siteName: "OneCompany - Premium Tuning Worldwide",
    locale: "en_US",
    alternateLocale: "uk_UA",
    url: siteUrl,
    images: [
      {
        url: `${siteUrl}/branding/og-image.png`,
        width: 1200,
        height: 630,
        alt: "OneCompany - Premium Auto Moto Tuning | Akrapovic, Brabus, Mansory, HRE, Ohlins | Worldwide Shipping",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "OneCompany — Premium Tuning | Akrapovic, Brabus, Mansory | Worldwide",
    description:
      "Official distributor 200+ tuning brands. Exhaust systems, suspension, wheels, carbon fiber. USA, Europe, Middle East shipping.",
    images: [`${siteUrl}/branding/og-image.png`],
    creator: "@onecompany_ua",
    site: "@onecompany_ua",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
    // yandex: "your-yandex-verification-code",
  },
  category: "automotive",
};

import { cn } from "@/lib/utils";

// Single Unbounded load, exposed as both --font-display and --font-sans.
// Previously loaded twice — doubled the font payload on every page.
const fontUnbounded = Unbounded({
  subsets: ["latin", "cyrillic"],
  variable: "--font-display",
  display: "swap",
  weight: ["300", "400", "500", "600", "700"],
  preload: true,
});

const fontMono = IBM_Plex_Mono({
  subsets: ["latin", "latin-ext", "cyrillic"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
  preload: false,
});

// Bebas Neue - condensed font for hero headlines (BRABUS, URBAN, AKRAPOVIČ)
const fontCondensed = Bebas_Neue({
  subsets: ["latin", "latin-ext"],
  weight: "400",
  variable: "--font-condensed",
  display: "swap",
  preload: false,
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Default to "uk" — Ukrainian is the default locale and the majority of
  // traffic. For /en pages the LocaleLangSetter client component (mounted
  // in [locale]/layout.tsx) updates `html.lang` after hydration so JS-aware
  // crawlers (including Googlebot) see the correct value.
  //
  // We deliberately do NOT call `await headers()` here — that would force
  // dynamic rendering on every page in the app and bypass ISR edge cache.
  return (
    <html
      lang="uk"
      suppressHydrationWarning
      className={cn(fontUnbounded.variable, fontMono.variable, fontCondensed.variable)}
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Preconnect to analytics origins so the lazy-loaded scripts
            don't pay the TLS+DNS cost when they finally fire after
            interactive. Saves ~100-300ms on each script. */}
        <link rel="preconnect" href="https://www.googletagmanager.com" />
        <link rel="preconnect" href="https://www.google-analytics.com" />
        <link rel="preconnect" href="https://www.clarity.ms" />
        <link rel="preconnect" href="https://connect.facebook.net" />
        {process.env.NODE_ENV !== "production" && (
          <script src="https://mcp.figma.com/mcp/html-to-design/capture.js" async />
        )}
      </head>
      <body
        className={cn("min-h-screen bg-background text-foreground antialiased")}
        suppressHydrationWarning
      >
        {/* Schema.org Structured Data */}
        <OrganizationSchema />
        <WebSiteSchema />
        <LocalBusinessSchema locale="ua" />

        {process.env.NEXT_PUBLIC_GA_ID && <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_ID} />}

        {process.env.NEXT_PUBLIC_CLARITY_ID && (
          <MicrosoftClarity id={process.env.NEXT_PUBLIC_CLARITY_ID} />
        )}

        {process.env.NEXT_PUBLIC_FB_PIXEL_ID && (
          <MetaPixel id={process.env.NEXT_PUBLIC_FB_PIXEL_ID} />
        )}

        <Analytics />

        {/* Optional: Plausible analytics if NEXT_PUBLIC_PLAUSIBLE_DOMAIN is configured */}
        {process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN ? (
          <Script
            defer
            data-domain={process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN}
            src="https://plausible.io/js/script.js"
          />
        ) : null}
        <AuthProvider>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            {children}
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

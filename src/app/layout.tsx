import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { headers } from "next/headers";
import "./globals.css";
import { ThemeProvider } from "@/components/ui/ThemeProvider";
import AuthProvider from "@/components/AuthProvider";
import { IBM_Plex_Mono, Unbounded } from "next/font/google";
import { OrganizationSchema, WebSiteSchema, LocalBusinessSchema } from "@/components/seo/StructuredData";
import GoogleAnalytics from "@/components/analytics/GoogleAnalytics";
import MicrosoftClarity from "@/components/analytics/MicrosoftClarity";
import MetaPixel from "@/components/analytics/MetaPixel";
import { Analytics } from "@vercel/analytics/react";
// Root layout should be lean; navigation is rendered inside locale layout to access translations

const defaultSiteUrl = "https://onecompany.global";
const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || defaultSiteUrl).replace(/\/$/, "");

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#000000",
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "onecompany — Premium Auto & Moto Performance Hub",
    template: "%s | onecompany",
  },
  description: "Провідний B2B дистриб'ютор та експертна підтримка преміум тюнінгу",
  keywords: [
    "auto tuning Ukraine",
    "moto tuning Ukraine",
    "performance parts",
    "premium automotive",
    "Akrapovic Ukraine",
    "Brabus Ukraine",
    "HRE wheels",
    "KW suspension",
    "b2b distribution",
    "авто тюнінг Україна",
    "мото тюнінг Київ",
    "преміум запчастини",
  ],
  authors: [{ name: "onecompany", url: siteUrl }],
  creator: "onecompany",
  publisher: "onecompany",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  alternates: {
    canonical: siteUrl,
    languages: {
      'en': `${siteUrl}/en`,
      'uk': `${siteUrl}/ua`,
      'x-default': `${siteUrl}/ua`,
    },
  },
  openGraph: {
    title: "premium tuning parts · 200+ brands · one company",
    description: "Провідний B2B дистриб'ютор та експертна підтримка преміум тюнінгу",
    type: "website",
    siteName: "onecompany",
    locale: "uk_UA",
    alternateLocale: "en_US",
    url: siteUrl,
    images: [
      {
        url: `${siteUrl}/branding/og-image.png`,
        width: 1200,
        height: 630,
        alt: "onecompany - premium tuning parts · 200+ brands",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "premium tuning parts · 200+ brands · one company",
    description: "Провідний B2B дистриб'ютор та експертна підтримка преміум тюнінгу",
    images: [`${siteUrl}/branding/og-image.png`],
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
  icons: {
    icon: [
      { url: "/icon.png", type: "image/png", sizes: "512x512" },
      { url: "/branding/one-company-logo.svg", type: "image/svg+xml" },
    ],
    shortcut: "/icon.png",
    apple: "/apple-icon.png",
  },
  manifest: "/manifest.json",
  category: "automotive",
};

import { cn } from "@/lib/utils";

// Unbounded - гострий шрифт для заголовків
const fontDisplay = Unbounded({
  subsets: ["latin", "cyrillic"],
  variable: "--font-display",
  display: "swap",
  weight: ["300", "400", "500", "600", "700"],
});

// Unbounded - тепер використовуємо всюди
const fontSans = Unbounded({
  subsets: ["latin", "cyrillic"],
  variable: "--font-sans",
  display: "swap",
});

const fontMono = IBM_Plex_Mono({
  subsets: ["latin", "latin-ext", "cyrillic"],
  weight: ["400", "500"],
  variable: "--font-mono",
});

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const requestHeaders = await headers();
  const activeLocale = requestHeaders.get("x-next-intl-locale") ?? "ua";
  const htmlLang = activeLocale === "ua" ? "uk" : "en";

  return (
  <html 
    lang={htmlLang}
    suppressHydrationWarning
    className={cn(
      fontSans.variable,
      fontDisplay.variable,
      fontMono.variable
    )}
  >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://fonts.googleapis.com" />
      </head>
      <body
        className={cn(
          "min-h-screen bg-background text-foreground antialiased"
        )}
        suppressHydrationWarning
      >
        {/* Schema.org Structured Data */}
        <OrganizationSchema />
        <WebSiteSchema />
        <LocalBusinessSchema />
        
        {process.env.NEXT_PUBLIC_GA_ID && (
          <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_ID} />
        )}
        
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
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem
            disableTransitionOnChange
          >
            {children}
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

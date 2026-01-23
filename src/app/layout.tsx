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
    default: "OneCompany — Premium Auto & Moto Tuning | Akrapovic, Brabus, Mansory | Worldwide Shipping",
    template: "%s | OneCompany - Premium Tuning",
  },
  description: "Official distributor 200+ premium tuning brands: Akrapovic, Brabus, Mansory, HRE, KW, Ohlins. Exhaust systems, suspension, wheels, carbon fiber. Worldwide shipping USA, Europe, Ukraine.",
  keywords: [
    // USA/International Priority
    "premium car tuning USA",
    "performance parts USA",
    "Akrapovic exhaust USA",
    "Brabus tuning USA",
    "Mansory USA",
    "HRE wheels USA",
    "KW suspension USA",
    "buy Akrapovic online",
    "buy Brabus online",
    "performance exhaust systems",
    "carbon fiber body kit",
    "forged wheels buy",
    "sport suspension kit",
    "stage 2 tuning",
    "ECU tuning",
    "luxury car tuning",
    "supercar parts",
    "exotic car tuning",
    "worldwide shipping tuning",
    // Top Brands Global
    "Akrapovic",
    "Brabus",
    "Mansory",
    "Novitec",
    "ABT Sportsline",
    "HRE Wheels",
    "KW Suspension",
    "Ohlins",
    "Brembo",
    "Vorsteiner",
    "AC Schnitzer",
    "Hamann",
    "Renntech",
    "Weistec",
    "Eventuri",
    "Milltek",
    "Armytrix",
    "IPE exhaust",
    "Capristo",
    "ADV.1 wheels",
    "ANRKY wheels",
    "Vossen wheels",
    "SC-Project",
    "Termignoni",
    "Arrow exhaust",
    // Car Models
    "BMW M tuning",
    "Mercedes AMG tuning",
    "Porsche 911 tuning",
    "Ferrari tuning",
    "Lamborghini tuning",
    "Audi RS tuning",
    "McLaren tuning",
    "Rolls Royce tuning",
    "G-Class tuning",
    // Categories EN
    "exhaust systems",
    "performance suspension",
    "carbon parts",
    "forged wheels",
    "brake systems",
    "turbo upgrade",
    "supercharger kit",
    // Локальні запити UA
    "тюнінг Київ",
    "СТО Київ",
    "тюнінг ательє Київ",
    "чіп тюнінг Київ",
    "авто тюнінг Київ",
    "мото тюнінг Київ",
    "тюнінг авто Україна",
    "преміум тюнінг",
    "Akrapovic Україна",
    "Brabus Україна",
    "Mansory Україна",
    "вихлопні системи",
    "підвіска спортивна",
    "карбонові деталі",
    "диски ковані",
    "купити вихлоп",
    "купити підвіску",
    "доставка по Україні",
    // Russian keywords (for SEO only, not visible to users)
    // Moto RU
    "тюнинг для мотоцикла",
    "мототюнинг",
    "мотоэкипировка Киев",
    "мотоэкипировка",
    "тюнинг мотоцикла",
    "мото запчасти купить",
    "мотозапчасти",
    "выхлоп мотоцикла",
    "глушитель мото",
    "Akrapovic мото",
    "SC-Project купить",
    "Termignoni выхлоп",
    "Ohlins мото",
    "Brembo мото",
    "спортбайк тюнинг",
    // Auto RU
    "тюнинг авто",
    "автотюнинг",
    "автотюнинг Киев",
    "тюнинг машины",
    "тюнинг автомобиля",
    "выхлопная система",
    "карбоновый обвес",
    "кованые диски",
    "литые диски",
    "спортивная подвеска",
    "койловеры купить",
    "чип тюнинг",
    "стейдж 1",
    "стейдж 2",
    "даунпайп",
    "турбо апгрейд",
    // Brands RU
    "Akrapovic купить",
    "Akrapovic цена",
    "Brabus тюнинг",
    "Brabus купить",
    "Mansory обвес",
    "Novitec тюнинг",
    "HRE диски",
    "KW подвеска",
    "Ohlins амортизаторы",
    "Brembo тормоза",
    "ABT Audi",
    "AC Schnitzer BMW",
    // Models RU
    "тюнинг BMW",
    "тюнинг Mercedes",
    "тюнинг Mercedes AMG",
    "тюнинг Audi RS",
    "тюнинг Porsche",
    "тюнинг G-Class",
    "тюнинг Гелендваген",
    "тюнинг Lamborghini",
    "тюнинг Ferrari",
    // Location RU
    "тюнинг Киев",
    "тюнинг Украина",
    "тюнинг магазин Киев",
    "купить тюнинг Киев",
    "onecompany",
    "one company тюнинг",
    "one company Украина",
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
      'en': `${siteUrl}/en`,
      'uk': `${siteUrl}/ua`,
      'x-default': `${siteUrl}/en`,
    },
  },
  openGraph: {
    title: "OneCompany — Premium Auto & Moto Tuning | 200+ Brands | Worldwide Shipping",
    description: "Official distributor of Akrapovic, Brabus, Mansory, HRE, KW, Ohlins. Exhaust systems, suspension, wheels, carbon fiber. USA, Europe, Middle East shipping.",
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
    description: "Official distributor 200+ tuning brands. Exhaust systems, suspension, wheels, carbon fiber. USA, Europe, Middle East shipping.",
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

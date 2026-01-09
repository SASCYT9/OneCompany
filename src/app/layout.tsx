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
    default: "OneCompany — Преміум Тюнінг Авто та Мото | Київ, Україна | Akrapovic, Brabus, Mansory",
    template: "%s | OneCompany - Тюнінг Київ",
  },
  description: "Офіційний дистриб'ютор 200+ преміум брендів тюнінгу: Akrapovic, Brabus, Mansory, HRE, KW, Ohlins. Авто та мото тюнінг Київ. Вихлопні системи, підвіска, диски, карбон. Доставка по Україні.",
  keywords: [
    // Локальні запити
    "тюнінг Київ",
    "СТО Київ",
    "тюнінг ательє Київ",
    "чіп тюнінг Київ",
    "авто тюнінг Київ",
    "мото тюнінг Київ",
    "тюнінг авто Україна",
    "тюнінг мотоциклів Україна",
    "преміум тюнінг",
    "преміум запчастини",
    "тюнінг студія",
    "детейлінг Київ",
    "автозапчастини преміум",
    "спортивні запчастини",
    "performance parts Ukraine",
    "auto tuning Ukraine",
    "moto tuning Ukraine",
    "b2b distribution",
    // Топ бренди Auto
    "Akrapovic Україна",
    "Brabus Україна",
    "ABT Україна",
    "Mansory Україна",
    "Novitec Україна",
    "HRE wheels Україна",
    "KW suspension Україна",
    "Brembo Україна",
    "Vorsteiner Україна",
    "AC Schnitzer Україна",
    "Hamann Україна",
    "Renntech Україна",
    "Weistec Україна",
    "Eventuri Україна",
    "Milltek Україна",
    "Armytrix Україна",
    "IPE exhaust Україна",
    "Capristo Україна",
    "ADV.1 wheels",
    "ANRKY wheels",
    "Brixton wheels",
    "Vossen wheels",
    "BC Racing",
    "Stoptech",
    "APR tuning",
    "Dinan BMW",
    "Wagner Tuning",
    // Топ бренди Moto
    "Akrapovic moto",
    "Ohlins Україна",
    "Termignoni Україна",
    "SC-Project Україна",
    "Arrow exhaust",
    "Brembo moto",
    "Marchesini wheels",
    "Rizoma",
    "Ilmberger Carbon",
    "Fullsix Carbon",
    // Категорії
    "вихлопні системи",
    "підвіска спортивна",
    "карбонові деталі",
    "диски ковані",
    "гальмівні системи",
    "турбо апгрейд",
    "чіп тюнінг BMW",
    "чіп тюнінг Mercedes",
    "чіп тюнінг Porsche",
    "тюнінг Ferrari",
    "тюнінг Lamborghini",
    // Конкурентні запити
    "тюнінг магазин Київ",
    "тюнінг інтернет магазин",
    "авто тюнінг магазин",
    "мото тюнінг магазин",
    "автоспорт Україна",
    "гонки Україна",
    "ралі запчастини",
    "дріфт тюнінг",
    "трек запчастини",
    "спорт автомобілі запчастини",
    "екіпіровка автоспорт",
    "купити вихлоп",
    "купити підвіску",
    "купити диски",
    "купити карбон",
    "тюнінг ціна",
    "Akrapovic ціна",
    "Brabus ціна",
    "вихлоп Akrapovic купити",
    "підвіска KW купити",
    "диски HRE купити",
    "Ohlins мото купити",
    // Геотаргетинг
    "тюнінг Одеса",
    "тюнінг Харків",
    "тюнінг Дніпро",
    "тюнінг Львів",
    "доставка по Україні",
  ],
  authors: [{ name: "OneCompany", url: siteUrl }],
  creator: "OneCompany",
  publisher: "OneCompany - Преміум Тюнінг Авто Мото Україна",
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
    title: "OneCompany — Преміум Тюнінг Авто та Мото | 200+ Брендів | Київ",
    description: "Офіційний дистриб'ютор Akrapovic, Brabus, Mansory, HRE, KW, Ohlins в Україні. Вихлопні системи, підвіска, диски, карбон. Авто та мото тюнінг Київ.",
    type: "website",
    siteName: "OneCompany - Преміум Тюнінг Україна",
    locale: "uk_UA",
    alternateLocale: "en_US",
    url: siteUrl,
    images: [
      {
        url: `${siteUrl}/branding/og-image.png`,
        width: 1200,
        height: 630,
        alt: "OneCompany - Преміум Тюнінг Авто Мото Київ Україна | Akrapovic, Brabus, Mansory, HRE, Ohlins",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "OneCompany — Преміум Тюнінг | Akrapovic, Brabus, Mansory | Київ",
    description: "Офіційний дистриб'ютор 200+ брендів тюнінгу в Україні. Вихлопні системи, підвіска, диски, карбон. Авто та мото.",
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
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32" },
      { url: "/icon.png", type: "image/png", sizes: "512x512" },
    ],
    shortcut: "/favicon.ico",
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

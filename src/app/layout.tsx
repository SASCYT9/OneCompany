import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import { ThemeProvider } from "@/components/ui/ThemeProvider";
import AuthProvider from "@/components/AuthProvider";
import { IBM_Plex_Mono, Unbounded } from "next/font/google";
import { OrganizationSchema, WebSiteSchema, LocalBusinessSchema } from "@/components/seo/StructuredData";
// Root layout should be lean; navigation is rendered inside locale layout to access translations

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#000000",
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://onecompany.global"),
  title: {
    default: "onecompany — Premium Auto & Moto Tuning Importer Ukraine | Since 2007",
    template: "%s | onecompany",
  },
  description: "Офіційний B2B дистриб'ютор 200+ преміум брендів авто та мото тюнінгу в Україні. Akrapovic, Brabus, HRE, KW, Brembo. Експертний підбір, глобальна логістика з 2007.",
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
  authors: [{ name: "onecompany", url: "https://onecompany.ua" }],
  creator: "onecompany",
  publisher: "onecompany",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    title: "premium tuning parts · 200+ brands · one company",
    description: "Official importer of premium auto & moto tuning in Ukraine. Akrapovič, Brabus, HRE, KW, Brembo, Mansory.",
    type: "website",
    siteName: "onecompany",
    locale: "uk_UA",
    alternateLocale: "en_US",
    url: "https://onecompany.global",
    images: [
      {
        url: "/branding/og-image.png",
        width: 1200,
        height: 630,
        alt: "onecompany - Premium Tuning Parts",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "premium tuning parts · 200+ brands · one company",
    description: "Official importer of premium auto & moto tuning in Ukraine",
    images: ["/branding/og-image.png"],
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
    // Add your verification codes here when ready
    // google: "your-google-verification-code",
    // yandex: "your-yandex-verification-code",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "48x48" },
      { url: "/branding/one-company-logo.svg", type: "image/svg+xml" },
    ],
    shortcut: "/favicon.ico",
    apple: "/branding/one-company-logo.svg",
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
  <html 
    lang="uk" 
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

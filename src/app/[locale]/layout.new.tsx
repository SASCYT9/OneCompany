import { ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import Script from "next/script";
import { IBM_Plex_Mono, Unbounded } from "next/font/google";
import { Header } from "@/components/layout/Header";
import Footer from "@/components/shared/Footer";
import AuthProvider from "@/components/AuthProvider";
import { ThemeProvider } from "@/components/ui/ThemeProvider";
import { cn } from "@/lib/utils";
import HeroVideoWrapper from "@/components/layout/HeroVideoWrapper";
import LocaleLangSetter from "@/components/LocaleLangSetter";
import { readVideoConfig } from "@/lib/videoConfig";
import LoadingScreen from "@/components/ui/LoadingScreen";
import "../globals.css";
import { buildPageMetadata, SupportedLocale } from "@/lib/seo";
import { resolveImageAssetReference, resolveVideoAssetReference } from "@/lib/runtimeAssetPaths";

// Fonts
const fontDisplay = Unbounded({
  subsets: ["latin", "cyrillic"],
  variable: "--font-display",
  display: "swap",
  weight: ["300", "400", "500", "600", "700"],
});

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

type Props = {
  children: ReactNode;
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const isUa = locale === "ua";

  return buildPageMetadata(locale as SupportedLocale, "", {
    title: "onecompany — Premium Auto & Moto Performance Hub",
    description: isUa
      ? "Провідний B2B дистриб'ютор та експертна підтримка преміум тюнінгу. 200+ брендів для авто та мото, логістика та технічна підтримка."
      : "Leading B2B distributor and expert support for premium tuning. 200+ brands for auto and moto, logistics and technical support.",
  });
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  const currentYear = new Date().getFullYear();

  // Validate locale
  const locales = ["en", "ua"];
  if (!locales.includes(locale)) {
    notFound();
  }

  // Get messages for this locale
  const messages = await getMessages();
  const videoConfig = await readVideoConfig();
  const heroVideoSrc = resolveVideoAssetReference(videoConfig.heroVideo);
  const heroVideoMobileSrc = resolveVideoAssetReference(videoConfig.heroVideoMobile);
  const heroPosterSrc = resolveImageAssetReference(videoConfig.heroPoster);

  return (
    <html
      lang={locale === "ua" ? "uk" : "en"}
      suppressHydrationWarning
      className={cn(fontSans.variable, fontDisplay.variable, fontMono.variable)}
    >
      <body
        className={cn(
          "min-h-screen bg-background text-foreground antialiased",
          locale === "ua" && "locale-ua"
        )}
        suppressHydrationWarning
      >
        {process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN ? (
          <Script
            defer
            data-domain={process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN}
            src="https://plausible.io/js/script.js"
          />
        ) : null}

        <NextIntlClientProvider locale={locale} messages={messages}>
          <AuthProvider>
            <ThemeProvider
              attribute="class"
              defaultTheme="dark"
              enableSystem
              disableTransitionOnChange
            >
              <LocaleLangSetter locale={locale} />
              {heroPosterSrc && <link rel="preload" href={heroPosterSrc} as="image" />}
              <LoadingScreen />

              <div
                data-server-hero-enabled={videoConfig.heroEnabled ? "true" : "false"}
                className="flex flex-col min-h-screen"
              >
                {heroVideoSrc ? (
                  <HeroVideoWrapper
                    src={heroVideoSrc}
                    mobileSrc={heroVideoMobileSrc}
                    poster={heroPosterSrc}
                    serverEnabled={videoConfig.heroEnabled ?? true}
                  />
                ) : null}
                <Header />
                <main id="main-content" className="grow relative z-10">
                  {children}
                </main>
                <Footer currentYear={currentYear} />
              </div>
            </ThemeProvider>
          </AuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

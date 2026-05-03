import { ReactNode } from "react";
import type { Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Inter, Manrope } from "next/font/google";
import { cn } from "@/lib/utils";
import { Header } from "@/components/layout/Header";
import Footer from "@/components/shared/Footer";
import AuthProvider from "@/components/AuthProvider";
import FullScreenVideo from "@/components/layout/FullScreenVideo";

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-inter",
});

const manrope = Manrope({
  subsets: ["latin", "cyrillic"],
  variable: "--font-manrope",
});

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

type Props = {
  children: ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;

  // Validate locale
  const locales = ["en", "ua"];
  if (!locales.includes(locale)) {
    notFound();
  }

  // Get messages for this locale
  const messages = await getMessages();

  // Feature flags for optional telemetry (avoid console errors when disabled or blocked)
  const enableVercelAnalytics =
    process.env.NEXT_PUBLIC_ENABLE_VERCEL_ANALYTICS === "true" ||
    process.env.NEXT_PUBLIC_ENABLE_VERCEL_ANALYTICS === "1";
  const enableVercelSpeed =
    process.env.NEXT_PUBLIC_ENABLE_VERCEL_SPEED_INSIGHTS === "true" ||
    process.env.NEXT_PUBLIC_ENABLE_VERCEL_SPEED_INSIGHTS === "1";

  return (
    <html lang={locale} className={cn(inter.variable, manrope.variable)}>
      <body
        className={cn(
          "bg-black text-white antialiased",
          locale === "ua" ? "font-manrope" : "font-sans"
        )}
      >
        <NextIntlClientProvider locale={locale} messages={messages}>
          <AuthProvider>
            <div className="relative flex min-h-dvh flex-col overflow-x-hidden">
              {/* Full-screen video (backmost visible layer) */}
              <FullScreenVideo />

              {/* Pure black fallback, placed behind video */}
              <div className="absolute inset-0 -z-60 bg-black" />

              {/* Global dark overlay (softened to reveal video) */}
              <div className="absolute inset-0 -z-30 bg-gradient-to-b from-black/55 via-black/22 to-black/60" />

              {/* Global golden accent (stronger and wider) */}
              <div className="absolute inset-0 -z-20 bg-[radial-gradient(ellipse_at_45%_35%,rgba(209,151,89,0.28),transparent_72%)]" />
              {/* Bottom halo to smooth section transitions */}
              <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_88%,rgba(255,186,92,0.16),transparent_58%)]" />
              
              <Header />
              <main className="flex-grow">{children}</main>
              <Footer />
            </div>
            {enableVercelAnalytics ? <Analytics /> : null}
            {enableVercelSpeed ? <SpeedInsights /> : null}
          </AuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

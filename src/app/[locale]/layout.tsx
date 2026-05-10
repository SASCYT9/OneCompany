import { ReactNode } from "react";
import { unstable_cache } from "next/cache";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Header } from "@/components/layout/Header";
import Footer from "@/components/shared/Footer";
import AuthProvider from "@/components/AuthProvider";
import { cn } from "@/lib/utils";
import HeroVideoWrapper from "@/components/layout/HeroVideoWrapper";
import LocaleLangSetter from "@/components/LocaleLangSetter";
import { readVideoConfig } from "@/lib/videoConfig";
import LoadingScreen from "@/components/ui/LoadingScreen";
import CookieBanner from "@/components/ui/CookieBanner";
import { ScrollToTop } from "@/components/ScrollToTop";
import SmoothScroll from "@/components/effects/SmoothScroll";
import { ShopCurrencyProvider } from "@/components/shop/CurrencyContext";
import { prisma } from "@/lib/prisma";
import {
  getOrCreateShopSettings,
  getShopSettingsRuntime,
  type ShopSettingsRuntime,
} from "@/lib/shopAdminSettings";
import { resolveImageAssetReference, resolveVideoAssetReference } from "@/lib/runtimeAssetPaths";

export function generateStaticParams() {
  return [{ locale: "en" }, { locale: "ua" }];
}

// Cached lookup for the shop settings used in the footer. Keeps the layout
// statically renderable so /[locale]/* pages can be served from the ISR
// edge cache. Tag lets admin pages bust this with revalidateTag if needed.
const getCachedShopSettings = unstable_cache(
  async () => {
    const record = await getOrCreateShopSettings(prisma);
    return getShopSettingsRuntime(record);
  },
  ["shop-settings-runtime"],
  { revalidate: 3600, tags: ["shop-settings"] }
);

type Props = {
  children: ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  const currentYear = new Date().getFullYear();

  // Validate locale
  const locales = ["en", "ua"];
  if (!locales.includes(locale)) {
    notFound();
  }

  // Required for static rendering: the next-intl middleware is skipped for
  // already-localized paths in proxy.ts (to preserve ISR caching), so without
  // this call requestLocale is undefined and getRequestConfig falls back to
  // the default 'ua' locale — breaking translations on /en pages.
  setRequestLocale(locale);

  // Get messages for this locale
  const messages = await getMessages();
  const videoConfig = await readVideoConfig();
  const heroVideoSrc = resolveVideoAssetReference(videoConfig.heroVideo);
  const heroVideoMobileSrc = resolveVideoAssetReference(videoConfig.heroVideoMobile);
  const heroPosterSrc = resolveImageAssetReference(videoConfig.heroPoster);
  let shopSettingsRuntime: ShopSettingsRuntime | null = null;
  let companyRequisites: string | null = null;
  try {
    const shopSettings = await Promise.race([
      getCachedShopSettings(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("DB timeout")), 5000)),
    ]);
    shopSettingsRuntime = shopSettings;
    if (shopSettings.fopCompanyName) {
      companyRequisites = `${shopSettings.fopCompanyName}${shopSettings.fopEdrpou ? `, ЄДРПОУ: ${shopSettings.fopEdrpou}` : ""}`;
    }
  } catch (error) {
    companyRequisites = "ФОП Побережець Іван Юрійович, ЄДРПОУ: 3803206192";
    console.warn(
      "Failed to fetch shop settings from DB for footer, using fallback:",
      error instanceof Error ? error.message : error
    );
  }

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <AuthProvider>
        <LocaleLangSetter locale={locale} />
        <SmoothScroll />
        {heroPosterSrc && <link rel="preload" href={heroPosterSrc} as="image" />}
        <LoadingScreen />
        <ShopCurrencyProvider
          defaultCurrency={shopSettingsRuntime?.defaultCurrency ?? "UAH"}
          initialRates={shopSettingsRuntime?.currencyRates ?? null}
        >
          <div
            data-server-hero-enabled={videoConfig.heroEnabled ? "true" : "false"}
            className={cn("flex flex-col min-h-screen", locale === "ua" && "locale-ua")}
            lang={locale === "ua" ? "uk" : "en"}
          >
            {heroVideoSrc ? (
              <HeroVideoWrapper
                src={heroVideoSrc}
                mobileSrc={heroVideoMobileSrc}
                poster={heroPosterSrc}
                serverEnabled={videoConfig.heroEnabled ?? true}
              />
            ) : null}
            {/* Font debug overlay removed */}
            <Header />
            <main id="main-content" className="grow relative z-10">
              {children}
            </main>
            <ScrollToTop />
            <Footer currentYear={currentYear} companyRequisites={companyRequisites} />
            <CookieBanner locale={locale} />
          </div>
        </ShopCurrencyProvider>
      </AuthProvider>
    </NextIntlClientProvider>
  );
}

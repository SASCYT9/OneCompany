import { ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Header } from "@/components/layout/Header";
import Footer from "@/components/shared/Footer";
import { cn } from "@/lib/utils";
import HeroVideoWrapper from "@/components/layout/HeroVideoWrapper";
import LocaleLangSetter from "@/components/LocaleLangSetter";
import { readVideoConfig } from "@/lib/videoConfig";
import CookieBanner from "@/components/ui/CookieBanner";
import { ScrollToTop } from "@/components/ScrollToTop";
import { ShopCurrencyProvider } from "@/components/shop/CurrencyContext";
import type { ShopSettingsRuntime } from "@/lib/shopAdminSettings";
import { resolveImageAssetReference, resolveVideoAssetReference } from "@/lib/runtimeAssetPaths";
import { getPublicShopSettingsRuntime } from "@/lib/shopPublicSettings";
import { MobileBottomNavigation } from "@/components/layout/MobileBottomNavigation";

export function generateStaticParams() {
  return [{ locale: "en" }, { locale: "ua" }];
}

// Cached lookup for the shop settings used in the footer. Keeps the layout
// statically renderable so /[locale]/* pages can be served from the ISR
// edge cache. Tag lets admin pages bust this with revalidateTag if needed.

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
      getPublicShopSettingsRuntime(),
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
      <LocaleLangSetter locale={locale} />
      {heroPosterSrc && <link rel="preload" href={heroPosterSrc} as="image" />}
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
          <Header />
          <main id="main-content" className="grow relative z-10">
            {children}
          </main>
          <ScrollToTop />
          <Footer currentYear={currentYear} companyRequisites={companyRequisites} />
          <CookieBanner locale={locale} />
          <MobileBottomNavigation locale={locale} />
        </div>
      </ShopCurrencyProvider>
    </NextIntlClientProvider>
  );
}

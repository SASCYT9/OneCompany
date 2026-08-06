import type { Metadata } from "next";

import EventuriMachineAtelier, {
  type EventuriLandingCategory,
  type EventuriLandingHero,
  type EventuriLandingProduct,
} from "./EventuriMachineAtelier";
import { absoluteUrl, buildPageMetadata, resolveLocale, type SupportedLocale } from "@/lib/seo";
import type { ShopProduct } from "@/lib/shopCatalog";
import { getShopProductsByBrandServer } from "@/lib/shopCatalogServer";
import { buildShopStorefrontProductPathForProduct } from "@/lib/shopStorefrontRouting";
import { localizeShopProductTitle, localizeShopText } from "@/lib/shopText";

export const dynamic = "force-static";
export const revalidate = 3600;

type Props = {
  params: Promise<{ locale: string }>;
};

const pageCopy: Record<SupportedLocale, { title: string; description: string }> = {
  ua: {
    title: "Eventuri — карбонові системи впуску | OneCompany",
    description:
      "Карбонові системи впуску, турбоінлети та компоненти Eventuri для BMW, Audi, Mercedes-Benz, Porsche, Toyota та інших автомобілів.",
  },
  en: {
    title: "Eventuri carbon intake systems | OneCompany",
    description:
      "Eventuri carbon intake systems, turbo inlets and components for BMW, Audi, Mercedes-Benz, Porsche, Toyota and more.",
  },
};

const categoryDefinitions = [
  {
    id: "intake-systems",
    productType: "Intake Systems",
    imageSlug: "eventuri-bmw-g90-g99-m5-intake-system",
    title: { ua: "Впускні системи", en: "Intake systems" },
    description: {
      ua: "Карбонові системи впуску для конкретних платформ.",
      en: "Carbon intake systems for specific vehicle platforms.",
    },
  },
  {
    id: "turbo-inlets-pipes",
    productType: "Turbo Inlets & Pipes",
    imageSlug: "bmw-g90-g99-m5-s68-carbon-turbo-inlet-set",
    title: { ua: "Турбоінлети та патрубки", en: "Turbo inlets & pipes" },
    description: {
      ua: "Компоненти тракту наддуву для вибраних конфігурацій.",
      en: "Boost-path components for selected configurations.",
    },
  },
  {
    id: "engine-covers",
    productType: "Engine Covers",
    imageSlug: "c8-rs6-rs7-black-carbon-engine-cover-matte",
    title: { ua: "Кришки двигуна", en: "Engine covers" },
    description: {
      ua: "Карбонові деталі для завершеної підкапотної композиції.",
      en: "Carbon details for a finished engine-bay composition.",
    },
  },
  {
    id: "strut-braces",
    productType: "Strut Braces",
    imageSlug: "bmw-g8x-m2-m3-m4-strut-brace",
    title: { ua: "Розпірки", en: "Strut braces" },
    description: {
      ua: "Карбонові розпірки для сумісних платформ BMW.",
      en: "Carbon strut braces for compatible BMW platforms.",
    },
  },
  {
    id: "filters-accessories",
    productType: "Filters & Accessories",
    imageSlug: "g8x-m3-m4-black-carbon-intake-scoop-set-matte",
    title: { ua: "Фільтри та аксесуари", en: "Filters & accessories" },
    description: {
      ua: "Додаткові компоненти для комплектації системи.",
      en: "Supporting components for a complete system.",
    },
  },
] as const;

const featuredSlugs = [
  "eventuri-bmw-g90-g99-m5-intake-system",
  "g8x-m3-m4-m3cs-m4csl-black-carbon-intake-matte",
  "c8-rs6-rs7-hybrid-turbo-inlet-set",
  "w205-c63-c63s-amg-black-carbon-intake-v2-w-3-turbos",
] as const;

const featuredProductTypes: Record<string, { ua: string; en: string }> = {
  "eventuri-bmw-g90-g99-m5-intake-system": { ua: "Впускна система", en: "Intake system" },
  "g8x-m3-m4-m3cs-m4csl-black-carbon-intake-matte": {
    ua: "Впускна система",
    en: "Intake system",
  },
  "c8-rs6-rs7-hybrid-turbo-inlet-set": { ua: "Турбоінлети", en: "Turbo inlets" },
  "w205-c63-c63s-amg-black-carbon-intake-v2-w-3-turbos": {
    ua: "Впускна система",
    en: "Intake system",
  },
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);
  const copy = pageCopy[resolvedLocale];
  return buildPageMetadata(resolvedLocale, "shop/eventuri", {
    title: copy.title,
    description: copy.description,
  });
}

function buildEventuriTypeHref(locale: SupportedLocale, productType: string) {
  const params = new URLSearchParams({
    brand: "Eventuri",
    productType,
  });
  return `/${locale}/shop/catalog?${params.toString()}`;
}

function findVisualProduct(products: ShopProduct[], slug: string, productType: string) {
  return (
    products.find((product) => product.slug === slug && product.image) ??
    products.find((product) => product.productType === productType && product.image) ??
    products.find((product) => product.image) ??
    null
  );
}

function createLandingCategories(
  products: ShopProduct[],
  locale: SupportedLocale
): EventuriLandingCategory[] {
  return categoryDefinitions.map((definition) => {
    const visualProduct = findVisualProduct(products, definition.imageSlug, definition.productType);
    const count = products.filter(
      (product) => product.productType === definition.productType
    ).length;

    return {
      id: definition.id,
      href: buildEventuriTypeHref(locale, definition.productType),
      image: visualProduct?.image || "/images/placeholders/product-fallback.svg",
      title: definition.title,
      description: definition.description,
      count,
    };
  });
}

function createFeaturedProducts(
  products: ShopProduct[],
  locale: SupportedLocale
): EventuriLandingProduct[] {
  const bySlug = new Map(products.map((product) => [product.slug, product]));
  const selected = featuredSlugs
    .map((slug) => bySlug.get(slug))
    .filter((product): product is ShopProduct => Boolean(product));

  for (const product of products) {
    if (selected.length >= 4) break;
    if (!selected.some((candidate) => candidate.slug === product.slug)) selected.push(product);
  }

  return selected.map((product) => ({
    slug: product.slug,
    href: buildShopStorefrontProductPathForProduct(locale, product),
    image: product.image || "/images/placeholders/product-fallback.svg",
    title: localizeShopProductTitle(locale, product),
    type: localizedFeaturedProductType(locale, product),
    price: product.price,
  }));
}

function localizedFeaturedProductType(locale: SupportedLocale, product: ShopProduct) {
  const type = featuredProductTypes[product.slug];
  return type ? type[locale] : localizeShopText(locale, product.category);
}

function createHeroProduct(products: ShopProduct[], locale: SupportedLocale): EventuriLandingHero {
  const m5G90 = products.find(
    (product) => product.slug === "eventuri-bmw-g90-g99-m5-intake-system"
  );
  const fallback = m5G90 ?? products[0];

  return {
    href: fallback
      ? buildShopStorefrontProductPathForProduct(locale, fallback)
      : `/${locale}/shop/catalog?brand=Eventuri`,
    // Original product-gallery photographs from the Eventuri G90/G99 M5 catalogue record.
    // They are intentionally used without synthetic replacement imagery or text over the photo.
    image:
      m5G90?.gallery?.[2] ??
      fallback?.gallery?.[0] ??
      fallback?.image ??
      "/images/placeholders/product-fallback.svg",
    mobileImage:
      m5G90?.gallery?.[1] ??
      m5G90?.gallery?.[2] ??
      fallback?.image ??
      "/images/placeholders/product-fallback.svg",
    detailImage:
      m5G90?.gallery?.[3] ??
      m5G90?.gallery?.[1] ??
      fallback?.image ??
      "/images/placeholders/product-fallback.svg",
    alt:
      locale === "ua"
        ? "Карбонова система впуску Eventuri для BMW M5 G90 / G99"
        : "Eventuri carbon intake system for BMW M5 G90 / G99",
  };
}

export default async function EventuriLandingPage({ params }: Props) {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);
  const copy = pageCopy[resolvedLocale];
  const products = await getShopProductsByBrandServer("Eventuri");
  const sortedProducts = [...products].sort((a, b) =>
    localizeShopProductTitle(resolvedLocale, a).localeCompare(
      localizeShopProductTitle(resolvedLocale, b),
      resolvedLocale === "ua" ? "uk" : "en"
    )
  );
  const catalogHref = `/${resolvedLocale}/shop/catalog?brand=Eventuri`;
  const featuredProducts = createFeaturedProducts(sortedProducts, resolvedLocale);
  const categories = createLandingCategories(sortedProducts, resolvedLocale);
  const hero = createHeroProduct(sortedProducts, resolvedLocale);

  return (
    <>
      <EventuriMachineAtelier
        locale={resolvedLocale}
        productCount={sortedProducts.length}
        catalogHref={catalogHref}
        contactHref={`/${resolvedLocale}/contact?brand=Eventuri`}
        hero={hero}
        categories={categories}
        featuredProducts={featuredProducts}
      />
      {sortedProducts.length > 0 ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "CollectionPage",
              name: copy.title,
              description: copy.description,
              url: absoluteUrl(`/${resolvedLocale}/shop/eventuri`),
              mainEntity: {
                "@type": "ItemList",
                numberOfItems: sortedProducts.length,
                itemListElement: sortedProducts.map((product, index) => ({
                  "@type": "ListItem",
                  position: index + 1,
                  url: absoluteUrl(
                    buildShopStorefrontProductPathForProduct(resolvedLocale, product)
                  ),
                  name: localizeShopProductTitle(resolvedLocale, product),
                })),
              },
            }),
          }}
        />
      ) : null}
    </>
  );
}

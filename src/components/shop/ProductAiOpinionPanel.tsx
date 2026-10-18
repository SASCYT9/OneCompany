"use client";

import Image from "next/image";
import { ArrowUpRight, CarFront, Gauge, Scale, Sparkles, Wrench } from "lucide-react";
import type { ShopProduct } from "@/lib/shopCatalog";
import {
  buildProductAiPrompt,
  buildProductAiProviderHref,
  type ProductAiProvider,
} from "@/lib/shopAiOpinion";
import { trackEvent } from "@/lib/analytics";
import { siteConfig, type SupportedLocale } from "@/lib/seo";
import { buildShopStorefrontProductPathForProduct } from "@/lib/shopStorefrontRouting";
import {
  localizeShopDescription,
  localizeShopProductTitle,
  localizeShopText,
} from "@/lib/shopText";

type ProductAiOpinionPanelProps = {
  locale: SupportedLocale;
  product: ShopProduct;
  className?: string;
  shape?: "pill" | "rounded" | "square";
};

function buildPrompt(locale: SupportedLocale, product: ShopProduct) {
  const category = localizeShopText(locale, product.category);
  // Use the product type only when it is written in the page language.
  const productType =
    product.productType && (locale === "ua") === /[Ѐ-ӿ]/u.test(product.productType)
      ? product.productType
      : category;

  return buildProductAiPrompt(locale, {
    title: localizeShopProductTitle(locale, product),
    brand: product.brand,
    sku: product.sku,
    productType,
    url: `${siteConfig.url}${buildShopStorefrontProductPathForProduct(locale, product)}`,
    description:
      localizeShopDescription(locale, product.shortDescription) ||
      localizeShopDescription(locale, product.longDescription),
  });
}

const shapeClasses = {
  pill: { card: "rounded-2xl", inner: "rounded-xl", button: "rounded-full" },
  rounded: { card: "rounded-2xl", inner: "rounded-lg", button: "rounded-xl" },
  square: { card: "rounded-none", inner: "rounded-none", button: "rounded-none" },
} as const;

const PROVIDERS: Array<{ id: ProductAiProvider; name: string }> = [
  { id: "chatgpt", name: "ChatGPT" },
  { id: "perplexity", name: "Perplexity" },
];

function ProviderLogo({ provider }: { provider: ProductAiProvider }) {
  return provider === "chatgpt" ? (
    <Image
      src="/logos/chatgpt-official.png"
      alt=""
      width={20}
      height={20}
      className="h-5 w-5 shrink-0 rounded-full bg-white object-cover p-0.5"
    />
  ) : (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#20808d]">
      <Image
        src="/logos/perplexity-symbol-light.svg"
        alt=""
        width={10}
        height={13}
        className="h-[13px] w-[10px] object-contain"
      />
    </span>
  );
}

/**
 * "Second opinion" links that open ChatGPT or Perplexity with a ready question
 * about this exact part. Sits below the purchase facts so it does not compete
 * with the cart button.
 */
export function ProductAiOpinionPanel({
  locale,
  product,
  className = "",
  shape = "rounded",
}: ProductAiOpinionPanelProps) {
  const isUa = locale === "ua";
  const prompt = buildPrompt(locale, product);
  const headingId = `ai-opinion-${product.slug}`;
  const currentShape = shapeClasses[shape];
  // The four questions the prompt asks, so the customer knows what comes back.
  const topics = [
    { label: isUa ? "Що дає" : "What it does", Icon: Gauge },
    { label: isUa ? "Сумісність" : "Fitment", Icon: CarFront },
    { label: isUa ? "Встановлення" : "Installation", Icon: Wrench },
    { label: isUa ? "За і проти" : "Pros & cons", Icon: Scale },
  ];

  return (
    <section
      aria-labelledby={headingId}
      className={`border border-foreground/12 p-4 ${currentShape.card} ${className}`}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/[0.08] text-primary dark:bg-primary/[0.12]">
          <Sparkles className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 id={headingId} className="text-sm font-medium text-foreground">
            {isUa ? "Друга думка від AI" : "A second opinion from AI"}
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-foreground/60">
            {isUa
              ? "Відкриємо ChatGPT або Perplexity з готовим питанням саме про цю деталь."
              : "Opens ChatGPT or Perplexity with a ready question about this exact part."}
          </p>
        </div>
      </div>

      <ul
        className={`mt-3 grid grid-cols-2 gap-x-3 gap-y-2.5 bg-foreground/[0.035] p-3 ${currentShape.inner}`}
        aria-label={isUa ? "Про що буде відповідь" : "What the answer covers"}
      >
        {topics.map(({ label, Icon }) => (
          <li
            key={label}
            className="flex min-w-0 items-center gap-2 text-[12px] leading-tight text-foreground/75"
          >
            <Icon
              className="h-3.5 w-3.5 shrink-0 text-primary"
              strokeWidth={1.8}
              aria-hidden="true"
            />
            <span className="min-w-0">{label}</span>
          </li>
        ))}
      </ul>

      <div className="mt-3 grid grid-cols-2 gap-2">
        {PROVIDERS.map(({ id, name }) => (
          <a
            key={id}
            href={buildProductAiProviderHref(id, prompt)}
            target="_blank"
            rel="noopener noreferrer"
            data-testid={`product-ai-opinion-${id}`}
            onClick={() =>
              trackEvent("product_ai_opinion_click", { provider: id, product: product.slug })
            }
            className={`group flex min-h-11 items-center justify-center gap-2 border border-foreground/15 bg-foreground/[0.03] px-3 text-[13px] font-medium text-foreground transition hover:border-foreground/35 hover:bg-foreground/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${currentShape.button}`}
          >
            <ProviderLogo provider={id} />
            <span>{name}</span>
            <ArrowUpRight
              className="h-3.5 w-3.5 shrink-0 opacity-45 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:opacity-80"
              aria-hidden="true"
            />
          </a>
        ))}
      </div>
    </section>
  );
}

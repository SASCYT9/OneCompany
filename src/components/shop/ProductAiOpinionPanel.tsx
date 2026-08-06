"use client";

import Image from "next/image";
import { ArrowUpRight, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ShopProduct } from "@/lib/shopCatalog";
import { buildProductAiPrompt } from "@/lib/shopAiOpinion";
import {
  localizeShopDescription,
  localizeShopProductTitle,
  localizeShopText,
} from "@/lib/shopText";
import type { SupportedLocale } from "@/lib/seo";

type ProductAiOpinionPanelProps = {
  locale: SupportedLocale;
  product: ShopProduct;
  className?: string;
  shape?: "pill" | "rounded" | "square";
};

type ProductAiProvider = "chatgpt" | "perplexity";

function buildProviderHref(provider: ProductAiProvider, prompt: string) {
  const encodedPrompt = encodeURIComponent(prompt);

  return provider === "chatgpt"
    ? `https://chatgpt.com/?q=${encodedPrompt}`
    : `https://www.perplexity.ai/?q=${encodedPrompt}`;
}

function buildPrompt(locale: SupportedLocale, product: ShopProduct) {
  const isUa = locale === "ua";
  const description =
    localizeShopDescription(locale, product.longDescription) ||
    localizeShopDescription(locale, product.shortDescription);

  return buildProductAiPrompt(locale, {
    title: localizeShopProductTitle(locale, product),
    brand: product.brand,
    category: localizeShopText(locale, product.category),
    productType: localizeShopText(locale, {
      ua: product.productType ?? "",
      en: product.productType ?? "",
    }),
    sku: product.sku,
    description,
    highlights: product.highlights.map((item) => localizeShopText(locale, item)).filter(Boolean),
    specifications: [
      product.length || product.width || product.height
        ? {
            label: isUa ? "Габарити" : "Dimensions",
            value: [product.length, product.width, product.height]
              .filter((value): value is number => value != null)
              .map((value) => `${value} mm`)
              .join(" × "),
          }
        : null,
      product.weightKg != null
        ? { label: isUa ? "Вага" : "Weight", value: `${product.weightKg} kg` }
        : null,
    ].filter((item): item is { label: string; value: string } => Boolean(item)),
  });
}

const shapeClasses = {
  pill: {
    button: "rounded-full",
    icon: "rounded-full",
    badge: "rounded-full",
  },
  rounded: {
    button: "rounded-xl",
    icon: "rounded-lg",
    badge: "rounded-lg",
  },
  square: {
    button: "rounded-none",
    icon: "rounded-none",
    badge: "rounded-none",
  },
} as const;

export function ProductAiOpinionPanel({
  locale,
  product,
  className = "",
  shape = "rounded",
}: ProductAiOpinionPanelProps) {
  const t = useTranslations("aiOpinion");
  const prompt = buildPrompt(locale, product);
  const headingId = `ai-opinion-${product.slug}`;
  const chatGptHref = buildProviderHref("chatgpt", prompt);
  const perplexityHref = buildProviderHref("perplexity", prompt);
  const currentShape = shapeClasses[shape];

  return (
    <section
      aria-labelledby={headingId}
      className={`mt-3 border-t border-foreground/10 pt-3 ${className}`}
    >
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className={`relative flex h-8 w-8 shrink-0 items-center justify-center border border-primary/30 bg-primary/[0.08] text-primary dark:bg-primary/[0.12] ${currentShape.badge}`}
          >
            <Sparkles className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
            <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_9px_rgba(194,157,89,0.9)]" />
          </span>
          <div className="min-w-0">
            <h2
              id={headingId}
              className="truncate text-xs font-semibold tracking-tight text-foreground"
            >
              {t("compactTitle")}
            </h2>
            <p className="mt-0.5 truncate text-[11px] text-foreground/50 dark:text-foreground/40">
              {t("compactHint")}
            </p>
          </div>
        </div>

        <div className="grid w-full grid-cols-2 gap-2 sm:w-auto sm:shrink-0">
          <a
            href={chatGptHref}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="product-ai-opinion-chatgpt"
            className={`group inline-flex min-h-10 items-center gap-2 border border-[#10a37f]/35 bg-[#10a37f]/[0.06] px-2.5 py-1.5 text-left transition duration-200 hover:-translate-y-0.5 hover:border-[#10a37f]/60 hover:bg-[#10a37f]/[0.12] dark:border-[#10a37f]/45 dark:bg-[#10a37f]/[0.1] dark:hover:bg-[#10a37f]/[0.16] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#10a37f]/60 ${currentShape.button}`}
          >
            <Image
              src="/logos/chatgpt-official.png"
              alt=""
              width={28}
              height={28}
              className={`h-7 w-7 shrink-0 bg-white object-cover p-1 ${currentShape.icon}`}
            />
            <span className="min-w-0 flex-1 leading-none">
              <span className="block text-[9px] uppercase tracking-[0.11em] text-foreground/45">
                {t("buttonLabel")}
              </span>
              <span className="mt-1 block text-xs font-semibold text-foreground">ChatGPT</span>
            </span>
            <ArrowUpRight
              className="h-3.5 w-3.5 shrink-0 text-[#10a37f]/70 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </a>

          <a
            href={perplexityHref}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="product-ai-opinion-perplexity"
            className={`group inline-flex min-h-10 items-center gap-2 border border-[#7c67ff]/35 bg-[#7c67ff]/[0.06] px-2.5 py-1.5 text-left transition duration-200 hover:-translate-y-0.5 hover:border-[#7c67ff]/60 hover:bg-[#7c67ff]/[0.12] dark:border-[#7c67ff]/45 dark:bg-[#7c67ff]/[0.1] dark:hover:bg-[#7c67ff]/[0.16] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7c67ff]/60 ${currentShape.button}`}
          >
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center bg-[#7c67ff]/[0.14] dark:bg-[#7c67ff]/[0.2] ${currentShape.icon}`}
            >
              <Image
                src="/logos/perplexity-symbol-light.svg"
                alt=""
                width={18}
                height={23}
                className="h-5 w-4 object-contain"
              />
            </span>
            <span className="min-w-0 flex-1 leading-none">
              <span className="block text-[9px] uppercase tracking-[0.11em] text-foreground/45">
                {t("buttonLabel")}
              </span>
              <span className="mt-1 block text-xs font-semibold text-foreground">Perplexity</span>
            </span>
            <ArrowUpRight
              className="h-3.5 w-3.5 shrink-0 text-[#9b8cff]/75 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </a>
        </div>
      </div>
    </section>
  );
}

"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { ShopProductImage } from "@/components/shop/ShopProductImage";
import { ShopInlinePriceText } from "@/components/shop/ShopInlinePriceText";
import type { SupportedLocale } from "@/lib/seo";
import type { CrossShopGroup, CrossShopMatch, Fitment } from "@/lib/crossShopFitment";
import {
  buildCrossShopHeading,
  prettifyVehicleLabel,
  porsche911SubmodelsCompatible,
} from "@/lib/crossShopFitment";
import { localizeShopProductTitle } from "@/lib/shopText";
import { buildShopStorefrontProductPathForProduct } from "@/lib/shopStorefrontRouting";
import { getBrandLogo } from "@/lib/brandLogos";

type Props = {
  locale: SupportedLocale;
  fitment: Fitment;
  groups: CrossShopGroup[];
};

type StoredPreference = {
  brand?: string;
  model?: string;
  chassis?: string;
};

function normalizeBrand(b: string): string {
  const clean = b.trim().toLowerCase();
  if (clean === "vw" || clean === "volkswagen" || clean === "vag") return "vw";
  if (clean === "mercedes" || clean === "mercedes-benz" || clean === "mercedes-amg")
    return "mercedes";
  return clean;
}

function tokenize(str: string): string[] {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function chassisCompatible(prefChassis: string, candChassis: string): boolean {
  const p = prefChassis.toLowerCase().replace(/[^a-z0-9]/g, "");
  const c = candChassis.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (p === c) return true;
  // Handle MQB relationship
  if (p === "mqb" && (c.startsWith("mk7") || c.startsWith("mk8") || c === "pq35")) return true;
  if (c === "mqb" && (p.startsWith("mk7") || p.startsWith("mk8") || p === "pq35")) return true;
  if (p.includes(c) || c.includes(p)) return true;
  return false;
}

function fitsPreference(fitment: Fitment, preference: StoredPreference): boolean {
  // 1. Verify Brand/Make compatibility
  if (preference.brand) {
    const prefBrandNorm = normalizeBrand(preference.brand);
    const candMakeNorm = fitment.make ? normalizeBrand(fitment.make) : "";

    if (candMakeNorm && prefBrandNorm !== candMakeNorm) {
      return false;
    }
  }

  // 2. Verify Model compatibility (if candidate has specific models list)
  if (preference.model && fitment.models.length > 0) {
    const isPorscheSubmodelCompatible = fitment.models.every((candModel) =>
      porsche911SubmodelsCompatible(preference.model!, candModel)
    );
    if (!isPorscheSubmodelCompatible) return false;

    const prefModelTokens = tokenize(preference.model);
    const hasModelOverlap = fitment.models.some((candModel) => {
      const candModelTokens = tokenize(candModel);
      return candModelTokens.some(
        (t) =>
          prefModelTokens.includes(t) && t !== "gti" && t !== "r" && t !== "class" && t !== "series"
      );
    });

    if (!hasModelOverlap) {
      if (preference.chassis && fitment.chassisCodes.length > 0) {
        const hasChassisOverlap = fitment.chassisCodes.some((cc) =>
          chassisCompatible(preference.chassis!, cc)
        );
        if (!hasChassisOverlap) return false;
      } else {
        return false;
      }
    }
  }

  // 3. Verify Chassis compatibility
  if (preference.chassis && fitment.chassisCodes.length > 0) {
    const hasChassisOverlap = fitment.chassisCodes.some((cc) =>
      chassisCompatible(preference.chassis!, cc)
    );
    if (!hasChassisOverlap) return false;
  }

  return true;
}

function interleaveByBrand(matches: CrossShopMatch[]): CrossShopMatch[] {
  const brandGroups = new Map<string, CrossShopMatch[]>();
  for (const match of matches) {
    const brand = (match.product.brand ?? "").trim().toLowerCase();
    let list = brandGroups.get(brand);
    if (!list) {
      list = [];
      brandGroups.set(brand, list);
    }
    list.push(match);
  }

  const result: CrossShopMatch[] = [];
  const lists = Array.from(brandGroups.values());

  let hasMore = true;
  let index = 0;
  while (hasMore) {
    hasMore = false;
    for (const list of lists) {
      if (index < list.length) {
        result.push(list[index]);
        hasMore = true;
      }
    }
    index++;
  }

  return result;
}

export default function CrossShopFitment({ locale, fitment, groups }: Props) {
  const [preference, setPreference] = useState<StoredPreference | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.sessionStorage.getItem("do88VehiclePreference");
      if (!raw) return;
      const parsed = JSON.parse(raw) as StoredPreference;
      if (parsed && (parsed.brand || parsed.model || parsed.chassis)) {
        setPreference(parsed);
      }
    } catch {
      // ignore
    }
  }, []);

  const filteredMatches = useMemo(() => {
    const rawMatches = groups.flatMap((group) => group.matches);
    const filtered = preference
      ? rawMatches.filter((match) => fitsPreference(match.fitment, preference))
      : rawMatches;
    return interleaveByBrand(filtered);
  }, [groups, preference]);

  if (!filteredMatches.length) return null;

  const isUa = locale === "ua";

  const heading = (() => {
    // Resolve brand, model, chassis by merging preference and fitment when applicable
    let displayBrand = preference?.brand;
    let displayModel = preference?.model;
    let displayChassis = preference?.chassis;

    if (preference) {
      const prefBrandNorm = preference.brand ? normalizeBrand(preference.brand) : "";
      const fitmentMakeNorm = fitment.make ? normalizeBrand(fitment.make) : "";

      if (!prefBrandNorm || prefBrandNorm === fitmentMakeNorm) {
        if (!displayBrand) displayBrand = fitment.make || undefined;
        if (!displayModel && fitment.models.length > 0) {
          displayModel = [...fitment.models].sort((a, b) => b.length - a.length)[0];
        }
        if (!displayChassis && fitment.chassisCodes.length > 0) {
          displayChassis = fitment.chassisCodes[0];
        }
      }
    } else {
      displayBrand = fitment.make || undefined;
      if (fitment.models.length > 0) {
        displayModel = [...fitment.models].sort((a, b) => b.length - a.length)[0];
      }
      if (fitment.chassisCodes.length > 0) {
        displayChassis = fitment.chassisCodes[0];
      }
    }

    const parts: string[] = [];
    if (displayBrand) {
      parts.push(displayBrand);
    }
    if (displayModel) {
      parts.push(prettifyVehicleLabel(displayModel));
    }
    if (displayChassis) {
      const lastPart = parts[parts.length - 1] || "";
      if (!lastPart.toLowerCase().includes(displayChassis.toLowerCase())) {
        parts.push(`(${displayChassis.toUpperCase()})`);
      }
    }

    const lead = isUa ? "Також підходить:" : "Also fits:";
    if (parts.length === 0) {
      return isUa ? "Може зацікавити з інших магазинів" : "You may also like from other stores";
    }
    return `${lead} ${parts.join(" ")}`;
  })();

  return (
    <section aria-label={isUa ? "Підходить також" : "Also fits"} className="space-y-6">
      <header className="space-y-2">
        <p className="text-[10px] uppercase tracking-[0.28em] text-foreground/60 dark:text-foreground/40">
          {isUa ? "Сумісне з вашим авто" : "Compatible with your vehicle"}
        </p>
        <h2 className="text-2xl font-light tracking-tight md:text-3xl">{heading}</h2>
      </header>

      <div
        className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-3 scrollbar-thin sm:mx-0 sm:px-0 sm:[scrollbar-color:rgba(255,255,255,0.25)_transparent]"
        role="list"
      >
        {filteredMatches.map((match) => (
          <CrossShopCard key={match.product.slug} match={match} locale={locale} />
        ))}
      </div>
    </section>
  );
}

function CrossShopCard({ match, locale }: { match: CrossShopMatch; locale: SupportedLocale }) {
  const { product } = match;
  const title = localizeShopProductTitle(locale, product);
  const href = buildShopStorefrontProductPathForProduct(locale, product);
  const brandLogo = getBrandLogo(product.brand ?? "");
  const fitmentChips = buildFitmentChips(match);
  const isUa = locale === "ua";

  return (
    <Link
      href={href}
      role="listitem"
      className="group flex w-[280px] shrink-0 snap-start flex-col overflow-hidden rounded-2xl border border-foreground/15 bg-foreground/[0.03] transition-all duration-300 hover:border-foreground/30 hover:bg-foreground/8 sm:w-[300px]"
    >
      <div className="relative aspect-4/3 overflow-hidden bg-white border-b border-zinc-950/10 flex items-center justify-center p-4">
        {product.image ? (
          <ShopProductImage
            src={product.image}
            alt={title}
            fill
            sizes="(max-width: 768px) 80vw, 320px"
            fallbackSrc="/images/placeholders/product-fallback.svg"
            className="object-contain p-4 mix-blend-multiply transition duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-zinc-400">
            <ShoppingBag size={32} aria-hidden="true" />
          </div>
        )}
        {brandLogo ? (
          <span className="absolute left-3 top-3 inline-flex h-8 items-center gap-2 rounded-full border border-foreground/18 bg-black/60 px-3 backdrop-blur-md">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={brandLogo}
              alt={product.brand ?? ""}
              loading="lazy"
              className="h-4 w-auto max-w-[80px] object-contain"
            />
          </span>
        ) : (
          <span className="absolute left-3 top-3 inline-flex items-center rounded-full border border-white/25 bg-black/60 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/85 backdrop-blur-md">
            {product.brand}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="text-[10px] uppercase tracking-[0.18em] text-foreground/65 dark:text-foreground/45">
          {product.brand}
        </p>
        <h3 className="line-clamp-2 min-h-[2.6rem] text-[0.95rem] font-light leading-snug text-foreground dark:text-foreground/90 transition-colors group-hover:text-foreground">
          {title}
        </h3>
        {fitmentChips.length ? (
          <ul className="flex flex-wrap gap-1.5" aria-label={isUa ? "Сумісність" : "Fitment"}>
            {fitmentChips.map((chip) => (
              <li
                key={chip}
                className="rounded-full border border-foreground/12 bg-foreground/6 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-foreground/75 dark:text-foreground/60"
              >
                {chip}
              </li>
            ))}
          </ul>
        ) : null}
        <div className="mt-auto flex items-center justify-between gap-3 border-t border-foreground/12 pt-3">
          <ShopInlinePriceText locale={locale} price={product.price} />
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/80 dark:text-foreground/65 transition-colors group-hover:text-foreground">
            {isUa ? "Перейти" : "View"}
            <svg
              viewBox="0 0 24 24"
              width="12"
              height="12"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="transition-transform duration-300 group-hover:translate-x-0.5"
            >
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </span>
        </div>
      </div>
    </Link>
  );
}

function buildFitmentChips(match: CrossShopMatch): string[] {
  const chassis = match.fitment.chassisCodes[0];
  const model = match.fitment.models[0] ? prettifyVehicleLabel(match.fitment.models[0]) : "";

  if (chassis && model) {
    if (model.toLowerCase().includes(chassis.toLowerCase())) {
      return [model];
    }
    return [chassis.toUpperCase(), model];
  }

  if (chassis) return [chassis.toUpperCase()];
  if (model) return [model];
  return [];
}

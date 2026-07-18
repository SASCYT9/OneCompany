import Link from "next/link";
import { ArrowDown, ArrowUpRight, LayoutGrid, SlidersHorizontal, Tags } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  getShopNavigationDestinations,
  type ShopNavigationDestinationKey,
} from "@/lib/shopNavigation";

type ShopHubNavigationProps = {
  locale: string;
  active: ShopNavigationDestinationKey;
  className?: string;
};

const ICONS = {
  brands: Tags,
  catalog: LayoutGrid,
  selection: SlidersHorizontal,
} as const;

export function ShopHubNavigation({ locale, active, className }: ShopHubNavigationProps) {
  const isUa = locale === "ua";
  const copy = {
    brands: {
      title: isUa ? "Бренди" : "Brands",
      description: isUa ? "Усі в одному магазині" : "All in one shop",
    },
    catalog: {
      title: isUa ? "Каталог товарів" : "Product catalog",
      description: isUa ? "Усі товари в одному пошуку" : "All products in one search",
    },
    selection: {
      title: isUa ? "Підбір за авто / мото" : "Vehicle finder",
      description: isUa ? "Допоможемо перевірити сумісність" : "We will help verify fitment",
    },
  } as const;

  return (
    <nav
      aria-label={isUa ? "Розділи магазину" : "Shop sections"}
      className={cn(
        "grid grid-cols-2 gap-1.5 rounded-[24px] border border-white/10 bg-[#0b0b0c]/96 p-1.5 text-white shadow-[0_22px_60px_rgba(0,0,0,0.28)] backdrop-blur-xl md:grid-cols-3",
        className
      )}
    >
      {getShopNavigationDestinations(locale).map((destination) => {
        const Icon = ICONS[destination.key];
        const isActive = active === destination.key;
        const isCatalog = destination.key === "catalog";
        const scrollsToBrands = destination.key === "brands" && isActive;
        const DirectionIcon = scrollsToBrands ? ArrowDown : ArrowUpRight;

        return (
          <Link
            key={destination.key}
            href={scrollsToBrands ? "#shop-brands" : destination.href}
            prefetch={destination.key === "catalog" ? false : undefined}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "group relative flex min-h-[78px] items-center gap-3 overflow-hidden rounded-[18px] border px-3 py-3 text-left transition duration-300 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0b0c] sm:min-h-[88px] sm:px-5 sm:py-4",
              destination.key === "selection" && "col-span-2 md:col-span-1",
              isCatalog
                ? "border-primary bg-primary text-primary-foreground shadow-[0_14px_32px_rgba(213,0,28,0.22)] hover:-translate-y-0.5 hover:bg-primary/92"
                : "border-white/[0.08] bg-white/[0.035] text-white hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.08]",
              isActive && !isCatalog && "border-white/20 bg-white/[0.09]"
            )}
          >
            <span
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border sm:h-10 sm:w-10",
                isCatalog ? "border-white/25 bg-white/12" : "border-white/15 bg-white/[0.06]"
              )}
            >
              <Icon className="h-[18px] w-[18px]" strokeWidth={1.7} aria-hidden="true" />
            </span>

            <span className="min-w-0 flex-1">
              <span className="block font-display text-[11px] font-semibold uppercase tracking-[0.13em] sm:text-[13px] sm:tracking-[0.16em]">
                {copy[destination.key].title}
              </span>
              <span
                className={cn(
                  "mt-1 hidden text-[11px] leading-snug sm:block sm:text-xs",
                  isCatalog ? "text-primary-foreground/78" : "text-white/55"
                )}
              >
                {copy[destination.key].description}
              </span>
            </span>

            <DirectionIcon
              className={cn(
                "hidden h-4 w-4 shrink-0 transition-transform duration-300 sm:block",
                scrollsToBrands
                  ? "group-hover:translate-y-0.5"
                  : "group-hover:translate-x-0.5 group-hover:-translate-y-0.5",
                isCatalog ? "text-primary-foreground" : "text-white/40"
              )}
              strokeWidth={1.7}
              aria-hidden="true"
            />
          </Link>
        );
      })}
    </nav>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, Search, ShoppingBag, ShoppingCart } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  getMobileBottomNavigationActiveKey,
  shouldHideMobileBottomNavigation,
  type MobileBottomNavigationKey,
} from "@/lib/mobileBottomNavigation";

type MobileBottomNavigationProps = {
  locale: string;
};

type MobileBottomNavigationItem = {
  key: MobileBottomNavigationKey;
  href: string;
  label: string;
  icon: typeof House;
};

export function MobileBottomNavigation({ locale }: MobileBottomNavigationProps) {
  const pathname = usePathname();
  const isUa = locale === "ua";

  if (shouldHideMobileBottomNavigation(pathname, locale)) return null;

  const activeKey = getMobileBottomNavigationActiveKey(pathname, locale);
  const items: MobileBottomNavigationItem[] = [
    {
      key: "home",
      href: `/${locale}`,
      label: isUa ? "Головна" : "Home",
      icon: House,
    },
    {
      key: "shop",
      href: `/${locale}/shop`,
      label: isUa ? "Магазин" : "Shop",
      icon: ShoppingBag,
    },
    {
      key: "selection",
      href: `/${locale}/contact#selection-form`,
      label: isUa ? "Підбір" : "Finder",
      icon: Search,
    },
    {
      key: "cart",
      href: `/${locale}/shop/cart`,
      label: isUa ? "Кошик" : "Cart",
      icon: ShoppingCart,
    },
  ];

  return (
    <>
      <div aria-hidden="true" className="h-[calc(4.25rem+env(safe-area-inset-bottom))] lg:hidden" />
      <nav
        aria-label={isUa ? "Основна мобільна навігація" : "Primary mobile navigation"}
        data-testid="mobile-bottom-navigation"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-30 lg:hidden"
      >
        <div className="pointer-events-auto rounded-t-[30px] border border-b-0 border-black/10 bg-[#f8f7f5]/96 px-2 pt-1 shadow-[0_-12px_36px_rgba(0,0,0,0.12)] backdrop-blur-xl transition-[background-color,border-color,box-shadow] duration-300 dark:border-white/10 dark:bg-[#0b0b0c]/94 dark:shadow-[0_-14px_42px_rgba(0,0,0,0.5)]">
          <div className="grid grid-cols-4 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
            {items.map((item) => {
              const Icon = item.icon;
              const isActive = item.key === activeKey;

              return (
                <Link
                  key={item.key}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "relative flex min-h-[52px] touch-manipulation flex-col items-center justify-center gap-0.5 rounded-2xl px-1 text-[#171717] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d5001c]/45 dark:text-white/78",
                    isActive && "text-[#d5001c]"
                  )}
                >
                  <Icon aria-hidden="true" className="h-5 w-5" strokeWidth={1.8} />
                  <span className="font-display text-[9px] font-medium uppercase tracking-[0.08em]">
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
    </>
  );
}

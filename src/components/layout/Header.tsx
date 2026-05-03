"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/ui/Logo";
import { LocaleSwitcher } from "@/components/ui/LocaleSwitcher";
import { trackEvent } from "@/lib/analytics";

type NavItemKey = "automotive" | "moto" | "about" | "contact";

const navItems: { key: NavItemKey; href: string }[] = [
  { key: "automotive", href: "/auto" },
  { key: "moto", href: "/moto" },
  { key: "about", href: "/about" },
  { key: "contact", href: "/contact" },
];

const storeLinks = [
  { label: "KW Suspension", href: "https://kwsuspension.shop/" },
  { label: "Fi Exhaust", href: "https://fiexhaust.shop/" },
  { label: "Eventuri", href: "https://eventuri.shop/" },
];

export function Header() {
  const params = useParams();
  const pathname = usePathname();
  const locale = (params?.locale as string) || "ua";
  const tNav = useTranslations("nav");
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  useEffect(() => {
    setIsMobileNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!isMobileNavOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isMobileNavOpen]);

  const toggleMobileNav = () => setIsMobileNavOpen((prev) => !prev);

  return (
    <header className="fixed left-0 right-0 top-0 z-50 pt-4">
      <div className="mx-auto flex max-w-7xl items-center rounded-[32px] border border-white/10 bg-transparent px-3 py-2 backdrop-blur-2xl sm:px-4 md:px-8">
        <Link
          href={`/${locale}`}
          className="relative inline-flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          aria-label="ONE COMPANY home"
        >
          <Logo className="w-24 md:w-32" priority tone="light" />
          <span className="absolute -bottom-2.5 left-0 h-px w-10 bg-gradient-to-r from-amber-400 to-transparent" />
        </Link>
        <nav className="ml-10 hidden flex-1 items-center gap-8 md:flex">
          {navItems.map((item) => {
            const target = item.href === "/" ? `/${locale}` : `/${locale}${item.href}`;
            const isActive =
              item.href === "/"
                ? pathname === `/${locale}`
                : pathname === target || pathname?.startsWith(`${target}/`);
            return (
              <Link
                key={item.key}
                href={target}
                className={cn(
                  "relative text-xs font-light uppercase tracking-[0.35em] text-white/70 transition-colors hover:text-white",
                  isActive && "text-white"
                )}
                onClick={() => trackEvent("nav_click", { destination: item.key, surface: "desktop" })}
              >
                {tNav(item.key)}
                {isActive && (
                  <motion.span
                    layoutId="nav-active"
                    className="absolute -bottom-2.5 left-0 block h-px w-full bg-gradient-to-r from-amber-400 to-transparent"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3 }}
                  />
                )}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-2 sm:gap-4">
          <LocaleSwitcher className="hidden md:flex" />
          <Link
            href={`/${locale}/contact`}
            className="group hidden items-center gap-3 rounded-full border border-white/20 bg-white/10 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.35em] text-white transition duration-300 hover:border-white hover:bg-white hover:text-black sm:inline-flex"
            onClick={() => trackEvent("cta_book_atelier", { surface: "header-desktop" })}
          >
            {tNav("bookAtelier")}
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/20 text-white transition-colors group-hover:bg-black/60">
              →
            </span>
          </Link>
          <button
            type="button"
            onClick={toggleMobileNav}
            className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white transition-colors hover:bg-white/10 md:hidden"
            aria-label={isMobileNavOpen ? tNav("close") : tNav("menu")}
            aria-expanded={isMobileNavOpen}
          >
            <span className="sr-only">{isMobileNavOpen ? tNav("close") : tNav("menu")}</span>
            <span className="relative flex h-5 w-5 flex-col items-center justify-center">
              <span
                className={cn(
                  "block h-0.5 w-full rounded-full bg-white transition-all duration-300",
                  isMobileNavOpen ? "translate-y-1 rotate-45" : "-translate-y-1"
                )}
              />
              <span
                className={cn(
                  "mt-1 block h-0.5 w-full rounded-full bg-white transition-opacity",
                  isMobileNavOpen ? "opacity-0" : "opacity-100"
                )}
              />
              <span
                className={cn(
                  "mt-1 block h-0.5 w-full rounded-full bg-white transition-all duration-300",
                  isMobileNavOpen ? "-translate-y-1 -rotate-45" : "translate-y-1"
                )}
              />
            </span>
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isMobileNavOpen && (
          <motion.div
            key="mobile-nav"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-md"
            onClick={() => setIsMobileNavOpen(false)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 150, damping: 25 }}
              className="absolute bottom-0 left-0 right-0 rounded-t-[32px] border-t border-white/10 bg-[#080808] p-5 pb-8"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-6 flex items-center justify-between px-1">
                <Logo tone="light" className="w-28" />
                <LocaleSwitcher variant="ghost" />
              </div>
              <div className="space-y-3">
                {navItems.map((item) => {
                  const target = item.href === "/" ? `/${locale}` : `/${locale}${item.href}`;
                  const isActive =
                    item.href === "/"
                      ? pathname === `/${locale}`
                      : pathname === target || pathname?.startsWith(`${target}/`);
                  return (
                    <Link
                      key={`mobile-${item.key}`}
                      href={target}
                      onClick={() => {
                        trackEvent("nav_click", { destination: item.key, surface: "mobile" });
                        setIsMobileNavOpen(false);
                      }}
                      className={cn(
                        "flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 text-base font-light uppercase tracking-[0.25em] text-white/80 transition-colors hover:bg-white/10 hover:text-white",
                        isActive && "border-white/20 bg-white/10 text-white"
                      )}
                    >
                      {tNav(item.key)}
                      <span aria-hidden className="text-white/50">↗</span>
                    </Link>
                  );
                })}
              </div>
              <div className="mt-6 space-y-2 border-t border-white/10 pt-5 text-sm text-white/70">
                {storeLinks.map((store) => (
                  <a
                    key={store.label}
                    href={store.href}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between rounded-2xl border border-transparent px-4 py-3 transition-colors hover:border-white/10 hover:bg-white/5 hover:text-white"
                    onClick={() => trackEvent("store_link_click", { destination: store.label })}
                  >
                    {store.label}
                    <span aria-hidden className="text-white/50">↗</span>
                  </a>
                ))}
              </div>
              <Link
                href={`/${locale}/contact`}
                onClick={() => {
                  trackEvent("cta_book_atelier", { surface: "header-mobile" });
                  setIsMobileNavOpen(false);
                }}
                className="mt-6 inline-flex w-full items-center justify-center rounded-2xl bg-white px-6 py-4 text-base font-semibold uppercase tracking-[0.3em] text-black transition-transform active:scale-95"
              >
                {tNav("bookAtelier")}
              </Link>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

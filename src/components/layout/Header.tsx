"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/ui/Logo";
import { LocaleSwitcher } from "@/components/ui/LocaleSwitcher";
import { Menu, X } from "lucide-react";

const navItems = [
  { key: "automotive", href: "/auto" },
  { key: "moto", href: "/moto" },
  { key: "about", href: "/about" },
  { key: "contact", href: "/contact" },
];

export function Header() {
  const params = useParams();
  const pathname = usePathname();
  const locale = (params?.locale as string) || "en";
  const tNav = useTranslations("nav");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <>
    <a href="#main-content" className="sr-only focus:not-sr-only absolute top-2 left-2 z-50 rounded-md bg-white/90 px-3 py-2 text-sm text-black">Skip to content</a>
    <header className="fixed top-0 left-0 right-0 z-50 pt-2 sm:pt-4">
      <div className="relative mx-2 flex max-w-6xl items-center rounded-2xl border border-white/10 bg-black/80 backdrop-blur-xl px-3 py-2.5 sm:mx-auto sm:rounded-[32px] sm:px-4 sm:py-3 md:px-8">
        <Link
          href={`/${locale}`}
          className="absolute left-1/2 -translate-x-1/2 md:relative md:left-auto md:translate-x-0 z-10 inline-flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          aria-label="ONE COMPANY home"
        >
          <Logo className="w-20 sm:w-28 md:w-32" priority tone="light" size="compact" />
          <span className="absolute -bottom-1 left-0 h-px w-8 bg-gradient-to-r from-white to-transparent sm:-bottom-2 sm:w-10" />
        </Link>
        <nav className="ml-6 hidden flex-1 items-center gap-4 md:ml-10 md:gap-6 lg:flex">
          {navItems.map((item) => {
            const target = `/${locale}${item.href}`;
            const isActive = pathname === target || pathname?.startsWith(`${target}/`);
            return (
              <Link
                key={item.key}
                href={target}
                className={cn(
                  "relative font-display text-xs uppercase tracking-[0.2em] text-white/60 transition-colors md:text-sm md:tracking-[0.25em]",
                  isActive && "text-white"
                )}
              >
                {tNav(item.key)}
                {isActive && (
                  <motion.span
                    layoutId="nav-active"
                    className="absolute -bottom-2 left-0 block h-px w-full bg-gradient-to-r from-white to-transparent"
                  />
                )}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-2 sm:gap-4">
          <LocaleSwitcher className="hidden md:flex" />
          <Link
            href={`/${locale}/partnership`}
            className="group hidden items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 font-display text-[10px] font-semibold uppercase tracking-[0.25em] text-white transition hover:border-white hover:bg-white hover:text-black sm:inline-flex sm:gap-3 sm:px-5 sm:py-2 sm:text-xs sm:tracking-[0.35em]"
          >
            <span className="hidden sm:inline">{tNav("bookAtelier")}</span>
            <span className="sm:hidden">Book</span>
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-black/30 text-white transition group-hover:bg-black/80 sm:h-6 sm:w-6">
              →
            </span>
          </Link>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition hover:border-white hover:bg-white/20 lg:hidden"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-x-0 top-16 z-40 mx-2 rounded-2xl border border-white/10 bg-black/90 backdrop-blur-xl p-6 sm:top-20 sm:mx-auto sm:max-w-md"
          >
            <nav className="flex flex-col gap-4 text-center">
              {navItems.map((item) => {
                const target = `/${locale}${item.href}`;
                const isActive = pathname === target || pathname?.startsWith(`${target}/`);
                return (
                  <Link
                    key={item.key}
                    href={target}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      "relative font-display border-b border-white/10 pb-3 text-sm uppercase tracking-[0.25em] text-white/60 transition-colors",
                      isActive && "text-white"
                    )}
                  >
                    {tNav(item.key)}
                    {isActive && (
                      <span className="absolute bottom-0 left-0 block h-px w-12 bg-gradient-to-r from-white to-transparent" />
                    )}
                  </Link>
                );
              })}
              <div className="mt-2 flex flex-col items-center gap-4 border-t border-white/10 pt-4">
                <div className="flex items-center gap-3">
                  <LocaleSwitcher />
                </div>
                <Link
                  href={`/${locale}/partnership`}
                  onClick={() => setMobileMenuOpen(false)}
                  className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-black transition"
                >
                  {tNav("bookAtelier")}
                </Link>
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
    </>
  );
}

"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/ui/Logo";
import { LocaleSwitcher } from "@/components/ui/LocaleSwitcher";

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

  return (
    <header className="fixed top-0 left-0 right-0 z-50 pt-4">
      <div className="mx-auto flex max-w-6xl items-center rounded-[32px] border border-white/10 bg-gradient-to-r from-white/5 via-white/5 to-transparent px-4 py-3 backdrop-blur-3xl md:px-8">
        <Link
          href={`/${locale}`}
          className="relative inline-flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          aria-label="ONE COMPANY home"
        >
          <Logo className="w-28 md:w-32" priority tone="light" size="compact" />
          <span className="absolute -bottom-2 left-0 h-px w-10 bg-gradient-to-r from-amber-400 to-transparent" />
        </Link>
        <nav className="ml-10 hidden flex-1 items-center gap-6 md:flex">
          {navItems.map((item) => {
            const target = `/${locale}${item.href}`;
            const isActive = pathname === target || pathname?.startsWith(`${target}/`);
            return (
              <Link
                key={item.key}
                href={target}
                className={cn(
                  "relative text-sm font-light uppercase tracking-[0.25em] text-white/60 transition-colors",
                  isActive && "text-white"
                )}
              >
                {tNav(item.key)}
                {isActive && (
                  <motion.span
                    layoutId="nav-active"
                    className="absolute -bottom-2 left-0 block h-px w-full bg-gradient-to-r from-amber-400 to-transparent"
                  />
                )}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-4">
          <LocaleSwitcher className="hidden md:flex" />
          <Link
            href={`/${locale}/contact`}
            className="group inline-flex items-center gap-3 rounded-full border border-white/20 bg-white/10 px-5 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-white transition hover:border-white hover:bg-white hover:text-black"
          >
            {tNav("bookAtelier")}
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/30 text-white transition group-hover:bg-black/80">
              →
            </span>
          </Link>
        </div>
      </div>
    </header>
  );
}

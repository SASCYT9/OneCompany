"use client";

import { useTransition } from "react";
import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/routing";
import { cn } from "@/lib/utils";

const locales: { value: "en" | "ua"; label: string }[] = [
  { value: "en", label: "EN" },
  { value: "ua", label: "UA" },
];

export function LocaleSwitcher({ className }: { className?: string }) {
  const locale = useLocale() as "en" | "ua";
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const handleSelect = (targetLocale: "en" | "ua") => {
    if (targetLocale === locale) return;
    startTransition(() => {
      router.replace(pathname, { locale: targetLocale });
    });
  };

  return (
    <div
      className={cn(
        "flex items-center gap-1 rounded-full border border-white/15 bg-white/5 p-1 text-[11px] uppercase tracking-[0.35em]",
        className
      )}
    >
      {locales.map(({ value, label }) => {
        const isActive = value === locale;
        return (
          <button
            key={value}
            type="button"
            onClick={() => handleSelect(value)}
            disabled={isPending || isActive}
            className={cn(
              "rounded-full px-3 py-1 transition",
              isActive
                ? "bg-white text-black shadow-[0_4px_18px_rgba(255,255,255,0.3)]"
                : "text-white/70 hover:text-white"
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

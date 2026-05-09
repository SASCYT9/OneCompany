"use client";

import type { ReactNode } from "react";

import Image from "next/image";
import Link from "next/link";

import { ArrowLeft, X } from "lucide-react";

import { adminBrandTheme, type AdminBrandTheme } from "@/lib/admin/brandTheme";
import { cn } from "@/lib/utils";

export type AdminBrandHeroStat = {
  label: string;
  value: ReactNode;
  tone?: "default" | "success" | "warning" | "danger" | "accent";
};

const STAT_DOT: Record<NonNullable<AdminBrandHeroStat["tone"]>, string> = {
  default: "bg-zinc-400",
  accent: "bg-blue-400",
  success: "bg-emerald-400",
  warning: "bg-amber-400",
  danger: "bg-red-400",
};

export function AdminBrandHero({
  brand,
  description,
  stats,
  actions,
  onClearBrand,
  className,
}: {
  brand: string;
  description?: string;
  stats?: AdminBrandHeroStat[];
  actions?: ReactNode;
  /** Called when the user clicks the "X" inside the active-filter chip. */
  onClearBrand?: () => void;
  className?: string;
}) {
  const theme: AdminBrandTheme = adminBrandTheme(brand);

  const heroGradient = `radial-gradient(120% 100% at 0% 0%, ${theme.bgSoft} 0%, transparent 60%), radial-gradient(80% 80% at 100% 100%, ${theme.bgSoft} 0%, transparent 55%)`;

  return (
    <section
      data-testid="brand-hero"
      data-brand={theme.id}
      className={cn(
        "relative overflow-hidden rounded-none border bg-[#0F0F0F] px-5 py-6 sm:px-7 sm:py-8 md:px-10 md:py-10 lg:px-14 lg:py-14",
        className
      )}
      style={{
        borderColor: theme.border,
        backgroundImage: heroGradient,
      }}
    >
      {/* Cinematic glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-32 -top-32 h-112 w-md rounded-full opacity-60 blur-3xl"
        style={{ background: theme.bgMedium }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-40 bottom-[-40%] h-128 w-lg rounded-full opacity-40 blur-3xl"
        style={{ background: theme.bgMedium }}
      />

      {/* Subtle grid lines */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage: "radial-gradient(ellipse at 50% 30%, rgba(0,0,0,0.6), transparent 70%)",
        }}
      />

      <div className="relative flex flex-wrap items-start justify-between gap-6">
        <div className="min-w-0 flex-1 space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/admin/shop"
              className="inline-flex items-center gap-1.5 rounded-full border border-white/8 bg-white/3 px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-zinc-400 transition hover:border-white/20 hover:text-zinc-200"
            >
              <ArrowLeft className="h-3 w-3" />
              Каталог
            </Link>
            <button
              type="button"
              onClick={onClearBrand}
              data-chip="brand"
              className="group inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-wider transition"
              style={{
                borderColor: theme.border,
                background: theme.bgSoft,
                color: theme.tintHex,
              }}
              aria-label="Очистити фільтр бренду"
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: theme.tintHex }} />
              Активний бренд: {theme.displayName}
              <X
                className="h-3 w-3 opacity-70 transition group-hover:opacity-100"
                aria-hidden="true"
              />
            </button>
          </div>

          <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-end">
            {theme.logoSrc ? (
              <div
                className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-none border border-white/8 bg-black/50 backdrop-blur-md"
                style={{
                  width: "clamp(96px, 12vw, 160px)",
                  height: "clamp(96px, 12vw, 160px)",
                }}
              >
                <div
                  className="absolute inset-0 opacity-30"
                  style={{ background: theme.bgMedium }}
                  aria-hidden="true"
                />
                <Image
                  src={theme.logoSrc}
                  alt={theme.displayName}
                  width={140}
                  height={140}
                  className="relative h-[68%] w-[68%] object-contain"
                  unoptimized
                />
              </div>
            ) : null}
            <div className="min-w-0 flex-1 space-y-2">
              <div
                className="text-[11px] font-medium uppercase tracking-[0.36em]"
                style={{ color: theme.tintHex }}
              >
                Перегляд бренду
              </div>
              <h1
                className={cn(
                  "font-semibold leading-[1.02] text-zinc-50",
                  theme.fontClass,
                  theme.trackingClass
                )}
                style={{
                  fontSize: "clamp(2.25rem, 5.4vw, 5rem)",
                  fontWeight: theme.fontClass === "font-display" ? 500 : 600,
                }}
              >
                {theme.displayName}
              </h1>
              {theme.tagline || description ? (
                <p className="max-w-3xl text-sm leading-6 text-zinc-300/90 md:text-[15px] lg:text-base">
                  {description || theme.tagline}
                </p>
              ) : null}
            </div>
          </div>

          {stats && stats.length > 0 ? (
            <dl className="flex flex-wrap items-center gap-x-7 gap-y-2 pt-3 text-sm">
              {stats.map((stat, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span
                    className={cn(
                      "h-2 w-2 rounded-full",
                      stat.tone && stat.tone !== "default" ? STAT_DOT[stat.tone] : undefined
                    )}
                    style={
                      !stat.tone || stat.tone === "default"
                        ? { background: theme.tintHex }
                        : undefined
                    }
                    aria-hidden="true"
                  />
                  <dt className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">
                    {stat.label}
                  </dt>
                  <dd className="text-base font-semibold tabular-nums text-zinc-50">
                    {stat.value}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>

        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </div>
    </section>
  );
}

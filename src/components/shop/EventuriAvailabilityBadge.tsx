import type { SupportedLocale } from "@/lib/seo";

type Props = {
  locale: SupportedLocale;
  compact?: boolean;
};

export function EventuriAvailabilityBadge({ locale, compact = false }: Props) {
  return (
    <span
      role="status"
      aria-label={locale === "ua" ? "В наявності" : "In stock"}
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-emerald-500/35 bg-emerald-500/10 font-semibold uppercase text-emerald-700 dark:border-emerald-300/25 dark:bg-emerald-400/10 dark:text-emerald-300 ${
        compact
          ? "px-2 py-1 text-[9px] tracking-[0.12em]"
          : "px-3 py-1.5 text-[10px] tracking-[0.15em]"
      }`}
    >
      <span
        aria-hidden="true"
        className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-600 dark:bg-emerald-300"
      />
      {locale === "ua" ? "В наявності!" : "In stock"}
    </span>
  );
}

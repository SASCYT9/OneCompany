import Link from "next/link";
import type { SupportedLocale } from "@/lib/seo";

type Props = {
  locale: SupportedLocale;
  href: string;
  productCount: number;
};

/**
 * Server-rendered CTA placed below each brand HomeSignature. Gives every
 * brand home an explicit, crawlable internal link to its product catalog —
 * the hero-section "Open Catalog" link is sometimes wrapped in custom CSS
 * that the SSR HTML still includes, but having a second, plain anchor in a
 * uniform footer slot guarantees Googlebot finds the catalog regardless of
 * the editorial design of any individual HomeSignature.
 *
 * Anchor text intentionally surfaces the product count so the link reads as
 * a concrete commitment rather than a vague CTA — both better UX and a
 * stronger relevance signal for the destination listing page.
 */
export function ShopBrandViewAllCta({ locale, href, productCount }: Props) {
  const isUa = locale === "ua";
  const label = isUa
    ? `Переглянути всі ${productCount} товарів`
    : `View all ${productCount} products`;
  return (
    <section className="border-t border-foreground/8 bg-background py-16 text-center">
      <Link
        href={href}
        className="inline-flex items-center gap-4 text-xs font-semibold uppercase tracking-[0.28em] text-foreground/70 transition-colors hover:text-foreground"
      >
        <span>{label}</span>
        <span aria-hidden="true" className="text-base">
          →
        </span>
      </Link>
    </section>
  );
}

import Link from 'next/link';
import { ShoppingBag } from 'lucide-react';
import { ShopProductImage } from '@/components/shop/ShopProductImage';
import { ShopInlinePriceText } from '@/components/shop/ShopInlinePriceText';
import type { SupportedLocale } from '@/lib/seo';
import type {
  CrossShopGroup,
  CrossShopMatch,
  Fitment,
} from '@/lib/crossShopFitment';
import { buildCrossShopHeading, prettifyVehicleLabel } from '@/lib/crossShopFitment';
import { localizeShopProductTitle } from '@/lib/shopText';
import { buildShopStorefrontProductPathForProduct } from '@/lib/shopStorefrontRouting';
import { getBrandLogo } from '@/lib/brandLogos';

type Props = {
  locale: SupportedLocale;
  fitment: Fitment;
  groups: CrossShopGroup[];
};

export default function CrossShopFitment({ locale, fitment, groups }: Props) {
  if (!groups.length) return null;
  const heading = buildCrossShopHeading(fitment, locale);
  const matches = groups.flatMap((group) => group.matches);
  const isUa = locale === 'ua';

  return (
    <section aria-label={isUa ? 'Підходить також' : 'Also fits'} className="space-y-6">
      <header className="space-y-2">
        <p className="text-[10px] uppercase tracking-[0.28em] text-white/40">
          {isUa ? 'Сумісне з вашим авто' : 'Compatible with your vehicle'}
        </p>
        <h2 className="text-2xl font-light tracking-tight md:text-3xl">{heading}</h2>
      </header>

      <div
        className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-3 [scrollbar-width:thin] sm:mx-0 sm:px-0 sm:[scrollbar-color:rgba(255,255,255,0.25)_transparent]"
        role="list"
      >
        {matches.map((match) => (
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
  const brandLogo = getBrandLogo(product.brand ?? '');
  const fitmentChips = buildFitmentChips(match);
  const isUa = locale === 'ua';

  return (
    <Link
      href={href}
      role="listitem"
      className="group flex w-[280px] shrink-0 snap-start flex-col overflow-hidden rounded-2xl border border-white/12 bg-white/[0.02] transition-all duration-300 hover:border-white/30 hover:bg-white/[0.05] sm:w-[300px]"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-black/40">
        {product.image ? (
          <ShopProductImage
            src={product.image}
            alt={title}
            fill
            sizes="(max-width: 768px) 80vw, 320px"
            fallbackSrc="/images/placeholders/product-fallback.svg"
            className="object-cover transition duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-white/15">
            <ShoppingBag size={32} aria-hidden="true" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/0 to-black/55" />
        {brandLogo ? (
          <span className="absolute left-3 top-3 inline-flex h-8 items-center gap-2 rounded-full border border-white/15 bg-black/65 px-3 backdrop-blur-md">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={brandLogo}
              alt={product.brand ?? ''}
              loading="lazy"
              className="h-4 w-auto max-w-[80px] object-contain"
            />
          </span>
        ) : (
          <span className="absolute left-3 top-3 inline-flex items-center rounded-full border border-white/15 bg-black/65 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/85 backdrop-blur-md">
            {product.brand}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="text-[10px] uppercase tracking-[0.18em] text-white/45">
          {product.brand}
        </p>
        <h3 className="line-clamp-2 min-h-[2.6rem] text-[0.95rem] font-light leading-snug text-white/90 transition-colors group-hover:text-white">
          {title}
        </h3>
        {fitmentChips.length ? (
          <ul
            className="flex flex-wrap gap-1.5"
            aria-label={isUa ? 'Сумісність' : 'Fitment'}
          >
            {fitmentChips.map((chip) => (
              <li
                key={chip}
                className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-white/60"
              >
                {chip}
              </li>
            ))}
          </ul>
        ) : null}
        <div className="mt-auto flex items-center justify-between gap-3 border-t border-white/10 pt-3">
          <ShopInlinePriceText
            locale={locale}
            price={product.price}
          />
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/65 transition-colors group-hover:text-white">
            {isUa ? 'Перейти' : 'View'}
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
  const chips: string[] = [];
  if (match.fitment.chassisCodes[0]) chips.push(match.fitment.chassisCodes[0]);
  if (match.fitment.models[0]) {
    chips.push(prettifyVehicleLabel(match.fitment.models[0]));
  }
  return Array.from(new Set(chips)).slice(0, 2);
}

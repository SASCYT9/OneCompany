import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

import { buildShopStorefrontBrandPath } from "@/lib/shopStorefrontRouting";

type Props = {
  brand: string;
  locale: string;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
};

/** Shared accessible brand link used by every product-detail presentation. */
export function ShopBrandLink({ brand, locale, children, className, style }: Props) {
  const isUa = locale === "ua";

  return (
    <Link
      href={buildShopStorefrontBrandPath(locale, brand)}
      aria-label={
        isUa ? `Переглянути всі товари бренду ${brand}` : `View all ${brand} products`
      }
      className={className}
      style={style}
    >
      {children ?? brand}
    </Link>
  );
}

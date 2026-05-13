"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ShoppingBag } from "lucide-react";

type Props = { locale: string };

export function CartIconLink({ locale }: Props) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/shop/cart")
      .then((r) => r.json())
      .then((data) => setCount(data?.totalItems ?? 0))
      .catch(() => setCount(0));
  }, []);

  const isUa = locale === "ua";
  const label = isUa ? "Кошик" : "Cart";

  return (
    <Link
      href={`/${locale}/shop/cart`}
      className="relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-foreground/25 text-foreground/80 transition hover:border-foreground hover:text-foreground"
      aria-label={count != null && count > 0 ? `${label} (${count})` : label}
    >
      <ShoppingBag className="h-4 w-4" />
      {count != null && count > 0 ? (
        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-foreground px-1 text-[10px] font-medium text-background">
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </Link>
  );
}

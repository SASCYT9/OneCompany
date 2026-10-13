"use client";

import { useEffect, useState } from "react";
import { normalizeShopBrandKey } from "@/lib/shopB2bBrandDiscounts";

export type B2bBrandOption = { brand: string; productCount: number };

let brandOptionsRequest: Promise<B2bBrandOption[]> | null = null;

function loadBrandOptions() {
  brandOptionsRequest ??= fetch("/api/admin/shop/b2b/brands", { cache: "no-store" })
    .then(async (response) => {
      if (!response.ok) throw new Error("brands");
      const data = (await response.json()) as { brands?: B2bBrandOption[] };
      return data.brands ?? [];
    })
    .catch((error) => {
      brandOptionsRequest = null;
      throw error;
    });
  return brandOptionsRequest;
}

/** Storefront brands with product counts — the only names a discount can match. */
export function useB2bBrandOptions() {
  const [brands, setBrands] = useState<B2bBrandOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    loadBrandOptions()
      .then((rows) => {
        if (active) setBrands(rows);
      })
      .catch(() => {
        if (active) setError("Не вдалося завантажити список брендів");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return { brands, loading, error };
}

export function findB2bBrandOption(brands: readonly B2bBrandOption[], brand: string) {
  const key = normalizeShopBrandKey(brand);
  return brands.find((option) => normalizeShopBrandKey(option.brand) === key) ?? null;
}

export function B2bBrandSelect({
  value,
  onChange,
  brands,
  loading,
  exclude = [],
  disabled,
  className,
}: {
  value: string;
  onChange: (brand: string) => void;
  brands: readonly B2bBrandOption[];
  loading?: boolean;
  /** Brands that already have a rule, listed last and marked. */
  exclude?: readonly string[];
  disabled?: boolean;
  className?: string;
}) {
  const taken = new Set(exclude.map(normalizeShopBrandKey));
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled || loading}
      className={
        className ??
        "h-9 w-full rounded-none border border-white/10 bg-black/40 px-2 text-sm text-white disabled:opacity-50"
      }
    >
      <option value="">{loading ? "Завантаження брендів…" : "Оберіть бренд"}</option>
      {brands.map((option) => {
        const hasRule = taken.has(normalizeShopBrandKey(option.brand));
        return (
          <option key={option.brand} value={option.brand}>
            {option.brand} · {option.productCount} тов.{hasRule ? " · вже є знижка" : ""}
          </option>
        );
      })}
    </select>
  );
}

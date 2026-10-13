"use client";

import { useCallback, useEffect, useState } from "react";

export type B2bTariffGroup = {
  id: string;
  name: string;
  description: string | null;
  partnerCount: number;
  brandDiscounts: Array<{
    brand: string;
    discountPct: number;
    notes: string | null;
    updatedAt: string;
  }>;
  updatedAt: string;
};

/** Tariff groups with their brand discounts and partner counts. */
export function useB2bTariffGroups() {
  const [groups, setGroups] = useState<B2bTariffGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/shop/b2b/tariff-groups", { cache: "no-store" });
      const data = (await response.json().catch(() => ({}))) as {
        groups?: B2bTariffGroup[];
        error?: string;
      };
      if (!response.ok) throw new Error(data.error || "Не вдалося завантажити тарифні групи");
      setGroups(data.groups ?? []);
      setError("");
      return data.groups ?? [];
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не вдалося завантажити тарифні групи");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { groups, loading, error, reload };
}

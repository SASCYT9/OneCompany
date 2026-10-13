"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, X } from "lucide-react";

import { useToast } from "@/components/admin/AdminToast";
import { findB2bBrandOption, useB2bBrandOptions } from "@/components/admin/b2b/B2bBrandSelect";
import { AddRow, CrmPicker, formatPct, PctCell } from "@/components/admin/b2b/B2bPricingUi";
import { crmIconButton, crmInput, crmPrimaryButton } from "@/components/admin/crm/CrmUi";
import { normalizeShopBrandKey } from "@/lib/shopB2bBrandDiscounts";
import { cn } from "@/lib/utils";

type Discount = {
  id: string;
  brand: string;
  discountPct: number;
  notes: string | null;
  updatedAt: string;
};

type Rule = { brand: string; discountPct: number };

const NO_GROUP_DISCOUNTS: ReadonlyArray<Rule> = [];

type Props = {
  customerId: string;
  globalDiscountPct: number | null;
  /** The partner's tariff group, shown next to the exceptions that override it. */
  groupName?: string | null;
  groupDiscounts?: ReadonlyArray<Rule>;
};

/** The partner's own brand discounts — they beat the tariff group and the rule for everyone. */
export function CustomerBrandDiscountsPanel({
  customerId,
  globalDiscountPct,
  groupName,
  groupDiscounts = NO_GROUP_DISCOUNTS,
}: Props) {
  const toast = useToast();
  const { brands, loading: brandsLoading } = useB2bBrandOptions();
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [systemDiscounts, setSystemDiscounts] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [newBrand, setNewBrand] = useState<string | null>(null);
  const [newPct, setNewPct] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      const [own, system] = await Promise.all([
        fetch(`/api/admin/shop/customers/${customerId}/brand-discounts`, { cache: "no-store" }),
        fetch("/api/admin/shop/b2b/brand-discounts", { cache: "no-store" }),
      ]);
      const ownData = (await own.json().catch(() => ({}))) as {
        discounts?: Discount[];
        error?: string;
      };
      if (!own.ok) {
        setError(ownData.error || "Не вдалося завантажити знижки");
        return;
      }
      setDiscounts(ownData.discounts ?? []);
      if (system.ok) {
        const systemData = (await system.json().catch(() => ({}))) as { discounts?: Rule[] };
        setSystemDiscounts(systemData.discounts ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    void load();
  }, [load]);

  const groupByKey = useMemo(
    () => new Map(groupDiscounts.map((row) => [normalizeShopBrandKey(row.brand), row.discountPct])),
    [groupDiscounts]
  );
  const systemByKey = useMemo(
    () =>
      new Map(systemDiscounts.map((row) => [normalizeShopBrandKey(row.brand), row.discountPct])),
    [systemDiscounts]
  );
  const taken = new Set(discounts.map((row) => normalizeShopBrandKey(row.brand)));
  /** What the partner would get on this brand without the exception. */
  const baseFor = (brand: string) => {
    const key = normalizeShopBrandKey(brand);
    return groupByKey.get(key) ?? systemByKey.get(key) ?? null;
  };

  async function save(brand: string, pct: number | null, notes: string | null) {
    try {
      const response =
        pct == null
          ? await fetch(
              `/api/admin/shop/customers/${customerId}/brand-discounts?brand=${encodeURIComponent(brand)}`,
              { method: "DELETE" }
            )
          : await fetch(`/api/admin/shop/customers/${customerId}/brand-discounts`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ brand, discountPct: pct, notes }),
            });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Не вдалося зберегти");
      toast.success(
        pct == null ? `Виняток на ${brand} прибрано` : `Виняток: ${brand} −${formatPct(pct)}`
      );
      await load();
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не вдалося зберегти");
      return false;
    }
  }

  async function addException(event?: React.FormEvent) {
    event?.preventDefault();
    if (!newBrand) return;
    const value = Number(newPct.trim().replace(",", "."));
    if (newPct.trim() === "" || !Number.isFinite(value) || value < 0 || value > 100) {
      toast.error("Знижка має бути від 0 до 100%");
      return;
    }
    setSaving(true);
    const ok = await save(newBrand, value, newNotes.trim() || null);
    setSaving(false);
    if (ok) {
      setNewBrand(null);
      setNewPct("");
      setNewNotes("");
    }
  }

  const baseLabel = groupName ? `Група «${groupName}»` : "Для всіх";

  return (
    <section className="border border-[#24262B] bg-[#0E0F11]">
      <header className="px-4 pb-2 pt-3.5">
        <h3 className="text-[13px] font-semibold text-zinc-100">
          Винятки для цього партнера{" "}
          {discounts.length ? (
            <span className="crm-mono text-[12px] font-normal text-zinc-500">
              {discounts.length}
            </span>
          ) : null}
        </h3>
        <p className="mt-1 text-zinc-500">
          Своя знижка на бренд — важливіша за тарифну групу і за{" "}
          <Link
            href="/admin/shop/customers/b2b-pricing?tab=matrix"
            className="text-[#9CC0FF] hover:text-white"
          >
            знижки брендів для всіх
          </Link>
          {globalDiscountPct != null
            ? `. Бренди без жодної знижки отримують «інші бренди» −${formatPct(globalDiscountPct)}.`
            : "."}
        </p>
      </header>

      {error ? (
        <p className="mx-4 mb-3 border-l-2 border-[#F19B9B] bg-[#1F0E0E] px-3 py-2 text-[#F19B9B]">
          {error}
        </p>
      ) : null}

      <div className="border-t border-[#1F2125]">
        {loading ? (
          <p className="px-4 py-5 text-zinc-500">Завантаження…</p>
        ) : (
          <table className="w-full table-fixed border-collapse text-left">
            {discounts.length ? (
              <thead>
                <tr className="h-8 border-b border-[#1F2125] text-[12px] text-zinc-500">
                  <th className="px-4 font-normal">Бренд</th>
                  <th className="w-[130px] px-3 text-right font-normal">{baseLabel}</th>
                  <th className="w-[130px] px-1 text-right font-normal">Виняток</th>
                  <th className="w-10" />
                </tr>
              </thead>
            ) : null}
            <tbody>
              {discounts.map((discount) => {
                const base = baseFor(discount.brand);
                const unknownBrand = !brandsLoading && !findB2bBrandOption(brands, discount.brand);
                return (
                  <tr
                    key={discount.id}
                    className="group h-10 border-b border-[#17181B] last:border-b-0 hover:bg-[#111113]"
                  >
                    <td className="truncate px-4">
                      <span className="text-zinc-100">{discount.brand}</span>
                      {unknownBrand ? (
                        <span className="ml-2 inline-flex items-center gap-1 text-[12px] text-[#F5C46B]">
                          <AlertTriangle className="h-3 w-3" /> немає товарів — не діє
                        </span>
                      ) : discount.notes ? (
                        <span className="ml-2 text-[12px] text-zinc-500" title={discount.notes}>
                          {discount.notes}
                        </span>
                      ) : null}
                    </td>
                    <td className="crm-mono px-3 text-right text-[12px] text-zinc-500">
                      {base != null ? (base === 0 ? "0%" : `−${formatPct(base)}`) : "—"}
                    </td>
                    <td className="px-1">
                      <PctCell
                        value={discount.discountPct}
                        label={`Виняток на ${discount.brand}`}
                        onSave={(next) => save(discount.brand, next, discount.notes)}
                      />
                    </td>
                    <td className="text-center">
                      <button
                        type="button"
                        aria-label={`Прибрати виняток на ${discount.brand}`}
                        title="Прибрати виняток"
                        onClick={() => void save(discount.brand, null, null)}
                        className="p-1 text-zinc-600 opacity-0 transition hover:text-[#F19B9B] group-hover:opacity-100 focus:opacity-100"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!discounts.length && !newBrand ? (
                <tr>
                  <td className="px-4 py-4 text-zinc-500">
                    Винятків немає —{" "}
                    {groupName
                      ? `діють знижки групи «${groupName}» і брендів для всіх.`
                      : "діють знижки брендів для всіх партнерів."}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        )}

        {newBrand ? (
          <form
            onSubmit={addException}
            className="flex flex-wrap items-center gap-2 border-t border-[#1F2125] px-4 py-2.5"
          >
            <span className="min-w-[120px] flex-1 truncate text-zinc-100">
              {newBrand}
              {baseFor(newBrand) != null ? (
                <span className="ml-2 text-[12px] text-zinc-500">
                  зараз −{formatPct(baseFor(newBrand)!)}
                </span>
              ) : null}
            </span>
            <div className="relative w-24">
              <input
                autoFocus
                inputMode="decimal"
                value={newPct}
                onChange={(event) => setNewPct(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") setNewBrand(null);
                }}
                placeholder="15"
                aria-label={`Виняток на ${newBrand}, %`}
                className={cn(crmInput, "crm-mono pr-6 text-right")}
              />
              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[12px] text-zinc-500">
                %
              </span>
            </div>
            <input
              value={newNotes}
              onChange={(event) => setNewNotes(event.target.value)}
              placeholder="Нотатка (необов’язково)"
              aria-label="Нотатка до винятку"
              className={cn(crmInput, "w-auto min-w-[160px] flex-1")}
            />
            <button type="submit" disabled={saving || !newPct.trim()} className={crmPrimaryButton}>
              Додати
            </button>
            <button
              type="button"
              onClick={() => setNewBrand(null)}
              aria-label="Скасувати"
              className={crmIconButton}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </form>
        ) : (
          <AddRow label="Додати виняток на бренд" open={adding} onOpen={() => setAdding(true)}>
            <CrmPicker
              autoFocus
              label="Бренд для винятку"
              placeholder="Почніть вводити бренд…"
              loading={brandsLoading}
              options={brands.map((option) => {
                const has = taken.has(normalizeShopBrandKey(option.brand));
                const base = baseFor(option.brand);
                return {
                  value: option.brand,
                  label: option.brand,
                  disabled: has,
                  meta: has
                    ? "вже є виняток"
                    : `${option.productCount} тов.${base != null ? ` · зараз −${formatPct(base)}` : ""}`,
                };
              })}
              onSelect={(value) => {
                setNewBrand(value);
                setNewPct("");
                setNewNotes("");
                setAdding(false);
              }}
            />
          </AddRow>
        )}
      </div>
    </section>
  );
}

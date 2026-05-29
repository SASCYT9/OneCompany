"use client";

/**
 * System-wide per-brand B2B discount editor.
 *
 * Each row stores ONE discount percentage that applies to ALL
 * B2B-approved customers for products of that brand. Per-customer-per-brand
 * overrides (set on the customer profile) take priority — see
 * src/lib/shopBrandB2bDiscounts.ts for the resolution order.
 *
 * Example: Akrapovic = 15%, Ilmberger Carbon = 10%, default = whatever
 * the customer's global b2bDiscountPercent is.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";

import {
  AdminButton,
  AdminCardSection,
  AdminInlineAlert,
  AdminPage,
  AdminPageHeader,
  AdminTableShell,
  AdminResponsiveTable,
} from "@/components/admin/AdminPrimitives";
import { AdminMobileCard } from "@/components/admin/AdminMobileCard";

type DiscountRow = {
  id?: string;
  brand: string;
  discountPct: number;
  notes: string | null;
  updatedAt?: string;
  dirty?: boolean;
  draft?: boolean; // new row not saved yet
};

type BrandOption = { name: string; count: number };

export default function BrandMarkupsAdminPage() {
  const [rows, setRows] = useState<DiscountRow[]>([]);
  const [brandOptions, setBrandOptions] = useState<BrandOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>("");
  const [notice, setNotice] = useState<string>("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [discountsRes, brandsRes] = await Promise.all([
        fetch("/api/admin/shop/brand-markups").then((r) => r.json()),
        fetch("/api/shop/stock/brands?source=all").then((r) => r.json()),
      ]);
      if (discountsRes.error) throw new Error(discountsRes.error);
      const fetched: DiscountRow[] = (discountsRes.discounts || []).map((d: any) => ({
        id: d.id,
        brand: d.brand,
        discountPct: Number(d.discountPct ?? 0),
        notes: d.notes ?? "",
        updatedAt: d.updatedAt,
      }));
      setRows(fetched);
      setBrandOptions(brandsRes.data || []);
    } catch (e: any) {
      setError(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const existingBrandKeys = useMemo(() => new Set(rows.map((r) => r.brand.toLowerCase())), [rows]);

  function addDraftRow(brand = "") {
    setRows((current) => [
      { brand, discountPct: 10, notes: "", draft: true, dirty: true },
      ...current,
    ]);
  }

  function updateRow(index: number, patch: Partial<DiscountRow>) {
    setRows((current) =>
      current.map((r, i) => (i === index ? { ...r, ...patch, dirty: true } : r))
    );
  }

  async function saveRow(index: number) {
    const r = rows[index];
    if (!r.brand.trim()) {
      setError("Brand cannot be empty");
      return;
    }
    if (!Number.isFinite(r.discountPct) || r.discountPct < 0 || r.discountPct > 100) {
      setError("Discount must be between 0 and 100");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/shop/brand-markups", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand: r.brand.trim(),
          discountPct: r.discountPct,
          notes: r.notes || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setNotice(`Saved ${r.brand} → −${r.discountPct}%`);
      setTimeout(() => setNotice(""), 2500);
      await refresh();
    } catch (e: any) {
      setError(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function deleteRow(index: number) {
    const r = rows[index];
    if (r.draft) {
      setRows((current) => current.filter((_, i) => i !== index));
      return;
    }
    if (!confirm(`Remove markup for "${r.brand}"?`)) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(
        `/api/admin/shop/brand-markups?brand=${encodeURIComponent(r.brand)}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed");
      setNotice(`Removed ${r.brand}`);
      setTimeout(() => setNotice(""), 2500);
      await refresh();
    } catch (e: any) {
      setError(e?.message || "Delete failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminPage>
      <AdminPageHeader
        title="B2B націнки по брендах"
        description="Системна знижка для B2B клієнтів. Per-customer override беруть пріоритет. Default fallback — ShopCustomer.b2bDiscountPercent."
        actions={
          <div className="flex gap-2">
            <AdminButton onClick={() => addDraftRow("")} variant="secondary">
              <Plus className="w-4 h-4" />
              Додати бренд
            </AdminButton>
            <AdminButton onClick={refresh} variant="ghost" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Оновити"}
            </AdminButton>
          </div>
        }
      />

      {error && <AdminInlineAlert tone="error">{error}</AdminInlineAlert>}
      {notice && <AdminInlineAlert tone="success">{notice}</AdminInlineAlert>}

      <AdminCardSection
        title="Існуючі правила"
        description="Знижка вираховується від retail-ціни. Для брендів без правила застосовується глобальна знижка клієнта."
      >
        <AdminResponsiveTable
          mobile={
            <div className="space-y-3">
              {rows.length === 0 && !loading && (
                <div className="text-center py-12 text-foreground/55 dark:text-foreground/40 border border-dashed border-white/10 p-4">
                  Жодного правила. Натисніть «Додати бренд».
                </div>
              )}
              {rows.map((r, i) => {
                const brandList = brandOptions.filter(
                  (o) =>
                    !existingBrandKeys.has(o.name.toLowerCase()) ||
                    o.name.toLowerCase() === r.brand.toLowerCase()
                );
                return (
                  <AdminMobileCard
                    key={`mob-${r.id ?? "draft"}-${i}`}
                    title={
                      r.draft ? (
                        <input
                          list={`brand-list-mob-${i}`}
                          value={r.brand}
                          onChange={(e) => updateRow(i, { brand: e.target.value })}
                          placeholder="Akrapovic, Ilmberger Carbon, …"
                          className="w-full rounded-md border border-border bg-card px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-primary/60"
                          autoFocus
                        />
                      ) : (
                        <span className="font-semibold text-zinc-50">{r.brand}</span>
                      )
                    }
                    rows={[
                      {
                        label: "Знижка %",
                        value: (
                          <div className="flex items-center justify-end gap-1">
                            <span className="text-zinc-500">−</span>
                            <input
                              type="number"
                              step={1}
                              min={0}
                              max={100}
                              value={r.discountPct}
                              onChange={(e) =>
                                updateRow(i, { discountPct: Number(e.target.value) || 0 })
                              }
                              className="w-14 rounded-md border border-border bg-card px-2 py-1 text-xs text-right tabular-nums focus:outline-none focus:border-primary/60 text-white"
                            />
                            <span className="text-zinc-500">%</span>
                          </div>
                        ),
                      },
                      {
                        label: "Нотатки",
                        value: (
                          <input
                            type="text"
                            value={r.notes ?? ""}
                            onChange={(e) => updateRow(i, { notes: e.target.value })}
                            placeholder="Опційно"
                            className="w-full max-w-[160px] rounded-md border border-border bg-card px-2 py-1 text-xs focus:outline-none focus:border-primary/60 text-white"
                          />
                        ),
                      },
                      {
                        label: "Оновлено",
                        value: r.updatedAt
                          ? new Date(r.updatedAt).toLocaleString("uk-UA", {
                              year: "numeric",
                              month: "2-digit",
                              day: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "—",
                      },
                    ]}
                    footer={
                      <div className="flex gap-2">
                        <AdminButton
                          variant="primary"
                          size="sm"
                          className="flex-1 justify-center py-2"
                          disabled={!r.dirty || saving}
                          onClick={() => saveRow(i)}
                        >
                          <Save className="w-3.5 h-3.5 mr-1.5" />
                          Зберегти
                        </AdminButton>
                        <AdminButton
                          variant="ghost"
                          size="sm"
                          className="flex-1 justify-center py-2 border border-white/10 text-red-400 hover:text-red-300"
                          disabled={saving}
                          onClick={() => deleteRow(i)}
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                          Видалити
                        </AdminButton>
                      </div>
                    }
                  />
                );
              })}
            </div>
          }
          desktop={
            <AdminTableShell>
              <table className="w-full text-sm">
                <thead className="text-left text-[10px] uppercase tracking-[0.18em] text-foreground/55 dark:text-foreground/40 border-b border-border">
                  <tr>
                    <th className="py-3 px-4">Бренд</th>
                    <th className="py-3 px-4 w-32">Знижка %</th>
                    <th className="py-3 px-4">Нотатки</th>
                    <th className="py-3 px-4 w-40">Оновлено</th>
                    <th className="py-3 px-4 w-32 text-right">Дії</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 && !loading && (
                    <tr>
                      <td
                        colSpan={5}
                        className="text-center py-12 text-foreground/55 dark:text-foreground/40"
                      >
                        Жодного правила. Натисніть «Додати бренд».
                      </td>
                    </tr>
                  )}
                  {rows.map((r, i) => {
                    const brandList = brandOptions.filter(
                      (o) =>
                        !existingBrandKeys.has(o.name.toLowerCase()) ||
                        o.name.toLowerCase() === r.brand.toLowerCase()
                    );
                    return (
                      <tr
                        key={`${r.id ?? "draft"}-${i}`}
                        className="border-b border-border/50 hover:bg-surface-elevated/50"
                      >
                        <td className="py-3 px-4">
                          {r.draft ? (
                            <input
                              list={`brand-list-${i}`}
                              value={r.brand}
                              onChange={(e) => updateRow(i, { brand: e.target.value })}
                              placeholder="Akrapovic, Ilmberger Carbon, …"
                              className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:border-primary/60"
                              autoFocus
                            />
                          ) : (
                            <span className="font-medium">{r.brand}</span>
                          )}
                          <datalist id={`brand-list-${i}`}>
                            {brandList.map((b) => (
                              <option key={b.name} value={b.name}>
                                {b.count} items
                              </option>
                            ))}
                          </datalist>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1">
                            <span className="text-foreground/55 dark:text-foreground/40">−</span>
                            <input
                              type="number"
                              step={1}
                              min={0}
                              max={100}
                              value={r.discountPct}
                              onChange={(e) =>
                                updateRow(i, { discountPct: Number(e.target.value) || 0 })
                              }
                              className="w-16 rounded-md border border-border bg-card px-2 py-2 text-sm tabular-nums focus:outline-none focus:border-primary/60"
                            />
                            <span className="text-foreground/55 dark:text-foreground/40">%</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <input
                            type="text"
                            value={r.notes ?? ""}
                            onChange={(e) => updateRow(i, { notes: e.target.value })}
                            placeholder="Опційно"
                            className="w-full rounded-md border border-border bg-card px-3 py-2 text-xs focus:outline-none focus:border-primary/60"
                          />
                        </td>
                        <td className="py-3 px-4 text-xs text-foreground/55 dark:text-foreground/40">
                          {r.updatedAt
                            ? new Date(r.updatedAt).toLocaleString("uk-UA", {
                                year: "numeric",
                                month: "2-digit",
                                day: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "—"}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex gap-1">
                            <AdminButton
                              variant="primary"
                              size="sm"
                              disabled={!r.dirty || saving}
                              onClick={() => saveRow(i)}
                            >
                              <Save className="w-3.5 h-3.5" />
                            </AdminButton>
                            <AdminButton
                              variant="ghost"
                              size="sm"
                              disabled={saving}
                              onClick={() => deleteRow(i)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </AdminButton>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </AdminTableShell>
          }
        />
      </AdminCardSection>

      <AdminCardSection title="Пріоритет розрахунку знижки">
        <ol className="text-sm text-foreground/85 dark:text-foreground/70 space-y-2 pl-4 list-decimal">
          <li>
            <strong>ShopCustomerBrandDiscount</strong> — окремий per-customer per-brand override
            (керується на профілі клієнта).
          </li>
          <li>
            <strong>ShopBrandB2bDiscount</strong> ← <em>цей екран</em> — системна знижка для бренду.
          </li>
          <li>
            <strong>ShopCustomer.b2bDiscountPercent</strong> — глобальна знижка клієнта (fallback).
          </li>
          <li>
            <strong>0%</strong> — нічого, retail-ціна (для не-B2B клієнтів).
          </li>
        </ol>
      </AdminCardSection>
    </AdminPage>
  );
}

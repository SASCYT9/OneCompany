"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Pencil, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/components/admin/AdminToast";
import { AdminTableShell } from "@/components/admin/AdminPrimitives";
import {
  B2bBrandSelect,
  findB2bBrandOption,
  useB2bBrandOptions,
} from "@/components/admin/b2b/B2bBrandSelect";

type Discount = {
  id: string;
  brand: string;
  discountPct: number;
  notes: string | null;
  updatedAt: string;
};

type Props = {
  customerId: string;
  globalDiscountPct: number | null;
  /** Rendered inside the customer's «Ціни» section: no own frame or heading. */
  embedded?: boolean;
};

export function CustomerBrandDiscountsPanel({ customerId, globalDiscountPct, embedded }: Props) {
  const toast = useToast();
  const { brands, loading: brandsLoading } = useB2bBrandOptions();
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [newBrand, setNewBrand] = useState("");
  const [newPct, setNewPct] = useState("");
  const [newNotes, setNewNotes] = useState("");
  /** Brand whose rule is loaded into the form for editing. */
  const [editing, setEditing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/shop/customers/${customerId}/brand-discounts`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError((data as { error?: string }).error || "Не вдалося завантажити знижки");
        return;
      }
      setDiscounts((data as { discounts: Discount[] }).discounts ?? []);
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    void load();
  }, [load]);

  function resetForm() {
    setNewBrand("");
    setNewPct("");
    setNewNotes("");
    setEditing(null);
  }

  function startEdit(discount: Discount) {
    setNewBrand(findB2bBrandOption(brands, discount.brand)?.brand ?? discount.brand);
    setNewPct(String(discount.discountPct));
    setNewNotes(discount.notes ?? "");
    setEditing(discount.brand);
    setError("");
  }

  async function save() {
    if (!newBrand.trim()) {
      setError("Оберіть бренд");
      return;
    }
    const pct = Number(newPct.trim().replace(",", "."));
    if (newPct.trim() === "" || !Number.isFinite(pct) || pct < 0 || pct > 100) {
      setError("Знижка має бути від 0 до 100%");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/shop/customers/${customerId}/brand-discounts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand: newBrand.trim(),
          discountPct: pct,
          notes: newNotes.trim() || null,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const msg = (data as { error?: string }).error || "Не вдалося зберегти";
        setError(msg);
        toast.error(msg);
        return;
      }
      toast.success(`Знижку на ${newBrand} збережено`);
      resetForm();
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function remove(brand: string) {
    if (!window.confirm(`Прибрати знижку на ${brand}?`)) return;
    setSaving(true);
    try {
      const response = await fetch(
        `/api/admin/shop/customers/${customerId}/brand-discounts?brand=${encodeURIComponent(brand)}`,
        { method: "DELETE" }
      );
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        toast.error((data as { error?: string }).error || "Не вдалося видалити");
        return;
      }
      toast.success(`Знижку на ${brand} прибрано`);
      if (editing === brand) resetForm();
      await load();
    } finally {
      setSaving(false);
    }
  }

  const existingBrands = discounts.map((d) => d.brand);

  return (
    <section className={embedded ? "" : "border border-white/10 bg-[#171717] p-6"}>
      <div className="mb-4">
        <h3
          className={
            embedded
              ? "text-[13px] font-semibold text-zinc-100"
              : "text-xl font-semibold text-zinc-100"
          }
        >
          Знижки на окремі бренди
        </h3>
        <p className="mt-1 text-[13px] leading-5 text-zinc-500">
          На товари цих брендів партнер отримує вказану знижку — вона важливіша за всі інші. Для
          решти брендів діє{" "}
          <Link
            href="/admin/shop/customers/b2b-pricing"
            className="text-blue-300 hover:text-blue-200"
          >
            знижка бренду для всіх партнерів
          </Link>
          {globalDiscountPct != null
            ? `, а якщо її немає — знижка на інші бренди (${globalDiscountPct}%)`
            : ""}
          .
        </p>
      </div>

      {/* Add / edit form */}
      <div className="mb-5 border border-white/10 bg-black/25 p-4">
        <div className="grid gap-3 sm:grid-cols-[1.5fr_0.8fr_2fr_auto]">
          <label className="block">
            <span className="mb-1 block text-[10px] uppercase tracking-[0.18em] text-zinc-500">
              Бренд
            </span>
            <B2bBrandSelect
              value={newBrand}
              onChange={setNewBrand}
              brands={brands}
              loading={brandsLoading}
              exclude={editing ? existingBrands.filter((b) => b !== editing) : existingBrands}
              disabled={Boolean(editing)}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] uppercase tracking-[0.18em] text-zinc-500">
              Знижка %
            </span>
            <input
              type="number"
              inputMode="decimal"
              step="0.5"
              min="0"
              max="100"
              value={newPct}
              onChange={(e) => setNewPct(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void save();
              }}
              placeholder="15"
              className="h-9 w-full rounded-none border border-white/10 bg-black/40 px-3 text-sm text-white"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] uppercase tracking-[0.18em] text-zinc-500">
              Нотатка
            </span>
            <input
              value={newNotes}
              onChange={(e) => setNewNotes(e.target.value)}
              placeholder="особливі умови (необов’язково)"
              className="h-9 w-full rounded-none border border-white/10 bg-black/40 px-3 text-sm text-white"
            />
          </label>
          <div className="flex items-end gap-2">
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving || !newBrand.trim() || !newPct}
              className="inline-flex h-9 items-center gap-2 rounded-none bg-blue-600 px-4 text-sm font-medium text-white transition hover:bg-blue-500 disabled:opacity-50"
            >
              {editing ? null : <Plus className="h-4 w-4" />}
              {editing ? "Зберегти" : "Додати"}
            </button>
            {editing ? (
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex h-9 items-center px-3 text-sm text-zinc-400 hover:text-white"
              >
                Скасувати
              </button>
            ) : null}
          </div>
        </div>
        {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
      </div>

      {/* Existing list */}
      {loading ? (
        <div className="border border-white/10 bg-black/25 px-4 py-8 text-sm text-zinc-500">
          Завантаження…
        </div>
      ) : discounts.length === 0 ? (
        <div className="border border-dashed border-white/10 px-4 py-6 text-sm text-zinc-500">
          Своїх знижок на бренди ще немає — діють знижки брендів для всіх партнерів.
        </div>
      ) : (
        <AdminTableShell>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/3 text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                  <th className="px-4 py-3 font-medium">Бренд</th>
                  <th className="px-4 py-3 text-right font-medium">Знижка</th>
                  <th className="px-4 py-3 font-medium">Нотатка</th>
                  <th className="px-4 py-3 font-medium">Оновлено</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/6">
                {discounts.map((d) => {
                  const unknownBrand = !brandsLoading && !findB2bBrandOption(brands, d.brand);
                  return (
                    <tr key={d.id} className="transition hover:bg-white/2">
                      <td className="px-4 py-3 font-medium text-zinc-100">
                        {d.brand}
                        {unknownBrand ? (
                          <span className="mt-0.5 flex items-center gap-1 text-xs font-normal text-amber-300">
                            <AlertTriangle className="h-3 w-3" /> Немає товарів цього бренду —
                            знижка не діє
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums text-emerald-300">
                        −{d.discountPct.toFixed(2)}%
                      </td>
                      <td className="px-4 py-3 text-zinc-400">{d.notes || "—"}</td>
                      <td className="px-4 py-3 text-xs text-zinc-500">
                        {new Date(d.updatedAt).toLocaleString("uk-UA")}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => startEdit(d)}
                            disabled={saving}
                            className="inline-flex items-center gap-1 text-xs text-zinc-300 transition hover:text-white disabled:opacity-50"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Змінити
                          </button>
                          <button
                            type="button"
                            onClick={() => void remove(d.brand)}
                            disabled={saving}
                            className="inline-flex items-center gap-1 text-xs text-red-300/80 transition hover:text-red-200 disabled:opacity-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Прибрати
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </AdminTableShell>
      )}
    </section>
  );
}

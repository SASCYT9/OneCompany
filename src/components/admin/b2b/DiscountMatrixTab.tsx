"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Search, X } from "lucide-react";

import { useToast } from "@/components/admin/AdminToast";
import type { B2bBrandOption } from "@/components/admin/b2b/B2bBrandSelect";
import {
  AddRow,
  CrmPicker,
  formatPct,
  groupAccent,
  GroupMark,
  PctCell,
  sendB2bJson,
} from "@/components/admin/b2b/B2bPricingUi";
import { partnerLabel, type TariffGroupPartner } from "@/components/admin/b2b/TariffGroupsTab";
import type { B2bTariffGroup } from "@/components/admin/b2b/useB2bTariffGroups";
import { normalizeShopBrandKey } from "@/lib/shopB2bBrandDiscounts";
import { cn } from "@/lib/utils";

type Rule = { brand: string; discountPct: number };

type Row = {
  key: string;
  brand: string;
  productCount: number | null;
  system: Rule | null;
  groups: Map<string, Rule>;
  exceptions: TariffGroupPartner[];
};

/**
 * Brands × tiers in one grid: the rule for every partner and each tariff
 * group side by side, every cell editable in place.
 */
export function DiscountMatrixTab({
  brands,
  brandsLoading,
  groups,
  systemDiscounts,
  partners,
  onChanged,
  onOpenGroup,
}: {
  brands: B2bBrandOption[];
  brandsLoading: boolean;
  groups: B2bTariffGroup[];
  systemDiscounts: ReadonlyArray<Rule>;
  partners: TariffGroupPartner[];
  onChanged: () => Promise<void>;
  onOpenGroup: (groupId: string) => void;
}) {
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [extraKeys, setExtraKeys] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);

  const rows = useMemo(() => {
    const byKey = new Map<string, Row>();
    const ensure = (brand: string, productCount: number | null) => {
      const key = normalizeShopBrandKey(brand);
      let row = byKey.get(key);
      if (!row) {
        row = { key, brand, productCount, system: null, groups: new Map(), exceptions: [] };
        byKey.set(key, row);
      }
      return row;
    };
    for (const option of brands) ensure(option.brand, option.productCount);
    for (const rule of systemDiscounts) ensure(rule.brand, null).system = rule;
    for (const group of groups) {
      for (const rule of group.brandDiscounts) ensure(rule.brand, null).groups.set(group.id, rule);
    }
    for (const partner of partners) {
      for (const rule of partner.brandDiscounts) ensure(rule.brand, null).exceptions.push(partner);
    }
    return [...byKey.values()];
  }, [brands, groups, partners, systemDiscounts]);

  const hasRule = (row: Row) => Boolean(row.system || row.groups.size || row.exceptions.length);
  const needle = query.trim().toLowerCase();
  const visible = rows
    .filter((row) =>
      needle
        ? row.brand.toLowerCase().includes(needle)
        : showAll || hasRule(row) || extraKeys.includes(row.key)
    )
    .sort(
      (left, right) =>
        Number(hasRule(right)) - Number(hasRule(left)) ||
        (right.productCount ?? 0) - (left.productCount ?? 0) ||
        left.brand.localeCompare(right.brand, "en")
    );
  const ruleCount = rows.filter(hasRule).length;

  async function save(row: Row, groupId: string | null, pct: number | null) {
    const existing = groupId ? row.groups.get(groupId) : row.system;
    const brand = existing?.brand ?? row.brand;
    const base = groupId
      ? `/api/admin/shop/b2b/tariff-groups/${groupId}/brand-discounts`
      : "/api/admin/shop/b2b/brand-discounts";
    try {
      if (pct == null) {
        await sendB2bJson(`${base}?brand=${encodeURIComponent(brand)}`, "DELETE");
      } else {
        await sendB2bJson(base, "PUT", { brand, discountPct: pct });
      }
      await onChanged();
      const where = groupId
        ? `«${groups.find((group) => group.id === groupId)?.name ?? "група"}»`
        : "для всіх партнерів";
      toast.success(
        pct == null ? `${brand}: знижку ${where} прибрано` : `${brand} −${formatPct(pct)} ${where}`
      );
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не вдалося зберегти");
      return false;
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-3 border-b border-[#1F2125] px-4 py-3 sm:px-5">
        <label className="flex h-8 w-full max-w-[320px] items-center gap-2 border border-[#24262B] bg-[#111113] px-2.5 focus-within:border-[#3B82F6]">
          <Search className="h-3.5 w-3.5 text-zinc-500" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Знайти бренд"
            aria-label="Пошук бренду"
            className="w-full bg-transparent text-[13px] text-zinc-100 placeholder:text-zinc-600 focus:outline-none"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Очистити пошук"
              className="text-zinc-500 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </label>
        <div className="flex border border-[#24262B]" role="group" aria-label="Які бренди показати">
          {[
            { all: false, label: `Зі знижками · ${ruleCount}` },
            { all: true, label: `Усі бренди · ${rows.length}` },
          ].map((option) => (
            <button
              key={String(option.all)}
              type="button"
              aria-pressed={showAll === option.all}
              onClick={() => setShowAll(option.all)}
              className={cn(
                "h-8 px-3 text-[12px] transition",
                showAll === option.all
                  ? "bg-[#1A2236] text-white"
                  : "text-zinc-400 hover:bg-[#141518] hover:text-zinc-100"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
        <span className="text-[12px] text-zinc-600">
          Клітинка порожня — діє знижка зліва (сірим). Enter зберігає, Esc скасовує.
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-left">
          <thead>
            <tr className="border-b border-[#1F2125] text-[12px] text-zinc-500">
              <th className="sticky left-0 z-10 w-[240px] min-w-[200px] bg-[#0A0A0B] px-4 py-2 font-normal sm:px-5">
                Бренд
              </th>
              <th className="w-[150px] min-w-[130px] border-l border-[#1F2125] px-2 py-2 text-right font-normal">
                <span className="block text-zinc-300">Для всіх партнерів</span>
                <span className="block text-[11px] text-zinc-600">базова знижка бренду</span>
              </th>
              {groups.map((group, index) => (
                <th
                  key={group.id}
                  className="w-[150px] min-w-[130px] border-l border-[#1F2125] px-2 py-2 text-right font-normal"
                >
                  <button
                    type="button"
                    onClick={() => onOpenGroup(group.id)}
                    className="ml-auto flex items-center justify-end gap-2 text-zinc-200 hover:text-white"
                    title="Відкрити групу"
                  >
                    <GroupMark
                      name={group.name}
                      accent={groupAccent(group.name, index)}
                      size={20}
                    />
                    <span className="truncate">{group.name}</span>
                  </button>
                  <span className="block text-[11px] text-zinc-600">
                    партнерів: {partners.filter((p) => p.tariffGroup?.id === group.id).length}
                  </span>
                </th>
              ))}
              <th className="min-w-[150px] border-l border-[#1F2125] px-3 py-2 font-normal">
                Винятки партнерів
              </th>
            </tr>
          </thead>
          <tbody>
            {brandsLoading && !rows.length ? (
              <tr>
                <td colSpan={groups.length + 3} className="px-5 py-8 text-zinc-500">
                  Завантажуємо бренди…
                </td>
              </tr>
            ) : visible.length === 0 ? (
              <tr>
                <td colSpan={groups.length + 3} className="px-5 py-8 text-zinc-500">
                  {needle
                    ? "Бренд не знайдено."
                    : "Знижок ще немає. Увімкніть «Усі бренди» або додайте бренд нижче."}
                </td>
              </tr>
            ) : (
              visible.map((row) => (
                <tr key={row.key} className="h-10 border-b border-[#17181B] hover:bg-[#0E0F11]">
                  <td className="sticky left-0 z-10 bg-[#0A0A0B] px-4 sm:px-5">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-zinc-100">{row.brand}</span>
                      {row.productCount != null ? (
                        <span className="crm-mono shrink-0 text-[11px] text-zinc-600">
                          {row.productCount}
                        </span>
                      ) : !brandsLoading ? (
                        <span
                          className="inline-flex shrink-0 items-center gap-1 text-[11px] text-[#F5C46B]"
                          title="Серед опублікованих товарів немає такого бренду — правило не діє"
                        >
                          <AlertTriangle className="h-3 w-3" /> немає товарів
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="border-l border-[#1F2125] px-1">
                    <PctCell
                      value={row.system?.discountPct ?? null}
                      label={`Знижка на ${row.brand} для всіх партнерів`}
                      onSave={(next) => save(row, null, next)}
                    />
                  </td>
                  {groups.map((group) => (
                    <td key={group.id} className="border-l border-[#1F2125] px-1">
                      <PctCell
                        value={row.groups.get(group.id)?.discountPct ?? null}
                        inherited={row.system?.discountPct ?? null}
                        label={`Знижка групи «${group.name}» на ${row.brand}`}
                        onSave={(next) => save(row, group.id, next)}
                      />
                    </td>
                  ))}
                  <td className="border-l border-[#1F2125] px-3 text-[12px] text-zinc-400">
                    {row.exceptions.length ? (
                      <span title={row.exceptions.map(partnerLabel).join("\n")}>
                        {row.exceptions.length === 1
                          ? partnerLabel(row.exceptions[0]!)
                          : `${row.exceptions.length} партнерів`}
                      </span>
                    ) : (
                      <span className="text-zinc-700">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {!showAll && !needle ? (
        <div className="max-w-[520px]">
          <AddRow label="Додати бренд у таблицю" open={adding} onOpen={() => setAdding(true)}>
            <CrmPicker
              autoFocus
              label="Бренд, який додати в таблицю"
              placeholder="Почніть вводити бренд…"
              loading={brandsLoading}
              options={rows
                .filter((row) => !hasRule(row) && !extraKeys.includes(row.key))
                .map((row) => ({
                  value: row.key,
                  label: row.brand,
                  meta: row.productCount != null ? `${row.productCount} тов.` : undefined,
                }))}
              onSelect={(key) => {
                setExtraKeys((current) => [...current, key]);
                setAdding(false);
              }}
            />
          </AddRow>
        </div>
      ) : null}
    </div>
  );
}

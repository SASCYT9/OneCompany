"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookMarked,
  CheckCircle2,
  Globe2,
  Search,
  ShieldAlert,
  Truck,
} from "lucide-react";

import { brandGuideCatalog, operatorFacingReferenceText } from "@/lib/operations/brandGuides";
import { cn } from "@/lib/utils";

import { OpsPageHeader } from "./OpsPageHeader";
import { OpsSurface } from "./OpsSurface";

const regionLabels: Record<string, string> = {
  usa: "США",
  europe: "Европа",
  moto: "Мото",
  oem: "OEM",
  racing: "Автоспорт",
  verified_rules: "Общие правила",
  "pdf-only": "Другое",
};

const PAGE_SIZE = 40;

export function OpsBrandDirectory({ permissions }: { permissions: readonly string[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | "available" | "missing">("all");
  const [region, setRegion] = useState("all");
  const [page, setPage] = useState(1);

  const availableCount = brandGuideCatalog.filter(
    (entry) => entry.retailFormula || entry.wholesaleFormula || entry.ourCost
  ).length;
  const regions = useMemo(
    () => Array.from(new Set(brandGuideCatalog.map((entry) => entry.siteGroup))).sort(),
    []
  );
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("ru-RU");
    return brandGuideCatalog
      .filter((entry) => {
        const hasFormula = Boolean(entry.retailFormula || entry.wholesaleFormula || entry.ourCost);
        return (
          (status === "all" || (status === "available" ? hasFormula : !hasFormula)) &&
          (region === "all" || entry.siteGroup === region) &&
          (!needle ||
            [
              entry.brand,
              entry.aliases.join(" "),
              entry.country,
              entry.retailFormula,
              entry.wholesaleFormula,
              entry.ourCost,
              entry.logisticsRule,
              entry.notes,
              entry.sourceUrl,
            ]
              .join(" ")
              .toLocaleLowerCase("ru-RU")
              .includes(needle))
        );
      })
      .sort((left, right) => left.brand.localeCompare(right.brand, "ru", { sensitivity: "base" }));
  }, [query, region, status]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const visible = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function updateFilters(action: () => void) {
    action();
    setPage(1);
  }

  return (
    <OpsSurface permissions={permissions}>
      <OpsPageHeader
        title="Справочник"
        description="Бренды, формулы, источники и ориентиры доставки"
      />

      <div className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-4 py-4 backdrop-blur sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1500px]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => updateFilters(() => setQuery(event.target.value))}
              placeholder="Бренд, алиас, формула, страна или ссылка…"
              className="h-12 w-full border border-slate-300 bg-white pl-12 pr-4 text-base outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
            />
          </label>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {[
              ["all", "Все"],
              ["available", "Есть правило"],
              ["missing", "Нужна проверка"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() =>
                  updateFilters(() => setStatus(value as "all" | "available" | "missing"))
                }
                className={cn(
                  "h-10 shrink-0 border px-3 text-sm font-semibold",
                  status === value
                    ? "border-slate-950 bg-slate-950 text-white"
                    : "border-slate-200 bg-white text-slate-600"
                )}
              >
                {label}
              </button>
            ))}
            <span className="mx-1 h-10 w-px shrink-0 bg-slate-200" />
            <button
              type="button"
              onClick={() => updateFilters(() => setRegion("all"))}
              className={cn(
                "h-10 shrink-0 border px-3 text-sm font-semibold",
                region === "all"
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "border-slate-200 bg-white text-slate-600"
              )}
            >
              Все группы
            </button>
            {regions.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => updateFilters(() => setRegion(value))}
                className={cn(
                  "h-10 shrink-0 border px-3 text-sm font-semibold",
                  region === value
                    ? "border-blue-600 bg-blue-600 text-white"
                    : "border-slate-200 bg-white text-slate-600"
                )}
              >
                {regionLabels[value] ?? value}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1500px] p-4 pb-28 sm:p-6 lg:p-8">
        <div className="grid grid-cols-2 gap-px border border-slate-200 bg-slate-200 sm:grid-cols-4">
          {[
            { label: "Всего", value: brandGuideCatalog.length, icon: BookMarked },
            { label: "С правилом", value: availableCount, icon: CheckCircle2 },
            {
              label: "Нужна проверка",
              value: brandGuideCatalog.length - availableCount,
              icon: ShieldAlert,
            },
            { label: "Найдено", value: filtered.length, icon: Search },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="bg-white p-4">
                <Icon className="h-4 w-4 text-blue-600" />
                <div className="mt-3 text-2xl font-bold text-slate-950">{item.value}</div>
                <div className="mt-0.5 text-xs text-slate-500">{item.label}</div>
              </div>
            );
          })}
        </div>

        <div className="mt-5 hidden border border-slate-200 bg-white md:block">
          <div className="grid grid-cols-[minmax(200px,1.1fr)_140px_150px_minmax(320px,2fr)_52px] border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">
            <span>Бренд</span>
            <span>Группа</span>
            <span>Статус</span>
            <span>Правило и доставка</span>
            <span />
          </div>
          {visible.map((entry) => {
            const available = Boolean(
              entry.retailFormula || entry.wholesaleFormula || entry.ourCost
            );
            return (
              <Link
                key={entry.guideKey}
                href={`/admin/operations/directory/${entry.guideKey}`}
                className="grid min-h-20 grid-cols-[minmax(200px,1.1fr)_140px_150px_minmax(320px,2fr)_52px] items-center border-b border-slate-100 px-4 py-3 last:border-0 hover:bg-blue-50/50"
              >
                <span>
                  <span className="block font-bold text-slate-950">{entry.brand}</span>
                  <span className="mt-1 block truncate text-xs text-slate-500">
                    {entry.country || "Страна не указана"}
                  </span>
                </span>
                <span className="text-sm text-slate-600">
                  {regionLabels[entry.siteGroup] ?? entry.siteGroup}
                </span>
                <span
                  className={cn(
                    "inline-flex w-fit items-center gap-1.5 text-xs font-semibold",
                    available ? "text-emerald-700" : "text-amber-700"
                  )}
                >
                  <span className={cn("h-2 w-2", available ? "bg-emerald-500" : "bg-amber-500")} />
                  {available ? "Есть правило" : "Проверить"}
                </span>
                <span className="pr-5 text-sm leading-5 text-slate-600">
                  <span className="line-clamp-2">
                    {operatorFacingReferenceText(
                      entry.retailFormula ||
                        entry.wholesaleFormula ||
                        entry.ourCost ||
                        "Формула не подтверждена."
                    )}
                  </span>
                  {entry.logisticsRule ? (
                    <span className="mt-1 flex items-center gap-1 text-xs text-blue-700">
                      <Truck className="h-3.5 w-3.5" />
                      Есть правило доставки
                    </span>
                  ) : null}
                </span>
                <ArrowRight className="h-4 w-4 justify-self-end text-slate-400" />
              </Link>
            );
          })}
        </div>

        <div className="mt-4 space-y-3 md:hidden">
          {visible.map((entry) => {
            const available = Boolean(
              entry.retailFormula || entry.wholesaleFormula || entry.ourCost
            );
            return (
              <Link
                key={entry.guideKey}
                href={`/admin/operations/directory/${entry.guideKey}`}
                className="block border border-slate-200 bg-white p-4 active:bg-blue-50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-bold text-slate-950">{entry.brand}</h2>
                    <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                      <Globe2 className="h-3.5 w-3.5" />
                      {regionLabels[entry.siteGroup] ?? entry.siteGroup}
                      {entry.country ? ` · ${entry.country}` : ""}
                    </div>
                  </div>
                  <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-slate-400" />
                </div>
                <div
                  className={cn(
                    "mt-3 inline-flex items-center gap-1.5 text-xs font-semibold",
                    available ? "text-emerald-700" : "text-amber-700"
                  )}
                >
                  <span className={cn("h-2 w-2", available ? "bg-emerald-500" : "bg-amber-500")} />
                  {available ? "Есть правило" : "Нужна проверка"}
                </div>
                <p className="mt-2 line-clamp-3 text-sm leading-5 text-slate-600">
                  {operatorFacingReferenceText(
                    entry.retailFormula ||
                      entry.wholesaleFormula ||
                      entry.ourCost ||
                      "Формула пока не подтверждена владельцем."
                  )}
                </p>
                {entry.logisticsRule ? (
                  <div className="mt-3 flex items-center gap-1.5 border-t border-slate-100 pt-3 text-xs font-medium text-blue-700">
                    <Truck className="h-4 w-4" />
                    Есть ориентир по доставке
                  </div>
                ) : null}
              </Link>
            );
          })}
        </div>

        {!visible.length ? (
          <div className="mt-5 border border-dashed border-slate-300 bg-white px-5 py-16 text-center">
            <Search className="mx-auto h-8 w-8 text-slate-300" />
            <h2 className="mt-3 font-bold text-slate-900">Ничего не найдено</h2>
            <p className="mt-1 text-sm text-slate-500">
              Измените запрос или сбросьте один из фильтров.
            </p>
          </div>
        ) : null}

        {pageCount > 1 ? (
          <div className="mt-5 flex items-center justify-between border border-slate-200 bg-white p-3">
            <span className="text-xs text-slate-500">
              {safePage} / {pageCount}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={safePage === 1}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
                className="h-10 border border-slate-200 px-4 text-sm font-semibold disabled:opacity-40"
              >
                Назад
              </button>
              <button
                type="button"
                disabled={safePage === pageCount}
                onClick={() => setPage((value) => Math.min(pageCount, value + 1))}
                className="h-10 border border-slate-200 px-4 text-sm font-semibold disabled:opacity-40"
              >
                Дальше
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </OpsSurface>
  );
}

import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  CheckCircle2,
  ExternalLink,
  FileText,
  Pencil,
  ShieldAlert,
  Truck,
} from "lucide-react";

import type { OpsShippingEstimate } from "@/data/operations/shipping-guides";
import {
  operatorFacingReferenceText,
  type BrandGuideCatalogEntry,
} from "@/lib/operations/brandGuides";
import { cn } from "@/lib/utils";

import { OpsSurface } from "./OpsSurface";

function RuleCard({
  title,
  value,
  important = false,
}: {
  title: string;
  value: string;
  important?: boolean;
}) {
  return (
    <section
      className={cn(
        "border p-4 sm:p-5",
        important ? "border-blue-200 bg-blue-50/60" : "border-slate-200 bg-white"
      )}
    >
      <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{title}</h2>
      <p className="mt-2 whitespace-pre-wrap text-sm font-medium leading-6 text-slate-800">
        {operatorFacingReferenceText(value || "Не указано")}
      </p>
    </section>
  );
}

export function OpsBrandDirectoryDetail({
  entry,
  permissions,
  canWrite,
  brandArticleId,
  shippingArticleId,
  shippingEstimates,
}: {
  entry: BrandGuideCatalogEntry;
  permissions: readonly string[];
  canWrite: boolean;
  brandArticleId: string | null;
  shippingArticleId: string | null;
  shippingEstimates: OpsShippingEstimate[];
}) {
  const available = Boolean(entry.retailFormula || entry.wholesaleFormula || entry.ourCost);
  const showUsaTable =
    entry.siteGroup === "usa" ||
    /(?:США|NY|USA|вага в Україну|доставка в Україну)/iu.test(
      [entry.retailFormula, entry.wholesaleFormula, entry.logisticsRule].join(" ")
    );

  return (
    <OpsSurface permissions={permissions}>
      <div className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <Link
            href="/admin/operations/directory"
            className="inline-flex h-10 items-center gap-2 text-sm font-semibold text-slate-600 hover:text-blue-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Справочник
          </Link>
          <div className="mt-3 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">
                Карточка бренда
              </div>
              <h1 className="mt-1 text-3xl font-bold text-slate-950 sm:text-4xl">{entry.brand}</h1>
              <p className="mt-2 text-sm text-slate-500">
                {[entry.country, entry.ruleGroup].filter(Boolean).join(" · ") ||
                  "Регион и группа не указаны"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {canWrite && brandArticleId ? (
                <Link
                  href={`/admin/operations/knowledge/${brandArticleId}/edit`}
                  className="inline-flex min-h-11 items-center gap-2 border border-blue-200 bg-blue-50 px-3 text-sm font-semibold text-blue-700 hover:bg-blue-100"
                >
                  <Pencil className="h-4 w-4" />
                  Редактировать бренд
                </Link>
              ) : null}
              <span
                className={cn(
                  "inline-flex w-fit items-center gap-2 border px-3 py-2 text-sm font-semibold",
                  available
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-amber-200 bg-amber-50 text-amber-800"
                )}
              >
                {available ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <ShieldAlert className="h-4 w-4" />
                )}
                {available ? "Есть рабочее правило" : "Нужна проверка владельцем"}
              </span>
            </div>
          </div>
        </div>
      </div>

      <main className="mx-auto grid max-w-6xl gap-5 p-4 pb-28 sm:p-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:p-8">
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <RuleCard title="Розница" value={entry.retailFormula} important />
            <RuleCard title="Опт / партнёр" value={entry.wholesaleFormula} />
            <RuleCard title="Наша закупка" value={entry.ourCost} />
            <RuleCard title="Логистика бренда" value={entry.logisticsRule} />
          </div>

          {entry.notes ? <RuleCard title="Важные заметки" value={entry.notes} /> : null}

          <section className="border border-slate-200 bg-white">
            <div className="flex items-center gap-2 border-b border-slate-200 p-4 sm:p-5">
              <Truck className="h-5 w-5 text-blue-600" />
              <div>
                <h2 className="font-bold text-slate-950">Ориентиры доставки</h2>
                <p className="text-xs text-slate-500">Не являются финальной стоимостью</p>
              </div>
            </div>
            {showUsaTable ? (
              <>
                <div className="grid grid-cols-2 gap-px bg-slate-200 sm:grid-cols-4">
                  {shippingEstimates.slice(0, 8).map((estimate) => (
                    <div key={estimate.key} className="bg-white p-3">
                      <div className="text-xs leading-4 text-slate-500">{estimate.label}</div>
                      <div className="mt-1 text-lg font-bold text-slate-950">
                        ≈ ${estimate.amountUsd}
                      </div>
                    </div>
                  ))}
                </div>
                <Link
                  href={
                    shippingArticleId
                      ? `/admin/operations/knowledge/${shippingArticleId}${canWrite ? "/edit" : ""}`
                      : "/admin/operations/knowledge?category=delivery"
                  }
                  className="flex h-12 items-center justify-between border-t border-slate-200 px-4 text-sm font-semibold text-blue-700 hover:bg-blue-50"
                >
                  {canWrite && shippingArticleId
                    ? "Редактировать доставку"
                    : "Все маршруты и проверки"}
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </>
            ) : (
              <div className="p-4 text-sm leading-6 text-slate-600 sm:p-5">
                Для этого направления нет безопасного универсального тарифа. Используйте правило
                бренда и уточните склад, вес/объём, локальную доставку и VAT.
              </div>
            )}
          </section>
        </div>

        <aside className="space-y-4">
          <section className="border border-slate-200 bg-white p-4">
            <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
              Перед расчётом
            </h2>
            <ol className="mt-3 space-y-3 text-sm leading-5 text-slate-700">
              {[
                "Проверить текущую цену и наличие.",
                "Проверить VAT/tax и скидку аккаунта.",
                "Уточнить локальную и международную доставку.",
                "Не добавлять shipping повторно, если он уже в total.",
              ].map((item, index) => (
                <li key={item} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center bg-slate-950 text-xs font-bold text-white">
                    {index + 1}
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ol>
          </section>

          <section className="border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-600" />
              <h2 className="font-bold text-slate-950">Источники и ссылки</h2>
            </div>
            <div className="mt-3 space-y-2">
              {entry.sourceUrl ? (
                <a
                  href={entry.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex min-h-11 items-center justify-between gap-3 border border-slate-200 px-3 text-sm font-semibold text-blue-700 hover:bg-blue-50"
                >
                  <span className="truncate">
                    {operatorFacingReferenceText(entry.source || "Открыть источник")}
                  </span>
                  <ExternalLink className="h-4 w-4 shrink-0" />
                </a>
              ) : (
                <p className="text-sm text-slate-500">Ссылка на источник не указана.</p>
              )}
            </div>
          </section>

          {entry.aliases.length ? (
            <section className="border border-slate-200 bg-white p-4">
              <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                Другие названия
              </h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {entry.aliases.map((alias) => (
                  <span
                    key={alias}
                    className="border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-700"
                  >
                    {alias}
                  </span>
                ))}
              </div>
            </section>
          ) : null}
        </aside>
      </main>
    </OpsSurface>
  );
}

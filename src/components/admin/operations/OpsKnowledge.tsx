"use client";

import { useEffect, useMemo, useState } from "react";

import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  BookOpenCheck,
  FilePenLine,
  Loader2,
  Plus,
  Search,
  Tags,
} from "lucide-react";

import { opsRu } from "@/lib/operations/i18n";
import { cn } from "@/lib/utils";

import { OpsPageHeader } from "./OpsPageHeader";
import { OpsSurface } from "./OpsSurface";
import { opsGet } from "./opsApi";
import type { OpsKnowledgeArticle } from "./types";

const categories = [
  { value: "all", label: "Все материалы" },
  { value: "prices-and-brands", label: opsRu.knowledge.categories.pricing },
  { value: "delivery", label: opsRu.knowledge.categories.delivery },
  { value: "order-processing", label: opsRu.knowledge.categories.orders },
  { value: "suppliers", label: opsRu.knowledge.categories.suppliers },
  { value: "general-processes", label: opsRu.knowledge.categories.processes },
];

export function knowledgeCategoryLabel(value: string) {
  return categories.find((category) => category.value === value)?.label ?? value;
}

export function OpsKnowledge({
  initialArticles,
  demoMode = false,
  canWrite = false,
  permissions,
}: {
  initialArticles?: OpsKnowledgeArticle[];
  demoMode?: boolean;
  canWrite?: boolean;
  permissions: readonly string[];
}) {
  const [articles, setArticles] = useState(initialArticles ?? []);
  const [category, setCategory] = useState("all");
  const [query, setQuery] = useState("");
  const [brandStatus, setBrandStatus] = useState<"all" | "available" | "missing">("all");
  const [brandScope, setBrandScope] = useState<"all" | "top-level">("all");
  const [brandPage, setBrandPage] = useState(1);
  const [loading, setLoading] = useState(!initialArticles);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialArticles || demoMode) return;
    const controller = new AbortController();
    void opsGet<{ articles: OpsKnowledgeArticle[] }>(
      "/api/admin/operations/knowledge?locale=ru&limit=100&excludeTag=brand-guide",
      controller.signal
    )
      .then((response) => setArticles(response.articles))
      .catch((cause) => {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : "Не удалось загрузить БАЗУ");
        }
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [demoMode, initialArticles]);

  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();
    return articles.filter(
      (article) =>
        !article.tags.includes("brand-guide") &&
        (category === "all" || article.category === category) &&
        (!value ||
          [
            article.title,
            article.excerpt,
            article.contentMarkdown,
            article.brandKey,
            article.tags.join(" "),
            knowledgeCategoryLabel(article.category),
          ].some((field) =>
            String(field ?? "")
              .toLowerCase()
              .includes(value)
          ))
    );
  }, [articles, category, query]);
  const startArticles = useMemo(
    () =>
      filtered
        .filter((article) => article.tags.includes("start-here"))
        .sort((left, right) => {
          const step = (article: OpsKnowledgeArticle) =>
            Number(article.tags.find((tag) => /^step-\d+$/.test(tag))?.slice(5) ?? 99);
          return step(left) - step(right);
        }),
    [filtered]
  );
  const brandArticles = useMemo(
    () =>
      filtered
        .filter(
          (article) =>
            article.tags.includes("brand-guide") &&
            (brandScope === "all" || article.tags.includes("top-level-pdf")) &&
            (brandStatus === "all" ||
              (brandStatus === "available"
                ? article.tags.includes("formula-available")
                : article.tags.includes("formula-missing")))
        )
        .sort((left, right) =>
          left.title.localeCompare(right.title, "ru", { sensitivity: "base" })
        ),
    [brandScope, brandStatus, filtered]
  );
  const regularArticles =
    category === "all" && !query.trim()
      ? filtered.filter(
          (article) => !article.tags.includes("start-here") && !article.tags.includes("brand-guide")
        )
      : filtered.filter((article) => !article.tags.includes("brand-guide"));
  const brandPageSize = 25;
  const brandPageCount = Math.max(1, Math.ceil(brandArticles.length / brandPageSize));
  const visibleBrandArticles = brandArticles.slice(
    (brandPage - 1) * brandPageSize,
    brandPage * brandPageSize
  );

  useEffect(() => {
    setBrandPage(1);
  }, [brandScope, brandStatus, category, query]);

  return (
    <OpsSurface permissions={permissions}>
      <OpsPageHeader
        title={opsRu.knowledge.title}
        description={opsRu.knowledge.subtitle}
        actions={
          canWrite ? (
            <Link
              href="/admin/operations/knowledge/new"
              className="flex h-11 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              {opsRu.knowledge.create}
            </Link>
          ) : undefined
        }
      />

      <div className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <label className="relative block min-w-0 flex-1 lg:max-w-xl">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Найти инструкцию, бренд или процесс…"
              className="h-11 w-full rounded-lg border border-slate-300 pl-10 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </label>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
            {categories.map((item) => (
              <button
                type="button"
                key={item.value}
                onClick={() => setCategory(item.value)}
                className={cn(
                  "h-10 shrink-0 rounded-lg border px-3 text-sm font-medium",
                  category === item.value
                    ? "border-blue-600 bg-blue-600 text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:border-blue-200"
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1400px] p-4 sm:p-6 lg:p-8">
        {loading ? (
          <div className="flex min-h-96 items-center justify-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            {opsRu.common.loading}
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        ) : filtered.length ? (
          <div>
            {category === "all" && !query.trim() ? (
              <Link
                href="/admin/operations/directory"
                className="mb-6 flex flex-col justify-between gap-4 border border-slate-900 bg-slate-950 p-5 text-white hover:bg-slate-900 sm:flex-row sm:items-center"
              >
                <span>
                  <span className="block text-xs font-bold uppercase tracking-[0.16em] text-blue-400">
                    Отдельный рабочий раздел
                  </span>
                  <span className="mt-1 block text-xl font-bold">Справочник брендов</span>
                  <span className="mt-1 block text-sm text-slate-300">
                    277 брендов, формулы, ссылки и ориентиры доставки.
                  </span>
                </span>
                <span className="flex h-11 shrink-0 items-center gap-2 border border-white/20 px-4 text-sm font-semibold">
                  Открыть справочник
                  <ArrowRight className="h-4 w-4" />
                </span>
              </Link>
            ) : null}
            {category === "all" && !query.trim() && startArticles.length ? (
              <section className="mb-9 border border-blue-200 bg-blue-50/50 p-4 sm:p-6">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">
                      Новый сотрудник
                    </div>
                    <h2 className="mt-1 text-2xl font-bold text-slate-950">Начните отсюда</h2>
                    <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
                      Короткий маршрут: что такое One Company, как проходит рабочий день и как
                      ставить или выполнять задачи.
                    </p>
                  </div>
                  <span className="text-sm font-medium text-blue-700">
                    {startArticles.length} шага
                  </span>
                </div>
                <div className="mt-5 grid gap-px overflow-hidden border border-blue-200 bg-blue-200 lg:grid-cols-3">
                  {startArticles.map((article, index) => (
                    <Link
                      key={article.id}
                      href={`/admin/operations/knowledge/${article.id}`}
                      className="group flex min-h-36 bg-white p-4 hover:bg-blue-50"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center bg-blue-600 text-sm font-bold text-white">
                        {index + 1}
                      </span>
                      <span className="ml-3 min-w-0">
                        <span className="block text-base font-bold leading-5 text-slate-950">
                          {article.title}
                        </span>
                        <span className="mt-2 line-clamp-3 block text-sm leading-5 text-slate-500">
                          {article.excerpt}
                        </span>
                        <span className="mt-3 flex items-center gap-1 text-xs font-semibold text-blue-700">
                          Открыть
                          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                        </span>
                      </span>
                    </Link>
                  ))}
                </div>
              </section>
            ) : null}

            {(category === "all" || category === "prices-and-brands") &&
            (brandArticles.length ||
              articles.some((article) => article.tags.includes("brand-guide"))) ? (
              <section className="mb-9 border border-slate-200 bg-white">
                <div className="border-b border-slate-200 p-4 sm:p-5">
                  <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
                    <div>
                      <div className="text-xs font-bold uppercase tracking-[0.14em] text-blue-700">
                        Цены и бренды
                      </div>
                      <h2 className="mt-1 text-2xl font-bold text-slate-950">Справочник брендов</h2>
                      <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
                        Формула здесь является рабочей подсказкой, а не автоматическим
                        калькулятором. Перед расчётом проверяйте актуальность источника, доставки и
                        VAT/tax.
                      </p>
                    </div>
                    <div className="text-sm text-slate-500">
                      Найдено:{" "}
                      <span className="font-semibold text-slate-900">{brandArticles.length}</span>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                    <div className="flex overflow-x-auto border border-slate-200 bg-slate-50">
                      {[
                        ["all", "Все бренды"],
                        ["top-level", "Из внутреннего каталога"],
                      ].map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setBrandScope(value as "all" | "top-level")}
                          className={cn(
                            "h-9 shrink-0 border-r border-slate-200 px-3 text-xs font-semibold last:border-r-0",
                            brandScope === value
                              ? "bg-blue-600 text-white"
                              : "bg-white text-slate-600 hover:bg-slate-50"
                          )}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <div className="flex overflow-x-auto border border-slate-200 bg-slate-50">
                      {[
                        ["all", "Любой статус"],
                        ["available", "Есть правило"],
                        ["missing", "Нужна проверка"],
                      ].map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setBrandStatus(value as "all" | "available" | "missing")}
                          className={cn(
                            "h-9 shrink-0 border-r border-slate-200 px-3 text-xs font-semibold last:border-r-0",
                            brandStatus === value
                              ? "bg-slate-900 text-white"
                              : "bg-white text-slate-600 hover:bg-slate-50"
                          )}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {visibleBrandArticles.length ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-[860px] w-full border-collapse text-left text-sm">
                      <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="border-b border-slate-200 px-4 py-3 font-semibold">
                            Бренд
                          </th>
                          <th className="border-b border-slate-200 px-4 py-3 font-semibold">
                            Статус
                          </th>
                          <th className="border-b border-slate-200 px-4 py-3 font-semibold">
                            Группа
                          </th>
                          <th className="border-b border-slate-200 px-4 py-3 font-semibold">
                            Правило
                          </th>
                          <th className="w-16 border-b border-slate-200 px-4 py-3" />
                        </tr>
                      </thead>
                      <tbody>
                        {visibleBrandArticles.map((article) => {
                          const available = article.tags.includes("formula-available");
                          const region =
                            article.tags
                              .find((tag) => tag.startsWith("region-"))
                              ?.slice("region-".length) ?? "other";
                          const regionLabels: Record<string, string> = {
                            usa: "США",
                            europe: "Европа",
                            moto: "Мото",
                            oem: "OEM",
                            racing: "Автоспорт",
                            verified_rules: "Общее правило",
                            "pdf-only": "Другое",
                          };
                          return (
                            <tr
                              key={article.id}
                              className="border-b border-slate-100 last:border-0 hover:bg-blue-50/40"
                            >
                              <td className="px-4 py-3">
                                <Link
                                  href={`/admin/operations/knowledge/${article.id}`}
                                  className="font-semibold text-slate-950 hover:text-blue-700"
                                >
                                  {article.title}
                                </Link>
                                {article.tags.includes("top-level-pdf") ? (
                                  <div className="mt-0.5 text-[11px] text-blue-600">
                                    Из внутреннего каталога
                                  </div>
                                ) : null}
                              </td>
                              <td className="px-4 py-3">
                                <span
                                  className={cn(
                                    "inline-flex items-center gap-1.5 text-xs font-semibold",
                                    available ? "text-emerald-700" : "text-amber-700"
                                  )}
                                >
                                  <span
                                    className={cn(
                                      "h-2 w-2",
                                      available ? "bg-emerald-500" : "bg-amber-500"
                                    )}
                                  />
                                  {available ? "Есть правило" : "Нужна проверка"}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-slate-600">
                                {regionLabels[region] ?? region}
                              </td>
                              <td className="max-w-xl px-4 py-3 text-slate-600">
                                <span className="line-clamp-2">
                                  {article.excerpt || "Формула не подтверждена"}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <Link
                                  href={`/admin/operations/knowledge/${article.id}`}
                                  aria-label={`Открыть правило ${article.title}`}
                                  className="inline-flex h-9 w-9 items-center justify-center text-slate-400 hover:bg-blue-50 hover:text-blue-700"
                                >
                                  <ArrowRight className="h-4 w-4" />
                                </Link>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="px-5 py-10 text-center text-sm text-slate-500">
                    По выбранным фильтрам бренды не найдены.
                  </div>
                )}

                {brandArticles.length > brandPageSize ? (
                  <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3">
                    <span className="text-xs text-slate-500">
                      Страница {brandPage} из {brandPageCount}
                    </span>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => setBrandPage((page) => Math.max(1, page - 1))}
                        disabled={brandPage === 1}
                        className="h-9 border border-slate-200 px-3 text-xs font-semibold disabled:opacity-40"
                      >
                        Назад
                      </button>
                      <button
                        type="button"
                        onClick={() => setBrandPage((page) => Math.min(brandPageCount, page + 1))}
                        disabled={brandPage === brandPageCount}
                        className="h-9 border border-slate-200 px-3 text-xs font-semibold disabled:opacity-40"
                      >
                        Дальше
                      </button>
                    </div>
                  </div>
                ) : null}
              </section>
            ) : null}

            {category === "all" && !query.trim() && regularArticles.length ? (
              <div className="mb-4 flex items-end justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-slate-950">Все инструкции</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Процессы, цены, бренды, доставка и поставщики.
                  </p>
                </div>
                <span className="text-xs text-slate-400">{regularArticles.length} материалов</span>
              </div>
            ) : null}

            {regularArticles.length ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {regularArticles.map((article) => (
                  <Link
                    key={article.id}
                    href={`/admin/operations/knowledge/${article.id}`}
                    className="group flex min-h-60 flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
                        {article.status === "PUBLISHED" ? (
                          <BookOpenCheck className="h-5 w-5" />
                        ) : (
                          <FilePenLine className="h-5 w-5" />
                        )}
                      </span>
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide",
                          article.status === "PUBLISHED"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-amber-50 text-amber-700"
                        )}
                      >
                        {article.status === "PUBLISHED"
                          ? opsRu.knowledge.published
                          : opsRu.knowledge.draft}
                      </span>
                    </div>
                    <div className="mt-4 text-[11px] font-bold uppercase tracking-wide text-blue-600">
                      {knowledgeCategoryLabel(article.category)}
                    </div>
                    <h2 className="mt-1.5 text-lg font-bold leading-6 text-slate-950">
                      {article.title}
                    </h2>
                    <p className="mt-2 line-clamp-3 text-sm leading-5 text-slate-500">
                      {article.excerpt || "Краткое описание пока не добавлено."}
                    </p>
                    <div className="mt-auto pt-5">
                      {article.tags.length ? (
                        <div className="flex items-center gap-2 overflow-hidden text-xs text-slate-400">
                          <Tags className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{article.tags.slice(0, 3).join(" · ")}</span>
                        </div>
                      ) : null}
                      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-400">
                        <span>
                          Обновлено{" "}
                          {new Intl.DateTimeFormat("ru-RU", {
                            day: "numeric",
                            month: "short",
                          }).format(new Date(article.updatedAt))}
                        </span>
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1 group-hover:text-blue-600" />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="flex min-h-96 flex-col items-center justify-center text-center">
            <BookOpen className="h-10 w-10 text-slate-300" />
            <h2 className="mt-3 font-semibold text-slate-800">{opsRu.knowledge.empty}</h2>
            <p className="mt-1 text-sm text-slate-500">Измените категорию или поисковый запрос.</p>
          </div>
        )}
      </div>
    </OpsSurface>
  );
}

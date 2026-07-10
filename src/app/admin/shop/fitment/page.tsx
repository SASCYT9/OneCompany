"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Check, ChevronLeft, ChevronRight, RefreshCw, Search } from "lucide-react";

import {
  AdminActionBar,
  AdminEmptyState,
  AdminFilterBar,
  AdminInlineAlert,
  AdminMetricCard,
  AdminMetricGrid,
  AdminPage,
  AdminPageHeader,
  AdminStatusBadge,
  AdminTableShell,
} from "@/components/admin/AdminPrimitives";
import type {
  NormalizedFitment,
  NormalizedFitmentStatus,
  NormalizedVehicleType,
} from "@/lib/shopFitmentQuality";

type ReviewProduct = {
  id: string;
  slug: string;
  sku: string;
  brand: string;
  title: string;
  image: string;
  fitment: NormalizedFitment;
  automaticFitment: NormalizedFitment;
  hasOverride: boolean;
};

type ReviewResponse = {
  products: ReviewProduct[];
  counts: Record<NormalizedFitmentStatus, number>;
  brands: Array<{ brand: string; count: number }>;
  metadata: { totalCount: number; currentPage: number; totalPages: number; limit: number };
  error?: string;
};

type EditorState = {
  vehicleType: NormalizedVehicleType;
  make: string;
  models: string;
  chassisCodes: string;
  yearRanges: string;
  note: string;
};

const STATUS_OPTIONS: Array<{ value: NormalizedFitmentStatus; label: string }> = [
  { value: "needs_review", label: "Потребують перевірки" },
  { value: "inferred", label: "Розпізнані" },
  { value: "verified", label: "Підтверджені" },
  { value: "universal", label: "Універсальні" },
];

function formatYearRanges(ranges: NormalizedFitment["yearRanges"]) {
  return ranges.map((range) => `${range.from}${range.to ? `-${range.to}` : "+"}`).join(", ");
}

function parseYearRanges(value: string) {
  return value.split(",").flatMap((token) => {
    const match = token.trim().match(/^(\d{4})(?:\s*-\s*(\d{4})|\s*\+)?$/);
    if (!match) return [];
    return [{ from: Number(match[1]), to: match[2] ? Number(match[2]) : null }];
  });
}

function editorFromProduct(product: ReviewProduct): EditorState {
  return {
    vehicleType:
      product.fitment.vehicleType === "universal" ? "unknown" : product.fitment.vehicleType,
    make: product.fitment.make || "",
    models: product.fitment.models.join(", "),
    chassisCodes: product.fitment.chassisCodes.join(", "),
    yearRanges: formatYearRanges(product.fitment.yearRanges),
    note: product.fitment.note || "",
  };
}

function splitValues(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function statusTone(status: NormalizedFitmentStatus) {
  if (status === "verified") return "success" as const;
  if (status === "needs_review") return "warning" as const;
  return "default" as const;
}

export default function FitmentReviewPage() {
  const [data, setData] = useState<ReviewResponse | null>(null);
  const [status, setStatus] = useState<NormalizedFitmentStatus>("needs_review");
  const [brand, setBrand] = useState("ALL");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeProduct, setActiveProduct] = useState<ReviewProduct | null>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        status,
        brand,
        q: query,
        page: String(page),
        limit: "50",
      });
      const response = await fetch(`/api/admin/shop/fitment-review?${params}`, {
        cache: "no-store",
      });
      const result = (await response.json().catch(() => ({}))) as ReviewResponse;
      if (!response.ok) {
        setError(result.error || "Не вдалося завантажити чергу");
        return;
      }
      setData(result);
      setSelectedIds([]);
      if (activeProduct && !result.products.some((product) => product.id === activeProduct.id)) {
        setActiveProduct(null);
        setEditor(null);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, brand, query, page]);

  const allVisibleSelected = useMemo(
    () =>
      Boolean(data?.products.length) &&
      data!.products.every((product) => selectedIds.includes(product.id)),
    [data, selectedIds]
  );

  function selectProduct(product: ReviewProduct) {
    setActiveProduct(product);
    setEditor(editorFromProduct(product));
  }

  function buildPayload(
    nextStatus: "verified" | "universal" | "needs_review",
    preserveAdditionalApplications = true
  ) {
    const primaryApplication = editor?.make
      ? {
          vehicleType: editor.vehicleType === "motorcycle" ? "motorcycle" : "car",
          make: editor.make,
          models: splitValues(editor.models),
          chassisCodes: splitValues(editor.chassisCodes),
          yearRanges: parseYearRanges(editor.yearRanges),
          engines: [],
          bodyStyles: [],
          drivetrains: [],
          markets: [],
        }
      : null;
    const additionalApplications = preserveAdditionalApplications
      ? (activeProduct?.fitment.applications.slice(1) ?? [])
      : [];
    return {
      status: nextStatus,
      vehicleType: editor?.vehicleType || "unknown",
      make: editor?.make || "",
      models: splitValues(editor?.models || ""),
      chassisCodes: splitValues(editor?.chassisCodes || ""),
      yearRanges: parseYearRanges(editor?.yearRanges || ""),
      note: editor?.note || "",
      applications:
        nextStatus === "universal"
          ? []
          : [primaryApplication, ...additionalApplications].filter(Boolean),
    };
  }

  async function save(nextStatus: "verified" | "universal" | "needs_review", ids?: string[]) {
    const productIds = ids?.length ? ids : activeProduct ? [activeProduct.id] : [];
    if (!productIds.length) return;
    setSaving(true);
    setError("");
    try {
      const isBulk = productIds.length > 1;
      const payload = buildPayload(nextStatus, !isBulk);
      const response = await fetch(
        isBulk
          ? "/api/admin/shop/fitment-review/bulk"
          : `/api/admin/shop/fitment-review/${productIds[0]}`,
        {
          method: isBulk ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(isBulk ? { productIds, fitment: payload } : payload),
        }
      );
      const result = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(result.error || "Не вдалося зберегти сумісність");
        return;
      }
      setActiveProduct(null);
      setEditor(null);
      await load();
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminPage wide className="space-y-5">
      <AdminPageHeader
        eyebrow="Catalog data"
        title="Перевірка сумісності"
        description="Черга товарів, для яких марка, модель, кузов або роки не можуть бути підтверджені автоматично."
        actions={
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-2 border border-white/10 bg-white/3 px-4 py-2 text-sm text-zinc-200 hover:bg-white/6 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "motion-safe:animate-spin" : ""}`} />
            Оновити
          </button>
        }
      />

      {error ? <AdminInlineAlert tone="error">{error}</AdminInlineAlert> : null}

      <AdminMetricGrid>
        {STATUS_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => {
              setStatus(option.value);
              setPage(1);
            }}
            className="text-left"
          >
            <AdminMetricCard
              label={option.label}
              value={data?.counts[option.value] ?? "—"}
              meta={status === option.value ? "Поточний список" : "Відкрити список"}
              tone={status === option.value ? "accent" : "default"}
            />
          </button>
        ))}
      </AdminMetricGrid>

      <AdminFilterBar>
        <label className="flex min-w-[260px] flex-1 items-center gap-2 border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-200">
          <Search className="h-4 w-4 text-zinc-500" />
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            placeholder="Назва, SKU, бренд, марка"
            className="w-full bg-transparent outline-none placeholder:text-zinc-600"
          />
        </label>
        <select
          value={brand}
          onChange={(event) => {
            setBrand(event.target.value);
            setPage(1);
          }}
          className="min-w-[220px] border border-white/10 bg-[#111] px-3 py-2 text-sm text-zinc-200"
        >
          <option value="ALL">Усі бренди</option>
          {(data?.brands ?? []).map((item) => (
            <option key={item.brand} value={item.brand}>
              {item.brand} ({item.count})
            </option>
          ))}
        </select>
      </AdminFilterBar>

      {selectedIds.length ? (
        <AdminActionBar>
          <span className="text-sm text-zinc-300">Вибрано: {selectedIds.length}</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void save("universal", selectedIds)}
              disabled={saving}
              className="border border-white/10 px-3 py-2 text-sm text-zinc-200 hover:bg-white/6"
            >
              Позначити універсальними
            </button>
            <button
              type="button"
              onClick={() => void save("verified", selectedIds)}
              disabled={saving || !editor?.make}
              className="bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-40"
            >
              Застосувати mapping
            </button>
          </div>
        </AdminActionBar>
      ) : null}

      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0">
          {data?.products.length ? (
            <AdminTableShell>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[940px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/3 text-[11px] uppercase tracking-wider text-zinc-500">
                      <th className="w-12 px-4 py-3">
                        <input
                          type="checkbox"
                          checked={allVisibleSelected}
                          onChange={() =>
                            setSelectedIds(
                              allVisibleSelected ? [] : data.products.map((product) => product.id)
                            )
                          }
                          aria-label="Вибрати сторінку"
                        />
                      </th>
                      <th className="px-3 py-3 font-medium">Товар</th>
                      <th className="px-3 py-3 font-medium">Автовизначення</th>
                      <th className="px-3 py-3 font-medium">Стан</th>
                      <th className="px-3 py-3 font-medium">Дія</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/6">
                    {data.products.map((product) => (
                      <tr
                        key={product.id}
                        className={`align-middle hover:bg-white/3 ${activeProduct?.id === product.id ? "bg-blue-500/8" : ""}`}
                      >
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(product.id)}
                            onChange={() =>
                              setSelectedIds((current) =>
                                current.includes(product.id)
                                  ? current.filter((id) => id !== product.id)
                                  : [...current, product.id]
                              )
                            }
                            aria-label={`Вибрати ${product.title}`}
                          />
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-3">
                            <div className="relative h-12 w-16 shrink-0 bg-white/5">
                              {product.image ? (
                                <Image
                                  src={product.image}
                                  alt=""
                                  fill
                                  unoptimized
                                  className="object-contain"
                                />
                              ) : null}
                            </div>
                            <div className="min-w-0">
                              <div className="line-clamp-2 font-medium text-zinc-100">
                                {product.title}
                              </div>
                              <div className="mt-1 text-xs text-zinc-500">
                                {product.brand} · {product.sku || product.slug}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-xs text-zinc-400">
                          <div>{product.fitment.make || "Марку не визначено"}</div>
                          <div className="mt-1 max-w-[280px] truncate text-zinc-600">
                            {[
                              ...product.fitment.models,
                              ...product.fitment.chassisCodes,
                              formatYearRanges(product.fitment.yearRanges),
                            ]
                              .filter(Boolean)
                              .join(" · ") || "Немає структурованих сигналів"}
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <AdminStatusBadge tone={statusTone(product.fitment.status)}>
                            {product.fitment.status}
                            {product.hasOverride ? " · manual" : ""}
                          </AdminStatusBadge>
                        </td>
                        <td className="px-3 py-3">
                          <button
                            type="button"
                            onClick={() => selectProduct(product)}
                            className="border border-white/10 px-3 py-2 text-xs text-zinc-200 hover:bg-white/6"
                          >
                            Перевірити
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </AdminTableShell>
          ) : loading ? (
            <div className="h-80 animate-pulse border border-white/8 bg-white/3" />
          ) : (
            <AdminEmptyState
              title="Черга порожня"
              description="За поточними фільтрами товарів немає."
            />
          )}

          {data && data.metadata.totalPages > 1 ? (
            <div className="mt-4 flex items-center justify-between text-sm text-zinc-500">
              <span>{data.metadata.totalCount} товарів</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                  className="border border-white/10 p-2 disabled:opacity-30"
                  aria-label="Попередня сторінка"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span>
                  {data.metadata.currentPage} / {data.metadata.totalPages}
                </span>
                <button
                  type="button"
                  disabled={page >= data.metadata.totalPages}
                  onClick={() => setPage((value) => value + 1)}
                  className="border border-white/10 p-2 disabled:opacity-30"
                  aria-label="Наступна сторінка"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <aside className="border border-white/8 bg-[#141414] p-5 xl:sticky xl:top-5 xl:self-start">
          {activeProduct && editor ? (
            <div className="space-y-4">
              <div>
                <div className="text-xs uppercase tracking-wider text-blue-400">
                  Ручна перевірка
                </div>
                <h2 className="mt-2 line-clamp-2 text-lg font-semibold text-zinc-100">
                  {activeProduct.title}
                </h2>
                <p className="mt-1 text-xs text-zinc-500">
                  {activeProduct.brand} · {activeProduct.sku}
                </p>
              </div>
              <EditorSelect
                label="Тип транспорту"
                value={editor.vehicleType}
                onChange={(value) =>
                  setEditor({ ...editor, vehicleType: value as NormalizedVehicleType })
                }
                options={[
                  { value: "car", label: "Автомобіль" },
                  { value: "motorcycle", label: "Мотоцикл" },
                  { value: "unknown", label: "Не визначено" },
                ]}
              />
              <EditorInput
                label="Марка"
                value={editor.make}
                onChange={(value) => setEditor({ ...editor, make: value })}
                placeholder="BMW"
              />
              <EditorInput
                label="Моделі через кому"
                value={editor.models}
                onChange={(value) => setEditor({ ...editor, models: value })}
                placeholder="M3, M4"
              />
              <EditorInput
                label="Кузови через кому"
                value={editor.chassisCodes}
                onChange={(value) => setEditor({ ...editor, chassisCodes: value })}
                placeholder="G80, G81"
              />
              <EditorInput
                label="Роки"
                value={editor.yearRanges}
                onChange={(value) => setEditor({ ...editor, yearRanges: value })}
                placeholder="2018-2020, 2021+"
              />
              <EditorInput
                label="Примітка"
                value={editor.note}
                onChange={(value) => setEditor({ ...editor, note: value })}
                placeholder="Джерело або причина рішення"
              />
              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => void save("universal")}
                  disabled={saving}
                  className="border border-white/10 px-3 py-2.5 text-sm text-zinc-200 hover:bg-white/6"
                >
                  Універсальний
                </button>
                <button
                  type="button"
                  onClick={() => void save("verified")}
                  disabled={saving || !editor.make}
                  className="inline-flex items-center justify-center gap-2 bg-blue-600 px-3 py-2.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-40"
                >
                  <Check className="h-4 w-4" />
                  Підтвердити
                </button>
              </div>
            </div>
          ) : (
            <div className="py-16 text-center">
              <div className="text-sm font-medium text-zinc-300">Виберіть товар</div>
              <p className="mx-auto mt-2 max-w-[260px] text-xs leading-5 text-zinc-600">
                Праворуч з’являться автоматично знайдені дані та поля для підтвердження.
              </p>
            </div>
          )}
        </aside>
      </div>
    </AdminPage>
  );
}

function EditorInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs text-zinc-500">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-blue-500/60"
      />
    </label>
  );
}

function EditorSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs text-zinc-500">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full border border-white/10 bg-[#111] px-3 py-2.5 text-sm text-zinc-100 outline-none"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

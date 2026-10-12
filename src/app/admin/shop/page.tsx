"use client";

import { Suspense, useEffect, useMemo, useState } from "react";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Download, Eye, Pencil, Plus, Search, Trash2, Upload } from "lucide-react";

import {
  AdminActionBar,
  AdminEmptyState,
  AdminFilterBar,
  AdminInlineAlert,
  AdminPage,
  AdminPageHeader,
  AdminResponsiveTable,
  AdminStatusBadge,
  AdminTableShell,
} from "@/components/admin/AdminPrimitives";
import { AdminSkeletonKpiGrid, AdminSkeletonTable } from "@/components/admin/AdminSkeleton";
import { useConfirm } from "@/components/admin/AdminConfirmDialog";
import { useToast } from "@/components/admin/AdminToast";
import { ProductQuickView } from "@/app/admin/shop/components/ProductQuickView";
import { AdminMobileCard } from "@/components/admin/AdminMobileCard";
import { AdminBrandHero } from "@/components/admin/AdminBrandHero";
import { AdminFilterChips, type FilterChip } from "@/components/admin/AdminFilterChips";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { AdminProductThumbnail } from "@/components/admin/AdminProductThumbnail";
import {
  AdminDensityToggle,
  DENSITY_ROW_PADDING,
  DENSITY_THUMB_SIZE,
  useAdminDensity,
} from "@/components/admin/AdminDensityToggle";
import { adminBrandTheme, isBrandFilterActive } from "@/lib/admin/brandTheme";
import { cn } from "@/lib/utils";

type ShopProductListItem = {
  id: string;
  slug: string;
  sku: string | null;
  scope: string;
  brand: string | null;
  vendor: string | null;
  productType: string | null;
  collectionIds: string[];
  collectionHandles: string[];
  titleUa: string;
  titleEn: string;
  stock: string;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  priceUah: number | null;
  priceEur: number | null;
  priceEurEurope: number | null;
  priceUsd: number | null;
  isPublished: boolean;
  updatedAt: string;
  imageUrl: string | null;
  customerAvailability?: {
    value: "inStock" | "inTransit" | "preOrder";
    origin: "editor" | "warehouse-list" | "unset";
  };
  customerPrice?: {
    uah: number;
    eur: number;
    usd: number;
    sourceCurrency: "EUR" | "USD" | "UAH" | null;
  } | null;
  variantsCount: number;
  mediaCount: number;
  collectionsCount: number;
};

type ProductBrand = {
  brand: string;
  count: number;
};

type AvailabilityFilter = "ALL" | "confirmed" | "outOfStock";

function availabilityFilterLabel(value: AvailabilityFilter) {
  if (value === "confirmed") return "В наявності на сайті";
  if (value === "outOfStock") return "Немає у постачальника";
  return "Уся наявність";
}

function CustomerAvailabilityBadge({ product }: { product: ShopProductListItem }) {
  const availability = product.customerAvailability ?? { value: "preOrder", origin: "unset" };
  if (availability.value === "inStock") {
    return <AdminStatusBadge tone="success">В наявності</AdminStatusBadge>;
  }
  return (
    <span className="inline-flex flex-col gap-0.5">
      <span className="text-[13px] text-zinc-300">
        {availability.value === "inTransit" ? "В дорозі" : "Під замовлення"}
      </span>
      {availability.origin === "unset" ? (
        <span
          className="text-[11px] text-zinc-600"
          title="Наявність ще не задавали в редакторі — сайт бере старі дані імпорту."
        >
          не задано вручну
        </span>
      ) : null}
    </span>
  );
}

const UAH = new Intl.NumberFormat("uk-UA", {
  style: "currency",
  currency: "UAH",
  maximumFractionDigits: 0,
});
const SOURCE_FORMAT: Record<"EUR" | "USD" | "UAH", Intl.NumberFormat> = {
  EUR: new Intl.NumberFormat("uk-UA", { style: "currency", currency: "EUR" }),
  USD: new Intl.NumberFormat("uk-UA", { style: "currency", currency: "USD" }),
  UAH: UAH,
};

function PriceCell({ product }: { product: ShopProductListItem }) {
  const price = product.customerPrice;
  if (!price) return <span className="text-[13px] text-amber-300">Ціна за запитом</span>;
  const source = price.sourceCurrency;
  return (
    <div className="space-y-0.5">
      <div className="text-[15px] font-semibold tabular-nums text-zinc-50">
        {UAH.format(price.uah)}
      </div>
      {source && source !== "UAH" ? (
        <div className="text-[11px] tabular-nums text-zinc-500">
          {SOURCE_FORMAT[source].format(price[source.toLowerCase() as "eur" | "usd"])} · ціна в{" "}
          {source}
        </div>
      ) : source === "UAH" ? (
        <div className="text-[11px] text-zinc-500">фіксована в грн</div>
      ) : null}
    </div>
  );
}

function SiteStatus({ product }: { product: ShopProductListItem }) {
  const live = product.status === "ACTIVE" && product.isPublished;
  const label = live
    ? "Показується"
    : product.status === "ARCHIVED"
      ? "Архів"
      : product.status === "DRAFT"
        ? "Чернетка"
        : "Прихований";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 text-[13px]",
        live ? "text-zinc-200" : "text-amber-300"
      )}
    >
      <span
        className={cn(
          "h-2 w-2 shrink-0",
          live ? "bg-emerald-400" : product.status === "ARCHIVED" ? "bg-zinc-600" : "bg-amber-400"
        )}
        aria-hidden="true"
      />
      {label}
    </span>
  );
}

function relativeTime(iso: string): { label: string; full: string } {
  const date = new Date(iso);
  const full = date.toLocaleString();
  const diff = Date.now() - date.getTime();
  const seconds = Math.max(0, Math.floor(diff / 1000));
  if (seconds < 60) return { label: "щойно", full };
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return { label: `${minutes} хв тому`, full };
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return { label: `${hours} год тому`, full };
  const days = Math.floor(hours / 24);
  if (days < 30) return { label: `${days} дн. тому`, full };
  const months = Math.floor(days / 30);
  if (months < 12) return { label: `${months} міс. тому`, full };
  return { label: `${Math.floor(months / 12)} р. тому`, full };
}

function AdminShopPageContent() {
  const confirm = useConfirm();
  const toast = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { density, setDensity } = useAdminDensity("comfortable");

  const searchParam = searchParams.get("search") || "";
  const brandParam = searchParams.get("brand") || "ALL";
  const statusParam = searchParams.get("status") || "ALL";
  const stockParam = searchParams.get("stock") || "ALL";
  const availabilityParam = (
    searchParams.get("availability") === "confirmed"
      ? "confirmed"
      : stockParam === "outOfStock"
        ? "outOfStock"
        : "ALL"
  ) as AvailabilityFilter;

  const [products, setProducts] = useState<ShopProductListItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [metadata, setMetadata] = useState({
    totalCount: 0,
    totalPages: 1,
    currentPage: 1,
    limit: 50,
    brands: [] as ProductBrand[],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [searchInput, setSearchInput] = useState(searchParam);
  const [quickViewId, setQuickViewId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const brandActive = isBrandFilterActive(brandParam);
  const brandTheme = useMemo(() => adminBrandTheme(brandParam), [brandParam]);

  const visibleStats = useMemo(() => {
    const counts = { active: 0, draft: 0, archived: 0, published: 0 };
    for (const p of products) {
      if (p.status === "ACTIVE") counts.active += 1;
      if (p.status === "DRAFT") counts.draft += 1;
      if (p.status === "ARCHIVED") counts.archived += 1;
      if (p.isPublished) counts.published += 1;
    }
    return counts;
  }, [products]);

  async function handleExport() {
    setExporting(true);
    try {
      const filtersJson = JSON.stringify({
        search: searchParam,
        brand: brandParam !== "ALL" ? brandParam : "",
        status: statusParam !== "ALL" ? statusParam : "",
        stock: stockParam !== "ALL" ? stockParam : "",
      });
      const filtersB64 = btoa(unescape(encodeURIComponent(filtersJson)));
      const response = await fetch(`/api/admin/export/products?filters=${filtersB64}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        toast.error("Не вдалося експортувати товари");
        return;
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        response.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ||
        "products.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Товари експортовано", `Завантажено ${a.download}`);
    } catch (e) {
      toast.error("Експорт не вдався", (e as Error).message);
    } finally {
      setExporting(false);
    }
  }

  function updateParams(newParams: Record<string, string | number | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(newParams)) {
      if (value === null || value === "" || value === "ALL") {
        params.delete(key);
      } else {
        params.set(key, String(value));
      }
    }

    if (
      !newParams.page &&
      (newParams.search !== undefined ||
        newParams.brand !== undefined ||
        newParams.status !== undefined ||
        newParams.stock !== undefined ||
        newParams.availability !== undefined)
    ) {
      params.set("page", "1");
    }

    router.push(`/admin/shop?${params.toString()}`);
  }

  function toggleSelectAll() {
    if (selectedIds.size === products.length) {
      setSelectedIds(new Set());
      return;
    }

    setSelectedIds(new Set(products.map((product) => product.id)));
  }

  function toggleSelect(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  }

  async function load() {
    setLoading(true);
    setError("");

    try {
      const query = new URLSearchParams(searchParams.toString());
      const response = await fetch(`/api/admin/shop/products?${query.toString()}`);
      if (response.status === 401) {
        setError("Unauthorized");
        return;
      }

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError((data as { error?: string }).error || "Не вдалося завантажити товари");
        return;
      }

      setProducts((data as { products?: ShopProductListItem[] }).products || []);
      if ((data as { metadata?: typeof metadata }).metadata) {
        const nextMetadata = (data as { metadata: typeof metadata }).metadata;
        setMetadata({
          ...nextMetadata,
          brands: Array.isArray(nextMetadata.brands) ? nextMetadata.brands : [],
        });
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setSearchInput(searchParam);
    setSelectedIds(new Set());
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, searchParam]);

  async function handleArchive(id: string) {
    const ok = await confirm({
      tone: "warning",
      title: "Архівувати цей товар?",
      description:
        "Товар буде знято з публікації та переведено в архів. Його можна буде відновити — це не повне видалення.",
      confirmLabel: "Архівувати",
    });
    if (!ok) return;

    setDeletingId(id);
    setSuccess("");
    setError("");

    try {
      const response = await fetch(`/api/admin/shop/products/${id}`, { method: "DELETE" });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const msg = (data as { error?: string }).error || "Archive failed";
        setError(msg);
        toast.error("Не вдалося архівувати товар", msg);
        return;
      }

      setSuccess("Товар архівовано.");
      toast.success("Товар архівовано");
      await load();
    } finally {
      setDeletingId(null);
    }
  }

  async function handleBulkStatus(status: "ACTIVE" | "DRAFT" | "ARCHIVED") {
    if (selectedIds.size === 0) {
      return;
    }

    setBulkUpdating(true);
    try {
      const response = await fetch("/api/admin/shop/products/bulk-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds), status }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError((data as { error?: string }).error || "Масова зміна статусу не вдалась");
        return;
      }

      setSelectedIds(new Set());
      await load();
    } finally {
      setBulkUpdating(false);
    }
  }

  const selectedCount = selectedIds.size;
  const selectionLabel =
    selectedCount === 0
      ? "Нічого не вибрано"
      : `${selectedCount} вибрано для масової зміни статусу.`;

  const availableBrands = useMemo(() => {
    const options = [...metadata.brands];
    if (brandParam !== "ALL" && !options.some((entry) => entry.brand === brandParam)) {
      options.unshift({ brand: brandParam, count: metadata.totalCount });
    }
    return options;
  }, [brandParam, metadata.brands, metadata.totalCount]);

  const activeFilterCount = [
    brandActive,
    statusParam !== "ALL",
    availabilityParam !== "ALL",
    Boolean(searchParam),
  ].filter(Boolean).length;

  // Build active filter chips
  const filterChips: FilterChip[] = [];
  if (brandActive) {
    filterChips.push({
      id: "brand",
      label: "Бренд",
      value: brandTheme.displayName,
      onRemove: () => updateParams({ brand: "ALL" }),
      tintHex: brandTheme.tintHex,
    });
  }
  if (statusParam !== "ALL") {
    filterChips.push({
      id: "status",
      label: "Статус",
      value: statusParam,
      onRemove: () => updateParams({ status: "ALL" }),
    });
  }
  if (availabilityParam !== "ALL") {
    filterChips.push({
      id: "stock",
      label: "Наявність",
      value: availabilityFilterLabel(availabilityParam),
      onRemove: () => updateParams({ stock: "ALL", availability: null }),
    });
  }
  if (searchParam) {
    filterChips.push({
      id: "search",
      label: "Пошук",
      value: `«${searchParam}»`,
      onRemove: () => {
        setSearchInput("");
        updateParams({ search: "" });
      },
    });
  }

  // Action buttons (rendered in either hero or page header)
  const headerActions = (
    <>
      <button
        type="button"
        onClick={() => void handleExport()}
        disabled={exporting}
        className="inline-flex items-center gap-2 rounded-none border border-white/10 bg-white/3 px-4 py-2.5 text-sm text-zinc-200 transition hover:bg-white/6 disabled:opacity-50"
      >
        <Download className="h-4 w-4" />
        {exporting ? "Експорт…" : "Експорт CSV"}
      </button>
      <Link
        href="/admin/shop/import"
        className="inline-flex items-center gap-2 rounded-none border border-white/10 bg-white/3 px-4 py-2.5 text-sm text-zinc-200 transition hover:bg-white/6"
      >
        <Upload className="h-4 w-4" />
        Імпорт
      </Link>
      <Link
        href="/admin/shop/new"
        className="inline-flex items-center gap-2 rounded-none bg-linear-to-b from-blue-500 to-blue-700 px-4 py-2.5 text-sm font-bold uppercase tracking-wider text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_2px_8px_rgba(59,130,246,0.4)] transition hover:from-blue-400 hover:to-blue-600"
      >
        <Plus className="h-4 w-4" />
        Новий товар
      </Link>
    </>
  );

  if (loading && products.length === 0) {
    return (
      <AdminPage wide className="space-y-6">
        <div role="status" aria-live="polite" aria-busy="true" className="space-y-6">
          <span className="sr-only">Завантаження каталогу…</span>
          <div className="flex flex-wrap items-end justify-between gap-4 pb-2">
            <div className="space-y-3">
              <div className="h-3 w-20 motion-safe:animate-pulse rounded-none bg-white/6" />
              <div className="h-9 w-72 motion-safe:animate-pulse rounded-none bg-white/6" />
              <div className="h-3.5 w-96 motion-safe:animate-pulse rounded-none bg-white/4" />
            </div>
            <div className="h-9 w-44 motion-safe:animate-pulse rounded-none bg-white/4" />
          </div>
          <AdminSkeletonKpiGrid count={4} />
          <AdminSkeletonTable rows={10} cols={6} />
        </div>
      </AdminPage>
    );
  }

  const thumbSize = DENSITY_THUMB_SIZE[density];
  const rowPad = DENSITY_ROW_PADDING[density];

  return (
    <AdminPage wide className="space-y-6">
      {brandActive ? (
        <AdminBrandHero
          brand={brandParam}
          onClearBrand={() => updateParams({ brand: "ALL" })}
          stats={[
            { label: "Усього", value: metadata.totalCount, tone: "accent" },
            { label: "Активні", value: visibleStats.active, tone: "success" },
            { label: "Чернетки", value: visibleStats.draft, tone: "warning" },
            { label: "Архів", value: visibleStats.archived, tone: "danger" },
            { label: "Опубліковано", value: visibleStats.published, tone: "default" },
          ]}
          actions={headerActions}
        />
      ) : (
        <AdminPageHeader
          eyebrow="Каталог"
          title="Товари"
          description={`${metadata.totalCount.toLocaleString("uk-UA")} товарів${
            filterChips.length ? " за фільтрами" : " у каталозі"
          }. Ціни показано так, як їх бачить покупець — у гривнях за поточним курсом.`}
          actions={headerActions}
        />
      )}

      <AdminFilterChips
        chips={filterChips}
        onClearAll={
          filterChips.length > 0
            ? () => {
                setSearchInput("");
                updateParams({
                  brand: "ALL",
                  status: "ALL",
                  stock: "ALL",
                  availability: null,
                  search: "",
                });
              }
            : undefined
        }
      />

      <AdminFilterBar
        collapsible
        collapsibleCount={activeFilterCount}
        primary={
          <label className="flex w-full min-w-0 items-center gap-2 rounded-none border border-white/10 bg-black/30 px-3.5 py-2.5 text-sm text-zinc-100">
            <Search className="h-4 w-4 shrink-0 text-zinc-500" />
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  updateParams({ search: searchInput });
                }
              }}
              placeholder="Назва, SKU, slug або бренд"
              className="w-full min-w-0 bg-transparent text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-hidden"
              aria-label="Пошук товарів"
            />
          </label>
        }
      >
        <label className="hidden min-w-0 flex-1 items-center gap-2 rounded-none border border-white/10 bg-black/30 px-3.5 py-2.5 text-sm text-zinc-100 md:flex md:min-w-[280px]">
          <Search className="h-4 w-4 shrink-0 text-zinc-500" />
          <input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                updateParams({ search: searchInput });
              }
            }}
            placeholder="Назва, SKU, slug або бренд"
            className="w-full min-w-0 bg-transparent text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-hidden"
            aria-label="Пошук товарів"
          />
        </label>

        <div className="flex w-full flex-wrap items-center gap-2 md:w-auto">
          <select
            value={statusParam}
            onChange={(event) => updateParams({ status: event.target.value })}
            className="min-w-0 flex-1 rounded-none border border-white/10 bg-black/30 px-3.5 py-2.5 text-sm text-zinc-100 focus:border-blue-500/30 focus:outline-hidden sm:flex-none"
            aria-label="Фільтр за статусом"
          >
            <option value="ALL">Усі статуси</option>
            <option value="ACTIVE">Активні</option>
            <option value="DRAFT">Чернетки</option>
            <option value="ARCHIVED">Архів</option>
          </select>

          <select
            value={availabilityParam}
            onChange={(event) => {
              const value = event.target.value as AvailabilityFilter;
              updateParams({
                availability: value === "confirmed" ? "confirmed" : null,
                stock: value === "outOfStock" ? "outOfStock" : "ALL",
              });
            }}
            className="min-w-0 flex-1 border border-white/10 bg-black/30 px-3.5 py-2.5 text-sm text-zinc-100 focus:border-blue-500/30 focus:outline-hidden sm:flex-none"
            aria-label="Фільтр за наявністю"
          >
            <option value="ALL">Уся наявність</option>
            <option value="confirmed">В наявності на сайті</option>
            <option value="outOfStock">Немає у постачальника</option>
          </select>

          <select
            value={brandParam}
            onChange={(event) => updateParams({ brand: event.target.value })}
            className="min-w-0 flex-1 rounded-none border border-white/10 bg-black/30 px-3.5 py-2.5 text-sm text-zinc-100 focus:border-blue-500/30 focus:outline-hidden sm:min-w-[190px] sm:flex-none"
            aria-label="Фільтр за брендом"
          >
            <option value="ALL">Усі бренди</option>
            {availableBrands.map(({ brand, count }) => (
              <option key={brand} value={brand}>
                {brand} · {count}
              </option>
            ))}
          </select>
        </div>

        <AdminDensityToggle className="ml-auto" value={density} onChange={setDensity} />
      </AdminFilterBar>

      {error ? <AdminInlineAlert tone="error">{error}</AdminInlineAlert> : null}
      {success ? <AdminInlineAlert tone="success">{success}</AdminInlineAlert> : null}

      {selectedCount > 0 ? (
        <AdminActionBar>
          <div className="space-y-1">
            <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">
              Панель масових дій
            </div>
            <div className="text-sm text-zinc-200">{selectionLabel}</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={bulkUpdating}
              onClick={() => handleBulkStatus("ACTIVE")}
              className="rounded-none border border-emerald-500/20 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-200 transition hover:bg-emerald-500/15 disabled:opacity-50"
            >
              {bulkUpdating ? "Оновлення…" : "Зробити активними"}
            </button>
            <button
              type="button"
              disabled={bulkUpdating}
              onClick={() => handleBulkStatus("DRAFT")}
              className="rounded-none border border-blue-500/25 bg-blue-500/8 px-4 py-2.5 text-sm text-blue-300 transition hover:bg-blue-500/12 disabled:opacity-50"
            >
              {bulkUpdating ? "Оновлення…" : "У чернетки"}
            </button>
            <button
              type="button"
              disabled={bulkUpdating}
              onClick={() => handleBulkStatus("ARCHIVED")}
              className="rounded-none border border-red-500/25 bg-red-950/30 px-4 py-2.5 text-sm text-red-200 transition hover:bg-red-950/45 disabled:opacity-50"
            >
              {bulkUpdating ? "Оновлення…" : "Архівувати"}
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="rounded-none border border-white/10 bg-white/3 px-4 py-2.5 text-sm text-zinc-300 transition hover:bg-white/6"
            >
              Очистити вибір
            </button>
          </div>
        </AdminActionBar>
      ) : null}

      {products.length === 0 ? (
        <AdminEmptyState
          title="Жоден товар не відповідає фільтрам"
          description="Спробуйте змінити фільтри, імпортувати CSV-партію або додати товар вручну, щоб заповнити каталог."
          action={
            <Link
              href="/admin/shop/new"
              className="inline-flex items-center gap-2 rounded-none bg-linear-to-b from-blue-500 to-blue-700 px-4 py-2.5 text-sm font-bold uppercase tracking-wider text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_2px_8px_rgba(59,130,246,0.4)] transition hover:from-blue-400 hover:to-blue-600"
            >
              <Plus className="h-4 w-4" />
              Створити товар
            </Link>
          }
        />
      ) : (
        <AdminResponsiveTable
          mobile={
            <div className="space-y-2">
              {products.map((product) => (
                <AdminMobileCard
                  key={product.id}
                  title={product.titleEn || product.titleUa}
                  subtitle={[product.brand, product.sku, product.slug].filter(Boolean).join(" · ")}
                  leading={
                    <AdminProductThumbnail
                      imageUrl={product.imageUrl}
                      brand={product.brand}
                      title={product.titleEn || product.titleUa}
                      size="sm"
                      tintHex={product.brand === brandParam ? brandTheme.tintHex : undefined}
                    />
                  }
                  badge={<SiteStatus product={product} />}
                  rows={[
                    { label: "Ціна для покупця", value: <PriceCell product={product} /> },
                    { label: "Наявність", value: <CustomerAvailabilityBadge product={product} /> },
                  ]}
                  footer={
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setQuickViewId(product.id)}
                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-none border border-blue-500/25 bg-blue-500/8 px-3 py-2.5 text-xs font-medium uppercase tracking-wider text-blue-300"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Швидкий перегляд
                      </button>
                      <Link
                        href={`/admin/shop/${product.id}`}
                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-none border border-white/8 bg-white/3 px-3 py-2.5 text-xs font-medium uppercase tracking-wider text-zinc-200"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Редагувати
                      </Link>
                    </div>
                  }
                />
              ))}
            </div>
          }
          desktop={
            <AdminTableShell>
              <table className="w-full min-w-[880px] table-fixed text-left text-sm">
                <thead className="bg-[#171717]">
                  <tr className="border-b border-white/10">
                    <th className="w-12 px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.size === products.length && products.length > 0}
                        onChange={toggleSelectAll}
                        className="border-white/20 bg-black/40 text-emerald-500"
                        aria-label="Вибрати всі рядки"
                      />
                    </th>
                    <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                      Товар
                    </th>
                    <th className="w-[150px] px-4 py-3 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                      Ціна для покупця
                    </th>
                    <th className="w-[150px] px-4 py-3 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                      Наявність на сайті
                    </th>
                    <th className="w-[130px] px-4 py-3 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                      На сайті
                    </th>
                    <th className="w-[110px] px-4 py-3 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                      Оновлено
                    </th>
                    <th className="w-[110px] bg-[#171717] px-4 py-3 text-right text-[11px] font-medium uppercase tracking-wider text-zinc-500 whitespace-nowrap">
                      Дії
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => {
                    const time = relativeTime(product.updatedAt);
                    const isSelected = selectedIds.has(product.id);
                    return (
                      <tr
                        key={product.id}
                        className={cn(
                          "group border-b border-white/4 align-top transition-colors",
                          isSelected ? "bg-blue-500/6" : "hover:bg-white/2.5"
                        )}
                      >
                        <td className={cn("px-4 align-middle", rowPad)}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(product.id)}
                            className="rounded-none border-white/20 bg-black/40 text-emerald-500"
                            aria-label={`Вибрати ${product.titleEn || product.titleUa}`}
                          />
                        </td>
                        <td className={cn("px-4", rowPad)}>
                          <button
                            type="button"
                            onClick={() => setQuickViewId(product.id)}
                            className="flex w-full items-start gap-3 text-left"
                          >
                            <AdminProductThumbnail
                              imageUrl={product.imageUrl}
                              brand={product.brand}
                              title={product.titleEn || product.titleUa}
                              size={thumbSize}
                              tintHex={
                                product.brand === brandParam ? brandTheme.tintHex : undefined
                              }
                            />
                            <div className="min-w-0 flex-1">
                              <div className="line-clamp-2 font-medium leading-snug text-zinc-50 transition group-hover:text-blue-200">
                                {product.titleEn || product.titleUa}
                              </div>
                              <div className="mt-0.5 truncate text-[12px] text-zinc-500">
                                {[product.brand, product.sku].filter(Boolean).join(" · ") || "—"}
                              </div>
                              {product.collectionHandles.length ? (
                                <div className="mt-2 flex flex-wrap gap-1">
                                  {product.collectionHandles.slice(0, 2).map((handle) => (
                                    <span
                                      key={handle}
                                      className="rounded-full border border-white/8 bg-white/3 px-2 py-0.5 text-[10px] text-zinc-400"
                                    >
                                      {handle}
                                    </span>
                                  ))}
                                  {product.collectionHandles.length > 2 ? (
                                    <span className="rounded-full border border-white/8 bg-white/3 px-2 py-0.5 text-[10px] text-zinc-500">
                                      +{product.collectionHandles.length - 2}
                                    </span>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>
                          </button>
                        </td>
                        <td className={cn("px-4", rowPad)}>
                          <PriceCell product={product} />
                        </td>
                        <td className={cn("px-4", rowPad)}>
                          <CustomerAvailabilityBadge product={product} />
                        </td>
                        <td className={cn("px-4", rowPad)}>
                          <SiteStatus product={product} />
                          {product.mediaCount === 0 && !product.imageUrl ? (
                            <div className="mt-1 text-[11px] text-amber-300/80">без фото</div>
                          ) : null}
                        </td>
                        <td className={cn("px-4 text-zinc-500", rowPad)} title={time.full}>
                          {time.label}
                        </td>
                        <td
                          className={cn(
                            "px-4 whitespace-nowrap",
                            rowPad,
                            isSelected
                              ? "bg-[#0F1B33]/45"
                              : "bg-[#171717]/45 group-hover:bg-[#1B1B1B]/45"
                          )}
                        >
                          <div className="flex items-center justify-end gap-1.5 opacity-80 transition-opacity group-hover:opacity-100">
                            <Link
                              href={`/admin/shop/${product.id}`}
                              className="rounded-none border border-white/10 p-2 text-zinc-300 transition hover:bg-white/6 hover:text-zinc-50"
                              title="Редагувати товар"
                            >
                              <Pencil className="h-4 w-4" />
                            </Link>
                            <button
                              type="button"
                              onClick={() => handleArchive(product.id)}
                              disabled={deletingId === product.id}
                              className="rounded-none border border-amber-500/30 bg-amber-500/6 p-2 text-amber-300 transition hover:border-amber-500/50 hover:bg-amber-500/[0.14] disabled:opacity-50"
                              title="Архівувати (м'яке видалення — можна відновити)"
                            >
                              <Trash2 className="h-4 w-4" aria-label="Архівувати" />
                            </button>
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
      )}

      <ProductQuickView
        productId={quickViewId}
        open={quickViewId !== null}
        onClose={() => setQuickViewId(null)}
      />

      <AdminPagination
        currentPage={metadata.currentPage}
        totalPages={metadata.totalPages}
        totalCount={metadata.totalCount}
        pageSize={metadata.limit}
        onPageChange={(page) => updateParams({ page })}
      />
    </AdminPage>
  );
}

export default function AdminShopPage() {
  return (
    <Suspense
      fallback={
        <AdminPage>
          <div className="text-sm text-zinc-400">Завантаження каталогу…</div>
        </AdminPage>
      }
    >
      <AdminShopPageContent />
    </Suspense>
  );
}

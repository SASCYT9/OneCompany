"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, LoaderCircle, RefreshCcw, TriangleAlert } from "lucide-react";
import {
  AdminActionBar,
  AdminInlineAlert,
  AdminMetricCard,
  AdminMetricGrid,
  AdminPage,
  AdminPageHeader,
} from "@/components/admin/AdminPrimitives";

type Preview = {
  source: {
    listedManufacturerSets: number;
    parsedManufacturerSets: number;
    verifiedWheelComponentPages: number;
    uniqueAvailableWheelOnlySets: number;
    excludedManufacturerPages: number;
    soldOutManufacturerPackages: number;
    uniqueSetsUnavailableOrUnconfirmed: number;
    fitmentRows: number;
    generatedAt: string;
    sample: Array<{
      slug: string;
      vehicle: string;
      front: string;
      rear: string;
      manufacturerGrossEur: number;
      accessoryOptions: number;
    }>;
  };
  priceRows: Array<{
    id: string;
    slug: string;
    sku: string;
    titleUa: string;
    sourceGrossEur: number | null;
    ukrainePriceUah: number;
    europeNetEur: number;
  }>;
  legacyWheelProducts: Array<{ id: string; sku: string | null; slug: string; titleUa: string; catalogVersion: string }>;
  stagedSetCount: number;
  activeSetCount: number;
  accessoryProductCount: number;
  missingAccessorySlugs: string[];
  batchLimit: number;
};

export default function WheelForceWheelSetsAdminPage() {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");
  const [completed, setCompleted] = useState(false);
  const [priceSearch, setPriceSearch] = useState("");
  const [savingPriceSlug, setSavingPriceSlug] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/shop/wheelforce-wheelsets", { cache: "no-store" });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Не вдалося завантажити попередній перегляд");
      setPreview(data as Preview);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Не вдалося завантажити попередній перегляд");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function postAction(action: string, payload: Record<string, unknown>) {
    const response = await fetch("/api/admin/shop/wheelforce-wheelsets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...payload }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.error || `Не вдалося виконати дію ${action}`);
    return data as Record<string, unknown>;
  }

  async function prepareCatalog() {
    if (!preview || running || preview.missingAccessorySlugs.length) return;
    setRunning(true);
    setCompleted(false);
    setError("");
    try {
      const total = preview.source.uniqueAvailableWheelOnlySets;
      const limit = preview.batchLimit;
      for (let offset = 0; offset < total; offset += limit) {
        const result = await postAction("stage", { offset, limit });
        const processed = Math.min(offset + Number(result.processed ?? limit), total);
        setProgress(`Підготовлено наборів: ${processed} / ${total}`);
      }

      const legacy = preview.legacyWheelProducts;
      for (let offset = 0; offset < legacy.length; offset += limit) {
        const ids = legacy.slice(offset, offset + limit).map((product) => product.id);
        const result = await postAction("archive_legacy_wheels", { ids });
        setProgress(`Приховано окремих дисків: ${Math.min(offset + ids.length, legacy.length)} / ${legacy.length}`);
        void result;
      }

      for (let offset = 0; offset < total; offset += limit) {
        const result = await postAction("publish", { offset, limit });
        const published = offset + Number(result.published ?? 0) + Number(result.alreadyPublished ?? 0);
        setProgress(`Опубліковано wheel-only наборів: ${Math.min(published, total)} / ${total}`);
      }
      setCompleted(true);
      setProgress(`Готово: ${total} комплектів 2+2; окремі диски приховані.`);
      await refresh();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Імпорт зупинився";
      await refresh();
      setError(message);
    } finally {
      setRunning(false);
    }
  }

  async function refreshDescriptions() {
    if (!preview || running || preview.activeSetCount === 0) return;
    setRunning(true);
    setCompleted(false);
    setError("");
    try {
      const total = preview.source.uniqueAvailableWheelOnlySets;
      const limit = Math.min(preview.batchLimit, 1);
      for (let offset = 0; offset < total; offset += limit) {
        const result = await postAction("refresh_copy", { offset, limit, deferOutbox: true });
        const refreshed = offset + Number(result.refreshed ?? 0);
        setProgress(`Оновлено дані комплектів: ${Math.min(refreshed, total)} / ${total}`);
      }
      const accessoryTotal = preview.accessoryProductCount;
      for (let offset = 0; offset < accessoryTotal; offset += 1) {
        await postAction("refresh_accessories", { offset, limit: 1, deferOutbox: true });
        setProgress(`Оновлено аксесуари: ${Math.min(offset + 1, accessoryTotal)} / ${accessoryTotal}`);
      }
      await postAction("finalize_refresh", {});
      setCompleted(true);
      setProgress(`Готово: оновлено ${total} комплектів і ${accessoryTotal} аксесуарів, зокрема назви, описи, категорії та ціни.`);
      await refresh();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Не вдалося оновити SEO-описи";
      await refresh();
      setError(message);
    } finally {
      setRunning(false);
    }
  }

  async function saveSetPrice(row: Preview["priceRows"][number]) {
    if (running || savingPriceSlug) return;
    const sourceGrossEur = Number(row.sourceGrossEur);
    if (!Number.isFinite(sourceGrossEur) || sourceGrossEur <= 0) {
      setError("Вкажіть коректну ціну виробника за комплект із чотирьох дисків.");
      return;
    }
    setSavingPriceSlug(row.slug);
    setCompleted(false);
    setError("");
    try {
      const result = await postAction("update_set_price", { slug: row.slug, sourceGrossEur });
      setPreview((current) => current ? {
        ...current,
        priceRows: current.priceRows.map((item) => item.slug === row.slug ? {
          ...item,
          sourceGrossEur: Number(result.sourceGrossEur),
          ukrainePriceUah: Number(result.priceUah),
          europeNetEur: Number(result.priceEurEurope),
        } : item),
      } : current);
      setProgress(`Збережено ${row.sku}: Європа €${Number(result.priceEurEurope).toLocaleString("uk-UA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} без ПДВ · Україна ${Number(result.priceUah).toLocaleString("uk-UA")} грн.`);
      setCompleted(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Не вдалося зберегти ціну комплекту");
    } finally {
      setSavingPriceSlug("");
    }
  }

  const filteredPriceRows = (preview?.priceRows ?? []).filter((row) =>
    `${row.titleUa} ${row.sku}`.toLocaleLowerCase("uk-UA").includes(priceSearch.trim().toLocaleLowerCase("uk-UA"))
  );

  return (
    <AdminPage>
      <AdminPageHeader
        eyebrow="WheelForce"
        title="Комплекти дисків для авто"
        description="Імпорт наборів із офіційних сторінок сумісності: передня пара + задня пара, без шин і монтажних послуг."
        actions={(
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={loading || running}
              className="inline-flex items-center gap-2 rounded-lg border border-foreground/15 px-3 py-2 text-xs font-semibold uppercase tracking-wider disabled:opacity-50"
            >
              <RefreshCcw className="h-3.5 w-3.5" /> Оновити
            </button>
            <Link href="/admin/shop" className="rounded-lg border border-foreground/15 px-3 py-2 text-xs font-semibold uppercase tracking-wider">
              До каталогу
            </Link>
          </div>
        )}
      />

      {error ? <AdminInlineAlert tone="error">{error}</AdminInlineAlert> : null}
      {completed ? <AdminInlineAlert tone="success"><span className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4" />{progress}</span></AdminInlineAlert> : null}
      {progress && !completed ? <AdminInlineAlert tone="warning">{progress}</AdminInlineAlert> : null}

      {loading || !preview ? (
        <div className="flex min-h-32 items-center justify-center text-sm text-foreground/50">
          <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> Завантажую каталог WheelForce…
        </div>
      ) : (
        <div className="space-y-6">
          <AdminMetricGrid>
            <AdminMetricCard label="Набори без шин" value={preview.source.uniqueAvailableWheelOnlySets} />
            <AdminMetricCard label="Fitment-записів" value={preview.source.fitmentRows.toLocaleString("uk-UA")} />
            <AdminMetricCard label="Окремі SKU дисків звірено" value={preview.source.verifiedWheelComponentPages} />
            <AdminMetricCard label="Окремих дисків буде приховано" value={preview.legacyWheelProducts.length} />
            <AdminMetricCard label="Уже опубліковано / підготовлено" value={`${preview.activeSetCount} / ${preview.stagedSetCount}`} />
            <AdminMetricCard label="Непідтверджені джерельні набори пропущено" value={preview.source.excludedManufacturerPages + preview.source.uniqueSetsUnavailableOrUnconfirmed} />
          </AdminMetricGrid>

          <section className="space-y-4 rounded-xl border border-foreground/10 bg-foreground/[0.02] p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wider">Ціни комплектів</h2>
                <p className="mt-1 text-xs text-foreground/60">
                  Введіть ціну WheelForce з ПДВ за весь комплект із 4 дисків. Українська ціна рахується як +10% за курсом сайту; європейська база зберігається без ПДВ, а checkout додає податок країни доставки.
                </p>
              </div>
              <input
                type="search"
                value={priceSearch}
                onChange={(event) => setPriceSearch(event.target.value)}
                placeholder="Пошук за авто або SKU"
                aria-label="Пошук комплекту за авто або SKU"
                className="min-h-10 w-full rounded-lg border border-foreground/15 bg-background px-3 text-sm sm:max-w-xs"
              />
            </div>
            <div className="space-y-3">
              {filteredPriceRows.map((row) => (
                <div key={row.id} className="grid gap-3 rounded-lg border border-foreground/10 bg-background p-3 sm:grid-cols-[minmax(0,1fr)_150px_160px_160px_auto] sm:items-center">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{row.titleUa}</p>
                    <p className="mt-1 break-all font-mono text-[11px] text-foreground/55">{row.sku}</p>
                    <p className="mt-1 text-[11px] text-foreground/50">Комплект 2 передні + 2 задні · ціна за 4 диски</p>
                  </div>
                  <label className="text-xs text-foreground/60">
                    Ціна WheelForce з ПДВ, €
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={row.sourceGrossEur ?? ""}
                      onChange={(event) => setPreview((current) => current ? {
                        ...current,
                        priceRows: current.priceRows.map((item) => item.slug === row.slug ? {
                          ...item,
                          sourceGrossEur: event.target.value === "" ? null : Number(event.target.value),
                        } : item),
                      } : current)}
                      className="mt-1 min-h-10 w-full rounded-md border border-foreground/15 bg-background px-2 font-mono text-sm text-foreground"
                    />
                  </label>
                  <div className="text-xs text-foreground/55">Європа net<p className="mt-1 font-mono text-sm text-foreground">€{row.europeNetEur.toLocaleString("uk-UA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p></div>
                  <div className="text-xs text-foreground/55">Україна<p className="mt-1 font-mono text-sm text-foreground">{row.ukrainePriceUah.toLocaleString("uk-UA")} грн</p></div>
                  <button
                    type="button"
                    onClick={() => void saveSetPrice(row)}
                    disabled={running || Boolean(savingPriceSlug)}
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-xs font-semibold uppercase tracking-wider text-primary-foreground disabled:opacity-50"
                  >
                    {savingPriceSlug === row.slug ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                    Зберегти
                  </button>
                </div>
              ))}
              {!filteredPriceRows.length ? <p className="py-5 text-center text-sm text-foreground/55">Комплектів за цим пошуком не знайдено.</p> : null}
            </div>
          </section>

          <section className="rounded-xl border border-foreground/10 bg-foreground/[0.02] p-4 sm:p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wider">Приклад набору</h2>
            <div className="mt-3 space-y-2">
              {preview.source.sample.map((item) => (
                <div key={item.slug} className="grid gap-1 border-t border-foreground/8 py-3 text-sm sm:grid-cols-[minmax(0,1.5fr)_1fr_1fr_auto] sm:items-center">
                  <span className="font-medium">{item.vehicle || "WheelForce"}</span>
                  <span className="text-foreground/65">Передні: {item.front}</span>
                  <span className="text-foreground/65">Задні: {item.rear}</span>
                  <span className="font-mono">€{item.manufacturerGrossEur.toLocaleString("en-US")}</span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-foreground/55">
              Ціна набору складається з чотирьох дисків. Європейська база зберігає виробничу ціну без німецького ПДВ; checkout додає ПДВ країни доставки. Українська ціна враховує +10% і курс сайту.
            </p>
          </section>

          {preview.missingAccessorySlugs.length ? (
            <AdminInlineAlert tone="error">
              Не всі аксесуари з конфігуратора є в каталозі: {preview.missingAccessorySlugs.join(", ")}
            </AdminInlineAlert>
          ) : null}

          <AdminActionBar>
            <div className="min-w-0">
              <p className="text-sm font-semibold">Каталог наборів WheelForce</p>
              <p className="mt-1 text-xs text-foreground/55">
                Набори 2+2 без шин і монтажу. Окремі SKU передніх і задніх дисків наведені в описі; SEO-текст описує розміри та сумісні автомобілі.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void refreshDescriptions()}
                disabled={running || loading || preview.activeSetCount === 0}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-foreground/20 px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.1em] disabled:opacity-45"
              >
                {running ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                Оновити описи, фільтри й ціни
              </button>
              <button
                type="button"
                onClick={() => void prepareCatalog()}
                disabled={running || loading || Boolean(preview.missingAccessorySlugs.length) || preview.source.uniqueAvailableWheelOnlySets === 0}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-primary-foreground disabled:opacity-45"
              >
                {running ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {running ? "Виконую…" : preview.activeSetCount ? "Синхронізувати набори" : "Підготувати й опублікувати"}
              </button>
            </div>
          </AdminActionBar>
        </div>
      )}
    </AdminPage>
  );
}

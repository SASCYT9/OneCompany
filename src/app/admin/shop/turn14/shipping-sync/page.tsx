"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  Loader2,
  PackageSearch,
  Play,
  RefreshCw,
} from "lucide-react";

import {
  AdminButton,
  AdminCardSection,
  AdminInlineAlert,
  AdminMetricCard,
  AdminMetricGrid,
  AdminPage,
  AdminPageHeader,
  AdminStatusBadge,
  AdminSwitch,
  AdminTableShell,
} from "@/components/admin/AdminPrimitives";

type Brand = { brand: string; productCount: number; turn14BrandId: string | null };

type Dims = {
  weightKg: number | null;
  lengthCm: number | null;
  widthCm: number | null;
  heightCm: number | null;
};

type Change = {
  variantId: string;
  sku: string | null;
  productTitle: string;
  before: Dims;
  after: Dims;
  source: "turn14" | "perplexity";
};

type SyncResult = {
  brandName: string;
  turn14BrandId: string | null;
  variantsScanned: number;
  variantsMatched: number;
  variantsUpdated: number;
  variantsSkippedAlreadyHave: number;
  variantsNoTurn14Match: number;
  variantsNoDimsInTurn14: number;
  perplexityFallbackQueued: number;
  changes: Change[];
  unmatched: Array<{ variantId: string; sku: string | null; reason: string }>;
  dryRun: boolean;
  durationMs: number;
};

type PerplexityBlock = {
  attempted: number;
  resolved: number;
  changes: Change[];
  skips: Array<{ variantId: string; reason: string; detail?: string }>;
};

type ApiResponse = {
  success: boolean;
  result?: SyncResult;
  perplexity?: PerplexityBlock | null;
  error?: string;
};

function fmtNum(n: number | null): string {
  if (n === null || n === undefined) return "—";
  return n.toFixed(2);
}

function fmtDims(d: Dims): string {
  return `${fmtNum(d.weightKg)}кг · ${fmtNum(d.lengthCm)}×${fmtNum(d.widthCm)}×${fmtNum(d.heightCm)}см`;
}

export default function Turn14ShippingSyncPage() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loadingBrands, setLoadingBrands] = useState(true);
  const [brandFilter, setBrandFilter] = useState("");
  const [selectedBrand, setSelectedBrand] = useState<string>("");

  const [refreshExisting, setRefreshExisting] = useState(false);
  const [perplexityFallback, setPerplexityFallback] = useState(false);

  const [running, setRunning] = useState(false);
  const [lastResponse, setLastResponse] = useState<ApiResponse | null>(null);
  const [lastWasDryRun, setLastWasDryRun] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBrands = useCallback(async () => {
    setLoadingBrands(true);
    try {
      const res = await fetch("/api/admin/shop/turn14/sync-dimensions");
      const data = await res.json();
      if (data.success) setBrands(data.brands || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingBrands(false);
    }
  }, []);

  useEffect(() => {
    fetchBrands();
  }, [fetchBrands]);

  const filteredBrands = useMemo(() => {
    const q = brandFilter.trim().toLowerCase();
    if (!q) return brands;
    return brands.filter((b) => b.brand.toLowerCase().includes(q));
  }, [brands, brandFilter]);

  async function runSync(apply: boolean) {
    if (!selectedBrand) return;
    setRunning(true);
    setError(null);
    if (!apply) setLastResponse(null);
    try {
      const res = await fetch("/api/admin/shop/turn14/sync-dimensions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand: selectedBrand,
          apply,
          refreshExisting,
          perplexityFallback,
        }),
      });
      const data: ApiResponse = await res.json();
      if (!data.success) {
        setError(data.error || "sync failed");
        return;
      }
      setLastResponse(data);
      setLastWasDryRun(!apply);
    } catch (e) {
      setError(e instanceof Error ? e.message : "unknown error");
    } finally {
      setRunning(false);
    }
  }

  const result = lastResponse?.result;
  const perplexity = lastResponse?.perplexity;
  const previewReady = !!result && lastWasDryRun;
  const totalChanges = (result?.changes.length || 0) + (perplexity?.changes.length || 0);

  return (
    <AdminPage>
      <AdminPageHeader
        eyebrow="Turn14"
        title="Sync габаритів доставки"
        description="Тягне ТІЛЬКИ weight/L/W/H/grams з Turn14 для брендів магазину. Не торкається тайтлів, описів, зображень. За замовчуванням — dry-run preview, потім явний Apply."
        actions={
          <AdminButton
            variant="ghost"
            icon={<RefreshCw />}
            onClick={fetchBrands}
            disabled={loadingBrands}
          >
            Оновити список брендів
          </AdminButton>
        }
      />

      <AdminInlineAlert tone="warning" className="mt-4">
        <strong>Безпекове правило:</strong> цей інструмент НЕ перезаписує контент товарів. Поля, що
        оновлюються:{" "}
        <code>weight, length, width, height, grams, isDimensionsEstimated, turn14Id</code>. Все інше
        захищене на рівні бібліотеки.
      </AdminInlineAlert>

      <div className="mt-6 grid gap-6 lg:grid-cols-[360px_1fr]">
        {/* ─── Sidebar: brand picker + options ─── */}
        <div className="space-y-4">
          <AdminCardSection
            title="Бренд"
            description="Список брендів, які реально є в магазині. Інші бренди Turn14 не показуються."
          >
            <input
              type="text"
              placeholder="Пошук бренду…"
              value={brandFilter}
              onChange={(e) => setBrandFilter(e.target.value)}
              className="mb-3 w-full rounded-none border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-blue-500/40 focus:outline-hidden"
            />
            <div className="max-h-[420px] overflow-y-auto border border-white/6">
              {loadingBrands ? (
                <div className="flex items-center justify-center py-12 text-zinc-500">
                  <Loader2 className="h-5 w-5 motion-safe:animate-spin" />
                </div>
              ) : filteredBrands.length === 0 ? (
                <div className="px-3 py-6 text-center text-sm text-zinc-500">
                  Брендів не знайдено
                </div>
              ) : (
                filteredBrands.map((b) => (
                  <button
                    key={b.brand}
                    onClick={() => setSelectedBrand(b.brand)}
                    className={`flex w-full items-center justify-between border-b border-white/4 px-3 py-2 text-left text-sm transition-colors last:border-b-0 ${
                      selectedBrand === b.brand
                        ? "bg-blue-500/10 text-blue-100"
                        : "text-zinc-300 hover:bg-white/3 hover:text-zinc-100"
                    }`}
                    title={
                      b.turn14BrandId
                        ? `Замаплено на Turn14 brandId=${b.turn14BrandId} (з Turn14BrandMarkup)`
                        : "Немає у Turn14BrandMarkup. Sync спробує exact + substring пошук."
                    }
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      {b.turn14BrandId ? (
                        <span className="shrink-0 rounded-sm bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-emerald-300">
                          T14
                        </span>
                      ) : (
                        <span className="shrink-0 rounded-sm bg-white/4 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-zinc-500">
                          ?
                        </span>
                      )}
                      <span className="truncate">{b.brand}</span>
                    </span>
                    <span className="ml-3 shrink-0 text-[10px] uppercase tracking-wider text-zinc-500">
                      {b.productCount} товарів
                    </span>
                  </button>
                ))
              )}
            </div>
          </AdminCardSection>

          <AdminCardSection
            title="Параметри"
            description="Безпечні дефолти. Apply робить запис у БД."
          >
            <div className="space-y-4">
              <AdminSwitch
                checked={refreshExisting}
                onChange={setRefreshExisting}
                label="Оновити існуючі розміри"
                description="За замовчуванням — заповнюємо тільки порожні поля. Увімкни, щоб перезаписати наявні."
              />
              <AdminSwitch
                checked={perplexityFallback}
                onChange={setPerplexityFallback}
                label="Perplexity-фолбек"
                description="Для варіантів, яких нема в Turn14 — шукаємо в Perplexity (макс 5 за запит). Помітимо як 'estimated'. Потрібен PERPLEXITY_API_KEY."
              />
            </div>
          </AdminCardSection>

          <AdminCardSection title="Запуск">
            <div className="flex flex-col gap-2">
              <AdminButton
                variant="secondary"
                icon={<Eye />}
                disabled={!selectedBrand || running}
                loading={running && lastWasDryRun}
                onClick={() => runSync(false)}
              >
                Preview (dry-run)
              </AdminButton>
              <AdminButton
                variant="primary"
                icon={<Play />}
                disabled={!previewReady || running || totalChanges === 0}
                loading={running && !lastWasDryRun}
                onClick={() => runSync(true)}
              >
                Apply changes ({totalChanges})
              </AdminButton>
              {!previewReady && selectedBrand ? (
                <p className="text-[11px] text-zinc-500">
                  Спочатку зроби Preview, щоб побачити що оновиться.
                </p>
              ) : null}
            </div>
          </AdminCardSection>
        </div>

        {/* ─── Main: results ─── */}
        <div className="space-y-4">
          {error ? (
            <AdminInlineAlert tone="error">
              <AlertTriangle className="mr-2 inline h-4 w-4" />
              {error}
            </AdminInlineAlert>
          ) : null}

          {!result && !running ? (
            <AdminCardSection title="Очікую запуск" description="Обери бренд і натисни Preview.">
              <div className="flex h-40 items-center justify-center text-zinc-600">
                <PackageSearch className="h-10 w-10" />
              </div>
            </AdminCardSection>
          ) : null}

          {running && !result ? (
            <AdminCardSection
              title="Виконується…"
              description="Звертаємось до Turn14 та порівнюємо з варіантами в магазині."
            >
              <div className="flex h-40 items-center justify-center text-zinc-500">
                <Loader2 className="h-8 w-8 motion-safe:animate-spin" />
              </div>
            </AdminCardSection>
          ) : null}

          {result && result.turn14BrandId === null ? (
            <AdminInlineAlert tone="warning">
              <AlertTriangle className="mr-2 inline h-4 w-4" />
              Бренд <strong>{result.brandName}</strong> не знайдено в Turn14 (ні в локальній мапі{" "}
              <code>Turn14BrandMarkup</code>, ні через substring-пошук). Перевір назву бренду в
              каталозі Turn14 і додай маппінг через <code>/admin/shop/turn14/markups</code>.
            </AdminInlineAlert>
          ) : null}

          {result ? (
            <>
              <AdminMetricGrid>
                <AdminMetricCard
                  label="Просканировано варіантів"
                  value={String(result.variantsScanned)}
                />
                <AdminMetricCard label="Знайдено в Turn14" value={String(result.variantsMatched)} />
                <AdminMetricCard
                  label={lastWasDryRun ? "Буде оновлено" : "Оновлено"}
                  value={String(lastWasDryRun ? result.changes.length : result.variantsUpdated)}
                  tone={lastWasDryRun ? "default" : "accent"}
                />
                <AdminMetricCard
                  label="Тривалість"
                  value={`${(result.durationMs / 1000).toFixed(1)}с`}
                />
              </AdminMetricGrid>

              <AdminCardSection
                title={lastWasDryRun ? "Preview змін" : "Застосовані зміни"}
                description={
                  lastWasDryRun
                    ? "Нічого не записано в БД. Натисни Apply, щоб закріпити."
                    : "Дані записані в БД. Оновлено тільки поля доставки."
                }
                action={
                  <AdminStatusBadge tone={lastWasDryRun ? "default" : "success"}>
                    {lastWasDryRun ? (
                      "DRY-RUN"
                    ) : (
                      <>
                        <CheckCircle2 className="mr-1 inline h-3 w-3" /> APPLIED
                      </>
                    )}
                  </AdminStatusBadge>
                }
              >
                {result.changes.length === 0 && (perplexity?.changes.length ?? 0) === 0 ? (
                  <p className="py-6 text-center text-sm text-zinc-500">Немає змін.</p>
                ) : (
                  <AdminTableShell>
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-white/6 bg-white/2 text-[10px] uppercase tracking-[0.15em] text-zinc-500">
                          <th className="px-4 py-3 font-medium">Товар</th>
                          <th className="px-4 py-3 font-medium">SKU</th>
                          <th className="px-4 py-3 font-medium">Було</th>
                          <th className="px-4 py-3 font-medium">Стане</th>
                          <th className="px-4 py-3 font-medium">Джерело</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/4">
                        {[...result.changes, ...(perplexity?.changes || [])].map((c) => (
                          <tr key={c.variantId} className="text-zinc-300">
                            <td className="px-4 py-2.5">{c.productTitle}</td>
                            <td className="px-4 py-2.5 font-mono text-xs text-zinc-400">
                              {c.sku || "—"}
                            </td>
                            <td className="px-4 py-2.5 text-zinc-500">{fmtDims(c.before)}</td>
                            <td className="px-4 py-2.5 text-emerald-300">{fmtDims(c.after)}</td>
                            <td className="px-4 py-2.5">
                              <AdminStatusBadge
                                tone={c.source === "turn14" ? "success" : "warning"}
                              >
                                {c.source}
                              </AdminStatusBadge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </AdminTableShell>
                )}
              </AdminCardSection>

              {result.unmatched.length > 0 ? (
                <AdminCardSection
                  title={`Не знайдено в Turn14 (${result.unmatched.length})`}
                  description="Потрібен Perplexity-фолбек або ручне оновлення."
                >
                  <AdminTableShell>
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-white/6 bg-white/2 text-[10px] uppercase tracking-[0.15em] text-zinc-500">
                          <th className="px-4 py-3 font-medium">SKU</th>
                          <th className="px-4 py-3 font-medium">Причина</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/4">
                        {result.unmatched.slice(0, 50).map((u) => (
                          <tr key={u.variantId} className="text-zinc-400">
                            <td className="px-4 py-2 font-mono text-xs">{u.sku || "—"}</td>
                            <td className="px-4 py-2 text-zinc-500">{u.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </AdminTableShell>
                  {result.unmatched.length > 50 ? (
                    <p className="mt-2 text-[11px] text-zinc-500">
                      Показано перші 50 з {result.unmatched.length}.
                    </p>
                  ) : null}
                </AdminCardSection>
              ) : null}

              {perplexity && perplexity.skips.length > 0 ? (
                <AdminCardSection
                  title="Perplexity skips"
                  description="Чому фолбек не дав даних для частини варіантів."
                >
                  <AdminTableShell>
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-white/6 bg-white/2 text-[10px] uppercase tracking-[0.15em] text-zinc-500">
                          <th className="px-4 py-3 font-medium">Variant ID</th>
                          <th className="px-4 py-3 font-medium">Причина</th>
                          <th className="px-4 py-3 font-medium">Деталі</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/4">
                        {perplexity.skips.map((s) => (
                          <tr key={s.variantId} className="text-zinc-400">
                            <td className="px-4 py-2 font-mono text-xs">{s.variantId}</td>
                            <td className="px-4 py-2">{s.reason}</td>
                            <td className="px-4 py-2 text-zinc-500">{s.detail || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </AdminTableShell>
                </AdminCardSection>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </AdminPage>
  );
}

"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowUpRight, Search, Trash2 } from "lucide-react";

import {
  AdminButton,
  AdminInlineAlert,
  AdminPage,
  AdminPageHeader,
  AdminTableShell,
} from "@/components/admin/AdminPrimitives";
import { useToast } from "@/components/admin/AdminToast";
import { useB2bBrandOptions, type B2bBrandOption } from "@/components/admin/b2b/B2bBrandSelect";
import {
  normalizeShopBrandKey,
  SHOP_B2B_DISCOUNT_SOURCE_LABELS,
  type ShopB2bDiscountSource,
} from "@/lib/shopB2bBrandDiscounts";
import { cn } from "@/lib/utils";

type SystemDiscount = {
  brand: string;
  discountPct: number;
  notes: string | null;
  updatedAt: string;
};

type Partner = {
  id: string;
  name: string;
  companyName: string | null;
  email: string;
  placeholderEmail: boolean;
  b2bDiscountPercent: number | null;
  brandDiscounts: Array<{ brand: string; discountPct: number }>;
  canSignIn: boolean;
  lastLoginAt: string | null;
};

type Money = { eur: number; usd: number; uah: number };

type PriceCheckItem = {
  slug: string;
  title: string;
  sku: string | null;
  brand: string | null;
  image: string | null;
  retail: Money;
  partner: Money;
  discountPercent: number;
  priceSource: "b2c" | "b2b-explicit" | "b2b-discount";
  rule: ShopB2bDiscountSource;
};

const TABS = [
  { key: "brands", label: "Знижки брендів" },
  { key: "partners", label: "Партнери" },
  { key: "check", label: "Перевірка ціни" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

const inputClass =
  "h-9 rounded-none border border-white/10 bg-black/40 px-3 text-sm text-white placeholder:text-zinc-600 focus:border-blue-500/60 focus:outline-hidden";

function formatPct(value: number) {
  return `${Number.isInteger(value) ? value : value.toFixed(2)}%`;
}

function formatMoney(amount: number, currency: "UAH" | "EUR") {
  if (!(amount > 0)) return "—";
  return new Intl.NumberFormat("uk-UA", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "UAH" ? 0 : 2,
  }).format(amount);
}

function partnerLabel(partner: Partner) {
  return partner.companyName && partner.companyName !== partner.name
    ? `${partner.companyName} · ${partner.name}`
    : partner.companyName || partner.name;
}

async function readJson<T>(response: Response): Promise<T> {
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(data.error || "Запит не вдався");
  return data;
}

function initialTab(value: string | null): TabKey {
  return TABS.some((entry) => entry.key === value) ? (value as TabKey) : "brands";
}

export default function AdminB2bPricingPage() {
  return (
    <Suspense fallback={null}>
      <AdminB2bPricingContent />
    </Suspense>
  );
}

function AdminB2bPricingContent() {
  const toast = useToast();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<TabKey>(() => initialTab(searchParams.get("tab")));
  const initialPartnerId = searchParams.get("customer") ?? "";
  const { brands, loading: brandsLoading, error: brandsError } = useB2bBrandOptions();
  const [discounts, setDiscounts] = useState<SystemDiscount[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [discountData, partnerData] = await Promise.all([
        fetch("/api/admin/shop/b2b/brand-discounts", { cache: "no-store" }).then((response) =>
          readJson<{ discounts: SystemDiscount[] }>(response)
        ),
        fetch("/api/admin/shop/b2b/partners", { cache: "no-store" }).then((response) =>
          readJson<{ partners: Partner[] }>(response)
        ),
      ]);
      setDiscounts(discountData.discounts ?? []);
      setPartners(partnerData.partners ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не вдалося завантажити дані");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const cannotSignIn = partners.filter((partner) => !partner.canSignIn).length;

  return (
    <AdminPage>
      <AdminPageHeader
        eyebrow="Клієнти"
        title="B2B-знижки"
        description="Знижки партнерам на конкретні бренди. Сайт, кошик, замовлення й проформи рахують ціну партнера за цими правилами однаково."
      />

      <div className="mt-4 flex flex-wrap gap-px border border-white/10 bg-white/10" role="tablist">
        {TABS.map((entry) => (
          <button
            key={entry.key}
            type="button"
            role="tab"
            aria-selected={tab === entry.key}
            onClick={() => setTab(entry.key)}
            className={cn(
              "flex-1 px-4 py-2.5 text-[13px] font-medium transition sm:flex-none",
              tab === entry.key
                ? "bg-blue-600 text-white"
                : "bg-[#151515] text-zinc-300 hover:bg-[#1c1c1c] hover:text-white"
            )}
          >
            {entry.label}
            {entry.key === "partners" && partners.length ? (
              <span className="ml-1.5 text-white/60">{partners.length}</span>
            ) : null}
          </button>
        ))}
      </div>

      {error ? (
        <div className="mt-4">
          <AdminInlineAlert tone="error">{error}</AdminInlineAlert>
        </div>
      ) : null}
      {brandsError ? (
        <div className="mt-4">
          <AdminInlineAlert tone="error">{brandsError}</AdminInlineAlert>
        </div>
      ) : null}

      <div className="mt-5">
        {tab === "brands" ? (
          <BrandDiscountsTab
            brands={brands}
            brandsLoading={brandsLoading || loading}
            discounts={discounts}
            partners={partners}
            onSaved={(next) => {
              setDiscounts(next);
              toast.success("Знижку збережено");
            }}
            onError={(message) => toast.error(message)}
          />
        ) : null}
        {tab === "partners" ? (
          <PartnersTab partners={partners} loading={loading} cannotSignIn={cannotSignIn} />
        ) : null}
        {tab === "check" ? (
          <PriceCheckTab
            partners={partners}
            loading={loading}
            initialPartnerId={initialPartnerId}
          />
        ) : null}
      </div>
    </AdminPage>
  );
}

function BrandDiscountsTab({
  brands,
  brandsLoading,
  discounts,
  partners,
  onSaved,
  onError,
}: {
  brands: B2bBrandOption[];
  brandsLoading: boolean;
  discounts: SystemDiscount[];
  partners: Partner[];
  onSaved: (discounts: SystemDiscount[]) => void;
  onError: (message: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const ruleByKey = useMemo(
    () => new Map(discounts.map((row) => [normalizeShopBrandKey(row.brand), row])),
    [discounts]
  );
  const partnersByBrand = useMemo(() => {
    const map = new Map<string, Partner[]>();
    for (const partner of partners) {
      for (const rule of partner.brandDiscounts) {
        const key = normalizeShopBrandKey(rule.brand);
        map.set(key, [...(map.get(key) ?? []), partner]);
      }
    }
    return map;
  }, [partners]);
  const brandKeys = useMemo(
    () => new Set(brands.map((option) => normalizeShopBrandKey(option.brand))),
    [brands]
  );
  // Rules whose brand no published product carries never apply on the site.
  const orphanRules = brandsLoading
    ? []
    : discounts.filter((row) => !brandKeys.has(normalizeShopBrandKey(row.brand)));

  const needle = query.trim().toLowerCase();
  const rows = brands.filter((option) => !needle || option.brand.toLowerCase().includes(needle));

  async function refresh() {
    const data = await fetch("/api/admin/shop/b2b/brand-discounts", { cache: "no-store" }).then(
      (response) => readJson<{ discounts: SystemDiscount[] }>(response)
    );
    onSaved(data.discounts ?? []);
  }

  /** An empty value removes the brand rule. */
  async function save(brand: string, value: string) {
    const key = normalizeShopBrandKey(brand);
    const raw = value.trim().replace(",", ".");
    setSavingKey(key);
    try {
      if (raw === "") {
        const response = await fetch(
          `/api/admin/shop/b2b/brand-discounts?brand=${encodeURIComponent(brand)}`,
          { method: "DELETE" }
        );
        await readJson(response);
      } else {
        const response = await fetch("/api/admin/shop/b2b/brand-discounts", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ brand, discountPct: Number(raw) }),
        });
        await readJson(response);
      }
      setDrafts((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
      await refresh();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Не вдалося зберегти");
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <div className="space-y-4">
      <p className="max-w-3xl text-[13px] leading-5 text-zinc-400">
        Знижка в цьому списку діє для <span className="text-zinc-200">всіх</span> B2B-партнерів. Щоб
        дати одному партнеру іншу знижку на бренд — задайте її на картці партнера: вона важливіша за
        цю. Порожнє поле — знижки на бренд немає.
      </p>

      {orphanRules.length ? (
        <AdminInlineAlert tone="warning">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              Ці знижки не діють — серед товарів немає такого бренду:{" "}
              {orphanRules.map((row, index) => (
                <span key={row.brand}>
                  {index ? ", " : ""}
                  <button
                    type="button"
                    className="underline decoration-dotted underline-offset-2 hover:text-white"
                    onClick={() => void save(row.brand, "")}
                  >
                    {row.brand} −{formatPct(row.discountPct)} (видалити)
                  </button>
                </span>
              ))}
            </div>
          </div>
        </AdminInlineAlert>
      ) : null}

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Знайти бренд"
          className={cn(inputClass, "w-full pl-9")}
        />
      </div>

      <AdminTableShell>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/3 text-[11px] uppercase tracking-[0.14em] text-zinc-500">
                <th className="px-4 py-3 font-medium">Бренд</th>
                <th className="px-4 py-3 text-right font-medium">Товарів</th>
                <th className="px-4 py-3 font-medium">Знижка для всіх партнерів</th>
                <th className="px-4 py-3 font-medium">Свої умови в партнерів</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/6">
              {brandsLoading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-zinc-500">
                    Завантаження…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-zinc-500">
                    Бренд не знайдено.
                  </td>
                </tr>
              ) : (
                rows.map((option) => {
                  const key = normalizeShopBrandKey(option.brand);
                  const rule = ruleByKey.get(key);
                  const saved = rule ? String(rule.discountPct) : "";
                  const draft = drafts[key];
                  const value = draft ?? saved;
                  const dirty = draft != null && draft.trim().replace(",", ".") !== saved;
                  const own = partnersByBrand.get(key) ?? [];
                  return (
                    <tr key={option.brand} className="transition hover:bg-white/2">
                      <td className="px-4 py-2.5 font-medium text-zinc-100">{option.brand}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-zinc-400">
                        {option.productCount}
                      </td>
                      <td className="px-4 py-2.5">
                        <form
                          className="flex items-center gap-2"
                          onSubmit={(event) => {
                            event.preventDefault();
                            if (dirty) void save(rule?.brand ?? option.brand, value);
                          }}
                        >
                          <div className="relative w-28">
                            <input
                              type="number"
                              inputMode="decimal"
                              min={0}
                              max={100}
                              step={0.5}
                              value={value}
                              placeholder="—"
                              aria-label={`Знижка на ${option.brand} для всіх партнерів, %`}
                              onChange={(event) =>
                                setDrafts((current) => ({ ...current, [key]: event.target.value }))
                              }
                              className={cn(
                                inputClass,
                                "w-full pr-7 text-right tabular-nums",
                                rule && !dirty && "border-emerald-500/30 text-emerald-200"
                              )}
                            />
                            <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-zinc-500">
                              %
                            </span>
                          </div>
                          {dirty ? (
                            <>
                              <AdminButton
                                type="submit"
                                size="sm"
                                variant="primary"
                                loading={savingKey === key}
                              >
                                {value.trim() === "" ? "Прибрати" : "Зберегти"}
                              </AdminButton>
                              <AdminButton
                                size="sm"
                                variant="ghost"
                                onClick={() =>
                                  setDrafts((current) => {
                                    const next = { ...current };
                                    delete next[key];
                                    return next;
                                  })
                                }
                              >
                                Скасувати
                              </AdminButton>
                            </>
                          ) : rule ? (
                            <button
                              type="button"
                              title="Прибрати знижку"
                              aria-label={`Прибрати знижку на ${option.brand}`}
                              disabled={savingKey === key}
                              onClick={() => void save(rule.brand, "")}
                              className="p-1.5 text-zinc-500 transition hover:text-red-300 disabled:opacity-50"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          ) : null}
                        </form>
                      </td>
                      <td className="px-4 py-2.5 text-[13px] text-zinc-400">
                        {own.length ? (
                          <span title={own.map(partnerLabel).join("\n")}>
                            {own.length === 1 ? partnerLabel(own[0]!) : `${own.length} партнери`}
                          </span>
                        ) : (
                          <span className="text-zinc-600">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </AdminTableShell>
    </div>
  );
}

function PartnersTab({
  partners,
  loading,
  cannotSignIn,
}: {
  partners: Partner[];
  loading: boolean;
  cannotSignIn: number;
}) {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const placeholderCount = partners.filter(
    (partner) => !partner.canSignIn && partner.placeholderEmail
  ).length;
  const rows = partners.filter(
    (partner) =>
      !needle ||
      [partner.name, partner.companyName, partner.email]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(needle))
  );

  return (
    <div className="space-y-4">
      {cannotSignIn ? (
        <AdminInlineAlert tone="warning">
          {cannotSignIn} з {partners.length} партнерів не можуть увійти на сайт, тож бачать
          роздрібні ціни.
          {placeholderCount ? (
            <>
              {" "}
              У {placeholderCount} з них пошта-заглушка з CRM (…@crm.onecompany.local): спершу
              вкажіть на картці справжній email партнера, потім створіть посилання для пароля — його
              можна переслати в месенджер.
            </>
          ) : (
            <>
              {" "}
              Створіть посилання для пароля на картці партнера — його можна переслати в месенджер.
            </>
          )}
        </AdminInlineAlert>
      ) : null}

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Партнер, компанія або email"
          className={cn(inputClass, "w-full pl-9")}
        />
      </div>

      <AdminTableShell>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] table-fixed text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/3 text-[11px] uppercase tracking-[0.14em] text-zinc-500">
                <th className="w-[30%] px-4 py-3 font-medium">Партнер</th>
                <th className="px-4 py-3 font-medium">Свої знижки на бренди</th>
                <th className="w-[140px] px-4 py-3 font-medium">Вхід на сайт</th>
                <th className="w-[100px] px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/6">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-zinc-500">
                    Завантаження…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-zinc-500">
                    Партнерів не знайдено.
                  </td>
                </tr>
              ) : (
                rows.map((partner) => (
                  <tr key={partner.id} className="align-top transition hover:bg-white/2">
                    <td className="px-4 py-3">
                      <div className="font-medium text-zinc-100">
                        {partner.companyName || partner.name}
                      </div>
                      <div className="break-all text-xs text-zinc-500">
                        {partner.companyName && partner.companyName !== partner.name
                          ? `${partner.name} · `
                          : ""}
                        {partner.email}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {partner.brandDiscounts.length ? (
                        <div className="flex flex-wrap gap-1.5">
                          {partner.brandDiscounts.map((rule) => (
                            <span
                              key={rule.brand}
                              className="border border-emerald-500/25 bg-emerald-500/5 px-2 py-0.5 text-xs text-emerald-200"
                            >
                              {rule.brand} −{formatPct(rule.discountPct)}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-zinc-500">Діють знижки брендів для всіх</span>
                      )}
                      {partner.b2bDiscountPercent ? (
                        <div className="mt-1.5 text-xs text-zinc-500">
                          Інші бренди: −{formatPct(partner.b2bDiscountPercent)}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {partner.canSignIn ? (
                        <span className="text-zinc-300">
                          Є пароль
                          <span className="block text-zinc-500">
                            {partner.lastLoginAt
                              ? `Входив ${new Date(partner.lastLoginAt).toLocaleDateString("uk-UA")}`
                              : "Ще не входив"}
                          </span>
                        </span>
                      ) : (
                        <span className="text-amber-300">
                          Немає пароля
                          {partner.placeholderEmail ? (
                            <span className="block text-zinc-500">Пошта-заглушка з CRM</span>
                          ) : null}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/shop/customers/${partner.id}`}
                        className="inline-flex items-center gap-1 whitespace-nowrap text-xs text-blue-300 hover:text-blue-200"
                      >
                        Відкрити <ArrowUpRight className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </AdminTableShell>
    </div>
  );
}

function PriceCheckTab({
  partners,
  loading,
  initialPartnerId,
}: {
  partners: Partner[];
  loading: boolean;
  initialPartnerId: string;
}) {
  const [partnerId, setPartnerId] = useState(initialPartnerId);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<PriceCheckItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);

  async function run(event?: React.FormEvent) {
    event?.preventDefault();
    if (!partnerId || query.trim().length < 2) return;
    setSearching(true);
    setError("");
    try {
      const params = new URLSearchParams({ customerId: partnerId, q: query.trim() });
      const data = await fetch(`/api/admin/shop/b2b/price-check?${params.toString()}`, {
        cache: "no-store",
      }).then((response) => readJson<{ items: PriceCheckItem[] }>(response));
      setItems(data.items ?? []);
      setSearched(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Перевірка не вдалася");
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="max-w-3xl text-[13px] leading-5 text-zinc-400">
        Оберіть партнера і знайдіть товар — тут видно ціну, яку партнер бачить на сайті й отримає в
        кошику (доставка в Україну), і яке правило дало знижку.
      </p>
      <form onSubmit={run} className="grid gap-2 sm:grid-cols-[minmax(0,320px)_minmax(0,1fr)_auto]">
        <select
          value={partnerId}
          onChange={(event) => setPartnerId(event.target.value)}
          disabled={loading}
          className={cn(inputClass, "w-full")}
          aria-label="Партнер"
        >
          <option value="">{loading ? "Завантаження…" : "Оберіть партнера"}</option>
          {partners.map((partner) => (
            <option key={partner.id} value={partner.id}>
              {partnerLabel(partner)}
            </option>
          ))}
        </select>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Назва, артикул або бренд товару"
          className={cn(inputClass, "w-full")}
          aria-label="Товар"
        />
        <AdminButton
          type="submit"
          variant="primary"
          loading={searching}
          disabled={!partnerId || query.trim().length < 2}
          icon={<Search />}
        >
          Перевірити
        </AdminButton>
      </form>

      {error ? <AdminInlineAlert tone="error">{error}</AdminInlineAlert> : null}

      {searched ? (
        <AdminTableShell>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/3 text-[11px] uppercase tracking-[0.14em] text-zinc-500">
                  <th className="px-4 py-3 font-medium">Товар</th>
                  <th className="px-4 py-3 font-medium">Бренд</th>
                  <th className="px-4 py-3 text-right font-medium">Роздрібна ціна</th>
                  <th className="px-4 py-3 text-right font-medium">Ціна партнера</th>
                  <th className="px-4 py-3 font-medium">Звідки знижка</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/6">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-zinc-500">
                      Нічого не знайдено серед опублікованих товарів.
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr key={item.slug} className="align-top transition hover:bg-white/2">
                      <td className="px-4 py-3">
                        <div className="text-zinc-100">{item.title}</div>
                        {item.sku ? <div className="text-xs text-zinc-500">{item.sku}</div> : null}
                      </td>
                      <td className="px-4 py-3 text-zinc-300">{item.brand || "—"}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-zinc-400">
                        <div>{formatMoney(item.retail.uah, "UAH")}</div>
                        <div className="text-xs text-zinc-600">
                          {formatMoney(item.retail.eur, "EUR")}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        <div
                          className={
                            item.discountPercent > 0
                              ? "font-semibold text-emerald-300"
                              : "text-zinc-200"
                          }
                        >
                          {formatMoney(item.partner.uah, "UAH")}
                        </div>
                        <div className="text-xs text-zinc-500">
                          {formatMoney(item.partner.eur, "EUR")}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[13px]">
                        {item.priceSource === "b2b-explicit" ? (
                          <span className="text-zinc-200">Окрема оптова ціна товару</span>
                        ) : item.discountPercent > 0 ? (
                          <span className="text-zinc-200">
                            −{formatPct(item.discountPercent)} ·{" "}
                            <span className="text-zinc-400">
                              {SHOP_B2B_DISCOUNT_SOURCE_LABELS[item.rule]}
                            </span>
                          </span>
                        ) : (
                          <span className="text-zinc-500">Без знижки — роздрібна ціна</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </AdminTableShell>
      ) : null}
    </div>
  );
}

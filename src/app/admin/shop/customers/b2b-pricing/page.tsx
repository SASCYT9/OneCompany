"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowUpRight, RefreshCcw, Search, X } from "lucide-react";

import { useToast } from "@/components/admin/AdminToast";
import { useB2bBrandOptions } from "@/components/admin/b2b/B2bBrandSelect";
import {
  CrmPicker,
  formatPct,
  groupAccent,
  GroupMark,
  pluralGroups,
  pluralPartners,
  TariffPriorityNote,
} from "@/components/admin/b2b/B2bPricingUi";
import { DiscountMatrixTab } from "@/components/admin/b2b/DiscountMatrixTab";
import {
  assignPartnerTariffGroup,
  partnerLabel,
  TariffGroupsTab,
} from "@/components/admin/b2b/TariffGroupsTab";
import { useB2bTariffGroups, type B2bTariffGroup } from "@/components/admin/b2b/useB2bTariffGroups";
import {
  CrmAvatar,
  CrmChip,
  CrmSurface,
  CrmTabs,
  crmAgo,
  crmButton,
  crmIconButton,
  crmInput,
  crmPrimaryButton,
} from "@/components/admin/crm/CrmUi";
import {
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
  tariffGroup: { id: string; name: string } | null;
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
  { key: "groups", label: "Тарифні групи" },
  { key: "matrix", label: "Таблиця знижок" },
  { key: "partners", label: "Партнери" },
  { key: "check", label: "Перевірка ціни" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

function tabFromParam(value: string | null): TabKey {
  // «brands» is the old name of the matrix tab; card links still use it.
  if (value === "brands") return "matrix";
  return TABS.find((entry) => entry.key === value)?.key ?? "groups";
}

function formatMoney(amount: number, currency: "UAH" | "EUR") {
  if (!(amount > 0)) return "—";
  return new Intl.NumberFormat("uk-UA", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "UAH" ? 0 : 2,
  }).format(amount);
}

async function readJson<T>(response: Response): Promise<T> {
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(data.error || "Запит не вдався");
  return data;
}

export default function AdminB2bPricingPage() {
  return (
    <Suspense fallback={null}>
      <B2bPricingScreen />
    </Suspense>
  );
}

function B2bPricingScreen() {
  const toast = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = tabFromParam(searchParams.get("tab"));
  const groupParam = searchParams.get("group") ?? "";
  const initialPartnerId = searchParams.get("customer") ?? "";

  const { brands, loading: brandsLoading, error: brandsError } = useB2bBrandOptions();
  const {
    groups,
    loading: groupsLoading,
    error: groupsError,
    reload: reloadGroups,
  } = useB2bTariffGroups();
  const [discounts, setDiscounts] = useState<SystemDiscount[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadDiscounts = useCallback(async () => {
    const data = await fetch("/api/admin/shop/b2b/brand-discounts", { cache: "no-store" }).then(
      (response) => readJson<{ discounts: SystemDiscount[] }>(response)
    );
    setDiscounts(data.discounts ?? []);
  }, []);

  const loadPartners = useCallback(async () => {
    const data = await fetch("/api/admin/shop/b2b/partners", { cache: "no-store" }).then(
      (response) => readJson<{ partners: Partner[] }>(response)
    );
    setPartners(data.partners ?? []);
  }, []);

  const loadAll = useCallback(async () => {
    setError("");
    try {
      await Promise.all([loadDiscounts(), loadPartners(), reloadGroups()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не вдалося завантажити дані");
    } finally {
      setLoading(false);
    }
  }, [loadDiscounts, loadPartners, reloadGroups]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  /** Quiet refresh after an edit: tables stay on screen. */
  const refreshAfterEdit = useCallback(
    async (options?: { partners?: boolean; discounts?: boolean }) => {
      try {
        await Promise.all([
          reloadGroups(),
          options?.partners ? loadPartners() : null,
          options?.discounts ? loadDiscounts() : null,
        ]);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Не вдалося оновити дані");
      }
    },
    [loadDiscounts, loadPartners, reloadGroups, toast]
  );

  function setParams(next: { tab?: TabKey; group?: string }) {
    const params = new URLSearchParams(searchParams.toString());
    if (next.tab) {
      if (next.tab === "groups") params.delete("tab");
      else params.set("tab", next.tab);
    }
    if (next.group !== undefined) {
      if (next.group) params.set("group", next.group);
      else params.delete("group");
    }
    const search = params.toString();
    router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false });
  }

  const stats = useMemo(() => {
    const inGroups = partners.filter((partner) => partner.tariffGroup).length;
    return [
      { label: "Партнерів", value: partners.length },
      { label: "У тарифних групах", value: inGroups },
      { label: "Без групи", value: partners.length - inGroups },
      { label: "Можуть увійти на сайт", value: partners.filter((p) => p.canSignIn).length },
      { label: "Брендів зі знижкою для всіх", value: discounts.length },
    ];
  }, [discounts.length, partners]);

  const errors = [error, brandsError, groupsError].filter(Boolean);

  return (
    <CrmSurface className="flex min-h-full flex-col bg-[#0A0A0B]">
      <header className="flex flex-wrap items-center gap-3 border-b border-[#1F2125] px-4 py-3 sm:px-5">
        <h1 className="crm-title text-[20px] font-semibold text-white">B2B-знижки</h1>
        <span className="crm-mono text-[12px] text-zinc-500">
          {partners.length
            ? `${partners.length} ${pluralPartners(partners.length)} · ${groups.length} ${pluralGroups(groups.length)}`
            : ""}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={async () => {
              setRefreshing(true);
              await loadAll();
              setRefreshing(false);
            }}
            aria-label="Оновити"
            title="Оновити"
            className={crmIconButton}
          >
            <RefreshCcw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
          </button>
          <Link href="/admin/shop/customers?tab=b2b" className={crmButton}>
            Клієнти-партнери <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </header>

      <dl className="no-scrollbar flex divide-x divide-[#1F2125] overflow-x-auto border-b border-[#1F2125]">
        {stats.map((stat) => (
          <div key={stat.label} className="min-w-[150px] flex-1 px-4 py-2.5 sm:px-5">
            <dt className="text-[12px] text-zinc-500">{stat.label}</dt>
            <dd className="crm-mono mt-0.5 text-[16px] text-white">{loading ? "…" : stat.value}</dd>
          </div>
        ))}
      </dl>

      <div className="border-b border-[#1F2125] px-2 sm:px-3">
        <CrmTabs
          label="Розділи B2B-знижок"
          tabs={TABS.map((entry) => ({
            key: entry.key,
            label: entry.label,
            count:
              entry.key === "groups" && groups.length
                ? groups.length
                : entry.key === "partners" && partners.length
                  ? partners.length
                  : null,
          }))}
          active={tab}
          onChange={(next) => setParams({ tab: next })}
        />
      </div>

      {errors.length ? (
        <div>
          {errors.map((message) => (
            <p
              key={message}
              className="border-b border-[#5B2323] bg-[#1F0E0E] px-5 py-2.5 text-[#F19B9B]"
            >
              {message}
            </p>
          ))}
        </div>
      ) : null}

      <div className="flex flex-1 flex-col">
        {tab === "groups" ? (
          <TariffGroupsTab
            groups={groups}
            groupsLoading={groupsLoading || loading}
            partners={partners}
            brands={brands}
            brandsLoading={brandsLoading}
            systemDiscounts={discounts}
            selectedId={groupParam}
            onSelect={(groupId) => setParams({ group: groupId })}
            onChanged={(options) => refreshAfterEdit(options)}
          />
        ) : null}
        {tab === "matrix" ? (
          <DiscountMatrixTab
            brands={brands}
            brandsLoading={brandsLoading}
            groups={groups}
            systemDiscounts={discounts}
            partners={partners}
            onChanged={() => refreshAfterEdit({ discounts: true })}
            onOpenGroup={(groupId) => setParams({ tab: "groups", group: groupId })}
          />
        ) : null}
        {tab === "partners" ? (
          <PartnersTab
            partners={partners}
            groups={groups}
            loading={loading}
            onAssigned={() => refreshAfterEdit({ partners: true })}
          />
        ) : null}
        {tab === "check" ? (
          <PriceCheckTab
            partners={partners}
            groups={groups}
            loading={loading}
            initialPartnerId={initialPartnerId}
          />
        ) : null}
      </div>

      {tab === "groups" || tab === "matrix" ? (
        <footer className="border-t border-[#1F2125] px-4 py-3 sm:px-5">
          <TariffPriorityNote />
        </footer>
      ) : null}
    </CrmSurface>
  );
}

function PartnersTab({
  partners,
  groups,
  loading,
  onAssigned,
}: {
  partners: Partner[];
  groups: B2bTariffGroup[];
  loading: boolean;
  onAssigned: () => Promise<void>;
}) {
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [groupFilter, setGroupFilter] = useState("");
  const [assigning, setAssigning] = useState<string | null>(null);

  const cannotSignIn = partners.filter((partner) => !partner.canSignIn);
  const placeholderCount = cannotSignIn.filter((partner) => partner.placeholderEmail).length;
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const rows = partners.filter((partner) => {
    if (groupFilter === "none" && partner.tariffGroup) return false;
    if (groupFilter && groupFilter !== "none" && partner.tariffGroup?.id !== groupFilter)
      return false;
    if (!words.length) return true;
    const haystack = [partner.name, partner.companyName, partner.email]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return words.every((word) => haystack.includes(word));
  });

  async function assign(partner: Partner, groupId: string) {
    setAssigning(partner.id);
    try {
      const result = await assignPartnerTariffGroup(partner.id, groupId || null);
      await onAssigned();
      toast.success(
        result.tariffGroup
          ? `${partnerLabel(partner)} — у групі «${result.tariffGroup.name}»`
          : `${partnerLabel(partner)} — без групи`
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не вдалося змінити групу");
    } finally {
      setAssigning(null);
    }
  }

  const filters = [
    { key: "", label: "Усі", count: partners.length },
    ...groups.map((group) => ({
      key: group.id,
      label: group.name,
      count: partners.filter((partner) => partner.tariffGroup?.id === group.id).length,
    })),
    {
      key: "none",
      label: "Без групи",
      count: partners.filter((partner) => !partner.tariffGroup).length,
    },
  ];

  return (
    <div className="flex flex-1 flex-col">
      {cannotSignIn.length && !loading ? (
        <p className="border-b border-[#3A2E14] bg-[#17130A] px-4 py-2.5 text-[#F5DDA6] sm:px-5">
          {cannotSignIn.length} з {partners.length} партнерів не можуть увійти на сайт і бачать
          роздрібні ціни.
          {placeholderCount
            ? ` У ${placeholderCount} — пошта-заглушка з CRM: впишіть справжній email на картці, потім створіть посилання для входу.`
            : " Створіть посилання для входу на картці партнера."}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 border-b border-[#1F2125] px-4 py-3 sm:px-5">
        <label className="flex h-8 w-full max-w-[320px] items-center gap-2 border border-[#24262B] bg-[#111113] px-2.5 focus-within:border-[#3B82F6]">
          <Search className="h-3.5 w-3.5 text-zinc-500" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Компанія, ім’я або email"
            aria-label="Пошук партнерів"
            className="w-full bg-transparent text-[13px] text-zinc-100 placeholder:text-zinc-600 focus:outline-none"
          />
        </label>
        <div className="flex flex-wrap border border-[#24262B]" role="group" aria-label="Група">
          {filters.map((filter) => (
            <button
              key={filter.key || "all"}
              type="button"
              aria-pressed={groupFilter === filter.key}
              onClick={() => setGroupFilter(filter.key)}
              className={cn(
                "h-8 px-3 text-[12px] transition",
                groupFilter === filter.key
                  ? "bg-[#1A2236] text-white"
                  : "text-zinc-400 hover:bg-[#141518] hover:text-zinc-100"
              )}
            >
              {filter.label} <span className="crm-mono text-zinc-500">{filter.count}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] table-fixed border-collapse text-left">
          <thead>
            <tr className="h-[34px] border-b border-[#1F2125] text-[12px] text-zinc-500">
              <th className="px-4 font-normal sm:px-5">Партнер</th>
              <th className="w-[210px] px-3 font-normal">Тарифна група</th>
              <th className="w-[280px] px-3 font-normal">Винятки на бренди</th>
              <th className="w-[150px] px-3 font-normal">Вхід на сайт</th>
              <th className="w-[52px]" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-zinc-500">
                  Завантажуємо партнерів…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-zinc-500">
                  Партнерів не знайдено.
                </td>
              </tr>
            ) : (
              rows.map((partner) => {
                const groupIndex = groups.findIndex(
                  (group) => group.id === partner.tariffGroup?.id
                );
                return (
                  <tr
                    key={partner.id}
                    className="h-[52px] border-b border-[#17181B] hover:bg-[#0E0F11]"
                  >
                    <td className="px-4 sm:px-5">
                      <div className="flex min-w-0 items-center gap-3">
                        <CrmAvatar name={partner.companyName || partner.name} partner size={28} />
                        <div className="min-w-0">
                          <Link
                            href={`/admin/shop/customers/${partner.id}?tab=discounts`}
                            className="block truncate text-zinc-100 hover:text-white"
                          >
                            {partner.companyName || partner.name}
                          </Link>
                          <div className="truncate text-[12px] text-zinc-500">
                            {partner.companyName && partner.companyName !== partner.name
                              ? `${partner.name} · `
                              : ""}
                            {partner.placeholderEmail ? (
                              <span className="text-[#C9A869]">пошта-заглушка з CRM</span>
                            ) : (
                              partner.email
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3">
                      <div className="flex items-center gap-2">
                        {partner.tariffGroup && groupIndex >= 0 ? (
                          <GroupMark
                            name={partner.tariffGroup.name}
                            accent={groupAccent(partner.tariffGroup.name, groupIndex)}
                            size={22}
                          />
                        ) : null}
                        <select
                          value={partner.tariffGroup?.id ?? ""}
                          disabled={assigning === partner.id}
                          onChange={(event) => void assign(partner, event.target.value)}
                          aria-label={`Тарифна група ${partnerLabel(partner)}`}
                          className={cn(
                            crmInput,
                            "disabled:opacity-50",
                            !partner.tariffGroup && "text-zinc-500"
                          )}
                        >
                          <option value="">Без групи</option>
                          {groups.map((group) => (
                            <option key={group.id} value={group.id}>
                              {group.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </td>
                    <td className="overflow-hidden px-3">
                      {partner.brandDiscounts.length || partner.b2bDiscountPercent ? (
                        <div className="flex gap-1 overflow-hidden">
                          {partner.brandDiscounts.slice(0, 3).map((rule) => (
                            <CrmChip key={rule.brand} tone="green">
                              {rule.brand} −{formatPct(rule.discountPct)}
                            </CrmChip>
                          ))}
                          {partner.brandDiscounts.length > 3 ? (
                            <CrmChip>+{partner.brandDiscounts.length - 3}</CrmChip>
                          ) : null}
                          {partner.b2bDiscountPercent ? (
                            <CrmChip>інші −{formatPct(partner.b2bDiscountPercent)}</CrmChip>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-zinc-700">—</span>
                      )}
                    </td>
                    <td className="px-3">
                      {partner.canSignIn ? (
                        <span className="text-zinc-300">
                          Є пароль
                          <span className="block text-[12px] text-zinc-500">
                            {partner.lastLoginAt
                              ? `входив ${crmAgo(partner.lastLoginAt)}`
                              : "ще не входив"}
                          </span>
                        </span>
                      ) : (
                        <CrmChip tone="amber">Немає пароля</CrmChip>
                      )}
                    </td>
                    <td className="pr-4 text-right">
                      <Link
                        href={`/admin/shop/customers/${partner.id}?tab=discounts`}
                        aria-label={`Картка ${partnerLabel(partner)}`}
                        className="inline-flex p-1 text-zinc-500 hover:text-white"
                      >
                        <ArrowUpRight className="h-4 w-4" />
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PriceCheckTab({
  partners,
  groups,
  loading,
  initialPartnerId,
}: {
  partners: Partner[];
  groups: B2bTariffGroup[];
  loading: boolean;
  initialPartnerId: string;
}) {
  const [partnerId, setPartnerId] = useState(initialPartnerId);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<PriceCheckItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);
  const [checkedGroup, setCheckedGroup] = useState<string | null>(null);
  const partner = partners.find((entry) => entry.id === partnerId) ?? null;
  const groupIndex = groups.findIndex((group) => group.id === partner?.tariffGroup?.id);

  async function run(event?: React.FormEvent) {
    event?.preventDefault();
    if (!partnerId || query.trim().length < 2) return;
    setSearching(true);
    setError("");
    try {
      const params = new URLSearchParams({ customerId: partnerId, q: query.trim() });
      const data = await fetch(`/api/admin/shop/b2b/price-check?${params.toString()}`, {
        cache: "no-store",
      }).then((response) =>
        readJson<{ items: PriceCheckItem[]; tariffGroup?: { name: string } | null }>(response)
      );
      setItems(data.items ?? []);
      setCheckedGroup(data.tariffGroup?.name ?? null);
      setSearched(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Перевірка не вдалася");
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="space-y-3 border-b border-[#1F2125] px-4 py-4 sm:px-5">
        <p className="max-w-3xl text-zinc-400">
          Оберіть партнера і знайдіть товар — тут видно ціну, яку партнер бачить на сайті й отримає
          в кошику (доставка в Україну), і яке правило дало знижку.
        </p>
        <form
          onSubmit={run}
          className="grid gap-2 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)_auto]"
        >
          {partner ? (
            <div className="flex h-8 min-w-0 items-center gap-2 border border-[#24262B] bg-[#0A0A0B] pl-1 pr-1.5">
              <CrmAvatar name={partner.companyName || partner.name} partner size={22} />
              <span className="min-w-0 flex-1 truncate text-zinc-100">{partnerLabel(partner)}</span>
              {partner.tariffGroup && groupIndex >= 0 ? (
                <GroupMark
                  name={partner.tariffGroup.name}
                  accent={groupAccent(partner.tariffGroup.name, groupIndex)}
                  size={20}
                />
              ) : null}
              <button
                type="button"
                onClick={() => {
                  setPartnerId("");
                  setSearched(false);
                }}
                aria-label="Обрати іншого партнера"
                className="p-0.5 text-zinc-500 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <CrmPicker
              label="Партнер"
              placeholder={loading ? "Завантажуємо партнерів…" : "Оберіть партнера…"}
              loading={loading}
              options={partners.map((entry) => ({
                value: entry.id,
                label: partnerLabel(entry),
                keywords: entry.email,
                meta: entry.tariffGroup?.name,
              }))}
              onSelect={(value) => {
                setPartnerId(value);
                setSearched(false);
              }}
            />
          )}
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Назва, артикул або бренд товару"
            aria-label="Товар"
            className={crmInput}
          />
          <button
            type="submit"
            disabled={searching || !partnerId || query.trim().length < 2}
            className={crmPrimaryButton}
          >
            <Search className="h-3.5 w-3.5" /> {searching ? "Шукаємо…" : "Перевірити"}
          </button>
        </form>
        {partner ? (
          <p className="text-[12px] text-zinc-500">
            Тарифна група:{" "}
            <span className="text-zinc-300">{partner.tariffGroup?.name ?? "без групи"}</span>
            {partner.brandDiscounts.length
              ? ` · винятків на бренди: ${partner.brandDiscounts.length}`
              : ""}
            {partner.canSignIn ? "" : " · партнер ще не може увійти на сайт"}
          </p>
        ) : null}
        {error ? (
          <p className="border-l-2 border-[#F19B9B] bg-[#1F0E0E] px-3 py-2 text-[#F19B9B]">
            {error}
          </p>
        ) : null}
      </div>

      {searched ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-left">
            <thead>
              <tr className="h-[34px] border-b border-[#1F2125] text-[12px] text-zinc-500">
                <th className="px-4 font-normal sm:px-5">Товар</th>
                <th className="px-3 font-normal">Бренд</th>
                <th className="px-3 text-right font-normal">Роздріб</th>
                <th className="px-3 text-right font-normal">Ціна партнера</th>
                <th className="px-4 font-normal sm:px-5">Звідки знижка</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-zinc-500">
                    Нічого не знайдено серед опублікованих товарів.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.slug} className="border-b border-[#17181B] hover:bg-[#0E0F11]">
                    <td className="px-4 py-2.5 sm:px-5">
                      <div className="text-zinc-100">{item.title}</div>
                      {item.sku ? (
                        <div className="crm-mono text-[11px] text-zinc-500">{item.sku}</div>
                      ) : null}
                    </td>
                    <td className="px-3 text-zinc-300">{item.brand || "—"}</td>
                    <td className="crm-mono px-3 text-right text-[12px] text-zinc-400">
                      <div>{formatMoney(item.retail.uah, "UAH")}</div>
                      <div className="text-zinc-600">{formatMoney(item.retail.eur, "EUR")}</div>
                    </td>
                    <td className="crm-mono px-3 text-right text-[12px]">
                      <div
                        className={item.discountPercent > 0 ? "text-[#86E0A3]" : "text-zinc-200"}
                      >
                        {formatMoney(item.partner.uah, "UAH")}
                      </div>
                      <div className="text-zinc-500">{formatMoney(item.partner.eur, "EUR")}</div>
                    </td>
                    <td className="px-4 sm:px-5">
                      {item.priceSource === "b2b-explicit" ? (
                        <span className="text-zinc-200">Окрема оптова ціна товару</span>
                      ) : item.discountPercent > 0 ? (
                        <span className="flex flex-wrap items-center gap-1.5">
                          <CrmChip tone="green">−{formatPct(item.discountPercent)}</CrmChip>
                          <span className="text-zinc-400">
                            {item.rule === "group-brand" && checkedGroup
                              ? `Тарифна група «${checkedGroup}»`
                              : SHOP_B2B_DISCOUNT_SOURCE_LABELS[item.rule]}
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
      ) : null}
    </div>
  );
}

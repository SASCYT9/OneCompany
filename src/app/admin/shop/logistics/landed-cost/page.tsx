"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Calculator, Check, Loader2, Plus, Save, Trash2, Truck } from "lucide-react";

import {
  AdminActionBar,
  AdminInlineAlert,
  AdminMetricCard,
  AdminMetricGrid,
  AdminPage,
  AdminPageHeader,
} from "@/components/admin/AdminPrimitives";
import { useConfirm } from "@/components/admin/AdminConfirmDialog";
import { useToast } from "@/components/admin/AdminToast";
import { calculateShopLandedCost, type ShopLandedCostMode } from "@/lib/shopLandedCost";

type LandedRule = {
  id: string;
  regionCode: string;
  regionName: string;
  regionNameUa: string;
  taxType: string;
  taxRate: number;
  taxLabel: string | null;
  taxLabelUa: string | null;
  customsDutyPct: number;
  landedCostEnabled: boolean;
  appliesToShipping: boolean;
  incoterm: ShopLandedCostMode;
  brokerageFee: number;
  handlingFee: number;
  insurancePct: number;
  riskReservePct: number;
  importerOfRecord: string | null;
  ddpGuarantee: boolean;
  isInclusive: boolean;
  isActive: boolean;
  notes: string | null;
  sortOrder: number;
};

const EMPTY_RULE: LandedRule = {
  id: "",
  regionCode: "DE",
  regionName: "Germany",
  regionNameUa: "Німеччина",
  taxType: "VAT",
  taxRate: 19,
  taxLabel: "VAT",
  taxLabelUa: "ПДВ",
  customsDutyPct: 0,
  landedCostEnabled: true,
  appliesToShipping: true,
  incoterm: "DDP",
  brokerageFee: 0,
  handlingFee: 0,
  insurancePct: 0,
  riskReservePct: 0,
  importerOfRecord: "OneCompany / 3PL",
  ddpGuarantee: false,
  isInclusive: false,
  isActive: true,
  notes: "",
  sortOrder: 0,
};

const MODE_LABELS: Record<ShopLandedCostMode, string> = {
  DDP: "DDP · all-in",
  DAP: "DAP · import at delivery",
  QUOTE: "Quote · manual confirmation",
};

function money(value: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(value);
}

function numberValue(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function RuleFields({
  rule,
  onChange,
}: {
  rule: LandedRule;
  onChange: (patch: Partial<LandedRule>) => void;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <label className="space-y-1 text-xs text-zinc-400">
        <span>Код країни</span>
        <input
          value={rule.regionCode}
          onChange={(event) => onChange({ regionCode: event.target.value.toUpperCase() })}
          className="w-full rounded-none border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-hidden focus:border-blue-400/50"
        />
      </label>
      <label className="space-y-1 text-xs text-zinc-400">
        <span>Назва країни</span>
        <input
          value={rule.regionName}
          onChange={(event) => onChange({ regionName: event.target.value })}
          className="w-full rounded-none border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-hidden focus:border-blue-400/50"
        />
      </label>
      <label className="space-y-1 text-xs text-zinc-400">
        <span>Назва українською</span>
        <input
          value={rule.regionNameUa}
          onChange={(event) => onChange({ regionNameUa: event.target.value })}
          className="w-full rounded-none border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-hidden focus:border-blue-400/50"
        />
      </label>
      <label className="space-y-1 text-xs text-zinc-400">
        <span>Incoterm</span>
        <select
          value={rule.incoterm}
          onChange={(event) => onChange({ incoterm: event.target.value as ShopLandedCostMode })}
          className="w-full rounded-none border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-hidden focus:border-blue-400/50"
        >
          {Object.entries(MODE_LABELS).map(([value, label]) => (
            <option key={value} value={value} className="bg-zinc-900">
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="space-y-1 text-xs text-zinc-400">
        <span>VAT %</span>
        <input
          type="number"
          min="0"
          max="100"
          step="0.1"
          value={rule.taxRate}
          onChange={(event) => onChange({ taxRate: numberValue(event.target.value) })}
          className="w-full rounded-none border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-hidden focus:border-blue-400/50"
        />
      </label>
      <label className="space-y-1 text-xs text-zinc-400">
        <span>Мито %</span>
        <input
          type="number"
          min="0"
          max="100"
          step="0.1"
          value={rule.customsDutyPct}
          onChange={(event) => onChange({ customsDutyPct: numberValue(event.target.value) })}
          className="w-full rounded-none border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-hidden focus:border-blue-400/50"
        />
      </label>
      <label className="space-y-1 text-xs text-zinc-400">
        <span>Brokerage, EUR</span>
        <input
          type="number"
          min="0"
          step="0.01"
          value={rule.brokerageFee}
          onChange={(event) => onChange({ brokerageFee: numberValue(event.target.value) })}
          className="w-full rounded-none border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-hidden focus:border-blue-400/50"
        />
      </label>
      <label className="space-y-1 text-xs text-zinc-400">
        <span>Handling, EUR</span>
        <input
          type="number"
          min="0"
          step="0.01"
          value={rule.handlingFee}
          onChange={(event) => onChange({ handlingFee: numberValue(event.target.value) })}
          className="w-full rounded-none border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-hidden focus:border-blue-400/50"
        />
      </label>
      <label className="space-y-1 text-xs text-zinc-400">
        <span>Страхування %</span>
        <input
          type="number"
          min="0"
          max="100"
          step="0.1"
          value={rule.insurancePct}
          onChange={(event) => onChange({ insurancePct: numberValue(event.target.value) })}
          className="w-full rounded-none border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-hidden focus:border-blue-400/50"
        />
      </label>
      <label className="space-y-1 text-xs text-zinc-400">
        <span>Резерв DDP %</span>
        <input
          type="number"
          min="0"
          max="100"
          step="0.1"
          value={rule.riskReservePct}
          onChange={(event) => onChange({ riskReservePct: numberValue(event.target.value) })}
          className="w-full rounded-none border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-hidden focus:border-blue-400/50"
        />
      </label>
      <label className="space-y-1 text-xs text-zinc-400">
        <span>Importer of record</span>
        <input
          value={rule.importerOfRecord ?? ""}
          onChange={(event) => onChange({ importerOfRecord: event.target.value || null })}
          placeholder="OneCompany / 3PL / buyer"
          className="w-full rounded-none border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-hidden placeholder:text-zinc-600 focus:border-blue-400/50"
        />
      </label>
      <label className="flex items-center gap-2 self-end pb-2 text-xs text-zinc-300">
        <input
          type="checkbox"
          checked={rule.appliesToShipping}
          onChange={(event) => onChange({ appliesToShipping: event.target.checked })}
          className="accent-blue-500"
        />
        VAT base включає freight
      </label>
      <label className="flex items-center gap-2 self-end pb-2 text-xs text-zinc-300">
        <input
          type="checkbox"
          checked={rule.ddpGuarantee}
          onChange={(event) => onChange({ ddpGuarantee: event.target.checked })}
          className="accent-emerald-500"
        />
        Гарантувати DDP суму
      </label>
      <label className="flex items-center gap-2 self-end pb-2 text-xs text-zinc-300">
        <input
          type="checkbox"
          checked={rule.isActive}
          onChange={(event) => onChange({ isActive: event.target.checked })}
          className="accent-blue-500"
        />
        Активний маршрут
      </label>
      <label className="flex items-center gap-2 self-end pb-2 text-xs text-zinc-300">
        <input
          type="checkbox"
          checked={rule.landedCostEnabled}
          onChange={(event) => onChange({ landedCostEnabled: event.target.checked })}
          className="accent-emerald-500"
        />
        Використовувати в checkout
      </label>
      <label className="space-y-1 text-xs text-zinc-400 md:col-span-2 xl:col-span-4">
        <span>Нотатка для finance / support</span>
        <input
          value={rule.notes ?? ""}
          onChange={(event) => onChange({ notes: event.target.value || null })}
          placeholder="Провайдер, сервіс, обмеження маршруту, версія ставки"
          className="w-full rounded-none border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-hidden placeholder:text-zinc-600 focus:border-blue-400/50"
        />
      </label>
    </div>
  );
}

export default function LandedCostAdminPage() {
  const confirm = useConfirm();
  const toast = useToast();
  const [rules, setRules] = useState<LandedRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [newRule, setNewRule] = useState<LandedRule | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [previewSubtotal, setPreviewSubtotal] = useState("1000");
  const [previewShipping, setPreviewShipping] = useState("100");

  const fetchRules = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/shop/logistics/taxes", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не вдалося завантажити маршрути");
      const nextRules = (data.rules || []) as LandedRule[];
      setRules(nextRules);
      setSelectedId((current) => current || nextRules[0]?.id || "");
    } catch (fetchError) {
      setError(
        fetchError instanceof Error ? fetchError.message : "Не вдалося завантажити маршрути"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchRules();
  }, [fetchRules]);

  async function saveRule(rule: LandedRule) {
    if (!rule.regionCode.trim() || !rule.regionName.trim()) {
      toast.error("Заповни код і назву країни");
      return;
    }
    setSaving(rule.regionCode);
    try {
      const response = await fetch("/api/admin/shop/logistics/taxes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rule),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Не вдалося зберегти маршрут");
      toast.success("Маршрут збережено", `${rule.regionCode} · ${MODE_LABELS[rule.incoterm]}`);
      setNewRule(null);
      await fetchRules();
    } catch (saveError) {
      toast.error(
        "Не вдалося зберегти маршрут",
        saveError instanceof Error ? saveError.message : undefined
      );
    } finally {
      setSaving(null);
    }
  }

  async function deleteRule(rule: LandedRule) {
    if (!rule.id) return;
    const confirmed = await confirm({
      tone: "danger",
      title: `Видалити маршрут ${rule.regionCode}?`,
      description:
        "Checkout більше не зможе використати це правило для автоматичного all-in розрахунку.",
      confirmLabel: "Видалити",
    });
    if (!confirmed) return;
    const response = await fetch(
      `/api/admin/shop/logistics/taxes?id=${encodeURIComponent(rule.id)}`,
      {
        method: "DELETE",
      }
    );
    if (!response.ok) {
      toast.error("Не вдалося видалити маршрут");
      return;
    }
    toast.success("Маршрут видалено");
    await fetchRules();
  }

  const selectedRule = useMemo(
    () => rules.find((rule) => rule.id === selectedId) ?? rules[0] ?? null,
    [rules, selectedId]
  );
  const preview = useMemo(() => {
    if (!selectedRule) return null;
    return calculateShopLandedCost({
      rule: selectedRule,
      country: selectedRule.regionCode,
      currency: "EUR",
      subtotal: numberValue(previewSubtotal),
      shippingCost: numberValue(previewShipping),
    });
  }, [previewShipping, previewSubtotal, selectedRule]);

  const activeCount = rules.filter((rule) => rule.isActive && rule.landedCostEnabled).length;
  const ddpCount = rules.filter(
    (rule) => rule.isActive && rule.landedCostEnabled && rule.incoterm === "DDP"
  ).length;
  const guaranteedCount = rules.filter(
    (rule) =>
      rule.isActive &&
      rule.landedCostEnabled &&
      rule.incoterm === "DDP" &&
      rule.ddpGuarantee &&
      Boolean(rule.importerOfRecord)
  ).length;

  return (
    <AdminPage className="space-y-6">
      <Link
        href="/admin/shop/logistics"
        className="inline-flex items-center gap-2 text-sm text-zinc-500 transition hover:text-zinc-100"
      >
        <ArrowLeft className="h-4 w-4" /> Логістика
      </Link>

      <AdminPageHeader
        eyebrow="Europe wholesale"
        title="Landed cost routes"
        description="Керуй country-level правилами для DDP, DAP та ручного прорахунку. Ці ж правила використовує checkout."
        actions={
          <button
            type="button"
            onClick={() => setNewRule({ ...EMPTY_RULE })}
            className="inline-flex items-center gap-2 rounded-none bg-linear-to-b from-blue-500 to-blue-700 px-4 py-2.5 text-sm font-bold uppercase tracking-wider text-white shadow-[0_2px_8px_rgba(59,130,246,0.35)] transition hover:from-blue-400 hover:to-blue-600"
          >
            <Plus className="h-4 w-4" /> Додати маршрут
          </button>
        }
      />

      <AdminMetricGrid className="xl:grid-cols-4">
        <AdminMetricCard
          label="Routes"
          value={rules.length}
          meta="Country-level rules"
          tone="accent"
        />
        <AdminMetricCard label="Active" value={activeCount} meta="Used by checkout" />
        <AdminMetricCard label="DDP" value={ddpCount} meta="Import charges included" />
        <AdminMetricCard label="Guaranteed" value={guaranteedCount} meta="Can say all-in" />
      </AdminMetricGrid>

      {error ? <AdminInlineAlert tone="error">{error}</AdminInlineAlert> : null}

      <AdminActionBar className="bg-[#171717]">
        <div className="flex items-center gap-3 text-sm text-zinc-300">
          <Truck className="h-4 w-4 text-blue-300" />
          <span>
            DDP all-in можна показувати тільки для активного маршруту з контрольованим importer of
            record.
          </span>
        </div>
        <Link
          href="/admin/shop/logistics/taxes"
          className="text-xs text-zinc-500 hover:text-zinc-100"
        >
          Відкрити legacy tax editor →
        </Link>
      </AdminActionBar>

      {newRule ? (
        <section className="rounded-none border border-blue-500/30 bg-blue-500/5 p-5">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-white">Новий country route</h2>
              <p className="mt-1 text-xs text-zinc-500">
                Після збереження правило стане доступним для checkout.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setNewRule(null)}
              className="text-xs text-zinc-500 hover:text-white"
            >
              Скасувати
            </button>
          </div>
          <RuleFields
            rule={newRule}
            onChange={(patch) =>
              setNewRule((current) => (current ? { ...current, ...patch } : current))
            }
          />
          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={() => void saveRule(newRule)}
              disabled={saving === newRule.regionCode}
              className="inline-flex items-center gap-2 rounded-none border border-blue-400/30 bg-blue-500/15 px-4 py-2 text-sm font-semibold text-blue-100 hover:bg-blue-500/25 disabled:opacity-50"
            >
              {saving === newRule.regionCode ? (
                <Loader2 className="h-4 w-4 motion-safe:animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Створити маршрут
            </button>
          </div>
        </section>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="space-y-4">
          {loading ? (
            <div className="flex items-center gap-3 rounded-none border border-white/10 bg-[#171717] px-5 py-8 text-sm text-zinc-400">
              <Loader2 className="h-4 w-4 motion-safe:animate-spin" /> Завантаження маршрутів…
            </div>
          ) : rules.length === 0 ? (
            <div className="rounded-none border border-dashed border-white/10 bg-[#171717] px-5 py-12 text-center text-sm text-zinc-500">
              Створи перший маршрут для Європи.
            </div>
          ) : (
            rules.map((rule) => (
              <article
                key={rule.id || rule.regionCode}
                className="rounded-none border border-white/10 bg-[#171717] p-5"
              >
                <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedId(rule.id || rule.regionCode)}
                    className="text-left"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold text-white">
                        {rule.regionNameUa || rule.regionName}
                      </h2>
                      <span className="font-mono text-xs text-zinc-500">{rule.regionCode}</span>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${rule.incoterm === "DDP" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" : rule.incoterm === "QUOTE" ? "border-amber-500/30 bg-amber-500/10 text-amber-200" : "border-white/10 bg-white/5 text-zinc-300"}`}
                      >
                        {rule.incoterm}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-zinc-500">
                      {MODE_LABELS[rule.incoterm]} ·{" "}
                      {rule.importerOfRecord || "Importer не заданий"}
                    </p>
                  </button>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs ${rule.isActive && rule.landedCostEnabled ? "text-emerald-300" : "text-zinc-600"}`}
                    >
                      {rule.isActive && rule.landedCostEnabled ? "Active" : "Tax only / disabled"}
                    </span>
                    <button
                      type="button"
                      onClick={() => void saveRule(rule)}
                      disabled={saving === rule.regionCode}
                      className="inline-flex items-center gap-1.5 rounded-none border border-white/10 px-3 py-1.5 text-xs text-zinc-200 hover:border-blue-400/40 hover:text-blue-200 disabled:opacity-50"
                    >
                      {saving === rule.regionCode ? (
                        <Loader2 className="h-3.5 w-3.5 motion-safe:animate-spin" />
                      ) : (
                        <Save className="h-3.5 w-3.5" />
                      )}{" "}
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteRule(rule)}
                      className="rounded-none border border-white/10 p-1.5 text-zinc-500 hover:border-red-400/40 hover:text-red-300"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <RuleFields
                  rule={rule}
                  onChange={(patch) =>
                    setRules((current) =>
                      current.map((item) => (item.id === rule.id ? { ...item, ...patch } : item))
                    )
                  }
                />
              </article>
            ))
          )}
        </section>

        <aside className="h-fit rounded-none border border-white/10 bg-[#171717] p-5 xl:sticky xl:top-6">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Calculator className="h-4 w-4 text-blue-300" /> Preview landed price
          </div>
          <p className="mt-2 text-xs leading-5 text-zinc-500">
            Перевір, що саме потрапить у фінальний customer total для вибраного маршруту.
          </p>
          <label className="mt-5 block space-y-1 text-xs text-zinc-400">
            <span>Маршрут</span>
            <select
              value={selectedRule?.id || ""}
              onChange={(event) => setSelectedId(event.target.value)}
              className="w-full rounded-none border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-hidden"
            >
              {rules.map((rule) => (
                <option key={rule.id || rule.regionCode} value={rule.id}>
                  {rule.regionCode} · {rule.regionName}
                </option>
              ))}
            </select>
          </label>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <label className="space-y-1 text-xs text-zinc-400">
              <span>Товар, EUR</span>
              <input
                type="number"
                value={previewSubtotal}
                onChange={(event) => setPreviewSubtotal(event.target.value)}
                className="w-full rounded-none border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
              />
            </label>
            <label className="space-y-1 text-xs text-zinc-400">
              <span>Freight, EUR</span>
              <input
                type="number"
                value={previewShipping}
                onChange={(event) => setPreviewShipping(event.target.value)}
                className="w-full rounded-none border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
              />
            </label>
          </div>
          {preview ? (
            <div className="mt-5 space-y-2 border-t border-white/10 pt-4 text-xs text-zinc-400">
              <div className="flex justify-between">
                <span>Митна база</span>
                <strong className="text-zinc-100">{money(preview.customsValue)}</strong>
              </div>
              <div className="flex justify-between">
                <span>Duty</span>
                <strong className="text-zinc-100">{money(preview.dutyAmount)}</strong>
              </div>
              <div className="flex justify-between">
                <span>Insurance</span>
                <strong className="text-zinc-100">{money(preview.insuranceAmount)}</strong>
              </div>
              <div className="flex justify-between">
                <span>Broker + handling</span>
                <strong className="text-zinc-100">
                  {money(preview.brokerageAmount + preview.handlingAmount)}
                </strong>
              </div>
              <div className="flex justify-between">
                <span>Import VAT</span>
                <strong className="text-zinc-100">{money(preview.importVatAmount)}</strong>
              </div>
              <div className="flex justify-between">
                <span>DDP reserve</span>
                <strong className="text-zinc-100">{money(preview.riskReserveAmount)}</strong>
              </div>
              <div className="mt-3 flex justify-between border-t border-white/10 pt-3 text-sm text-white">
                <span>{preview.mode === "DDP" ? "Included in total" : "At delivery / quote"}</span>
                <strong className={preview.mode === "DDP" ? "text-emerald-300" : "text-amber-300"}>
                  {money(
                    preview.mode === "DDP" ? preview.includedAmount : preview.dueAtDeliveryAmount
                  )}
                </strong>
              </div>
              <div className="mt-3 flex justify-between border-t border-white/10 pt-3 text-sm text-white">
                <span>{preview.mode === "DDP" ? "Customer total" : "Checkout total"}</span>
                <strong className="text-blue-200">
                  {money(
                    numberValue(previewSubtotal) +
                      numberValue(previewShipping) +
                      (preview.mode === "DDP" ? preview.includedAmount : 0)
                  )}
                </strong>
              </div>
              {preview.guaranteed ? (
                <div className="mt-3 flex items-center gap-2 text-emerald-300">
                  <Check className="h-3.5 w-3.5" /> All-in promise дозволено
                </div>
              ) : (
                <div className="mt-3 text-amber-300">
                  Estimate / delivery charge: promise не гарантується
                </div>
              )}
            </div>
          ) : (
            <p className="mt-6 text-xs text-zinc-600">Додай маршрут, щоб побачити preview.</p>
          )}
        </aside>
      </div>
    </AdminPage>
  );
}

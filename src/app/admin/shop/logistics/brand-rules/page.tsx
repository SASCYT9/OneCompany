"use client";

/**
 * Brand and destination shipping rules.
 *
 * One row represents one brand + one configured shipping zone. The empty zone
 * value is the legacy all-regions rule for that brand. Rules are persisted in
 * ShopSettings.brandShippingRules so this page can be used without another
 * migration while keeping old global rules compatible.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Copy,
  FlaskConical,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Trash2,
} from "lucide-react";

import {
  AdminButton,
  AdminCardSection,
  AdminInlineAlert,
  AdminPage,
  AdminPageHeader,
  AdminStatusBadge,
  AdminSwitch,
} from "@/components/admin/AdminPrimitives";

const SHOP_BRAND_DEFAULT_RULE_ID = "__default__";
const MODES = ["fixed", "multiplier", "free", "tiered", "percent", "manual_quote"] as const;
type Mode = (typeof MODES)[number];
const CURRENCIES = ["EUR", "USD", "UAH"] as const;
type Currency = (typeof CURRENCIES)[number];

const MODE_LABELS: Record<Mode, string> = {
  fixed: "Фіксована сума",
  multiplier: "Множник стандартної",
  free: "Безкоштовно",
  tiered: "За сумою кошика",
  percent: "Відсоток від кошика",
  manual_quote: "Ручний прорахунок",
};

const FIELD_INPUT_CLASS =
  "h-10 w-full rounded-none border border-white/10 bg-black/30 px-3 text-sm text-zinc-100 outline-hidden placeholder:text-zinc-600 focus:border-blue-500/40";

type Bracket = { maxAmount: string; fee: string };

type Rule = {
  id: string;
  brandName: string;
  /** Empty means all destinations; otherwise this is a ShopShippingZone id. */
  shippingZoneId: string;
  mode: Mode;
  value: string;
  warehouseRatePerKg: string;
  currency: Currency;
  enabled: boolean;
  brackets: Bracket[];
};

type Brand = { brand: string; productCount: number; turn14BrandId: string | null };

type ShippingZone = {
  id: string;
  name: string;
  countries?: string[];
  regions?: string[];
  enabled: boolean;
};

type ServerRule = {
  id: string;
  brandName: string;
  shippingZoneId?: string | null;
  mode: Mode;
  value: number;
  warehouseRatePerKg: number;
  currency: Currency;
  enabled: boolean;
  brackets?: Array<{ maxAmount: number | null; fee: number }>;
};

type SettingsResponse = {
  shippingZones?: ShippingZone[];
  brandShippingRules?: ServerRule[];
};

function newRuleId(prefix = "brand-rule") {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function emptyRule(id: string, brandName = "", shippingZoneId = "", enabled = true): Rule {
  return {
    id,
    brandName,
    shippingZoneId,
    mode: "fixed",
    value: "0",
    warehouseRatePerKg: "0",
    currency: "EUR",
    enabled,
    brackets: [],
  };
}

function ruleFromServer(rule: ServerRule): Rule {
  return {
    id: rule.id,
    brandName: rule.brandName,
    shippingZoneId: rule.shippingZoneId ?? "",
    mode: rule.mode,
    value: String(rule.value ?? 0),
    warehouseRatePerKg: String(rule.warehouseRatePerKg ?? 0),
    currency: rule.currency,
    enabled: rule.enabled,
    brackets: (rule.brackets ?? []).map((bracket) => ({
      maxAmount: bracket.maxAmount === null ? "" : String(bracket.maxAmount),
      fee: String(bracket.fee),
    })),
  };
}

function ruleToServer(rule: Rule) {
  const brackets =
    rule.mode === "tiered"
      ? rule.brackets.map((bracket) => ({
          maxAmount: bracket.maxAmount.trim() === "" ? null : Number(bracket.maxAmount) || null,
          fee: Number(bracket.fee) || 0,
        }))
      : undefined;

  return {
    id: rule.id.trim() || newRuleId(),
    brandName: rule.brandName.trim(),
    shippingZoneId: rule.shippingZoneId.trim() || null,
    mode: rule.mode,
    value: Number(rule.value) || 0,
    warehouseRatePerKg: Number(rule.warehouseRatePerKg) || 0,
    currency: rule.currency,
    enabled: rule.enabled,
    ...(brackets ? { brackets } : {}),
  };
}

export default function BrandRulesPage() {
  const [defaultRule, setDefaultRule] = useState<Rule>(() =>
    emptyRule(SHOP_BRAND_DEFAULT_RULE_ID, "", "", false)
  );
  const [brands, setBrands] = useState<Brand[]>([]);
  const [zones, setZones] = useState<ShippingZone[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [brandFilter, setBrandFilter] = useState("");
  const [zoneFilter, setZoneFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [settingsRes, brandsRes] = await Promise.all([
        fetch("/api/admin/shop/settings", { cache: "no-store" }),
        fetch("/api/admin/shop/turn14/sync-dimensions", { cache: "no-store" }),
      ]);
      if (!settingsRes.ok) throw new Error("Не вдалося завантажити налаштування магазину");

      const settings: SettingsResponse = await settingsRes.json();
      const brandsData = brandsRes.ok ? await brandsRes.json() : { brands: [] };
      const brandList = Array.isArray(brandsData.brands) ? (brandsData.brands as Brand[]) : [];
      const serverRules = settings.brandShippingRules ?? [];
      const fallback = serverRules.find((rule) => rule.id === SHOP_BRAND_DEFAULT_RULE_ID);

      setBrands(brandList);
      setZones(settings.shippingZones ?? []);
      setDefaultRule(
        fallback ? ruleFromServer(fallback) : emptyRule(SHOP_BRAND_DEFAULT_RULE_ID, "", "", false)
      );
      setRules(
        serverRules
          .filter((rule) => rule.id !== SHOP_BRAND_DEFAULT_RULE_ID && rule.brandName.trim())
          .map(ruleFromServer)
      );
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const brandOptions = useMemo(() => {
    const values = new Map<string, Brand>();
    for (const brand of brands) values.set(brand.brand.toLowerCase(), brand);
    for (const rule of rules) {
      if (!rule.brandName.trim()) continue;
      const key = rule.brandName.trim().toLowerCase();
      if (!values.has(key)) {
        values.set(key, { brand: rule.brandName.trim(), productCount: 0, turn14BrandId: null });
      }
    }
    return Array.from(values.values()).sort((a, b) => a.brand.localeCompare(b.brand));
  }, [brands, rules]);

  const filteredRules = useMemo(() => {
    const query = brandFilter.trim().toLowerCase();
    return rules.filter((rule) => {
      if (query && !rule.brandName.toLowerCase().includes(query)) return false;
      if (zoneFilter === "global" && rule.shippingZoneId) return false;
      if (zoneFilter !== "all" && zoneFilter !== "global" && rule.shippingZoneId !== zoneFilter) {
        return false;
      }
      return true;
    });
  }, [brandFilter, rules, zoneFilter]);

  function patchRule(id: string, patch: Partial<Rule>) {
    setRules((current) => current.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule)));
  }

  function addRule() {
    const firstBrand = brandOptions[0]?.brand ?? "";
    const firstZone = zones.find((zone) => zone.enabled)?.id ?? "";
    setRules((current) => [...current, emptyRule(newRuleId(), firstBrand, firstZone)]);
  }

  function cloneRule(rule: Rule) {
    setRules((current) => {
      const index = current.findIndex((entry) => entry.id === rule.id);
      const copy = { ...rule, id: newRuleId(), enabled: false };
      return [...current.slice(0, index + 1), copy, ...current.slice(index + 1)];
    });
  }

  function removeRule(id: string) {
    setRules((current) => current.filter((rule) => rule.id !== id));
  }

  function validateBeforeSave() {
    const seen = new Set<string>();
    for (const rule of rules) {
      const brandName = rule.brandName.trim();
      if (!brandName) return "У кожному тарифі потрібно вибрати бренд.";
      const key = `${brandName.toLowerCase()}::${rule.shippingZoneId || "*"}`;
      if (seen.has(key)) {
        return `Дубль тарифу: ${brandName} + ${zoneLabel(rule.shippingZoneId, zones)}.`;
      }
      seen.add(key);
      if (rule.mode === "tiered" && rule.brackets.length === 0) {
        return `Для бренду ${brandName} додайте хоча б один поріг суми.`;
      }
    }
    if (defaultRule.mode === "tiered" && defaultRule.brackets.length === 0) {
      return "Для глобального fallback додайте хоча б один поріг суми.";
    }
    return null;
  }

  async function save() {
    const validationError = validateBeforeSave();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const settingsRes = await fetch("/api/admin/shop/settings", { cache: "no-store" });
      if (!settingsRes.ok) throw new Error("Не вдалося прочитати поточні налаштування");
      const current = await settingsRes.json();
      const payload = {
        ...current,
        brandShippingRules: [ruleToServer(defaultRule), ...rules.map(ruleToServer)],
      };

      const response = await fetch("/api/admin/shop/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const message = await response.text();
        throw new Error(`Не вдалося зберегти тарифи: ${message.slice(0, 200)}`);
      }

      setSavedAt(Date.now());
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : String(saveError));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <AdminPage>
        <div className="flex items-center justify-center py-20 text-zinc-400">
          <Loader2 className="mr-2 h-5 w-5 motion-safe:animate-spin" /> Завантаження…
        </div>
      </AdminPage>
    );
  }

  const activeCount = rules.filter((rule) => rule.enabled).length;

  return (
    <AdminPage>
      <AdminPageHeader
        eyebrow="Логістика"
        title="Доставка за брендом і регіоном"
        description="Один рядок = один бренд + одна зона доставки. Наприклад: Eventuri → Європа → €120, Eventuri → США → $180. Якщо окремої зони немає, використовується глобальне правило бренду або fallback."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/admin/shop/logistics"
              className="inline-flex items-center gap-2 rounded-none border border-white/10 px-3 py-2 text-sm text-zinc-300 hover:bg-white/5"
            >
              <ArrowLeft className="h-4 w-4" /> Логістика
            </Link>
            <Link
              href="/admin/shop/logistics/shipping-lab"
              className="inline-flex items-center gap-2 rounded-none border border-blue-500/30 px-3 py-2 text-sm text-blue-200 hover:bg-blue-500/10"
            >
              <FlaskConical className="h-4 w-4" /> Демо-чекаут
            </Link>
            <AdminButton variant="ghost" icon={<RefreshCw />} onClick={load} disabled={saving}>
              Оновити
            </AdminButton>
            <AdminButton variant="primary" icon={<Save />} onClick={save} loading={saving}>
              Зберегти
            </AdminButton>
          </div>
        }
      />

      {error ? (
        <AdminInlineAlert tone="error" className="mt-4">
          {error}
        </AdminInlineAlert>
      ) : null}
      {savedAt ? (
        <AdminInlineAlert tone="success" className="mt-4">
          Тарифи збережено о {new Date(savedAt).toLocaleTimeString()}
        </AdminInlineAlert>
      ) : null}

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <SummaryCard label="Активні правила" value={activeCount} note={`з ${rules.length}`} />
        <SummaryCard label="Зони доставки" value={zones.length} note="налаштовано в логістиці" />
        <SummaryCard
          label="Бренди в каталозі"
          value={brandOptions.length}
          note="доступні для вибору"
        />
      </div>

      <div className="mt-6 space-y-6">
        <AdminCardSection
          title="Глобальний fallback"
          description="Застосовується, коли для бренду немає власного правила. Окремий тариф бренду за конкретною зоною завжди має вищий пріоритет."
          action={
            <AdminSwitch
              checked={defaultRule.enabled}
              onChange={(enabled) => setDefaultRule({ ...defaultRule, enabled })}
              label={defaultRule.enabled ? "Увімкнено" : "Вимкнено"}
            />
          }
        >
          <RuleFields
            rule={defaultRule}
            onChange={(patch) => setDefaultRule({ ...defaultRule, ...patch })}
          />
        </AdminCardSection>

        <AdminCardSection
          title={`Тарифи брендів (${rules.length})`}
          description="Регіон береться зі списку зон доставки. Для однакового бренду можна створити окремі рядки для Європи, США, України та інших зон."
          action={
            <AdminButton variant="primary" size="sm" icon={<Plus />} onClick={addRule}>
              Додати тариф
            </AdminButton>
          }
        >
          <div className="mb-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_auto]">
            <input
              value={brandFilter}
              onChange={(event) => setBrandFilter(event.target.value)}
              placeholder="Пошук бренду…"
              className="h-10 rounded-none border border-white/10 bg-black/30 px-3 text-sm text-zinc-100 outline-hidden placeholder:text-zinc-600 focus:border-blue-500/40"
            />
            <select
              value={zoneFilter}
              onChange={(event) => setZoneFilter(event.target.value)}
              className="h-10 rounded-none border border-white/10 bg-black/30 px-3 text-sm text-zinc-100 outline-hidden focus:border-blue-500/40"
            >
              <option value="all">Усі регіони</option>
              <option value="global">Тільки всі регіони</option>
              {zones.map((zone) => (
                <option key={zone.id} value={zone.id}>
                  {zone.name}
                  {!zone.enabled ? " · вимкнена" : ""}
                </option>
              ))}
            </select>
            <div className="flex h-10 items-center justify-end text-xs text-zinc-500">
              Показано {filteredRules.length}
            </div>
          </div>

          {filteredRules.length === 0 ? (
            <div className="rounded-none border border-dashed border-white/10 bg-black/20 p-8 text-center">
              <p className="text-sm text-zinc-300">Ще немає окремих тарифів брендів.</p>
              <p className="mt-1 text-xs text-zinc-500">
                Додайте перший рядок і виберіть бренд, регіон та фіксовану суму.
              </p>
              <AdminButton className="mt-4" variant="ghost" icon={<Plus />} onClick={addRule}>
                Додати перший тариф
              </AdminButton>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredRules.map((rule) => (
                <RuleRow
                  key={rule.id}
                  rule={rule}
                  brands={brandOptions}
                  zones={zones}
                  onChange={(patch) => patchRule(rule.id, patch)}
                  onClone={() => cloneRule(rule)}
                  onRemove={() => removeRule(rule.id)}
                />
              ))}
            </div>
          )}
        </AdminCardSection>
      </div>
    </AdminPage>
  );
}

function SummaryCard({ label, value, note }: { label: string; value: number; note: string }) {
  return (
    <div className="border border-white/8 bg-white/[0.025] px-4 py-3">
      <div className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">{label}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-2xl font-semibold text-white">{value}</span>
        <span className="text-xs text-zinc-500">{note}</span>
      </div>
    </div>
  );
}

function RuleRow({
  rule,
  brands,
  zones,
  onChange,
  onClone,
  onRemove,
}: {
  rule: Rule;
  brands: Brand[];
  zones: ShippingZone[];
  onChange: (patch: Partial<Rule>) => void;
  onClone: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="border border-white/8 bg-[#151515] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-zinc-100">
              {rule.brandName || "Новий тариф"}
            </span>
            <AdminStatusBadge tone={rule.enabled ? "success" : "default"}>
              {rule.enabled ? "Активний" : "Вимкнений"}
            </AdminStatusBadge>
          </div>
          <div className="mt-1 text-[11px] text-zinc-500">
            {zoneLabel(rule.shippingZoneId, zones)} · {MODE_LABELS[rule.mode]}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClone}
            className="inline-flex items-center gap-1 rounded-none border border-white/10 px-2.5 py-1.5 text-[11px] text-zinc-300 hover:bg-white/5"
            title="Копіювати тариф для іншого регіону"
          >
            <Copy className="h-3.5 w-3.5" /> Копіювати
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="rounded-none border border-red-500/25 p-2 text-red-300 hover:bg-red-500/10"
            title="Видалити тариф"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Field label="Бренд">
          <select
            value={rule.brandName}
            onChange={(event) => onChange({ brandName: event.target.value })}
            className={FIELD_INPUT_CLASS}
          >
            <option value="">Виберіть бренд</option>
            {rule.brandName && !brands.some((brand) => brand.brand === rule.brandName) ? (
              <option value={rule.brandName}>{rule.brandName}</option>
            ) : null}
            {brands.map((brand) => (
              <option key={brand.brand} value={brand.brand}>
                {brand.brand} {brand.productCount ? `(${brand.productCount})` : ""}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Регіон / зона доставки">
          <select
            value={rule.shippingZoneId}
            onChange={(event) => onChange({ shippingZoneId: event.target.value })}
            className={FIELD_INPUT_CLASS}
          >
            <option value="">Усі регіони бренду</option>
            {zones.map((zone) => (
              <option key={zone.id} value={zone.id}>
                {zone.name} {!zone.enabled ? "(вимкнена)" : ""}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Тип правила">
          <select
            value={rule.mode}
            onChange={(event) => onChange({ mode: event.target.value as Mode })}
            className={FIELD_INPUT_CLASS}
          >
            {MODES.map((mode) => (
              <option key={mode} value={mode}>
                {MODE_LABELS[mode]}
              </option>
            ))}
          </select>
        </Field>
        <div className="flex items-end pb-0.5">
          <AdminSwitch
            checked={rule.enabled}
            onChange={(enabled) => onChange({ enabled })}
            label={rule.enabled ? "Застосовується" : "Не застосовується"}
          />
        </div>
      </div>

      <div className="mt-3 border-t border-white/6 pt-3">
        <RuleFields rule={rule} onChange={onChange} compact />
      </div>
    </div>
  );
}

function RuleFields({
  rule,
  onChange,
  compact = false,
}: {
  rule: Rule;
  onChange: (patch: Partial<Rule>) => void;
  compact?: boolean;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <Field
        label={
          rule.mode === "fixed"
            ? "Фіксована доставка за товар"
            : rule.mode === "percent"
              ? "Відсоток від кошика"
              : rule.mode === "multiplier"
                ? "Множник стандартної доставки"
                : "Значення"
        }
      >
        <input
          type="number"
          min="0"
          step="0.01"
          value={rule.value}
          onChange={(event) => onChange({ value: event.target.value })}
          disabled={rule.mode === "free" || rule.mode === "tiered" || rule.mode === "manual_quote"}
          placeholder={rule.mode === "fixed" ? "120" : rule.mode === "percent" ? "5" : "1.25"}
          className={`${FIELD_INPUT_CLASS} disabled:opacity-40`}
        />
      </Field>
      <Field label="Валюта">
        <select
          value={rule.currency}
          onChange={(event) => onChange({ currency: event.target.value as Currency })}
          className={FIELD_INPUT_CLASS}
        >
          {CURRENCIES.map((currency) => (
            <option key={currency} value={currency}>
              {currency}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Додатково: виробник → склад, за кг">
        <input
          type="number"
          min="0"
          step="0.01"
          value={rule.warehouseRatePerKg}
          onChange={(event) => onChange({ warehouseRatePerKg: event.target.value })}
          placeholder="0"
          className={FIELD_INPUT_CLASS}
        />
      </Field>
      {rule.mode === "tiered" ? (
        <div className={compact ? "md:col-span-2 xl:col-span-4" : "md:col-span-2 xl:col-span-4"}>
          <BracketsEditor rule={rule} onChange={onChange} />
        </div>
      ) : null}
      {rule.mode === "manual_quote" ? (
        <div className="md:col-span-2 xl:col-span-4">
          <AdminInlineAlert tone="warning">
            Клієнт не отримає автоматичну суму. Замовлення переходить у ручний прорахунок.
          </AdminInlineAlert>
        </div>
      ) : null}
      {rule.mode === "percent" ? (
        <div className="md:col-span-2 xl:col-span-4 text-xs text-blue-200/75">
          Сума доставки = сума товарів цього бренду × відсоток / 100.
        </div>
      ) : null}
    </div>
  );
}

function BracketsEditor({
  rule,
  onChange,
}: {
  rule: Rule;
  onChange: (patch: Partial<Rule>) => void;
}) {
  function add() {
    onChange({ brackets: [...rule.brackets, { maxAmount: "", fee: "0" }] });
  }

  function patch(index: number, value: Partial<Bracket>) {
    onChange({
      brackets: rule.brackets.map((bracket, bracketIndex) =>
        bracketIndex === index ? { ...bracket, ...value } : bracket
      ),
    });
  }

  return (
    <div className="rounded-none border border-white/8 bg-black/25 p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-wider text-blue-300">
            Пороги суми кошика
          </div>
          <div className="text-[11px] text-zinc-500">
            Порожня верхня межа означає останній, відкритий поріг.
          </div>
        </div>
        <AdminButton variant="ghost" size="sm" icon={<Plus />} onClick={add}>
          Додати поріг
        </AdminButton>
      </div>
      {rule.brackets.length === 0 ? (
        <p className="text-xs text-zinc-500">Додайте хоча б один поріг.</p>
      ) : (
        <div className="space-y-2">
          {rule.brackets.map((bracket, index) => (
            <div key={index} className="flex flex-wrap items-end gap-2">
              <Field label={`Сума до (${rule.currency})`}>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={bracket.maxAmount}
                  onChange={(event) => patch(index, { maxAmount: event.target.value })}
                  placeholder="верхній поріг"
                  className={`${FIELD_INPUT_CLASS} w-44`}
                />
              </Field>
              <Field label={`Доставка (${rule.currency})`}>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={bracket.fee}
                  onChange={(event) => patch(index, { fee: event.target.value })}
                  placeholder="120"
                  className={`${FIELD_INPUT_CLASS} w-36`}
                />
              </Field>
              <button
                type="button"
                onClick={() =>
                  onChange({
                    brackets: rule.brackets.filter((_, bracketIndex) => bracketIndex !== index),
                  })
                }
                className="rounded-none border border-red-500/25 p-2 text-red-300 hover:bg-red-500/10"
                title="Видалити поріг"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function zoneLabel(zoneId: string, zones: ShippingZone[]) {
  if (!zoneId) return "Усі регіони";
  return zones.find((zone) => zone.id === zoneId)?.name ?? `Невідома зона (${zoneId})`;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 text-[10px] uppercase tracking-wider text-zinc-500">{label}</div>
      {children}
    </label>
  );
}

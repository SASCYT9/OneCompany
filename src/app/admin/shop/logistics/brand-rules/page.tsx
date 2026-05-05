'use client';

/**
 * Per-brand shipping rules editor with a global default fallback.
 *
 * Auto-lists every brand currently sold in the shop (via
 * `listShopBrands`), letting the operator attach a shipping rule to
 * each one inline. A dedicated "Default fallback" card at the top
 * defines the rule applied to any brand without its own.
 *
 * Persists into the existing `ShopSettings.brandShippingRules` JSON
 * array; the default rule lives in the same array under the special id
 * `SHOP_BRAND_DEFAULT_RULE_ID = '__default__'`. No Prisma migration.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Eye, Loader2, Plus, RefreshCw, Save, Trash2 } from 'lucide-react';

import {
  AdminButton,
  AdminCardSection,
  AdminInlineAlert,
  AdminPage,
  AdminPageHeader,
  AdminStatusBadge,
  AdminSwitch,
  AdminTableShell,
} from '@/components/admin/AdminPrimitives';

const SHOP_BRAND_DEFAULT_RULE_ID = '__default__';
const MODES = ['fixed', 'multiplier', 'free', 'tiered', 'percent', 'manual_quote'] as const;
type Mode = (typeof MODES)[number];
const CURRENCIES = ['EUR', 'USD', 'UAH'] as const;
type Currency = (typeof CURRENCIES)[number];

const MODE_LABELS: Record<Mode, string> = {
  fixed: 'Фіксована ставка',
  multiplier: 'Множник стандартної',
  free: 'Безкоштовно',
  tiered: 'Брекети суми',
  percent: 'Відсоток від кошика',
  manual_quote: 'Ручний прорахунок (запит)',
};

type Bracket = { maxAmount: string; fee: string };

type Rule = {
  id: string;
  brandName: string;
  mode: Mode;
  value: string;
  warehouseRatePerKg: string;
  currency: Currency;
  enabled: boolean;
  brackets: Bracket[];
};

type Brand = { brand: string; productCount: number; turn14BrandId: string | null };

type SettingsResponse = {
  brandShippingRules?: Array<{
    id: string;
    brandName: string;
    mode: Mode;
    value: number;
    warehouseRatePerKg: number;
    currency: Currency;
    enabled: boolean;
    brackets?: Array<{ maxAmount: number | null; fee: number }>;
  }>;
};

function emptyRule(id: string, brandName: string): Rule {
  return {
    id,
    brandName,
    mode: 'free',
    value: '0',
    warehouseRatePerKg: '0',
    currency: 'EUR',
    enabled: false,
    brackets: [],
  };
}

function ruleFromServer(r: NonNullable<SettingsResponse['brandShippingRules']>[number]): Rule {
  return {
    id: r.id,
    brandName: r.brandName,
    mode: r.mode,
    value: String(r.value ?? 0),
    warehouseRatePerKg: String(r.warehouseRatePerKg ?? 0),
    currency: r.currency,
    enabled: r.enabled,
    brackets: (r.brackets ?? []).map((b) => ({
      maxAmount: b.maxAmount === null ? '' : String(b.maxAmount),
      fee: String(b.fee),
    })),
  };
}

function ruleToServer(r: Rule) {
  const value = Number(r.value) || 0;
  const warehouseRatePerKg = Number(r.warehouseRatePerKg) || 0;
  const brackets =
    r.mode === 'tiered'
      ? r.brackets.map((b) => ({
          maxAmount: b.maxAmount.trim() === '' ? null : Number(b.maxAmount) || null,
          fee: Number(b.fee) || 0,
        }))
      : undefined;
  return {
    id: r.id,
    brandName: r.brandName,
    mode: r.mode,
    value,
    warehouseRatePerKg,
    currency: r.currency,
    enabled: r.enabled,
    ...(brackets ? { brackets } : {}),
  };
}

export default function BrandRulesPage() {
  const [defaultRule, setDefaultRule] = useState<Rule>(() =>
    emptyRule(SHOP_BRAND_DEFAULT_RULE_ID, ''),
  );
  const [brands, setBrands] = useState<Brand[]>([]);
  const [brandRules, setBrandRules] = useState<Record<string, Rule>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [settingsRes, brandsRes] = await Promise.all([
        fetch('/api/admin/shop/settings'),
        fetch('/api/admin/shop/turn14/sync-dimensions'),
      ]);
      if (!settingsRes.ok) throw new Error('Failed to load settings');
      const settings: SettingsResponse = await settingsRes.json();
      const brandsData = brandsRes.ok ? await brandsRes.json() : { brands: [] };
      const brandList: Brand[] = (brandsData.brands as Brand[]) ?? [];
      setBrands(brandList);

      const rules = settings.brandShippingRules ?? [];
      const def = rules.find((r) => r.id === SHOP_BRAND_DEFAULT_RULE_ID);
      setDefaultRule(def ? ruleFromServer(def) : emptyRule(SHOP_BRAND_DEFAULT_RULE_ID, ''));

      const map: Record<string, Rule> = {};
      for (const r of rules) {
        if (r.id === SHOP_BRAND_DEFAULT_RULE_ID) continue;
        if (!r.brandName) continue;
        map[r.brandName.toLowerCase()] = ruleFromServer(r);
      }
      // Ensure every brand has a row, even if only as a placeholder.
      for (const b of brandList) {
        const key = b.brand.toLowerCase();
        if (!map[key]) {
          map[key] = emptyRule(`brand-rule-${b.brand}`, b.brand);
        } else {
          // Overwrite displayed brandName with the canonical case from listShopBrands.
          map[key] = { ...map[key], brandName: b.brand };
        }
      }
      setBrandRules(map);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function patchBrandRule(brandKey: string, patch: Partial<Rule>) {
    setBrandRules((prev) => ({
      ...prev,
      [brandKey]: { ...prev[brandKey], ...patch },
    }));
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      // Build the final brandShippingRules array: default first, then every
      // brand row that's enabled OR has been customized away from the empty
      // default (so we don't pollute the JSON with no-op rows).
      const settingsRes = await fetch('/api/admin/shop/settings');
      if (!settingsRes.ok) throw new Error('Failed to fetch current settings for save');
      const current = await settingsRes.json();

      const brandRulesArr = Object.values(brandRules)
        .filter((r) => r.enabled || r.mode !== 'free' || r.value !== '0' || r.warehouseRatePerKg !== '0' || r.brackets.length > 0)
        .map(ruleToServer);

      const newBrandShippingRules = [ruleToServer(defaultRule), ...brandRulesArr];

      const payload = {
        ...current,
        brandShippingRules: newBrandShippingRules,
      };

      const res = await fetch('/api/admin/shop/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Save failed: ${text.slice(0, 200)}`);
      }
      setSavedAt(Date.now());
      // Re-load to reflect server-normalized state (e.g. sorted brackets).
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  const sortedBrandKeys = useMemo(
    () =>
      Object.keys(brandRules).sort((a, b) => {
        const ar = brandRules[a];
        const br = brandRules[b];
        const aActive = ar.enabled ? 1 : 0;
        const bActive = br.enabled ? 1 : 0;
        if (aActive !== bActive) return bActive - aActive;
        return ar.brandName.localeCompare(br.brandName);
      }),
    [brandRules],
  );

  if (loading) {
    return (
      <AdminPage>
        <div className="flex items-center justify-center py-20 text-zinc-400">
          <Loader2 className="mr-2 h-5 w-5 motion-safe:animate-spin" /> Завантаження…
        </div>
      </AdminPage>
    );
  }

  return (
    <AdminPage>
      <AdminPageHeader
        eyebrow="Логістика"
        title="Правила доставки за брендом"
        description="Кожен бренд може мати власну формулу доставки. Якщо власної нема — застосовується глобальний фолбек (зверху). Зміни зберігаються в ShopSettings.brandShippingRules і застосовуються в checkout."
        actions={
          <>
            <AdminButton variant="ghost" icon={<RefreshCw />} onClick={load} disabled={saving}>
              Оновити
            </AdminButton>
            <AdminButton variant="primary" icon={<Save />} onClick={save} loading={saving}>
              Зберегти
            </AdminButton>
          </>
        }
      />

      {error ? (
        <AdminInlineAlert tone="error" className="mt-4">
          {error}
        </AdminInlineAlert>
      ) : null}
      {savedAt ? (
        <AdminInlineAlert tone="success" className="mt-4">
          Збережено о {new Date(savedAt).toLocaleTimeString()}
        </AdminInlineAlert>
      ) : null}

      <div className="mt-6 space-y-6">
        <AdminCardSection
          title="Default fallback"
          description="Це правило застосовується до будь-якого бренду, для якого нема власного. Eventuri-стиль: брекети ≤300→$70 / ≤1000→$150 / >1000→$250 — типовий приклад."
          action={
            <AdminSwitch
              checked={defaultRule.enabled}
              onChange={(v) => setDefaultRule({ ...defaultRule, enabled: v })}
              label={defaultRule.enabled ? 'Увімкнено' : 'Вимкнено'}
            />
          }
        >
          <RuleEditor rule={defaultRule} onChange={(p) => setDefaultRule({ ...defaultRule, ...p })} />
        </AdminCardSection>

        <AdminCardSection
          title={`Бренди магазину (${brands.length})`}
          description="Кожен рядок — окреме правило. Заповни поля, постав 'Увімкнено', натисни 'Зберегти' зверху."
        >
          <AdminTableShell>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] bg-white/[0.02] text-[10px] uppercase tracking-[0.15em] text-zinc-500">
                  <th className="px-3 py-3 font-medium">Бренд</th>
                  <th className="px-3 py-3 font-medium">Режим</th>
                  <th className="px-3 py-3 font-medium">Параметри</th>
                  <th className="px-3 py-3 font-medium">Склад $/кг</th>
                  <th className="px-3 py-3 font-medium">Валюта</th>
                  <th className="px-3 py-3 font-medium">Стан</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {sortedBrandKeys.map((key) => {
                  const r = brandRules[key];
                  const brand = brands.find((b) => b.brand.toLowerCase() === key);
                  return (
                    <tr key={key} className="align-top">
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          {brand?.turn14BrandId ? (
                            <span className="rounded-sm bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-emerald-300">
                              T14
                            </span>
                          ) : null}
                          <span className="font-medium text-zinc-100">{r.brandName}</span>
                        </div>
                        <div className="mt-1 text-[10px] uppercase tracking-wider text-zinc-500">
                          {brand?.productCount ?? 0} товарів
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <select
                          value={r.mode}
                          onChange={(e) => patchBrandRule(key, { mode: e.target.value as Mode })}
                          className="rounded-none border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-zinc-100 focus:border-blue-500/40 focus:outline-none"
                        >
                          {MODES.map((m) => (
                            <option key={m} value={m}>
                              {MODE_LABELS[m]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-3">
                        <ModeFields rule={r} onChange={(p) => patchBrandRule(key, p)} />
                      </td>
                      <td className="px-3 py-3">
                        <input
                          type="number"
                          step="0.1"
                          value={r.warehouseRatePerKg}
                          onChange={(e) => patchBrandRule(key, { warehouseRatePerKg: e.target.value })}
                          className="w-20 rounded-none border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-zinc-100 focus:border-blue-500/40 focus:outline-none"
                        />
                      </td>
                      <td className="px-3 py-3">
                        <select
                          value={r.currency}
                          onChange={(e) => patchBrandRule(key, { currency: e.target.value as Currency })}
                          className="rounded-none border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-zinc-100 focus:border-blue-500/40 focus:outline-none"
                        >
                          {CURRENCIES.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-col gap-1">
                          <AdminSwitch
                            checked={r.enabled}
                            onChange={(v) => patchBrandRule(key, { enabled: v })}
                            label={r.enabled ? 'Увімк.' : 'Вимк.'}
                          />
                          <AdminStatusBadge tone={r.enabled ? 'success' : defaultRule.enabled ? 'warning' : 'default'}>
                            {r.enabled ? 'Custom' : defaultRule.enabled ? 'Default' : 'No rule'}
                          </AdminStatusBadge>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </AdminTableShell>
        </AdminCardSection>
      </div>
    </AdminPage>
  );
}

function RuleEditor({ rule, onChange }: { rule: Rule; onChange: (p: Partial<Rule>) => void }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <Field label="Режим">
        <select
          value={rule.mode}
          onChange={(e) => onChange({ mode: e.target.value as Mode })}
          className="w-full rounded-none border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100 focus:border-blue-500/40 focus:outline-none"
        >
          {MODES.map((m) => (
            <option key={m} value={m}>
              {MODE_LABELS[m]}
            </option>
          ))}
        </select>
      </Field>
      <Field label={rule.mode === 'percent' ? 'Відсоток (%)' : rule.mode === 'multiplier' ? 'Множник' : 'Значення'}>
        <input
          type="number"
          step="0.1"
          value={rule.value}
          onChange={(e) => onChange({ value: e.target.value })}
          disabled={rule.mode === 'free' || rule.mode === 'tiered' || rule.mode === 'manual_quote'}
          className="w-full rounded-none border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100 focus:border-blue-500/40 focus:outline-none disabled:opacity-40"
        />
      </Field>
      <Field label="Склад $/кг">
        <input
          type="number"
          step="0.1"
          value={rule.warehouseRatePerKg}
          onChange={(e) => onChange({ warehouseRatePerKg: e.target.value })}
          className="w-full rounded-none border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100 focus:border-blue-500/40 focus:outline-none"
        />
      </Field>
      <Field label="Валюта">
        <select
          value={rule.currency}
          onChange={(e) => onChange({ currency: e.target.value as Currency })}
          className="w-full rounded-none border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100 focus:border-blue-500/40 focus:outline-none"
        >
          {CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </Field>
      {rule.mode === 'tiered' ? (
        <div className="md:col-span-2 xl:col-span-4">
          <BracketsEditor rule={rule} onChange={onChange} />
        </div>
      ) : null}
      {rule.mode === 'manual_quote' ? (
        <div className="md:col-span-2 xl:col-span-4">
          <AdminInlineAlert tone="warning">
            Цей режим блокує стандартний checkout — покупець побачить кнопку «Запит на прорахунок».
          </AdminInlineAlert>
        </div>
      ) : null}
      {rule.mode === 'percent' ? (
        <div className="md:col-span-2 xl:col-span-4 text-[12px] text-blue-200/80">
          Доставка = <code className="text-zinc-300">сума_кошика_бренду × {rule.value || '?'}% / 100</code> у валюті{' '}
          {rule.currency}.
        </div>
      ) : null}
    </div>
  );
}

function ModeFields({ rule, onChange }: { rule: Rule; onChange: (p: Partial<Rule>) => void }) {
  if (rule.mode === 'free' || rule.mode === 'manual_quote') {
    return <span className="text-[11px] text-zinc-500">—</span>;
  }
  if (rule.mode === 'tiered') {
    return (
      <details>
        <summary className="cursor-pointer text-[11px] uppercase tracking-wider text-blue-300">
          Брекетів: {rule.brackets.length} (показати)
        </summary>
        <div className="mt-2">
          <BracketsEditor rule={rule} onChange={onChange} />
        </div>
      </details>
    );
  }
  return (
    <input
      type="number"
      step="0.1"
      value={rule.value}
      onChange={(e) => onChange({ value: e.target.value })}
      placeholder={rule.mode === 'multiplier' ? '1.25' : rule.mode === 'percent' ? '5' : '150'}
      className="w-24 rounded-none border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-zinc-100 focus:border-blue-500/40 focus:outline-none"
    />
  );
}

function BracketsEditor({ rule, onChange }: { rule: Rule; onChange: (p: Partial<Rule>) => void }) {
  function add() {
    onChange({ brackets: [...rule.brackets, { maxAmount: '', fee: '0' }] });
  }
  function remove(idx: number) {
    onChange({ brackets: rule.brackets.filter((_, i) => i !== idx) });
  }
  function patch(idx: number, p: Partial<Bracket>) {
    onChange({
      brackets: rule.brackets.map((b, i) => (i === idx ? { ...b, ...p } : b)),
    });
  }
  return (
    <div className="rounded-none border border-white/[0.08] bg-black/30 p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[11px] uppercase tracking-wider text-blue-300">Брекети тарифів</div>
        <AdminButton variant="ghost" size="sm" icon={<Plus />} onClick={add}>
          Брекет
        </AdminButton>
      </div>
      {rule.brackets.length === 0 ? (
        <p className="text-[11px] text-zinc-500">Немає брекетів. Додай хоча б один.</p>
      ) : (
        <div className="space-y-2">
          {rule.brackets.map((b, idx) => (
            <div key={idx} className="flex flex-wrap items-end gap-2">
              <Field label={`Сума до (${rule.currency})`}>
                <input
                  type="number"
                  step="0.1"
                  value={b.maxAmount}
                  onChange={(e) => patch(idx, { maxAmount: e.target.value })}
                  placeholder="порожнє = відкритий брекет"
                  className="w-44 rounded-none border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-zinc-100 focus:border-blue-500/40 focus:outline-none"
                />
              </Field>
              <Field label={`Доставка (${rule.currency})`}>
                <input
                  type="number"
                  step="0.1"
                  value={b.fee}
                  onChange={(e) => patch(idx, { fee: e.target.value })}
                  placeholder="70"
                  className="w-32 rounded-none border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-zinc-100 focus:border-blue-500/40 focus:outline-none"
                />
              </Field>
              <button
                type="button"
                onClick={() => remove(idx)}
                className="rounded-none border border-blue-500/30 bg-blue-950/20 p-2 text-blue-300 hover:border-blue-500/50 hover:bg-blue-950/40"
                aria-label="Видалити брекет"
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 text-[10px] uppercase tracking-wider text-zinc-500">{label}</div>
      {children}
    </label>
  );
}

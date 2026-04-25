'use client';

import { useState } from 'react';
import { ChevronDown, GripVertical, Star, Trash2 } from 'lucide-react';

import {
  AdminCheckboxField as CheckboxField,
  AdminInputField as InputField,
  AdminSelectField as SelectField,
} from '@/components/admin/AdminFormFields';
import { cn } from '@/lib/utils';

type InventoryPolicy = 'DENY' | 'CONTINUE';

export type VariantCardData = {
  id?: string;
  title: string;
  sku: string;
  position: string;
  option1Value: string;
  option1LinkedTo: string;
  option2Value: string;
  option2LinkedTo: string;
  option3Value: string;
  option3LinkedTo: string;
  grams: string;
  inventoryTracker: string;
  inventoryQty: string;
  inventoryPolicy: InventoryPolicy;
  fulfillmentService: string;
  priceEur: string;
  priceUsd: string;
  priceUah: string;
  priceEurB2b: string;
  priceUsdB2b: string;
  priceUahB2b: string;
  compareAtEur: string;
  compareAtUsd: string;
  compareAtUah: string;
  compareAtEurB2b: string;
  compareAtUsdB2b: string;
  compareAtUahB2b: string;
  requiresShipping: boolean;
  taxable: boolean;
  barcode: string;
  image: string;
  weightUnit: string;
  taxCode: string;
  costPerItem: string;
  isDefault: boolean;
  weight: string;
  length: string;
  width: string;
  height: string;
  isDimensionsEstimated: boolean;
};

type MediaOption = {
  src: string;
  label: string;
};

type Tab = 'general' | 'pricing' | 'inventory' | 'shipping';

export function AdminProductVariantCard({
  variant,
  index,
  totalVariants,
  mediaOptions,
  onUpdate,
  onRemove,
  onSetDefault,
  defaultOpen = false,
}: {
  variant: VariantCardData;
  index: number;
  totalVariants: number;
  mediaOptions: MediaOption[];
  onUpdate: (patch: Partial<VariantCardData>) => void;
  onRemove: () => void;
  onSetDefault: () => void;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [tab, setTab] = useState<Tab>('general');

  const optionSummary = [variant.option1Value, variant.option2Value, variant.option3Value]
    .filter(Boolean)
    .join(' / ');

  const priceSummary = variant.priceUah
    ? `${variant.priceUah}₴`
    : variant.priceEur
      ? `€${variant.priceEur}`
      : variant.priceUsd
        ? `$${variant.priceUsd}`
        : '—';

  const stock = variant.inventoryQty ? Number(variant.inventoryQty) : null;
  const stockTone = stock == null ? 'stone' : stock <= 0 ? 'red' : stock < 5 ? 'amber' : 'emerald';

  const stockColor =
    stockTone === 'red'
      ? 'border-blue-500/30 bg-blue-950/30 text-red-200'
      : stockTone === 'amber'
        ? 'border-amber-400/25 bg-amber-500/[0.1] text-amber-200'
        : stockTone === 'emerald'
          ? 'border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-200'
          : 'border-white/[0.1] bg-white/[0.04] text-zinc-400';

  const variantImageSrc = variant.image.trim();
  const isLinked = mediaOptions.some((m) => m.src === variantImageSrc);

  return (
    <div
      className={cn(
        'group rounded-[6px] border bg-gradient-to-b from-[#141B33] to-[#0E1325] shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_1px_2px_rgba(0,0,0,0.4)] transition-all',
        variant.isDefault ? 'border-blue-500/30' : 'border-white/[0.07]',
        open && 'shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_30px_rgba(0,0,0,0.4)]'
      )}
    >
      {/* Header — clickable summary */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={`${open ? 'Collapse' : 'Expand'} variant ${variant.title || `#${index + 1}`}`}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:ring-inset"
      >
        <GripVertical className="h-4 w-4 shrink-0 text-zinc-600" aria-hidden="true" />

        {/* Image preview */}
        <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[8px] border border-white/[0.07] bg-black/40">
          {variantImageSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={variantImageSrc}
              alt=""
              className="h-full w-full object-cover"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            <div className="text-[10px] uppercase tracking-wider text-zinc-600">No img</div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-semibold text-zinc-50">
              {variant.title || optionSummary || `Variant #${index + 1}`}
            </span>
            {variant.isDefault ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-blue-500/30 bg-blue-400/[0.1] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-blue-300">
                <Star className="h-2.5 w-2.5 fill-blue-400 text-blue-300" />
                Default
              </span>
            ) : null}
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-xs text-zinc-500">
            {variant.sku ? <span className="font-mono">{variant.sku}</span> : <span>SKU: —</span>}
            {optionSummary && variant.title ? <span>· {optionSummary}</span> : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <span className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-medium', stockColor)}>
            {stock == null ? '—' : `${stock} in stock`}
          </span>
          <span className="hidden text-sm font-semibold text-zinc-100 sm:inline">{priceSummary}</span>
          <ChevronDown
            aria-hidden="true"
            className={cn('h-4 w-4 shrink-0 text-zinc-400 transition-transform', open && 'rotate-180')}
          />
        </div>
      </button>

      {/* Body */}
      {open ? (
        <div className="border-t border-white/[0.06] px-4 pb-5 pt-4">
          {/* Action row */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              {!variant.isDefault ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSetDefault();
                  }}
                  className="inline-flex h-8 items-center gap-1.5 rounded-[6px] border border-white/[0.08] bg-white/[0.03] px-3 text-xs font-medium text-zinc-200 transition hover:border-blue-500/40 hover:text-blue-300"
                >
                  <Star className="h-3.5 w-3.5" />
                  Make default
                </button>
              ) : null}
            </div>
            {totalVariants > 1 ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove();
                }}
                className="inline-flex h-8 items-center gap-1.5 rounded-[6px] border border-blue-500/25 bg-blue-950/20 px-3 text-xs font-medium text-red-200 transition hover:border-blue-500/50 hover:bg-blue-950/40"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete variant
              </button>
            ) : null}
          </div>

          {/* Tabs */}
          <div role="tablist" aria-label="Variant sections" className="mb-4 flex gap-1 rounded-[6px] border border-white/[0.06] bg-black/30 p-1">
            {(['general', 'pricing', 'inventory', 'shipping'] as Tab[]).map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                onClick={(e) => {
                  e.stopPropagation();
                  setTab(t);
                }}
                className={cn(
                  'flex-1 rounded-[4px] px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-all',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#171717]',
                  tab === t
                    ? 'bg-gradient-to-b from-white/[0.08] to-white/[0.03] text-zinc-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
                    : 'text-zinc-400 hover:text-zinc-200'
                )}
              >
                {t}
              </button>
            ))}
          </div>

          {/* General */}
          {tab === 'general' ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <InputField label="Title" value={variant.title} onChange={(v) => onUpdate({ title: v })} />
              <InputField label="SKU" value={variant.sku} mono onChange={(v) => onUpdate({ sku: v })} />
              <InputField label="Position" type="number" value={variant.position} onChange={(v) => onUpdate({ position: v })} />

              <SelectField
                label="Linked product media"
                value={isLinked ? variantImageSrc : '__custom__'}
                onChange={(v) => onUpdate({ image: v === '__custom__' ? '' : v })}
                options={[
                  { label: 'Custom URL / none', value: '__custom__' },
                  ...mediaOptions.map((m, i) => ({
                    label: `Media #${i + 1} · ${m.label}`,
                    value: m.src,
                  })),
                ]}
                className="md:col-span-2 xl:col-span-2"
              />
              <InputField label="Custom image URL" value={variant.image} onChange={(v) => onUpdate({ image: v })} />

              <InputField label="Option 1 value" value={variant.option1Value} onChange={(v) => onUpdate({ option1Value: v })} />
              <InputField label="Option 2 value" value={variant.option2Value} onChange={(v) => onUpdate({ option2Value: v })} />
              <InputField label="Option 3 value" value={variant.option3Value} onChange={(v) => onUpdate({ option3Value: v })} />
              <InputField label="Option 1 linked to" value={variant.option1LinkedTo} onChange={(v) => onUpdate({ option1LinkedTo: v })} />
              <InputField label="Option 2 linked to" value={variant.option2LinkedTo} onChange={(v) => onUpdate({ option2LinkedTo: v })} />
              <InputField label="Option 3 linked to" value={variant.option3LinkedTo} onChange={(v) => onUpdate({ option3LinkedTo: v })} />
            </div>
          ) : null}

          {/* Pricing — grouped */}
          {tab === 'pricing' ? (
            <div className="space-y-5">
              <PricingGroup
                title="B2C — Retail"
                description="Customer-facing storefront pricing"
                eur={variant.priceEur}
                usd={variant.priceUsd}
                uah={variant.priceUah}
                onChange={(p) => onUpdate({ priceEur: p.eur, priceUsd: p.usd, priceUah: p.uah })}
              />
              <PricingGroup
                title="B2B — Wholesale"
                description="Pricing for B2B customers and dealers"
                eur={variant.priceEurB2b}
                usd={variant.priceUsdB2b}
                uah={variant.priceUahB2b}
                onChange={(p) => onUpdate({ priceEurB2b: p.eur, priceUsdB2b: p.usd, priceUahB2b: p.uah })}
              />
              <PricingGroup
                title="B2C — Compare-at"
                description="Original price shown crossed-out (for sales)"
                eur={variant.compareAtEur}
                usd={variant.compareAtUsd}
                uah={variant.compareAtUah}
                onChange={(p) => onUpdate({ compareAtEur: p.eur, compareAtUsd: p.usd, compareAtUah: p.uah })}
              />
              <PricingGroup
                title="B2B — Compare-at"
                description="Wholesale compare-at pricing"
                eur={variant.compareAtEurB2b}
                usd={variant.compareAtUsdB2b}
                uah={variant.compareAtUahB2b}
                onChange={(p) => onUpdate({ compareAtEurB2b: p.eur, compareAtUsdB2b: p.usd, compareAtUahB2b: p.uah })}
              />
              <div className="grid gap-3 md:grid-cols-2">
                <InputField
                  label="Cost per item"
                  type="number"
                  step="0.01"
                  value={variant.costPerItem}
                  onChange={(v) => onUpdate({ costPerItem: v })}
                  helper="Used for margin calculation"
                />
                <InputField label="Tax code" value={variant.taxCode} onChange={(v) => onUpdate({ taxCode: v })} />
              </div>
            </div>
          ) : null}

          {/* Inventory */}
          {tab === 'inventory' ? (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-3">
                <InputField
                  label="Quantity in stock"
                  type="number"
                  value={variant.inventoryQty}
                  onChange={(v) => onUpdate({ inventoryQty: v })}
                />
                <SelectField
                  label="Inventory policy"
                  value={variant.inventoryPolicy}
                  onChange={(v) => onUpdate({ inventoryPolicy: v as InventoryPolicy })}
                  options={[
                    { label: 'Continue selling when out of stock', value: 'CONTINUE' },
                    { label: 'Stop selling when out of stock', value: 'DENY' },
                  ]}
                />
                <InputField
                  label="Inventory tracker"
                  value={variant.inventoryTracker}
                  onChange={(v) => onUpdate({ inventoryTracker: v })}
                  helper="e.g. shopify, manual, turn14"
                />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <InputField label="Barcode (ISBN, UPC, GTIN)" value={variant.barcode} onChange={(v) => onUpdate({ barcode: v })} />
                <InputField label="Fulfillment service" value={variant.fulfillmentService} onChange={(v) => onUpdate({ fulfillmentService: v })} />
              </div>
            </div>
          ) : null}

          {/* Shipping */}
          {tab === 'shipping' ? (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-4">
                <InputField label="Weight" type="number" step="0.01" value={variant.weight} suffix="kg" onChange={(v) => onUpdate({ weight: v })} />
                <InputField label="Length" type="number" step="0.1" value={variant.length} suffix="cm" onChange={(v) => onUpdate({ length: v })} />
                <InputField label="Width" type="number" step="0.1" value={variant.width} suffix="cm" onChange={(v) => onUpdate({ width: v })} />
                <InputField label="Height" type="number" step="0.1" value={variant.height} suffix="cm" onChange={(v) => onUpdate({ height: v })} />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <InputField label="Grams (override)" type="number" value={variant.grams} onChange={(v) => onUpdate({ grams: v })} />
                <InputField label="Weight unit" value={variant.weightUnit} onChange={(v) => onUpdate({ weightUnit: v })} placeholder="kg / lb / g" />
              </div>
              <div className="flex flex-wrap gap-6 rounded-[6px] border border-white/[0.06] bg-black/30 p-4">
                <CheckboxField
                  label="Requires shipping"
                  checked={variant.requiresShipping}
                  onChange={(c) => onUpdate({ requiresShipping: c })}
                />
                <CheckboxField
                  label="Taxable"
                  checked={variant.taxable}
                  onChange={(c) => onUpdate({ taxable: c })}
                />
                <CheckboxField
                  label="Dimensions estimated"
                  checked={variant.isDimensionsEstimated}
                  onChange={(c) => onUpdate({ isDimensionsEstimated: c })}
                  helper="Marks dimensions as AI-estimated, not measured"
                />
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function PricingGroup({
  title,
  description,
  eur,
  usd,
  uah,
  onChange,
}: {
  title: string;
  description?: string;
  eur: string;
  usd: string;
  uah: string;
  onChange: (p: { eur: string; usd: string; uah: string }) => void;
}) {
  return (
    <div className="rounded-[6px] border border-white/[0.06] bg-black/20 p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-zinc-100">{title}</div>
          {description ? <div className="mt-0.5 text-xs text-zinc-500">{description}</div> : null}
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <InputField label="EUR" prefix="€" type="number" step="0.01" value={eur} onChange={(v) => onChange({ eur: v, usd, uah })} />
        <InputField label="USD" prefix="$" type="number" step="0.01" value={usd} onChange={(v) => onChange({ eur, usd: v, uah })} />
        <InputField label="UAH" prefix="₴" type="number" step="0.01" value={uah} onChange={(v) => onChange({ eur, usd, uah: v })} />
      </div>
    </div>
  );
}

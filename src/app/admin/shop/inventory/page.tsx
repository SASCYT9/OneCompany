'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Boxes, CheckSquare, RefreshCcw, Search, Warehouse } from 'lucide-react';

type InventoryRow = {
  id: string;
  productId: string;
  title: string | null;
  sku: string | null;
  position: number;
  inventoryQty: number;
  inventoryPolicy: 'DENY' | 'CONTINUE';
  inventoryTracker: string | null;
  fulfillmentService: string | null;
  image: string | null;
  isDefault: boolean;
  updatedAt: string;
  product: {
    id: string;
    slug: string;
    titleUa: string;
    titleEn: string;
    brand: string | null;
    vendor: string | null;
    scope: string;
    status: string;
    isPublished: boolean;
    stock: string;
    collectionIds: string[];
    collectionHandles: string[];
  };
};

type BulkInventoryState = {
  inventoryQty: string;
  inventoryAdjustment: string;
  inventoryPolicy: '' | 'DENY' | 'CONTINUE';
  inventoryTracker: string;
  fulfillmentService: string;
};

function createEmptyBulkState(): BulkInventoryState {
  return {
    inventoryQty: '',
    inventoryAdjustment: '',
    inventoryPolicy: '',
    inventoryTracker: '',
    fulfillmentService: '',
  };
}

export default function AdminInventoryPage() {
  const [variants, setVariants] = useState<InventoryRow[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [query, setQuery] = useState('');
  const [bulk, setBulk] = useState<BulkInventoryState>(createEmptyBulkState());

  useEffect(() => {
    void load();
  }, []);

  const filteredVariants = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return variants;
    return variants.filter((variant) =>
      [
        variant.product.slug,
        variant.product.titleEn,
        variant.product.titleUa,
        variant.product.brand,
        variant.product.vendor,
        variant.title,
        variant.sku,
        ...variant.product.collectionHandles,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle))
    );
  }, [variants, query]);

  const visibleIds = filteredVariants.map((variant) => variant.id);
  const selectedVisibleCount = visibleIds.filter((id) => selectedIds.includes(id)).length;

  async function load() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/shop/inventory');
      const data = await response.json().catch(() => []);
      if (!response.ok) {
        setError(data.error || 'Failed to load inventory');
        return;
      }
      setVariants(data as InventoryRow[]);
    } finally {
      setLoading(false);
    }
  }

  function toggleSelection(id: string) {
    setSelectedIds((current) => (current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]));
  }

  function selectVisible() {
    setSelectedIds((current) => Array.from(new Set([...current, ...visibleIds])));
  }

  function clearSelection() {
    setSelectedIds([]);
  }

  async function applyBulk() {
    setError('');
    setSuccess('');

    if (!selectedIds.length) {
      setError('Select at least one variant.');
      return;
    }
    if (bulk.inventoryQty.trim() && bulk.inventoryAdjustment.trim()) {
      setError('Use either set quantity or adjustment, not both.');
      return;
    }

    const payload: Record<string, unknown> = {
      variantIds: selectedIds,
    };

    if (bulk.inventoryQty.trim()) payload.inventoryQty = Number(bulk.inventoryQty);
    if (bulk.inventoryAdjustment.trim()) payload.inventoryAdjustment = Number(bulk.inventoryAdjustment);
    if (bulk.inventoryPolicy) payload.inventoryPolicy = bulk.inventoryPolicy;
    if (bulk.inventoryTracker.trim()) payload.inventoryTracker = bulk.inventoryTracker.trim();
    if (bulk.fulfillmentService.trim()) payload.fulfillmentService = bulk.fulfillmentService.trim();

    if (Object.keys(payload).length === 1) {
      setError('Enter at least one bulk inventory change.');
      return;
    }

    setApplying(true);
    try {
      const response = await fetch('/api/admin/shop/inventory', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || 'Failed to update inventory');
        return;
      }
      setSuccess(`Updated ${data.updatedCount ?? selectedIds.length} variants.`);
      setBulk(createEmptyBulkState());
      await load();
    } finally {
      setApplying(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6 text-white/60 flex items-center gap-2">
        <Warehouse className="h-5 w-5 animate-pulse" />
        Loading inventory…
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto max-w-7xl p-6">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link href="/admin/shop" className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white">
              <ArrowLeft className="h-4 w-4" />
              Back to catalog
            </Link>
            <h2 className="mt-3 text-2xl font-semibold text-white">Inventory</h2>
            <p className="mt-2 text-sm text-white/45">
              Bulk inventory operations for variant quantities, tracking, and fulfillment fields.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/admin/shop/pricing" className="rounded-lg border border-white/10 bg-zinc-800 px-4 py-2 text-sm text-white hover:bg-zinc-700">
              Pricing
            </Link>
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-zinc-800 px-4 py-2 text-sm text-white hover:bg-zinc-700"
            >
              <RefreshCcw className="h-4 w-4" />
              Refresh
            </button>
          </div>
        </div>

        <div className="mb-4 grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="grid gap-2 text-sm text-white/70 md:grid-cols-4">
              <div>{variants.length} variants</div>
              <div>{variants.filter((variant) => variant.inventoryQty > 0).length} in stock</div>
              <div>{variants.filter((variant) => variant.inventoryQty <= 0).length} zero/negative</div>
              <div>{variants.filter((variant) => variant.inventoryTracker).length} tracked</div>
            </div>
            <label className="mt-4 flex items-center gap-2 rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white">
              <Search className="h-4 w-4 text-white/35" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by product, variant, SKU, collection"
                className="w-full bg-transparent text-white placeholder:text-white/25 focus:outline-none"
              />
            </label>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-white">Selection</div>
                <div className="mt-1 text-xs text-white/45">
                  {selectedIds.length} selected, {selectedVisibleCount} visible
                </div>
              </div>
              <CheckSquare className="h-5 w-5 text-white/35" />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={selectVisible} className="rounded-lg border border-white/15 px-3 py-2 text-xs text-white hover:bg-white/5">
                Select visible
              </button>
              <button type="button" onClick={clearSelection} className="rounded-lg border border-white/15 px-3 py-2 text-xs text-white hover:bg-white/5">
                Clear
              </button>
            </div>
          </div>
        </div>

        {error ? <div className="mb-4 rounded-lg bg-red-900/20 p-3 text-sm text-red-300">{error}</div> : null}
        {success ? <div className="mb-4 rounded-lg bg-green-900/20 p-3 text-sm text-green-200">{success}</div> : null}

        <div className="mb-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="mb-4">
            <h3 className="text-lg font-medium text-white">Bulk update</h3>
            <p className="mt-1 text-sm text-white/45">
              Set inventory quantities or apply a delta across selected variants. Product stock state syncs automatically after update.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-5">
            <InputField label="Встановити кількість" value={bulk.inventoryQty} onChange={(value) => setBulk((current) => ({ ...current, inventoryQty: value }))} type="number" />
            <InputField label="Змінити на" value={bulk.inventoryAdjustment} onChange={(value) => setBulk((current) => ({ ...current, inventoryAdjustment: value }))} type="number" />
            <SelectField
              label="Inventory policy"
              value={bulk.inventoryPolicy}
              onChange={(value) => setBulk((current) => ({ ...current, inventoryPolicy: value as BulkInventoryState['inventoryPolicy'] }))}
              options={[
                { value: '', label: 'Keep as is' },
                { value: 'CONTINUE', label: 'Continue' },
                { value: 'DENY', label: 'Deny' },
              ]}
            />
            <InputField label="Відстеження складу" value={bulk.inventoryTracker} onChange={(value) => setBulk((current) => ({ ...current, inventoryTracker: value }))} />
            <InputField label="Служба виконання" value={bulk.fulfillmentService} onChange={(value) => setBulk((current) => ({ ...current, fulfillmentService: value }))} />
          </div>
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={applyBulk}
              disabled={applying}
              className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-black hover:bg-white/90 disabled:opacity-50"
            >
              <Boxes className="h-4 w-4" />
              {applying ? 'Applying…' : 'Apply to selected'}
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/10">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="px-4 py-3 font-medium text-white/60">Select</th>
                  <th className="px-4 py-3 font-medium text-white/60">Product</th>
                  <th className="px-4 py-3 font-medium text-white/60">Variant</th>
                  <th className="px-4 py-3 font-medium text-white/60">Collections</th>
                  <th className="px-4 py-3 font-medium text-white/60">Qty</th>
                  <th className="px-4 py-3 font-medium text-white/60">Policy</th>
                  <th className="px-4 py-3 font-medium text-white/60">Tracker</th>
                  <th className="px-4 py-3 font-medium text-white/60">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredVariants.map((variant) => (
                  <tr key={variant.id} className="border-b border-white/5 align-top hover:bg-white/[0.03]">
                    <td className="px-4 py-4">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(variant.id)}
                        onChange={() => toggleSelection(variant.id)}
                        className="h-4 w-4 rounded border-white/20 bg-zinc-950"
                      />
                    </td>
                    <td className="px-4 py-4">
                      <div className="font-medium text-white">{variant.product.titleEn || variant.product.titleUa}</div>
                      <div className="mt-1 font-mono text-xs text-white/45">{variant.product.slug}</div>
                      <div className="mt-1 text-xs text-white/45">
                        {[variant.product.brand, variant.product.vendor].filter(Boolean).join(' · ') || '—'}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-white/80">
                        {variant.title || `Variant #${variant.position}`} {variant.isDefault ? '· Default' : ''}
                      </div>
                      <div className="mt-1 font-mono text-xs text-white/45">{variant.sku || 'No SKU'}</div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex max-w-[280px] flex-wrap gap-1.5">
                        {variant.product.collectionHandles.length ? (
                          variant.product.collectionHandles.map((handle) => (
                            <span key={handle} className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-white/60">
                              {handle}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-white/35">No collections</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-white/80">{variant.inventoryQty}</td>
                    <td className="px-4 py-4 text-white/70">{variant.inventoryPolicy}</td>
                    <td className="px-4 py-4 text-white/45">
                      <div>{variant.inventoryTracker || '—'}</div>
                      <div className="mt-1 text-xs">{variant.fulfillmentService || '—'}</div>
                    </td>
                    <td className="px-4 py-4">
                      <Link href={`/admin/shop/${variant.productId}`} className="text-sm text-white/70 hover:text-white">
                        Edit product
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

type InputFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
};

function InputField({ label, value, onChange, type = 'text' }: InputFieldProps) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs text-white/50">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white placeholder:text-white/25 focus:border-white/30 focus:outline-none"
      />
    </label>
  );
}

type SelectFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
};

function SelectField({ label, value, onChange, options }: SelectFieldProps) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs text-white/50">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white focus:border-white/30 focus:outline-none"
      >
        {options.map((option) => (
          <option key={option.value || option.label} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

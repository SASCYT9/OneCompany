'use client';

import { useEffect, useMemo, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Boxes, CheckSquare, Download, RefreshCcw, Search, Warehouse } from 'lucide-react';

import {
  AdminActionBar,
  AdminEmptyState,
  AdminFilterBar,
  AdminInlineAlert,
  AdminMetricCard,
  AdminMetricGrid,
  AdminPage,
  AdminPageHeader,
  AdminTableShell,
} from '@/components/admin/AdminPrimitives';
import {
  AdminInputField as InputField,
  AdminSelectField as SelectField,
} from '@/components/admin/AdminFormFields';
import { useToast } from '@/components/admin/AdminToast';

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
  inventoryLevels?: {
    id: string;
    locationId: string;
    locationName: string;
    locationCode: string;
    stockedQuantity: number;
    reservedQuantity: number;
    incomingQuantity: number;
  }[];
};

type ShopLocation = {
  id: string;
  code: string;
  name: string;
  nameUa: string | null;
  country: string;
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

function AdminInventoryPageContent() {
  const toast = useToast();
  const searchParams = useSearchParams();
  const initialBrand = searchParams.get('brand') || 'ALL';

  const [variants, setVariants] = useState<InventoryRow[]>([]);
  const [locations, setLocations] = useState<ShopLocation[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [query, setQuery] = useState('');
  const [brandFilter, setBrandFilter] = useState<string>(initialBrand);
  const [bulk, setBulk] = useState<BulkInventoryState>(createEmptyBulkState());
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      const response = await fetch(`/api/admin/export/inventory`, { cache: 'no-store' });
      if (!response.ok) {
        toast.error('Could not export inventory');
        return;
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = response.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1] || 'inventory.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('Inventory exported', `Downloaded ${a.download}`);
    } catch (e) {
      toast.error('Export failed', (e as Error).message);
    } finally {
      setExporting(false);
    }
  }

  useEffect(() => {
    if (searchParams.get('brand')) {
      setBrandFilter(searchParams.get('brand') as string);
    }
  }, [searchParams]);

  useEffect(() => {
    void load();
  }, []);

  const filteredVariants = useMemo(() => {
    let list = variants;
    if (brandFilter !== 'ALL') {
      list = list.filter((v) => v.product.brand && v.product.brand.toLowerCase() === brandFilter.toLowerCase());
    }
    const needle = query.trim().toLowerCase();
    if (!needle) return list;
    return list.filter((variant) =>
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
  }, [variants, query, brandFilter]);

  const uniqueBrands = useMemo(() => {
    const brands = new Set(variants.map(v => v.product.brand).filter(Boolean) as string[]);
    return Array.from(brands).sort();
  }, [variants]);

  const visibleIds = filteredVariants.map((variant) => variant.id);
  const selectedVisibleCount = visibleIds.filter((id) => selectedIds.includes(id)).length;

  async function load() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/shop/inventory');
      const data = await response.json().catch(() => ({ variants: [], locations: [] }));
      if (!response.ok) {
        setError(data.error || 'Failed to load inventory');
        return;
      }
      setVariants(data.variants || []);
      setLocations(data.locations || []);
      if (data.locations && data.locations.length > 0 && !selectedLocationId) {
        setSelectedLocationId(data.locations[0].id);
      }
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

    // Validate non-negative absolute quantity
    if (bulk.inventoryQty.trim()) {
      const qty = Number(bulk.inventoryQty);
      if (!Number.isFinite(qty) || qty < 0) {
        setError('Inventory quantity cannot be negative.');
        return;
      }
    }

    // Validate adjustment doesn't push any selected variant below zero
    if (bulk.inventoryAdjustment.trim()) {
      const adj = Number(bulk.inventoryAdjustment);
      if (!Number.isFinite(adj)) {
        setError('Adjustment must be a number.');
        return;
      }
      if (adj < 0) {
        // Check if any selected variant would go negative at the chosen location
        const wouldGoNegative = selectedIds.some((id) => {
          const variant = variants.find((v) => v.id === id);
          if (!variant) return false;
          const level = variant.inventoryLevels?.find((l) => l.locationId === selectedLocationId);
          const currentQty = level?.stockedQuantity ?? variant.inventoryQty ?? 0;
          return currentQty + adj < 0;
        });
        if (wouldGoNegative) {
          setError('Adjustment would push at least one variant below zero. Reduce the adjustment or exclude variants with low stock.');
          return;
        }
      }
    }

    const payload: Record<string, unknown> = {
      variantIds: selectedIds,
      locationId: selectedLocationId,
    };

    if (bulk.inventoryQty.trim()) payload.inventoryQty = Number(bulk.inventoryQty);
    if (bulk.inventoryAdjustment.trim()) payload.inventoryAdjustment = Number(bulk.inventoryAdjustment);
    if (bulk.inventoryPolicy) payload.inventoryPolicy = bulk.inventoryPolicy;
    if (bulk.inventoryTracker.trim()) payload.inventoryTracker = bulk.inventoryTracker.trim();
    if (bulk.fulfillmentService.trim()) payload.fulfillmentService = bulk.fulfillmentService.trim();

    if (Object.keys(payload).length <= 2) {
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
      <AdminPage>
        <div className="flex items-center gap-3 rounded-none border border-white/10 bg-[#171717] px-5 py-6 text-sm text-zinc-400">
          <Warehouse className="h-4 w-4 animate-pulse" />
          Loading inventory…
        </div>
      </AdminPage>
    );
  }

  return (
    <AdminPage className="space-y-6">
      <AdminPageHeader
        eyebrow="Catalog"
        title="Inventory"
        description="Operational stock control for variant quantities, inventory policy, and fulfillment metadata across warehouse locations."
        actions={
          <>
            <button
              type="button"
              onClick={() => void handleExport()}
              disabled={exporting}
              className="inline-flex items-center gap-2 rounded-none border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-zinc-200 transition hover:bg-white/[0.06] disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              {exporting ? 'Exporting…' : 'Export CSV'}
            </button>
            <Link
              href="/admin/shop/pricing"
              className="rounded-none border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-zinc-200 transition hover:bg-white/[0.06]"
            >
              Pricing
            </Link>
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex items-center gap-2 rounded-none border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-zinc-200 transition hover:bg-white/[0.06]"
            >
              <RefreshCcw className="h-4 w-4" />
              Refresh
            </button>
          </>
        }
      />

      <AdminMetricGrid>
        <AdminMetricCard label="Variants" value={variants.length} meta="Rows available for stock operations" tone="accent" />
        <AdminMetricCard label="Locations" value={locations.length} meta="Warehouse destinations loaded" />
        <AdminMetricCard
          label="In stock"
          value={variants.filter((variant) => (variant.inventoryLevels?.find((l) => l.locationId === selectedLocationId)?.stockedQuantity || 0) > 0).length}
          meta="Positive stocked quantity in the selected location"
        />
        <AdminMetricCard
          label="Zero / negative"
          value={variants.filter((variant) => (variant.inventoryLevels?.find((l) => l.locationId === selectedLocationId)?.stockedQuantity || 0) <= 0).length}
          meta="Variants needing replenishment review"
        />
      </AdminMetricGrid>

      <AdminFilterBar className="space-y-3">
        <div className="flex flex-wrap gap-3">
          <SelectField
            label="Location"
            value={selectedLocationId}
            onChange={setSelectedLocationId}
            options={locations.map((location) => ({
              value: location.id,
              label: `${location.nameUa || location.name} (${location.code})`,
            }))}
            className="md:min-w-[260px]"
          />
          <SelectField
            label="Brand"
            value={brandFilter}
            onChange={setBrandFilter}
            options={[
              { value: 'ALL', label: 'All brands' },
              ...uniqueBrands.map((brand) => ({ value: brand, label: brand })),
            ]}
            className="md:min-w-[220px]"
          />
          <label className="flex w-full min-w-0 flex-1 items-center gap-2 self-end rounded-none border border-white/10 bg-black/30 px-3.5 py-2.5 text-sm text-zinc-100 md:min-w-[320px]">
            <Search className="h-4 w-4 text-zinc-500" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by product, variant, SKU, or collection"
              className="w-full bg-transparent text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none"
            />
          </label>
        </div>
      </AdminFilterBar>

      {error ? <AdminInlineAlert tone="error">{error}</AdminInlineAlert> : null}
      {success ? <AdminInlineAlert tone="success">{success}</AdminInlineAlert> : null}

      <AdminActionBar>
        <div className="space-y-1">
          <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">Selection</div>
          <div className="text-sm text-zinc-200">
            {selectedIds.length} selected, {selectedVisibleCount} visible in the current filter set
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={selectVisible}
            className="rounded-none border border-white/10 bg-white/[0.03] px-3.5 py-2 text-sm text-zinc-200 transition hover:bg-white/[0.06]"
          >
            Select visible
          </button>
          <button
            type="button"
            onClick={clearSelection}
            className="rounded-none border border-white/10 bg-white/[0.03] px-3.5 py-2 text-sm text-zinc-200 transition hover:bg-white/[0.06]"
          >
            Clear
          </button>
        </div>
      </AdminActionBar>

      <div className="rounded-none border border-white/10 bg-[#171717] p-5">
          <div className="mb-4">
            <h3 className="text-lg font-medium text-zinc-50">Bulk update</h3>
            <p className="mt-1 text-sm text-zinc-400">
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
              className="inline-flex items-center gap-2 rounded-none bg-gradient-to-b from-blue-500 to-blue-700 px-4 py-2.5 text-sm font-bold uppercase tracking-wider text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_2px_8px_rgba(59,130,246,0.4)] transition hover:from-blue-400 hover:to-blue-600 disabled:opacity-50"
            >
              <Boxes className="h-4 w-4" />
              {applying ? 'Applying…' : 'Apply to selected'}
            </button>
          </div>
      </div>

      {filteredVariants.length === 0 ? (
        <AdminEmptyState
          title="No variants match this inventory view"
          description="Adjust the location, brand, or search filters to surface variants that need stock actions."
        />
      ) : (
        <AdminTableShell>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.03]">
                  <th className="px-4 py-3 font-medium text-zinc-400">Select</th>
                  <th className="px-4 py-3 font-medium text-zinc-400">Product</th>
                  <th className="px-4 py-3 font-medium text-zinc-400">Variant</th>
                  <th className="px-4 py-3 font-medium text-zinc-400">Collections</th>
                  <th className="px-4 py-3 font-medium text-zinc-400">Qty</th>
                  <th className="px-4 py-3 font-medium text-zinc-400">Policy</th>
                  <th className="px-4 py-3 font-medium text-zinc-400">Tracker</th>
                  <th className="px-4 py-3 font-medium text-zinc-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredVariants.map((variant) => (
                  <tr key={variant.id} className="border-b border-white/5 align-top transition hover:bg-white/[0.02]">
                    <td className="px-4 py-4">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(variant.id)}
                        onChange={() => toggleSelection(variant.id)}
                        className="h-4 w-4 rounded-none border-white/20 bg-zinc-950"
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
                    <td className="px-4 py-4 text-white/80">
                      <div className="text-lg font-medium">
                        {(variant.inventoryLevels?.find(l => l.locationId === selectedLocationId)?.stockedQuantity) || 0}
                      </div>
                      <div className="text-[10px] text-white/40 uppercase mt-1">Stocked</div>
                    </td>
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
        </AdminTableShell>
      )}
    </AdminPage>
  );
}

export default function AdminInventoryPage() {
  return (
    <Suspense fallback={<div className="p-6 text-white/50">Завантаження складу...</div>}>
      <AdminInventoryPageContent />
    </Suspense>
  );
}

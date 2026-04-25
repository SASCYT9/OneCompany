'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Boxes, Plus, RefreshCcw, Save, Trash2 } from 'lucide-react';

import {
  AdminActionBar,
  AdminEmptyState,
  AdminInlineAlert,
  AdminMetricCard,
  AdminMetricGrid,
  AdminPage,
  AdminPageHeader,
  AdminTableShell,
} from '@/components/admin/AdminPrimitives';
import {
  AdminInputField,
  AdminSelectField,
} from '@/components/admin/AdminFormFields';
import { useConfirm } from '@/components/admin/AdminConfirmDialog';
import { useToast } from '@/components/admin/AdminToast';

type BundleListItem = {
  id: string;
  productId: string;
  updatedAt: string;
  createdAt: string;
  availableQuantity: number;
  componentsCount: number;
  product: {
    id: string;
    slug: string;
    scope: string;
    brand: string | null;
    titleUa: string;
    titleEn: string;
    image: string | null;
    stock: string;
    isPublished: boolean;
    status: string;
    priceEur: number | null;
    priceUsd: number | null;
    priceUah: number | null;
  };
};

type ProductOption = {
  id: string;
  slug: string;
  scope: string;
  brand: string | null;
  titleUa: string;
  titleEn: string;
  image: string | null;
  isPublished: boolean;
  status: string;
  priceEur: number | null;
  priceUsd: number | null;
  priceUah: number | null;
  bundleId: string | null;
  variants: Array<{
    id: string;
    title: string | null;
    sku: string | null;
    inventoryQty: number;
    isDefault: boolean;
    priceEur: number | null;
    priceUsd: number | null;
    priceUah: number | null;
  }>;
};

type BundleDetail = BundleListItem & {
  items: Array<{
    id: string;
    position: number;
    quantity: number;
    availableQuantity: number;
    componentProductId: string;
    componentVariantId: string | null;
    componentVariantTitle: string | null;
    componentProduct: {
      id: string;
      slug: string;
      scope: string;
      brand: string;
      image: string;
      title: {
        ua: string;
        en: string;
      };
      collection: {
        ua: string;
        en: string;
      };
    };
  }>;
};

type FormState = {
  id: string | null;
  productId: string;
  items: Array<{
    id: string;
    componentProductId: string;
    componentVariantId: string | null;
    quantity: number;
  }>;
};

function isBundleDetail(value: unknown): value is BundleDetail {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'id' in value &&
      'productId' in value &&
      'items' in value
  );
}

function emptyForm(): FormState {
  return {
    id: null,
    productId: '',
    items: [
      {
        id: crypto.randomUUID(),
        componentProductId: '',
        componentVariantId: null,
        quantity: 1,
      },
    ],
  };
}

function priceLabel(product: ProductOption | BundleListItem['product']) {
  if (product.priceEur != null) return `EUR ${product.priceEur}`;
  if (product.priceUsd != null) return `USD ${product.priceUsd}`;
  if (product.priceUah != null) return `UAH ${product.priceUah}`;
  return 'No price';
}

export default function AdminShopBundlesPage() {
  const confirm = useConfirm();
  const toast = useToast();
  const [bundles, setBundles] = useState<BundleListItem[]>([]);
  const [productOptions, setProductOptions] = useState<ProductOption[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [selectedBundleId, setSelectedBundleId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const selectedBundle = useMemo(
    () => bundles.find((bundle) => bundle.id === selectedBundleId) ?? null,
    [bundles, selectedBundleId]
  );

  const bundleProductOptions = useMemo(
    () =>
      productOptions.filter(
        (product) => !product.bundleId || product.bundleId === form.id
      ),
    [form.id, productOptions]
  );

  const bundleMetrics = useMemo(
    () => ({
      total: bundles.length,
      components: bundles.reduce((sum, bundle) => sum + bundle.componentsCount, 0),
      available: bundles.reduce((sum, bundle) => sum + bundle.availableQuantity, 0),
      assignableProducts: bundleProductOptions.length,
    }),
    [bundleProductOptions.length, bundles]
  );

  async function load(listOnly = false) {
    if (listOnly) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError('');
    try {
      const response = await fetch('/api/admin/shop/bundles');
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error || 'Failed to load bundles');
        return;
      }

      setBundles(Array.isArray(data?.bundles) ? data.bundles : []);
      setProductOptions(Array.isArray(data?.productOptions) ? data.productOptions : []);

      const nextSelectedId =
        selectedBundleId && data?.bundles?.some((bundle: BundleListItem) => bundle.id === selectedBundleId)
          ? selectedBundleId
          : data?.bundles?.[0]?.id ?? null;

      setSelectedBundleId(nextSelectedId);

      if (!nextSelectedId) {
        setForm((current) => (current.id ? emptyForm() : current));
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function loadDetail(id: string) {
    setDetailLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/admin/shop/bundles/${id}`);
      const raw = (await response.json().catch(() => null)) as BundleDetail | { error?: string } | null;
      if (!response.ok || !isBundleDetail(raw)) {
        setError((raw as { error?: string } | null)?.error || 'Failed to load bundle detail');
        return;
      }

      setForm({
        id: raw.id,
        productId: raw.productId,
        items: raw.items.map((item: BundleDetail['items'][number]) => ({
          id: item.id,
          componentProductId: item.componentProductId,
          componentVariantId: item.componentVariantId,
          quantity: item.quantity,
        })),
      });
    } finally {
      setDetailLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedBundleId) {
      void loadDetail(selectedBundleId);
      return;
    }

    setForm(emptyForm());
  }, [selectedBundleId]);

  function resetToNew() {
    setSelectedBundleId(null);
    setForm(emptyForm());
    setError('');
  }

  function updateItem(
    rowId: string,
    patch: Partial<FormState['items'][number]>
  ) {
    setForm((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.id === rowId
          ? {
              ...item,
              ...patch,
            }
          : item
      ),
    }));
  }

  function addRow() {
    setForm((current) => ({
      ...current,
      items: [
        ...current.items,
        {
          id: crypto.randomUUID(),
          componentProductId: '',
          componentVariantId: null,
          quantity: 1,
        },
      ],
    }));
  }

  function removeRow(rowId: string) {
    setForm((current) => ({
      ...current,
      items:
        current.items.length === 1
          ? current.items
          : current.items.filter((item) => item.id !== rowId),
    }));
  }

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      const payload = {
        productId: form.productId,
        items: form.items.map((item, index) => ({
          componentProductId: item.componentProductId,
          componentVariantId: item.componentVariantId,
          quantity: item.quantity,
          position: index + 1,
        })),
      };

      const response = await fetch(
        form.id ? `/api/admin/shop/bundles/${form.id}` : '/api/admin/shop/bundles',
        {
          method: form.id ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error || 'Failed to save bundle');
        return;
      }

      await load(true);
      if (form.id) {
        await loadDetail(form.id);
      } else if (data?.id) {
        setSelectedBundleId(data.id);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!form.id) return;
    const ok = await confirm({
      tone: 'danger',
      title: 'Delete this bundle?',
      description: 'The bundle definition and product mappings will be removed.',
      confirmLabel: 'Delete bundle',
    });
    if (!ok) return;
    setDeleting(true);
    setError('');
    try {
      const response = await fetch(`/api/admin/shop/bundles/${form.id}`, {
        method: 'DELETE',
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const msg = data?.error || 'Failed to delete bundle';
        setError(msg);
        toast.error('Could not delete bundle', msg);
        return;
      }

      toast.success('Bundle deleted');
      resetToNew();
      await load(true);
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <AdminPage>
        <div className="flex items-center gap-3 rounded-[6px] border border-white/10 bg-[#171717] px-5 py-6 text-sm text-zinc-400">
          <Boxes className="h-4 w-4 animate-pulse" />
          Loading bundles…
        </div>
      </AdminPage>
    );
  }

  return (
    <AdminPage className="space-y-6">
      <AdminPageHeader
        eyebrow="Catalog"
        title="Bundles"
        description="Configure bundle shell products, component composition, and computed availability while leaving bundle pricing on the parent product card."
        actions={
          <>
            <button
              type="button"
              onClick={() => void load(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-[6px] border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-zinc-200 transition hover:bg-white/[0.06] disabled:opacity-50"
            >
              <RefreshCcw className={`h-4 w-4 ${refreshing ? 'motion-safe:animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              type="button"
              onClick={resetToNew}
              className="inline-flex items-center gap-2 rounded-[6px] bg-gradient-to-b from-blue-500 to-blue-700 px-4 py-2.5 text-sm font-bold uppercase tracking-wider text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_2px_8px_rgba(59,130,246,0.4)] transition hover:from-blue-400 hover:to-blue-600"
            >
              <Plus className="h-4 w-4" />
              New bundle
            </button>
          </>
        }
      />

      <AdminMetricGrid>
        <AdminMetricCard label="Bundles" value={bundleMetrics.total} meta="Bundle definitions in catalog" tone="accent" />
        <AdminMetricCard label="Components" value={bundleMetrics.components} meta="Assigned component rows across all bundles" />
        <AdminMetricCard label="Available units" value={bundleMetrics.available} meta="Total computed bundle availability" />
        <AdminMetricCard label="Assignable products" value={bundleMetrics.assignableProducts} meta="Products still eligible as bundle shells" />
      </AdminMetricGrid>

      {error ? <AdminInlineAlert tone="error">{error}</AdminInlineAlert> : null}

      <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        <AdminTableShell className="overflow-hidden">
          <div className="border-b border-white/10 px-4 py-3 text-sm text-zinc-400">{bundles.length} bundles</div>
          <div className="max-h-[72vh] overflow-auto">
            {bundles.length === 0 ? (
              <AdminEmptyState
                className="rounded-none border-0 bg-transparent px-4 py-12"
                title="No bundles yet"
                description="Create a bundle shell product and assemble its component list here."
                action={
                  <button
                    type="button"
                    onClick={resetToNew}
                    className="inline-flex items-center gap-2 rounded-[6px] bg-gradient-to-b from-blue-500 to-blue-700 px-4 py-2.5 text-sm font-bold uppercase tracking-wider text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_2px_8px_rgba(59,130,246,0.4)] transition hover:from-blue-400 hover:to-blue-600"
                  >
                    <Plus className="h-4 w-4" />
                    New bundle
                  </button>
                }
              />
            ) : (
              bundles.map((bundle) => (
                <button
                  key={bundle.id}
                  type="button"
                  onClick={() => setSelectedBundleId(bundle.id)}
                  className={`w-full border-b border-white/5 px-4 py-4 text-left transition hover:bg-white/[0.04] ${
                    selectedBundleId === bundle.id ? 'bg-white/[0.06]' : ''
                  }`}
                >
                  <div className="font-medium text-zinc-100">{bundle.product.titleEn || bundle.product.titleUa}</div>
                  <div className="mt-1 text-xs text-zinc-500">{bundle.product.slug}</div>
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                    <span>{bundle.componentsCount} items</span>
                    <span>{bundle.availableQuantity} available</span>
                    <span>{priceLabel(bundle.product)}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </AdminTableShell>

        <div className="rounded-[6px] border border-white/10 bg-[#171717] p-5 md:p-6">
          <div className="space-y-6">
            <div className="space-y-2">
              <h2 className="text-xl font-semibold tracking-tight text-zinc-50">
                {form.id ? 'Edit bundle' : 'Create bundle'}
              </h2>
              <p className="max-w-2xl text-sm leading-6 text-zinc-400">
                Choose the bundle shell product, then attach component products and optional variants that drive bundle availability.
              </p>
            </div>

            <AdminActionBar className="bg-black/30">
              <div className="space-y-1">
                <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">Selected bundle</div>
                <div className="text-sm text-zinc-200">
                  {selectedBundle ? selectedBundle.product.slug : 'New bundle draft'}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {selectedBundle ? (
                  <Link
                    href={`/admin/shop/${selectedBundle.productId}`}
                    className="rounded-[6px] border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-zinc-200 transition hover:bg-white/[0.06]"
                  >
                    Open product
                  </Link>
                ) : null}
                {form.id ? (
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleting}
                    className="inline-flex items-center gap-2 rounded-[6px] border border-blue-500/25 bg-blue-950/30 px-4 py-2.5 text-sm text-red-200 transition hover:bg-blue-950/40 disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || detailLoading}
                  className="inline-flex items-center gap-2 rounded-[6px] bg-gradient-to-b from-blue-500 to-blue-700 px-4 py-2.5 text-sm font-bold uppercase tracking-wider text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_2px_8px_rgba(59,130,246,0.4)] transition hover:from-blue-400 hover:to-blue-600 disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {saving ? 'Saving…' : 'Save bundle'}
                </button>
              </div>
            </AdminActionBar>

            {detailLoading ? <AdminInlineAlert tone="warning">Loading selected bundle details…</AdminInlineAlert> : null}

            <AdminSelectField
              label="Bundle product"
              value={form.productId}
              onChange={(value) =>
                setForm((current) => ({
                  ...current,
                  productId: value,
                }))
              }
              options={[
                { value: '', label: 'Select bundle product…' },
                ...bundleProductOptions.map((product) => ({
                  value: product.id,
                  label: `${product.titleEn || product.titleUa} (${product.slug})`,
                })),
              ]}
            />

            <AdminInlineAlert tone="warning">
              Ціна комплекту та B2B-ціни задаються на картці пов&apos;язаного товару. Тут налаштовуються лише склад комплекту та обчислена доступність.
            </AdminInlineAlert>

            <div className="space-y-3">
              <AdminActionBar className="bg-black/30">
                <div>
                  <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">Components</div>
                  <div className="mt-1 text-sm text-zinc-300">{form.items.length} component rows in this bundle</div>
                </div>
                <button
                  type="button"
                  onClick={addRow}
                  className="inline-flex items-center gap-2 rounded-[6px] border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-zinc-200 transition hover:bg-white/[0.06]"
                >
                  <Plus className="h-4 w-4" />
                  Add item
                </button>
              </AdminActionBar>

              {form.items.map((item, index) => {
                const componentProduct = productOptions.find(
                  (product) => product.id === item.componentProductId
                );
                const variantOptions = componentProduct?.variants ?? [];

                return (
                  <div
                    key={item.id}
                    className="grid gap-4 rounded-[6px] border border-white/10 bg-black/20 p-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_140px_56px]"
                  >
                    <AdminSelectField
                      label={`Component product #${index + 1}`}
                      value={item.componentProductId}
                      onChange={(value) =>
                        updateItem(item.id, {
                          componentProductId: value,
                          componentVariantId: null,
                        })
                      }
                      options={[
                        { value: '', label: 'Select product…' },
                        ...productOptions
                          .filter((product) => product.id !== form.productId)
                          .map((product) => ({
                            value: product.id,
                            label: `${product.titleEn || product.titleUa} (${product.slug})`,
                          })),
                      ]}
                    />

                    <AdminSelectField
                      label="Variant"
                      value={item.componentVariantId ?? ''}
                      onChange={(value) =>
                        updateItem(item.id, {
                          componentVariantId: value || null,
                        })
                      }
                      options={[
                        { value: '', label: 'Default variant' },
                        ...variantOptions.map((variant) => ({
                          value: variant.id,
                          label: variant.title || variant.sku || variant.id,
                        })),
                      ]}
                    />

                    <AdminInputField
                      label="Qty"
                      type="number"
                      value={String(item.quantity)}
                      onChange={(value) =>
                        updateItem(item.id, {
                          quantity: Math.max(1, Math.floor(Number(value) || 1)),
                        })
                      }
                    />

                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={() => removeRow(item.id)}
                        disabled={form.items.length === 1}
                        className="inline-flex h-[46px] w-full items-center justify-center rounded-[6px] border border-blue-500/25 bg-blue-950/30 text-red-200 transition hover:bg-blue-950/40 disabled:opacity-40"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    {componentProduct ? (
                      <div className="lg:col-span-4 rounded-[6px] border border-white/10 bg-white/[0.03] px-3 py-3 text-xs text-zinc-400">
                        <span className="font-medium text-zinc-200">
                          {componentProduct.titleEn || componentProduct.titleUa}
                        </span>{' '}
                        · {priceLabel(componentProduct)} ·{' '}
                        {variantOptions.find((variant) => variant.id === item.componentVariantId)?.inventoryQty ??
                          variantOptions.find((variant) => variant.isDefault)?.inventoryQty ??
                          0}{' '}
                        units on selected/default variant
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </AdminPage>
  );
}

'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Boxes, Plus, RefreshCcw, Save, Trash2 } from 'lucide-react';

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
  return 'Ціну не задано';
}

export default function AdminShopBundlesPage() {
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
        setError(data?.error || 'Не вдалося завантажити комплекти');
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
        setError((raw as { error?: string } | null)?.error || 'Не вдалося завантажити деталі комплекту');
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
        setError(data?.error || 'Не вдалося зберегти комплект');
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
    if (!form.id || !confirm('Видалити цей комплект?')) return;
    setDeleting(true);
    setError('');
    try {
      const response = await fetch(`/api/admin/shop/bundles/${form.id}`, {
        method: 'DELETE',
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error || 'Не вдалося видалити комплект');
        return;
      }

      resetToNew();
      await load(true);
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6 text-white/60 flex items-center gap-2">
        <Boxes className="h-5 w-5 animate-pulse" />
        Завантаження комплектів…
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto max-w-7xl p-6">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-white">Комплекти</h2>
            <p className="mt-2 text-sm text-white/45">
              Керування товарами-комплектами, їх складом і розрахунковою доступністю. Ціна комплекту задається на самому товарі.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void load(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-zinc-800 px-4 py-2 text-sm text-white hover:bg-zinc-700 disabled:opacity-50"
            >
              <RefreshCcw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              Оновити
            </button>
            <button
              type="button"
              onClick={resetToNew}
              className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-black hover:bg-white/90"
            >
              <Plus className="h-4 w-4" />
              Новий комплект
            </button>
          </div>
        </div>

        {error ? <div className="mb-4 rounded-lg bg-red-900/20 p-3 text-sm text-red-300">{error}</div> : null}

        <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03]">
            <div className="border-b border-white/10 px-4 py-3 text-sm text-white/60">
              {bundles.length} комплектів
            </div>
            <div className="max-h-[70vh] overflow-auto">
              {bundles.length === 0 ? (
                <div className="px-4 py-10 text-center text-sm text-white/45">
                  Комплектів ще немає.
                </div>
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
                    <div className="font-medium text-white">
                      {bundle.product.titleEn || bundle.product.titleUa}
                    </div>
                    <div className="mt-1 text-xs text-white/45">{bundle.product.slug}</div>
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.16em] text-white/55">
                      <span>{bundle.componentsCount} позицій</span>
                      <span>{bundle.availableQuantity} доступно</span>
                      <span>{priceLabel(bundle.product)}</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-white">
                  {form.id ? 'Редагування комплекту' : 'Створення комплекту'}
                </h3>
                <p className="mt-1 text-sm text-white/45">
                  Оберіть товар-оболонку комплекту, потім додайте складові товари та, за потреби, конкретні варіанти.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {selectedBundle ? (
                  <Link
                    href={`/admin/shop/${selectedBundle.productId}`}
                    className="rounded-lg border border-white/10 bg-zinc-900 px-4 py-2 text-sm text-white hover:bg-zinc-800"
                  >
                    Відкрити товар
                  </Link>
                ) : null}
                {form.id ? (
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleting}
                    className="inline-flex items-center gap-2 rounded-lg border border-red-500/25 bg-red-500/10 px-4 py-2 text-sm text-red-200 hover:bg-red-500/15 disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                    Видалити
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || detailLoading}
                  className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-black hover:bg-white/90 disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {saving ? 'Збереження…' : 'Зберегти комплект'}
                </button>
              </div>
            </div>

            <div className="grid gap-5">
              <label className="grid gap-2 text-sm text-white/75">
                <span>Товар комплекту</span>
                <select
                  value={form.productId}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      productId: event.target.value,
                    }))
                  }
                  className="rounded-xl border border-white/10 bg-zinc-950 px-3 py-3 text-sm text-white focus:outline-none"
                >
                  <option value="">Оберіть товар комплекту…</option>
                  {bundleProductOptions.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.titleEn || product.titleUa} ({product.slug})
                    </option>
                  ))}
                </select>
              </label>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/60">
                Ціна комплекту та B2B-ціни задаються на картці пов’язаного товару. Тут налаштовуються лише склад комплекту та обчислена доступність.
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h4 className="text-sm font-medium uppercase tracking-[0.16em] text-white/60">
                    Компоненти
                  </h4>
                  <button
                    type="button"
                    onClick={addRow}
                    className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white hover:bg-zinc-800"
                  >
                    <Plus className="h-4 w-4" />
                    Додати позицію
                  </button>
                </div>

                {form.items.map((item, index) => {
                  const componentProduct = productOptions.find(
                    (product) => product.id === item.componentProductId
                  );
                  const variantOptions = componentProduct?.variants ?? [];

                  return (
                    <div
                      key={item.id}
                      className="grid gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_120px_56px]"
                    >
                      <label className="grid gap-2 text-sm text-white/75">
                        <span>Товар-компонент #{index + 1}</span>
                        <select
                          value={item.componentProductId}
                          onChange={(event) =>
                            updateItem(item.id, {
                              componentProductId: event.target.value,
                              componentVariantId: null,
                            })
                          }
                          className="rounded-xl border border-white/10 bg-zinc-950 px-3 py-3 text-sm text-white focus:outline-none"
                        >
                          <option value="">Оберіть товар…</option>
                          {productOptions
                            .filter((product) => product.id !== form.productId)
                            .map((product) => (
                              <option key={product.id} value={product.id}>
                                {product.titleEn || product.titleUa} ({product.slug})
                              </option>
                            ))}
                        </select>
                      </label>

                      <label className="grid gap-2 text-sm text-white/75">
                        <span>Варіант</span>
                        <select
                          value={item.componentVariantId ?? ''}
                          onChange={(event) =>
                            updateItem(item.id, {
                              componentVariantId: event.target.value || null,
                            })
                          }
                          className="rounded-xl border border-white/10 bg-zinc-950 px-3 py-3 text-sm text-white focus:outline-none"
                        >
                          <option value="">Базовий варіант</option>
                          {variantOptions.map((variant) => (
                            <option key={variant.id} value={variant.id}>
                              {variant.title || variant.sku || variant.id}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="grid gap-2 text-sm text-white/75">
                        <span>К-сть</span>
                        <input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(event) =>
                            updateItem(item.id, {
                              quantity: Math.max(1, Math.floor(Number(event.target.value) || 1)),
                            })
                          }
                          className="rounded-xl border border-white/10 bg-zinc-950 px-3 py-3 text-sm text-white focus:outline-none"
                        />
                      </label>

                      <div className="flex items-end">
                        <button
                          type="button"
                          onClick={() => removeRow(item.id)}
                          disabled={form.items.length === 1}
                          className="inline-flex h-[46px] w-full items-center justify-center rounded-xl border border-red-500/25 bg-red-500/10 text-red-200 hover:bg-red-500/15 disabled:opacity-40"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      {componentProduct ? (
                        <div className="lg:col-span-4 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-xs text-white/55">
                          <span className="font-medium text-white/75">
                            {componentProduct.titleEn || componentProduct.titleUa}
                          </span>{' '}
                          · {priceLabel(componentProduct)} ·{' '}
                          {variantOptions.find((variant) => variant.id === item.componentVariantId)?.inventoryQty ??
                            variantOptions.find((variant) => variant.isDefault)?.inventoryQty ??
                            0}{' '}
                          шт. у вибраному або базовому варіанті
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

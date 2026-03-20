'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, ArrowDown, ArrowUp, Save } from 'lucide-react';

type CollectionFormState = {
  storeKey: string;
  handle: string;
  titleUa: string;
  titleEn: string;
  brand: string;
  descriptionUa: string;
  descriptionEn: string;
  heroImage: string;
  isPublished: boolean;
  isUrban: boolean;
  sortOrder: string;
};

type CollectionResponse = {
  id: string;
  storeKey: string;
  store: {
    key: string;
    name: string;
  } | null;
  handle: string;
  titleUa: string;
  titleEn: string;
  brand: string | null;
  descriptionUa: string | null;
  descriptionEn: string | null;
  heroImage: string | null;
  isPublished: boolean;
  isUrban: boolean;
  sortOrder: number;
  productsCount: number;
  products: Array<{
    id: string;
    slug: string;
    titleEn: string;
    titleUa: string;
    brand: string | null;
    image: string | null;
    isPublished: boolean;
    sortOrder: number;
  }>;
};

type ShopStoreSummary = {
  key: string;
  name: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
};

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function createEmptyForm(storeKey = 'urban'): CollectionFormState {
  return {
    storeKey,
    handle: '',
    titleUa: '',
    titleEn: '',
    brand: '',
    descriptionUa: '',
    descriptionEn: '',
    heroImage: '',
    isPublished: true,
    isUrban: false,
    sortOrder: '0',
  };
}

function collectionToForm(collection: CollectionResponse): CollectionFormState {
  return {
    storeKey: collection.storeKey || 'urban',
    handle: collection.handle,
    titleUa: collection.titleUa,
    titleEn: collection.titleEn,
    brand: collection.brand ?? '',
    descriptionUa: collection.descriptionUa ?? '',
    descriptionEn: collection.descriptionEn ?? '',
    heroImage: collection.heroImage ?? '',
    isPublished: collection.isPublished,
    isUrban: collection.isUrban,
    sortOrder: String(collection.sortOrder),
  };
}

type Props = {
  collectionId?: string;
};

export default function AdminCollectionEditor({ collectionId }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isEditing = Boolean(collectionId);
  const initialStoreKey = searchParams.get('store') || 'urban';
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [handleTouched, setHandleTouched] = useState(isEditing);
  const [stores, setStores] = useState<ShopStoreSummary[]>([]);
  const [form, setForm] = useState<CollectionFormState>(() => createEmptyForm(initialStoreKey));
  const [linkedProducts, setLinkedProducts] = useState<CollectionResponse['products']>([]);

  useEffect(() => {
    if (!isEditing) {
      setForm((current) => ({ ...current, storeKey: current.storeKey || initialStoreKey }));
    }
  }, [initialStoreKey, isEditing]);

  useEffect(() => {
    let cancelled = false;

    async function loadStores() {
      try {
        const response = await fetch('/api/admin/shop/stores');
        const data = await response.json().catch(() => []);
        if (!response.ok || cancelled) return;
        const nextStores = Array.isArray(data) ? (data as ShopStoreSummary[]) : [];
        setStores(nextStores);
        if (!isEditing && nextStores.length && !nextStores.some((store) => store.key === form.storeKey)) {
          setForm((current) => ({ ...current, storeKey: nextStores[0].key }));
        }
      } catch {
        // Keep default store when bootstrap route is unavailable.
      }
    }

    void loadStores();

    return () => {
      cancelled = true;
    };
  }, [form.storeKey, isEditing]);

  useEffect(() => {
    if (!collectionId) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadCollection() {
      setLoading(true);
      setError('');
      try {
        const response = await fetch(`/api/admin/shop/collections/${collectionId}`);
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.error || 'Не вдалося завантажити колекцію');
        }
        if (!cancelled) {
          const collection = data as CollectionResponse;
          setForm(collectionToForm(collection));
          setLinkedProducts(collection.products);
          setHandleTouched(true);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError((loadError as Error).message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadCollection();

    return () => {
      cancelled = true;
    };
  }, [collectionId]);

  function updateField<K extends keyof CollectionFormState>(key: K, value: CollectionFormState[K]) {
    setForm((current) => {
      const next = { ...current, [key]: value };
      if ((key === 'titleEn' || key === 'titleUa') && !handleTouched) {
        const base = key === 'titleEn' ? String(value || current.titleUa) : String(current.titleEn || value);
        next.handle = slugify(base);
      }
      return next;
    });

    if (key === 'handle') {
      setHandleTouched(true);
    }
  }

  function moveLinkedProduct(index: number, direction: -1 | 1) {
    setLinkedProducts((current) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.length) {
        return current;
      }

      const next = [...current];
      const [item] = next.splice(index, 1);
      next.splice(nextIndex, 0, item);
      return next.map((entry, sortIndex) => ({
        ...entry,
        sortOrder: sortIndex,
      }));
    });
  }

  async function saveProductOrder() {
    if (!collectionId) return;

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`/api/admin/shop/collections/${collectionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          brand: form.brand || null,
          descriptionUa: form.descriptionUa || null,
          descriptionEn: form.descriptionEn || null,
          heroImage: form.heroImage || null,
          sortOrder: Number(form.sortOrder) || 0,
          productAssignments: linkedProducts.map((product, index) => ({
            id: product.id,
            sortOrder: index,
          })),
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Не вдалося зберегти порядок товарів');
      }

      setLinkedProducts((data.products ?? []) as CollectionResponse['products']);
      setSuccess('Порядок товарів у колекції збережено.');
    } catch (saveError) {
      setError((saveError as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(
        isEditing ? `/api/admin/shop/collections/${collectionId}` : '/api/admin/shop/collections',
        {
          method: isEditing ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            storeKey: form.storeKey,
            handle: form.handle,
            titleUa: form.titleUa,
            titleEn: form.titleEn,
            brand: form.brand || null,
            descriptionUa: form.descriptionUa || null,
            descriptionEn: form.descriptionEn || null,
            heroImage: form.heroImage || null,
            isPublished: form.isPublished,
            isUrban: form.isUrban,
            sortOrder: Number(form.sortOrder) || 0,
          }),
        }
      );

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Не вдалося зберегти колекцію');
      }

      setSuccess(isEditing ? 'Колекцію оновлено.' : 'Колекцію створено.');
      if (!isEditing) {
        router.push(`/admin/shop/collections?store=${encodeURIComponent(form.storeKey)}`);
        router.refresh();
      } else {
        setLinkedProducts((data.products ?? []) as CollectionResponse['products']);
      }
    } catch (saveError) {
      setError((saveError as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="p-6 text-white/60">Завантаження колекції…</div>;
  }

  return (
    <div className="h-full overflow-auto bg-[#090909]">
      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link href="/admin/shop/collections" className="inline-flex items-center gap-2 text-sm text-white/50 hover:text-white">
              <ArrowLeft className="h-4 w-4" />
              Назад до колекцій
            </Link>
            <h1 className="mt-3 text-3xl font-semibold text-white">
              {isEditing ? 'Редагувати колекцію' : 'Нова колекція'}
            </h1>
            <p className="mt-2 text-sm text-white/45">
              Налаштуйте handle колекції, тексти для вітрини та ціль прив’язки товарів.
            </p>
          </div>
        </div>

        {error ? <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div> : null}
        {success ? <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">{success}</div> : null}

        <form onSubmit={handleSubmit} className="space-y-6">
          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <div className="mb-5">
              <h2 className="text-lg font-medium text-white">Огляд</h2>
              <p className="mt-1 text-sm text-white/45">Ідентичність колекції для адмінки, вітрини та sitemap.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <SelectField
                label="Магазин"
                value={form.storeKey}
                onChange={(value) => updateField('storeKey', value)}
                disabled={isEditing}
                options={(stores.length
                  ? stores
                  : [{ key: 'urban', name: 'Urban Automotive', description: null, isActive: true, sortOrder: 0 }]
                ).map((store) => ({
                  value: store.key,
                  label: store.name,
                }))}
              />
              <InputField label="Назва (EN)" value={form.titleEn} onChange={(value) => updateField('titleEn', value)} />
              <InputField label="Назва (UA)" value={form.titleUa} onChange={(value) => updateField('titleUa', value)} />
              <InputField label="Handle (символний ідентифікатор)" value={form.handle} onChange={(value) => updateField('handle', slugify(value))} />
              <InputField label="Бренд" value={form.brand} onChange={(value) => updateField('brand', value)} />
              <InputField label="Порядок сортування" type="number" value={form.sortOrder} onChange={(value) => updateField('sortOrder', value)} />
              <InputField label="URL головного зображення" value={form.heroImage} onChange={(value) => updateField('heroImage', value)} />
            </div>
            <div className="mt-4 flex flex-wrap gap-6">
              <CheckboxField label="Опубліковано" checked={form.isPublished} onChange={(checked) => updateField('isPublished', checked)} />
              <CheckboxField label="Колекція Urban" checked={form.isUrban} onChange={(checked) => updateField('isUrban', checked)} />
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <div className="mb-5">
              <h2 className="text-lg font-medium text-white">Описи</h2>
              <p className="mt-1 text-sm text-white/45">Необов’язкові тексти колекції для майбутніх landing pages і SEO.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <TextareaField label="Опис (EN)" value={form.descriptionEn} onChange={(value) => updateField('descriptionEn', value)} rows={6} />
              <TextareaField label="Опис (UA)" value={form.descriptionUa} onChange={(value) => updateField('descriptionUa', value)} rows={6} />
            </div>
          </section>

          {isEditing ? (
            <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <div className="mb-5">
                <h2 className="text-lg font-medium text-white">Призначені товари</h2>
                <p className="mt-1 text-sm text-white/45">Товари прив’язуються з редактора товару або через синхронізацію Urban.</p>
              </div>
              {linkedProducts.length ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {linkedProducts.map((product, index) => (
                    <div key={product.id} className="rounded-xl border border-white/10 bg-black/40 p-4 text-sm text-white/80">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <Link href={`/admin/shop/${product.id}`} className="font-medium text-white hover:text-white/80">
                            {product.titleEn || product.titleUa}
                          </Link>
                          <div className="mt-1 font-mono text-xs text-white/45">{product.slug}</div>
                          <div className="mt-2 text-xs text-white/50">{product.brand || '—'}</div>
                          <div className="mt-2 text-xs text-white/35">Позиція {index + 1}</div>
                        </div>
                        <div className="flex shrink-0 flex-col gap-2">
                          <button
                            type="button"
                            onClick={() => moveLinkedProduct(index, -1)}
                            disabled={index === 0 || saving}
                            className="rounded-md border border-white/10 p-2 text-white/70 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-35"
                            aria-label="Move product up"
                          >
                            <ArrowUp className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveLinkedProduct(index, 1)}
                            disabled={index === linkedProducts.length - 1 || saving}
                            className="rounded-md border border-white/10 p-2 text-white/70 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-35"
                            aria-label="Move product down"
                          >
                            <ArrowDown className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-white/10 bg-black/30 px-4 py-8 text-sm text-white/45">
                  Товари ще не призначені.
                </div>
              )}
              {linkedProducts.length ? (
                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={saveProductOrder}
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-4 py-2 text-sm text-white hover:bg-white/5 disabled:opacity-50"
                  >
                    <Save className="h-4 w-4" />
                    {saving ? 'Зберігаємо порядок…' : 'Зберегти порядок товарів'}
                  </button>
                </div>
              ) : null}
            </section>
          ) : null}

          <div className="flex flex-wrap gap-3 pb-6">
            <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-medium text-black hover:bg-white/90 disabled:opacity-50">
              <Save className="h-4 w-4" />
              {saving ? 'Зберігаємо…' : isEditing ? 'Зберегти колекцію' : 'Створити колекцію'}
            </button>
            <Link href={`/admin/shop/collections${form.storeKey ? `?store=${encodeURIComponent(form.storeKey)}` : ''}`} className="rounded-lg border border-white/15 px-5 py-2.5 text-sm text-white hover:bg-white/5">
              Скасувати
            </Link>
          </div>
        </form>
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

type TextareaFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
};

function TextareaField({ label, value, onChange, rows = 5 }: TextareaFieldProps) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs text-white/50">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        className="w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white placeholder:text-white/25 focus:border-white/30 focus:outline-none"
      />
    </label>
  );
}

type CheckboxFieldProps = {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
};

function CheckboxField({ label, checked, onChange }: CheckboxFieldProps) {
  return (
    <label className="inline-flex items-center gap-2 text-sm text-white/80">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 rounded border-white/20 bg-zinc-950"
      />
      {label}
    </label>
  );
}

type SelectFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  disabled?: boolean;
};

function SelectField({ label, value, onChange, options, disabled = false }: SelectFieldProps) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs text-white/50">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className="w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white focus:border-white/30 focus:outline-none disabled:opacity-60"
      >
        {options.map((option) => (
          <option key={`${option.value}-${option.label}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

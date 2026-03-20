'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Save } from 'lucide-react';

type CategoryOption = {
  id: string;
  storeKey: string;
  store: {
    key: string;
    name: string;
  } | null;
  slug: string;
  titleUa: string;
  titleEn: string;
  isPublished: boolean;
  sortOrder: number;
  parent: {
    id: string;
    slug: string;
    titleEn: string;
    titleUa: string;
  } | null;
  productsCount?: number;
  childrenCount?: number;
};

type CategoryResponse = CategoryOption & {
  descriptionUa: string | null;
  descriptionEn: string | null;
  parentId: string | null;
  products: Array<{
    id: string;
    slug: string;
    titleEn: string;
    titleUa: string;
    brand: string | null;
    image: string | null;
    isPublished: boolean;
  }>;
  children: Array<{
    id: string;
    slug: string;
    titleEn: string;
    titleUa: string;
    isPublished: boolean;
    sortOrder: number;
  }>;
};

type CategoryFormState = {
  storeKey: string;
  slug: string;
  titleUa: string;
  titleEn: string;
  descriptionUa: string;
  descriptionEn: string;
  parentId: string;
  isPublished: boolean;
  sortOrder: string;
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

type ShopStoreSummary = {
  key: string;
  name: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
};

function createEmptyForm(storeKey = 'urban'): CategoryFormState {
  return {
    storeKey,
    slug: '',
    titleUa: '',
    titleEn: '',
    descriptionUa: '',
    descriptionEn: '',
    parentId: '',
    isPublished: true,
    sortOrder: '0',
  };
}

function categoryToForm(category: CategoryResponse): CategoryFormState {
  return {
    storeKey: category.storeKey || 'urban',
    slug: category.slug,
    titleUa: category.titleUa,
    titleEn: category.titleEn,
    descriptionUa: category.descriptionUa ?? '',
    descriptionEn: category.descriptionEn ?? '',
    parentId: category.parentId ?? '',
    isPublished: category.isPublished,
    sortOrder: String(category.sortOrder),
  };
}

type Props = {
  categoryId?: string;
};

export default function AdminCategoryEditor({ categoryId }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isEditing = Boolean(categoryId);
  const initialStoreKey = searchParams.get('store') || 'urban';
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [slugTouched, setSlugTouched] = useState(isEditing);
  const [stores, setStores] = useState<ShopStoreSummary[]>([]);
  const [form, setForm] = useState<CategoryFormState>(() => createEmptyForm(initialStoreKey));
  const [availableParents, setAvailableParents] = useState<CategoryOption[]>([]);
  const [linkedProducts, setLinkedProducts] = useState<CategoryResponse['products']>([]);
  const [children, setChildren] = useState<CategoryResponse['children']>([]);

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
    let cancelled = false;

    async function loadParents() {
      try {
        const response = await fetch(`/api/admin/shop/categories?store=${encodeURIComponent(form.storeKey)}`);
        const data = await response.json().catch(() => []);
        if (!response.ok) {
          throw new Error((data as { error?: string }).error || 'Не вдалося завантажити категорії');
        }
        if (!cancelled) {
          setAvailableParents(Array.isArray(data) ? (data as CategoryOption[]) : []);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError((current) => current || (loadError as Error).message);
        }
      }
    }

    void loadParents();

    return () => {
      cancelled = true;
    };
  }, [form.storeKey]);

  useEffect(() => {
    if (!categoryId) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadCategory() {
      setLoading(true);
      setError('');
      try {
        const response = await fetch(`/api/admin/shop/categories/${categoryId}`);
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error((data as { error?: string }).error || 'Не вдалося завантажити категорію');
        }
        if (!cancelled) {
          const category = data as CategoryResponse;
          setForm(categoryToForm(category));
          setLinkedProducts(category.products);
          setChildren(category.children);
          setSlugTouched(true);
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

    void loadCategory();

    return () => {
      cancelled = true;
    };
  }, [categoryId]);

  function updateField<K extends keyof CategoryFormState>(key: K, value: CategoryFormState[K]) {
    setForm((current) => {
      const next = { ...current, [key]: value };
      if ((key === 'titleEn' || key === 'titleUa') && !slugTouched) {
        const base = key === 'titleEn' ? String(value || current.titleUa) : String(current.titleEn || value);
        next.slug = slugify(base);
      }
      return next;
    });

    if (key === 'slug') {
      setSlugTouched(true);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(
        isEditing ? `/api/admin/shop/categories/${categoryId}` : '/api/admin/shop/categories',
        {
          method: isEditing ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            storeKey: form.storeKey,
            slug: form.slug,
            titleUa: form.titleUa,
            titleEn: form.titleEn,
            descriptionUa: form.descriptionUa || null,
            descriptionEn: form.descriptionEn || null,
            parentId: form.parentId || null,
            isPublished: form.isPublished,
            sortOrder: Number(form.sortOrder) || 0,
          }),
        }
      );

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error((data as { error?: string }).error || 'Не вдалося зберегти категорію');
      }

      setSuccess(isEditing ? 'Категорію оновлено.' : 'Категорію створено.');
      if (!isEditing) {
        router.push(`/admin/shop/categories?store=${encodeURIComponent(form.storeKey)}`);
        router.refresh();
        return;
      }

      const detailResponse = await fetch(`/api/admin/shop/categories/${categoryId}`);
      const detailData = await detailResponse.json().catch(() => ({}));
      if (detailResponse.ok) {
        const category = detailData as CategoryResponse;
        setForm(categoryToForm(category));
        setLinkedProducts(category.products);
        setChildren(category.children);
      }
    } catch (saveError) {
      setError((saveError as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="p-6 text-white/60">Завантаження категорії…</div>;
  }

  return (
    <div className="h-full overflow-auto bg-[#090909]">
      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link href="/admin/shop/categories" className="inline-flex items-center gap-2 text-sm text-white/50 hover:text-white">
              <ArrowLeft className="h-4 w-4" />
              Назад до категорій
            </Link>
            <h1 className="mt-3 text-3xl font-semibold text-white">
              {isEditing ? 'Редагувати категорію' : 'Нова категорія'}
            </h1>
            <p className="mt-2 text-sm text-white/45">
              Структуровані категорії товарів для фільтрів каталогу, синхронізації та майбутньої навігації вітриною.
            </p>
          </div>
        </div>

        {error ? <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div> : null}
        {success ? <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">{success}</div> : null}

        <form onSubmit={handleSubmit} className="space-y-6">
          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <div className="mb-5">
              <h2 className="text-lg font-medium text-white">Огляд</h2>
              <p className="mt-1 text-sm text-white/45">Ідентичність категорії, її місце в дереві та стан публікації.</p>
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
              <InputField label="Slug" value={form.slug} onChange={(value) => updateField('slug', slugify(value))} />
              <SelectField
                label="Батьківська категорія"
                value={form.parentId}
                onChange={(value) => updateField('parentId', value)}
                options={[
                  { value: '', label: 'Без батьківської категорії' },
                  ...availableParents
                    .filter((category) => category.id !== categoryId)
                    .map((category) => ({
                      value: category.id,
                      label: `${category.titleEn || category.titleUa || category.slug}${category.store ? ` · ${category.store.name}` : ''}`,
                    })),
                ]}
              />
              <InputField label="Порядок сортування" type="number" value={form.sortOrder} onChange={(value) => updateField('sortOrder', value)} />
            </div>
            <div className="mt-4 flex flex-wrap gap-6">
              <CheckboxField label="Опубліковано" checked={form.isPublished} onChange={(checked) => updateField('isPublished', checked)} />
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <div className="mb-5">
              <h2 className="text-lg font-medium text-white">Описи</h2>
              <p className="mt-1 text-sm text-white/45">Необов’язкові локалізовані тексти для майбутніх сторінок категорій на вітрині.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <TextareaField label="Опис (EN)" value={form.descriptionEn} onChange={(value) => updateField('descriptionEn', value)} rows={6} />
              <TextareaField label="Опис (UA)" value={form.descriptionUa} onChange={(value) => updateField('descriptionUa', value)} rows={6} />
            </div>
          </section>

          {isEditing ? (
            <>
              <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <div className="mb-5">
                <h2 className="text-lg font-medium text-white">Дочірні категорії</h2>
                <p className="mt-1 text-sm text-white/45">Використовуйте це для побудови дерева каталогу, коли потрібне глибше групування.</p>
                </div>
                {children.length ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    {children.map((child) => (
                      <Link
                        key={child.id}
                        href={`/admin/shop/categories/${child.id}`}
                        className="rounded-xl border border-white/10 bg-black/40 p-4 text-sm text-white/80 hover:bg-white/5"
                      >
                        <div className="font-medium text-white">{child.titleEn || child.titleUa}</div>
                        <div className="mt-1 font-mono text-xs text-white/45">{child.slug}</div>
                        <div className="mt-2 text-xs text-white/50">Сортування {child.sortOrder}</div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-white/10 bg-black/30 px-4 py-8 text-sm text-white/45">
                    Дочірніх категорій ще немає.
                  </div>
                )}
              </section>

              <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <div className="mb-5">
                  <h2 className="text-lg font-medium text-white">Призначені товари</h2>
                  <p className="mt-1 text-sm text-white/45">Товари прив’язуються безпосередньо з редактора товару або через дію синхронізації.</p>
                </div>
                {linkedProducts.length ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    {linkedProducts.map((product) => (
                      <Link
                        key={product.id}
                        href={`/admin/shop/${product.id}`}
                        className="rounded-xl border border-white/10 bg-black/40 p-4 text-sm text-white/80 hover:bg-white/5"
                      >
                        <div className="font-medium text-white">{product.titleEn || product.titleUa}</div>
                        <div className="mt-1 font-mono text-xs text-white/45">{product.slug}</div>
                        <div className="mt-2 text-xs text-white/50">{product.brand || '—'}</div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-white/10 bg-black/30 px-4 py-8 text-sm text-white/45">
                    Товари ще не призначені.
                  </div>
                )}
              </section>
            </>
          ) : null}

          <div className="flex flex-wrap gap-3 pb-6">
            <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-medium text-black hover:bg-white/90 disabled:opacity-50">
              <Save className="h-4 w-4" />
              {saving ? 'Зберігаємо…' : isEditing ? 'Зберегти категорію' : 'Створити категорію'}
            </button>
            <Link href={`/admin/shop/categories${form.storeKey ? `?store=${encodeURIComponent(form.storeKey)}` : ''}`} className="rounded-lg border border-white/15 px-5 py-2.5 text-sm text-white hover:bg-white/5">
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

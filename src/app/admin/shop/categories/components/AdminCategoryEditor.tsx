'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save } from 'lucide-react';

type CategoryOption = {
  id: string;
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

function createEmptyForm(): CategoryFormState {
  return {
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
  const isEditing = Boolean(categoryId);
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [slugTouched, setSlugTouched] = useState(isEditing);
  const [form, setForm] = useState<CategoryFormState>(createEmptyForm());
  const [availableParents, setAvailableParents] = useState<CategoryOption[]>([]);
  const [linkedProducts, setLinkedProducts] = useState<CategoryResponse['products']>([]);
  const [children, setChildren] = useState<CategoryResponse['children']>([]);

  useEffect(() => {
    let cancelled = false;

    async function loadParents() {
      try {
        const response = await fetch('/api/admin/shop/categories');
        const data = await response.json().catch(() => []);
        if (!response.ok) {
          throw new Error((data as { error?: string }).error || 'Failed to load categories');
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
  }, []);

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
          throw new Error((data as { error?: string }).error || 'Failed to load category');
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
        throw new Error((data as { error?: string }).error || 'Failed to save category');
      }

      setSuccess(isEditing ? 'Category updated.' : 'Category created.');
      if (!isEditing) {
        router.push('/admin/shop/categories');
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
    return <div className="p-6 text-white/60">Loading category…</div>;
  }

  return (
    <div className="h-full overflow-auto bg-[#090909]">
      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link href="/admin/shop/categories" className="inline-flex items-center gap-2 text-sm text-white/50 hover:text-white">
              <ArrowLeft className="h-4 w-4" />
              Back to categories
            </Link>
            <h1 className="mt-3 text-3xl font-semibold text-white">
              {isEditing ? 'Edit category' : 'New category'}
            </h1>
            <p className="mt-2 text-sm text-white/45">
              Structured product categories for catalog filters, sync and future storefront navigation.
            </p>
          </div>
        </div>

        {error ? <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div> : null}
        {success ? <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">{success}</div> : null}

        <form onSubmit={handleSubmit} className="space-y-6">
          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <div className="mb-5">
              <h2 className="text-lg font-medium text-white">Overview</h2>
              <p className="mt-1 text-sm text-white/45">Category identity, tree placement and publish state.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <InputField label="Title (EN)" value={form.titleEn} onChange={(value) => updateField('titleEn', value)} />
              <InputField label="Title (UA)" value={form.titleUa} onChange={(value) => updateField('titleUa', value)} />
              <InputField label="Slug" value={form.slug} onChange={(value) => updateField('slug', slugify(value))} />
              <SelectField
                label="Parent category"
                value={form.parentId}
                onChange={(value) => updateField('parentId', value)}
                options={[
                  { value: '', label: 'No parent' },
                  ...availableParents
                    .filter((category) => category.id !== categoryId)
                    .map((category) => ({
                      value: category.id,
                      label: category.titleEn || category.titleUa || category.slug,
                    })),
                ]}
              />
              <InputField label="Sort order" type="number" value={form.sortOrder} onChange={(value) => updateField('sortOrder', value)} />
            </div>
            <div className="mt-4 flex flex-wrap gap-6">
              <CheckboxField label="Published" checked={form.isPublished} onChange={(checked) => updateField('isPublished', checked)} />
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <div className="mb-5">
              <h2 className="text-lg font-medium text-white">Descriptions</h2>
              <p className="mt-1 text-sm text-white/45">Optional localized copy for future storefront category pages.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <TextareaField label="Description (EN)" value={form.descriptionEn} onChange={(value) => updateField('descriptionEn', value)} rows={6} />
              <TextareaField label="Description (UA)" value={form.descriptionUa} onChange={(value) => updateField('descriptionUa', value)} rows={6} />
            </div>
          </section>

          {isEditing ? (
            <>
              <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <div className="mb-5">
                  <h2 className="text-lg font-medium text-white">Child categories</h2>
                  <p className="mt-1 text-sm text-white/45">Use this to build catalog trees when deeper grouping is needed.</p>
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
                        <div className="mt-2 text-xs text-white/50">Sort {child.sortOrder}</div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-white/10 bg-black/30 px-4 py-8 text-sm text-white/45">
                    No child categories yet.
                  </div>
                )}
              </section>

              <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <div className="mb-5">
                  <h2 className="text-lg font-medium text-white">Assigned products</h2>
                  <p className="mt-1 text-sm text-white/45">Products are linked directly from the product editor or the sync action.</p>
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
                    No products assigned yet.
                  </div>
                )}
              </section>
            </>
          ) : null}

          <div className="flex flex-wrap gap-3 pb-6">
            <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-medium text-black hover:bg-white/90 disabled:opacity-50">
              <Save className="h-4 w-4" />
              {saving ? 'Saving…' : isEditing ? 'Save category' : 'Create category'}
            </button>
            <Link href="/admin/shop/categories" className="rounded-lg border border-white/15 px-5 py-2.5 text-sm text-white hover:bg-white/5">
              Cancel
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

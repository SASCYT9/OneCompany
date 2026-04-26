'use client';

import { useEffect, useState } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Save } from 'lucide-react';

import {
  AdminEditorSection,
  AdminEditorShell,
  AdminInlineAlert,
  AdminPage,
  AdminStatusBadge,
  type AdminEditorNavSection,
} from '@/components/admin/AdminPrimitives';
import {
  AdminCheckboxField,
  AdminInputField,
  AdminSelectField,
  AdminTextareaField,
} from '@/components/admin/AdminFormFields';

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

const CATEGORY_EDITOR_SECTIONS: AdminEditorNavSection[] = [
  { id: 'overview', label: 'Overview', description: 'Identity, taxonomy placement, and publish state.' },
  { id: 'descriptions', label: 'Descriptions', description: 'Localized long-form copy.' },
  { id: 'structure', label: 'Structure', description: 'Child categories in the taxonomy tree.' },
  { id: 'products', label: 'Assigned products', description: 'Products explicitly linked to this category.' },
];

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
    return (
      <AdminPage>
        <div className="text-sm text-zinc-400">Завантаження категорії…</div>
      </AdminPage>
    );
  }

  return (
    <AdminEditorShell
      backHref="/admin/shop/categories"
      backLabel="Back to categories"
      title={isEditing ? 'Edit category' : 'New category'}
      description="Catalog category editor for taxonomy structure, publish visibility, and future storefront category pages."
      sections={CATEGORY_EDITOR_SECTIONS}
      summary={
        <div className="rounded-none border border-white/10 bg-[#171717] p-5">
          <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">Category state</div>
          <div className="mt-4 flex flex-wrap gap-2">
            <AdminStatusBadge tone={form.isPublished ? 'success' : 'warning'}>
              {form.isPublished ? 'Published' : 'Hidden'}
            </AdminStatusBadge>
            <AdminStatusBadge>{children.length} child nodes</AdminStatusBadge>
            <AdminStatusBadge>{linkedProducts.length} linked products</AdminStatusBadge>
          </div>
        </div>
      }
    >
      {error ? <AdminInlineAlert tone="error">{error}</AdminInlineAlert> : null}
      {success ? <AdminInlineAlert tone="success">{success}</AdminInlineAlert> : null}

      <form onSubmit={handleSubmit} className="space-y-6">
        <AdminEditorSection
          id="overview"
          title="Overview"
          description="Category identity, catalog tree placement, sort order, and publish visibility."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <AdminInputField label="Title (EN)" value={form.titleEn} onChange={(value) => updateField('titleEn', value)} />
            <AdminInputField label="Title (UA)" value={form.titleUa} onChange={(value) => updateField('titleUa', value)} />
            <AdminInputField label="Slug" value={form.slug} onChange={(value) => updateField('slug', slugify(value))} />
            <AdminSelectField
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
            <AdminInputField
              label="Sort order"
              type="number"
              value={form.sortOrder}
              onChange={(value) => updateField('sortOrder', value)}
            />
          </div>
          <div className="mt-4 flex flex-wrap gap-6">
            <AdminCheckboxField label="Published" checked={form.isPublished} onChange={(checked) => updateField('isPublished', checked)} />
          </div>
        </AdminEditorSection>

        <AdminEditorSection
          id="descriptions"
          title="Descriptions"
          description="Optional localized copy for future storefront category landing pages."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <AdminTextareaField label="Description (EN)" value={form.descriptionEn} onChange={(value) => updateField('descriptionEn', value)} rows={6} />
            <AdminTextareaField label="Description (UA)" value={form.descriptionUa} onChange={(value) => updateField('descriptionUa', value)} rows={6} />
          </div>
        </AdminEditorSection>

        {isEditing ? (
          <AdminEditorSection
            id="structure"
            title="Child categories"
            description="Use child nodes to build deeper catalog groupings without mixing tree management into list pages."
          >
            {children.length ? (
              <div className="grid gap-3 md:grid-cols-2">
                {children.map((child) => (
                  <Link
                    key={child.id}
                    href={`/admin/shop/categories/${child.id}`}
                    className="rounded-none border border-white/10 bg-black/30 p-4 text-sm text-zinc-200 transition hover:bg-white/[0.04]"
                  >
                    <div className="font-medium text-zinc-50">{child.titleEn || child.titleUa}</div>
                    <div className="mt-1 font-mono text-xs text-zinc-500">{child.slug}</div>
                    <div className="mt-2 text-xs text-zinc-500">Sort {child.sortOrder}</div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="rounded-none border border-dashed border-white/10 bg-black/20 px-4 py-8 text-sm text-zinc-500">
                No child categories yet.
              </div>
            )}
          </AdminEditorSection>
        ) : null}

        {isEditing ? (
          <AdminEditorSection
            id="products"
            title="Assigned products"
            description="Products are linked directly from the product editor or by future synchronization workflows."
          >
            {linkedProducts.length ? (
              <div className="grid gap-3 md:grid-cols-2">
                {linkedProducts.map((product) => (
                  <Link
                    key={product.id}
                    href={`/admin/shop/${product.id}`}
                    className="rounded-none border border-white/10 bg-black/30 p-4 text-sm text-zinc-200 transition hover:bg-white/[0.04]"
                  >
                    <div className="font-medium text-zinc-50">{product.titleEn || product.titleUa}</div>
                    <div className="mt-1 font-mono text-xs text-zinc-500">{product.slug}</div>
                    <div className="mt-2 text-xs text-zinc-500">{product.brand || '—'}</div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="rounded-none border border-dashed border-white/10 bg-black/20 px-4 py-8 text-sm text-zinc-500">
                No products assigned yet.
              </div>
            )}
          </AdminEditorSection>
        ) : null}

        <div className="flex flex-wrap gap-3 pb-6">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-none bg-gradient-to-b from-blue-500 to-blue-700 px-5 py-2.5 text-sm font-bold uppercase tracking-wider text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_2px_8px_rgba(59,130,246,0.4)] transition hover:from-blue-400 hover:to-blue-600 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Saving…' : isEditing ? 'Save category' : 'Create category'}
          </button>
          <Link
            href="/admin/shop/categories"
            className="rounded-none border border-white/10 bg-white/[0.03] px-5 py-2.5 text-sm text-zinc-200 transition hover:bg-white/[0.06]"
          >
            Cancel
          </Link>
        </div>
      </form>
    </AdminEditorShell>
  );
}

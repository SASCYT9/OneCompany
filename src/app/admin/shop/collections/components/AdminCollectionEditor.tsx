"use client";

import { useEffect, useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";

import {
  AdminEditorSection,
  AdminEditorShell,
  AdminInlineAlert,
  AdminPage,
  AdminStatusBadge,
  type AdminEditorNavSection,
} from "@/components/admin/AdminPrimitives";
import {
  AdminCheckboxField,
  AdminInputField,
  AdminTextareaField,
} from "@/components/admin/AdminFormFields";

type CollectionFormState = {
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

const COLLECTION_EDITOR_SECTIONS: AdminEditorNavSection[] = [
  { id: "overview", label: "Overview", description: "Identity, brand scope, and hero media." },
  {
    id: "descriptions",
    label: "Descriptions",
    description: "Localized copy for collection landing pages.",
  },
  {
    id: "products",
    label: "Assigned products",
    description: "Products currently mapped to this collection.",
  },
];

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function createEmptyForm(): CollectionFormState {
  return {
    handle: "",
    titleUa: "",
    titleEn: "",
    brand: "",
    descriptionUa: "",
    descriptionEn: "",
    heroImage: "",
    isPublished: true,
    isUrban: false,
    sortOrder: "0",
  };
}

function collectionToForm(collection: CollectionResponse): CollectionFormState {
  return {
    handle: collection.handle,
    titleUa: collection.titleUa,
    titleEn: collection.titleEn,
    brand: collection.brand ?? "",
    descriptionUa: collection.descriptionUa ?? "",
    descriptionEn: collection.descriptionEn ?? "",
    heroImage: collection.heroImage ?? "",
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
  const isEditing = Boolean(collectionId);
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [handleTouched, setHandleTouched] = useState(isEditing);
  const [form, setForm] = useState<CollectionFormState>(createEmptyForm());
  const [linkedProducts, setLinkedProducts] = useState<CollectionResponse["products"]>([]);

  useEffect(() => {
    if (!collectionId) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadCollection() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/admin/shop/collections/${collectionId}`);
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error((data as { error?: string }).error || "Не вдалося завантажити колекцію");
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
      if ((key === "titleEn" || key === "titleUa") && !handleTouched) {
        const base =
          key === "titleEn" ? String(value || current.titleUa) : String(current.titleEn || value);
        next.handle = slugify(base);
      }
      return next;
    });

    if (key === "handle") {
      setHandleTouched(true);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        isEditing ? `/api/admin/shop/collections/${collectionId}` : "/api/admin/shop/collections",
        {
          method: isEditing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
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
        throw new Error((data as { error?: string }).error || "Не вдалося зберегти колекцію");
      }

      setSuccess(isEditing ? "Колекцію оновлено." : "Колекцію створено.");
      if (!isEditing) {
        router.push("/admin/shop/collections");
        router.refresh();
      } else {
        setLinkedProducts(
          ((data as { products?: CollectionResponse["products"] }).products ??
            []) as CollectionResponse["products"]
        );
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
        <div className="text-sm text-zinc-400">Завантаження колекції…</div>
      </AdminPage>
    );
  }

  return (
    <AdminEditorShell
      backHref="/admin/shop/collections"
      backLabel="Back to collections"
      title={isEditing ? "Edit collection" : "New collection"}
      description="Collection editor for merchandising groups, hero assets, Urban scope, and landing page copy."
      sections={COLLECTION_EDITOR_SECTIONS}
      summary={
        <div className="rounded-none border border-white/10 bg-[#171717] p-5">
          <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">
            Collection state
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <AdminStatusBadge tone={form.isPublished ? "success" : "warning"}>
              {form.isPublished ? "Published" : "Hidden"}
            </AdminStatusBadge>
            {form.isUrban ? <AdminStatusBadge>Urban</AdminStatusBadge> : null}
            <AdminStatusBadge>{linkedProducts.length} mapped products</AdminStatusBadge>
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
          description="Collection identity, brand labeling, hero image source, sort order, and publication flags."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <AdminInputField
              label="Title (EN)"
              value={form.titleEn}
              onChange={(value) => updateField("titleEn", value)}
            />
            <AdminInputField
              label="Title (UA)"
              value={form.titleUa}
              onChange={(value) => updateField("titleUa", value)}
            />
            <AdminInputField
              label="Handle"
              value={form.handle}
              onChange={(value) => updateField("handle", slugify(value))}
            />
            <AdminInputField
              label="Brand"
              value={form.brand}
              onChange={(value) => updateField("brand", value)}
            />
            <AdminInputField
              label="Sort order"
              type="number"
              value={form.sortOrder}
              onChange={(value) => updateField("sortOrder", value)}
            />
            <AdminInputField
              label="Hero image URL"
              value={form.heroImage}
              onChange={(value) => updateField("heroImage", value)}
            />
          </div>
          <div className="mt-4 flex flex-wrap gap-6">
            <AdminCheckboxField
              label="Published"
              checked={form.isPublished}
              onChange={(checked) => updateField("isPublished", checked)}
            />
            <AdminCheckboxField
              label="Urban collection"
              checked={form.isUrban}
              onChange={(checked) => updateField("isUrban", checked)}
            />
          </div>
        </AdminEditorSection>

        <AdminEditorSection
          id="descriptions"
          title="Descriptions"
          description="Optional localized editorial copy for collection landing pages and search metadata reuse."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <AdminTextareaField
              label="Description (EN)"
              value={form.descriptionEn}
              onChange={(value) => updateField("descriptionEn", value)}
              rows={6}
            />
            <AdminTextareaField
              label="Description (UA)"
              value={form.descriptionUa}
              onChange={(value) => updateField("descriptionUa", value)}
              rows={6}
            />
          </div>
        </AdminEditorSection>

        {isEditing ? (
          <AdminEditorSection
            id="products"
            title="Assigned products"
            description="Products are mapped from the product editor or by Urban collection synchronization."
          >
            {linkedProducts.length ? (
              <div className="grid gap-3 md:grid-cols-2">
                {linkedProducts.map((product) => (
                  <Link
                    key={product.id}
                    href={`/admin/shop/${product.id}`}
                    className="rounded-none border border-white/10 bg-black/30 p-4 text-sm text-zinc-200 transition hover:bg-white/4"
                  >
                    <div className="font-medium text-zinc-50">
                      {product.titleEn || product.titleUa}
                    </div>
                    <div className="mt-1 font-mono text-xs text-zinc-500">{product.slug}</div>
                    <div className="mt-2 text-xs text-zinc-500">{product.brand || "—"}</div>
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
            className="inline-flex items-center gap-2 rounded-none bg-linear-to-b from-blue-500 to-blue-700 px-5 py-2.5 text-sm font-bold uppercase tracking-wider text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_2px_8px_rgba(59,130,246,0.4)] transition hover:from-blue-400 hover:to-blue-600 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? "Saving…" : isEditing ? "Save collection" : "Create collection"}
          </button>
          <Link
            href="/admin/shop/collections"
            className="rounded-none border border-white/10 bg-white/3 px-5 py-2.5 text-sm text-zinc-200 transition hover:bg-white/6"
          >
            Cancel
          </Link>
        </div>
      </form>
    </AdminEditorShell>
  );
}

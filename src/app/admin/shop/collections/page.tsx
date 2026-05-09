"use client";

import { useEffect, useMemo, useState } from "react";

import Link from "next/link";
import { Layers3, Pencil, Plus, RefreshCcw, Search, Trash2 } from "lucide-react";

import {
  AdminEmptyState,
  AdminFilterBar,
  AdminInlineAlert,
  AdminMetricCard,
  AdminMetricGrid,
  AdminPage,
  AdminPageHeader,
  AdminResponsiveTable,
  AdminStatusBadge,
  AdminTableShell,
} from "@/components/admin/AdminPrimitives";
import { AdminMobileCard } from "@/components/admin/AdminMobileCard";
import { useConfirm } from "@/components/admin/AdminConfirmDialog";
import { useToast } from "@/components/admin/AdminToast";

type ShopCollectionListItem = {
  id: string;
  handle: string;
  titleUa: string;
  titleEn: string;
  brand: string | null;
  heroImage: string | null;
  isPublished: boolean;
  isUrban: boolean;
  sortOrder: number;
  productsCount: number;
  updatedAt: string;
};

export default function AdminShopCollectionsPage() {
  const confirm = useConfirm();
  const toast = useToast();
  const [collections, setCollections] = useState<ShopCollectionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, []);

  const filteredCollections = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return collections;

    return collections.filter((collection) =>
      [collection.handle, collection.titleEn, collection.titleUa, collection.brand]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle))
    );
  }, [collections, query]);

  async function load() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/shop/collections");
      const data = await response.json().catch(() => []);
      if (!response.ok) {
        setError((data as { error?: string }).error || "Failed to load collections");
        return;
      }
      setCollections(data as ShopCollectionListItem[]);
    } finally {
      setLoading(false);
    }
  }

  async function handleSyncUrban() {
    setSyncing(true);
    setError("");

    try {
      const response = await fetch("/api/admin/shop/collections/sync-urban", { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError((data as { error?: string }).error || "Failed to sync Urban collections");
        return;
      }
      await load();
    } finally {
      setSyncing(false);
    }
  }

  async function handleDelete(id: string) {
    const ok = await confirm({
      tone: "danger",
      title: "Delete this collection?",
      description:
        "Products will keep legacy labels but lose the explicit mapping. This cannot be undone.",
      confirmLabel: "Delete collection",
    });
    if (!ok) return;

    setDeletingId(id);
    try {
      const response = await fetch(`/api/admin/shop/collections/${id}`, { method: "DELETE" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const msg = (data as { error?: string }).error || "Failed to delete collection";
        setError(msg);
        toast.error("Could not delete", msg);
        return;
      }
      toast.success("Collection deleted");
      await load();
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return (
      <AdminPage>
        <div className="flex items-center gap-3 rounded-none border border-white/10 bg-[#171717] px-5 py-6 text-sm text-zinc-400">
          <Layers3 className="h-4 w-4 animate-pulse" />
          Loading collections…
        </div>
      </AdminPage>
    );
  }

  return (
    <AdminPage className="space-y-6">
      <AdminPageHeader
        eyebrow="Catalog"
        title="Collections"
        description="Explicit merchandising sets for Urban and future storefront collection landing pages."
        actions={
          <>
            <button
              type="button"
              onClick={handleSyncUrban}
              disabled={syncing}
              className="inline-flex items-center gap-2 rounded-none border border-white/10 bg-white/3 px-4 py-2.5 text-sm text-zinc-200 transition hover:bg-white/6 disabled:opacity-50"
            >
              <RefreshCcw className={`h-4 w-4 ${syncing ? "motion-safe:animate-spin" : ""}`} />
              {syncing ? "Syncing…" : "Sync Urban"}
            </button>
            <Link
              href="/admin/shop/collections/new"
              className="inline-flex items-center gap-2 rounded-none bg-linear-to-b from-blue-500 to-blue-700 px-4 py-2.5 text-sm font-bold uppercase tracking-wider text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_2px_8px_rgba(59,130,246,0.4)] transition hover:from-blue-400 hover:to-blue-600"
            >
              <Plus className="h-4 w-4" />
              New collection
            </Link>
          </>
        }
      />

      <AdminMetricGrid className="xl:grid-cols-3">
        <AdminMetricCard
          label="Collections"
          value={collections.length}
          meta="Published and hidden collection records"
          tone="accent"
        />
        <AdminMetricCard
          label="Urban collections"
          value={collections.filter((item) => item.isUrban).length}
          meta="Explicit Urban landing sets"
        />
        <AdminMetricCard
          label="Mapped products"
          value={collections.reduce((sum, item) => sum + item.productsCount, 0)}
          meta="Product-collection assignments"
        />
      </AdminMetricGrid>

      <AdminFilterBar>
        <label className="flex w-full min-w-0 flex-1 items-center gap-2 rounded-none border border-white/10 bg-black/30 px-3.5 py-2.5 text-sm text-zinc-100 md:min-w-[280px]">
          <Search className="h-4 w-4 text-zinc-500" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by handle, title, or brand"
            className="w-full bg-transparent text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-hidden"
          />
        </label>
      </AdminFilterBar>

      {error ? <AdminInlineAlert tone="error">{error}</AdminInlineAlert> : null}

      {filteredCollections.length === 0 ? (
        <AdminEmptyState
          title="No collections found"
          description="Create a collection or run the Urban sync to populate structured product groupings."
          action={
            <Link
              href="/admin/shop/collections/new"
              className="inline-flex items-center gap-2 rounded-none bg-linear-to-b from-blue-500 to-blue-700 px-4 py-2.5 text-sm font-bold uppercase tracking-wider text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_2px_8px_rgba(59,130,246,0.4)] transition hover:from-blue-400 hover:to-blue-600"
            >
              <Plus className="h-4 w-4" />
              Create collection
            </Link>
          }
        />
      ) : (
        <AdminResponsiveTable
          mobile={
            <div className="space-y-2">
              {filteredCollections.map((collection) => (
                <AdminMobileCard
                  key={collection.id}
                  title={collection.titleEn || collection.titleUa}
                  subtitle={collection.handle}
                  badge={
                    <AdminStatusBadge tone={collection.isPublished ? "success" : "warning"}>
                      {collection.isPublished ? "Published" : "Hidden"}
                    </AdminStatusBadge>
                  }
                  rows={[
                    { label: "Brand", value: collection.brand || "—" },
                    { label: "Products", value: collection.productsCount },
                    {
                      label: "Updated",
                      value: new Date(collection.updatedAt).toLocaleDateString(),
                    },
                  ]}
                  footer={
                    <div className="flex gap-2">
                      <Link
                        href={`/admin/shop/collections/${collection.id}`}
                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-none border border-white/10 px-3 py-2.5 text-xs font-medium uppercase tracking-wider text-zinc-200"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleDelete(collection.id)}
                        disabled={deletingId === collection.id}
                        className="inline-flex items-center justify-center gap-1.5 rounded-none border border-blue-500/20 px-3 py-2.5 text-xs text-blue-300 disabled:opacity-50"
                        aria-label="Delete collection"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  }
                />
              ))}
            </div>
          }
          desktop={
            <AdminTableShell>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/3">
                    <th className="px-4 py-3 font-medium text-zinc-400">Collection</th>
                    <th className="px-4 py-3 font-medium text-zinc-400">Brand</th>
                    <th className="px-4 py-3 font-medium text-zinc-400">Flags</th>
                    <th className="px-4 py-3 font-medium text-zinc-400">Products</th>
                    <th className="px-4 py-3 font-medium text-zinc-400">Updated</th>
                    <th className="px-4 py-3 font-medium text-zinc-400">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCollections.map((collection) => (
                    <tr
                      key={collection.id}
                      className="border-b border-white/5 align-top transition hover:bg-white/2"
                    >
                      <td className="px-4 py-4">
                        <div className="font-medium text-zinc-50">
                          {collection.titleEn || collection.titleUa}
                        </div>
                        <div className="mt-1 font-mono text-xs text-zinc-500">
                          {collection.handle}
                        </div>
                        <div className="mt-1 text-xs text-zinc-500">
                          Sort {collection.sortOrder}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-zinc-300">{collection.brand || "—"}</td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-2">
                          <AdminStatusBadge tone={collection.isPublished ? "success" : "warning"}>
                            {collection.isPublished ? "Published" : "Hidden"}
                          </AdminStatusBadge>
                          {collection.isUrban ? (
                            <AdminStatusBadge tone="default">Urban</AdminStatusBadge>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-zinc-300">{collection.productsCount}</td>
                      <td className="px-4 py-4 text-zinc-500">
                        {new Date(collection.updatedAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/admin/shop/collections/${collection.id}`}
                            className="rounded-none border border-white/10 p-2 text-zinc-300 transition hover:bg-white/6 hover:text-zinc-50"
                            title="Edit collection"
                          >
                            <Pencil className="h-4 w-4" />
                          </Link>
                          <button
                            type="button"
                            onClick={() => handleDelete(collection.id)}
                            disabled={deletingId === collection.id}
                            className="rounded-none border border-blue-500/20 p-2 text-blue-300 transition hover:bg-blue-950/30 disabled:opacity-50"
                            title="Delete collection"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </AdminTableShell>
          }
        />
      )}
    </AdminPage>
  );
}

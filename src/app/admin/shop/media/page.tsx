'use client';

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { ArrowUpRight, Copy, ImageIcon, RefreshCcw, Search, Trash2, Upload, Video } from 'lucide-react';

import {
  AdminEmptyState,
  AdminFilterBar,
  AdminInlineAlert,
  AdminMetricCard,
  AdminMetricGrid,
  AdminPage,
  AdminPageHeader,
} from '@/components/admin/AdminPrimitives';
import { useConfirm } from '@/components/admin/AdminConfirmDialog';
import { useToast } from '@/components/admin/AdminToast';

type ShopLibraryMediaUsage = {
  productPrimaryImages: number;
  productMedia: number;
  variantImages: number;
  siteContent: number;
  siteMedia: number;
  videoConfig: number;
};

type ShopLibraryMediaItem = {
  id: string;
  kind: 'image' | 'video' | 'other';
  provider: 'local' | 'vercel-blob';
  pathname: string;
  filename: string;
  url: string;
  originalName: string;
  size: number;
  uploadedAt: string;
  usage: ShopLibraryMediaUsage;
  usageCount: number;
};

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function usageLabel(item: ShopLibraryMediaItem) {
  return [
    `${item.usage.productPrimaryImages} primary`,
    `${item.usage.productMedia} gallery`,
    `${item.usage.variantImages} variants`,
    `${item.usage.siteContent} content`,
    `${item.usage.siteMedia} site-media`,
    `${item.usage.videoConfig} video-config`,
  ].join(' · ');
}

export default function AdminShopMediaPage() {
  const confirm = useConfirm();
  const toast = useToast();
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const [items, setItems] = useState<ShopLibraryMediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    void load();
  }, []);

  const filteredItems = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return items;
    }

    return items.filter((item) =>
      [item.originalName, item.filename, item.url, item.kind]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle))
    );
  }, [items, query]);

  const summary = useMemo(
    () => ({
      total: items.length,
      images: items.filter((item) => item.kind === 'image').length,
      videos: items.filter((item) => item.kind === 'video').length,
      inUse: items.filter((item) => item.usageCount > 0).length,
    }),
    [items]
  );

  async function load() {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/admin/shop/media');
      const data = (await response.json().catch(() => ({}))) as { items?: ShopLibraryMediaItem[]; error?: string };

      if (response.status === 401) {
        setError('Unauthorized');
        return;
      }

      if (!response.ok) {
        setError(data.error || 'Failed to load media library');
        return;
      }

      setItems(data.items || []);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setUploading(true);
    setError('');
    setSuccess('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/admin/shop/media', {
        method: 'POST',
        body: formData,
      });
      const data = (await response.json().catch(() => ({}))) as { item?: ShopLibraryMediaItem; error?: string };

      if (!response.ok || !data.item) {
        throw new Error(data.error || 'Media upload failed');
      }

      setItems((current) => [data.item!, ...current.filter((item) => item.id !== data.item!.id)]);
      setSuccess(`Uploaded ${data.item.originalName}.`);
    } catch (uploadError) {
      setError((uploadError as Error).message);
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  }

  async function handleDelete(item: ShopLibraryMediaItem) {
    if (item.usageCount > 0) {
      setError('This asset is still in use and cannot be deleted.');
      return;
    }

    const ok = await confirm({
      tone: 'danger',
      title: 'Delete this media asset?',
      description: `${item.originalName} will be removed permanently. This cannot be undone.`,
      confirmLabel: 'Delete asset',
    });
    if (!ok) return;

    setDeletingId(item.id);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`/api/admin/shop/media/${item.id}`, {
        method: 'DELETE',
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        usage?: ShopLibraryMediaUsage;
      };

      if (!response.ok) {
        if (response.status === 409 && data.usage) {
          throw new Error(
            `Asset is in use: ${data.usage.productPrimaryImages} primary, ${data.usage.productMedia} gallery, ${data.usage.variantImages} variant, ${data.usage.siteContent} content, ${data.usage.siteMedia} site-media, ${data.usage.videoConfig} video-config references.`
          );
        }
        throw new Error(data.error || 'Delete failed');
      }

      setItems((current) => current.filter((entry) => entry.id !== item.id));
      setSuccess(`Deleted ${item.originalName}.`);
    } catch (deleteError) {
      setError((deleteError as Error).message);
    } finally {
      setDeletingId(null);
    }
  }

  async function handleCopy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setSuccess(`Copied ${url}`);
      setError('');
    } catch {
      setError('Clipboard is not available in this browser.');
    }
  }

  if (loading) {
    return (
      <AdminPage>
        <div className="flex items-center gap-3 rounded-[6px] border border-white/10 bg-[#171717] px-5 py-6 text-sm text-zinc-400">
          <RefreshCcw className="h-4 w-4 motion-safe:animate-spin" />
          Loading media library…
        </div>
      </AdminPage>
    );
  }

  return (
    <AdminPage className="space-y-6">
      <AdminPageHeader
        eyebrow="Catalog"
        title="Media library"
        description="Shared product asset library with usage tracking, safe-delete guardrails, and reusable upload flow."
        actions={
          <>
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex items-center gap-2 rounded-[6px] border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-zinc-200 transition hover:bg-white/[0.06]"
            >
              <RefreshCcw className="h-4 w-4" />
              Refresh
            </button>
            <input
              ref={uploadInputRef}
              type="file"
              accept="image/*,video/*"
              onChange={handleUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => uploadInputRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-2 rounded-[6px] bg-gradient-to-b from-blue-500 to-blue-700 px-4 py-2.5 text-sm font-bold uppercase tracking-wider text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_2px_8px_rgba(59,130,246,0.4)] transition hover:from-blue-400 hover:to-blue-600 disabled:opacity-60"
            >
              <Upload className="h-4 w-4" />
              {uploading ? 'Uploading…' : 'Upload asset'}
            </button>
          </>
        }
      />

      {error ? <AdminInlineAlert tone="error">{error}</AdminInlineAlert> : null}
      {success ? <AdminInlineAlert tone="success">{success}</AdminInlineAlert> : null}

      <AdminMetricGrid>
        <AdminMetricCard label="Assets" value={summary.total} meta="Total library records" tone="accent" />
        <AdminMetricCard label="Images" value={summary.images} meta="Image assets available for products" />
        <AdminMetricCard label="Videos" value={summary.videos} meta="Hosted video assets in the library" />
        <AdminMetricCard label="In use" value={summary.inUse} meta="Assets currently referenced by the system" />
      </AdminMetricGrid>

      <AdminFilterBar>
        <label className="flex min-w-[280px] flex-1 items-center gap-2 rounded-[6px] border border-white/10 bg-black/30 px-3.5 py-2.5 text-sm text-zinc-100">
          <Search className="h-4 w-4 text-zinc-500" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by original name, filename, URL, or type"
            className="w-full bg-transparent text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none"
          />
        </label>
        <div className="text-sm text-zinc-400">{filteredItems.length} visible assets</div>
      </AdminFilterBar>

        {filteredItems.length === 0 ? (
          <AdminEmptyState
            title="No media assets found"
            description="Upload an image or video to seed the shared media library and make it available to product editors."
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredItems.map((item) => (
              <div key={item.id} className="overflow-hidden rounded-[6px] border border-white/10 bg-[#171717]">
                <div className="border-b border-white/10 bg-black/30">
                  {item.kind === 'image' ? (
                    <img src={item.url} alt={item.originalName} className="h-48 w-full object-cover" />
                  ) : item.kind === 'video' ? (
                    <video src={item.url} className="h-48 w-full object-cover" muted controls playsInline />
                  ) : (
                    <div className="flex h-48 items-center justify-center gap-3 text-white/35">
                      <Video className="h-6 w-6" />
                      <span className="text-sm uppercase tracking-[0.24em]">{item.kind}</span>
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-zinc-50">{item.originalName}</div>
                      <div className="mt-1 truncate font-mono text-[11px] text-zinc-500">{item.filename}</div>
                    </div>
                    <span
                      className={`shrink-0 rounded-full border px-2 py-1 text-[11px] ${
                        item.usageCount > 0
                          ? 'border-amber-500/25 bg-amber-500/10 text-blue-300'
                          : 'border-emerald-500/25 bg-emerald-500/10 text-emerald-100'
                      }`}
                    >
                      {item.usageCount > 0 ? `${item.usageCount} refs` : 'Unused'}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-2 text-xs text-zinc-400">
                    <div className="flex items-center justify-between gap-3">
                      <span>Type</span>
                      <span className="inline-flex items-center gap-1 text-zinc-200">
                        <ImageIcon className="h-3.5 w-3.5" />
                        {item.kind}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>Size</span>
                      <span className="text-zinc-200">{formatBytes(item.size)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>Uploaded</span>
                      <span className="text-zinc-200">
                        {new Date(item.uploadedAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>Storage</span>
                      <span className="text-zinc-200">{item.provider}</span>
                    </div>
                    <div className="rounded-[6px] border border-white/10 bg-black/20 p-3 text-zinc-400">
                      {usageLabel(item)}
                    </div>
                    <div className="truncate font-mono text-[11px] text-zinc-600">{item.url}</div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-[6px] border border-white/10 px-3 py-2 text-xs text-zinc-200 transition hover:bg-white/[0.06]"
                    >
                      <ArrowUpRight className="h-3.5 w-3.5" />
                      Open
                    </a>
                    <button
                      type="button"
                      onClick={() => void handleCopy(item.url)}
                      className="inline-flex items-center gap-2 rounded-[6px] border border-white/10 px-3 py-2 text-xs text-zinc-200 transition hover:bg-white/[0.06]"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      Copy URL
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(item)}
                      disabled={deletingId === item.id || item.usageCount > 0}
                      className="inline-flex items-center gap-2 rounded-[6px] border border-blue-500/20 px-3 py-2 text-xs text-blue-300 transition hover:bg-blue-950/30 disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      {deletingId === item.id ? 'Deleting…' : item.usageCount > 0 ? 'In use' : 'Delete'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
    </AdminPage>
  );
}

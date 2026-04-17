'use client';

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Copy, ImageIcon, RefreshCcw, Search, Trash2, Upload, Video } from 'lucide-react';

type ShopLibraryMediaUsage = {
  productPrimaryImages: number;
  productMedia: number;
  variantImages: number;
};

type ShopLibraryMediaItem = {
  id: string;
  kind: 'image' | 'video' | 'other';
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
  ].join(' · ');
}

export default function AdminShopMediaPage() {
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

    if (!confirm(`Delete ${item.originalName}?`)) {
      return;
    }

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
            `Asset is in use: ${data.usage.productPrimaryImages} primary, ${data.usage.productMedia} gallery, ${data.usage.variantImages} variant references.`
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
      <div className="p-6 text-white/60 flex items-center gap-2">
        <RefreshCcw className="h-5 w-5 animate-spin" />
        Loading media library…
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div className="w-full px-6 md:px-12 py-6">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link href="/admin/shop" className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white">
              Back to catalog
            </Link>
            <h2 className="mt-4 text-2xl font-semibold text-white">Shop media</h2>
            <p className="mt-2 text-sm text-white/45">
              Central media library for uploaded product assets with reuse tracking and safe delete rules.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex items-center gap-2 rounded-none border border-white/10 bg-zinc-800 px-4 py-2 text-sm text-white hover:bg-zinc-700"
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
              className="inline-flex items-center gap-2 rounded-none bg-white px-4 py-2 text-sm font-medium text-black hover:bg-white/90 disabled:opacity-60"
            >
              <Upload className="h-4 w-4" />
              {uploading ? 'Uploading…' : 'Upload asset'}
            </button>
          </div>
        </div>

        {error ? <div className="mb-4 rounded-none bg-red-900/20 p-3 text-sm text-red-300">{error}</div> : null}
        {success ? <div className="mb-4 rounded-none bg-green-900/20 p-3 text-sm text-green-200">{success}</div> : null}

        <div className="mb-4 grid gap-4 md:grid-cols-4">
          <div className="rounded-none border border-white/10 bg-white/[0.03] p-4">
            <div className="text-xs uppercase tracking-[0.24em] text-white/40">Assets</div>
            <div className="mt-2 text-2xl font-semibold text-white">{summary.total}</div>
          </div>
          <div className="rounded-none border border-white/10 bg-white/[0.03] p-4">
            <div className="text-xs uppercase tracking-[0.24em] text-white/40">Images</div>
            <div className="mt-2 text-2xl font-semibold text-white">{summary.images}</div>
          </div>
          <div className="rounded-none border border-white/10 bg-white/[0.03] p-4">
            <div className="text-xs uppercase tracking-[0.24em] text-white/40">Videos</div>
            <div className="mt-2 text-2xl font-semibold text-white">{summary.videos}</div>
          </div>
          <div className="rounded-none border border-white/10 bg-white/[0.03] p-4">
            <div className="text-xs uppercase tracking-[0.24em] text-white/40">In Use</div>
            <div className="mt-2 text-2xl font-semibold text-white">{summary.inUse}</div>
          </div>
        </div>

        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-none border border-white/10 bg-white/[0.03] p-4">
          <label className="flex min-w-[280px] items-center gap-2 rounded-none border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white">
            <Search className="h-4 w-4 text-white/35" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by name, file, URL or type"
              className="w-full bg-transparent text-white placeholder:text-white/25 focus:outline-none"
            />
          </label>
          <div className="text-sm text-white/45">{filteredItems.length} visible assets</div>
        </div>

        {filteredItems.length === 0 ? (
          <div className="rounded-none border border-white/10 bg-white/[0.03] py-16 text-center text-white/50">
            No media assets found.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredItems.map((item) => (
              <div key={item.id} className="overflow-hidden rounded-none border border-white/10 bg-white/[0.03]">
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
                      <div className="truncate text-sm font-medium text-white">{item.originalName}</div>
                      <div className="mt-1 truncate font-mono text-[11px] text-white/40">{item.filename}</div>
                    </div>
                    <span
                      className={`shrink-0 rounded-none-full border px-2 py-1 text-[11px] ${
                        item.usageCount > 0
                          ? 'border-amber-500/25 bg-amber-500/10 text-amber-100'
                          : 'border-emerald-500/25 bg-emerald-500/10 text-emerald-100'
                      }`}
                    >
                      {item.usageCount > 0 ? `${item.usageCount} refs` : 'Unused'}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-2 text-xs text-white/55">
                    <div className="flex items-center justify-between gap-3">
                      <span>Type</span>
                      <span className="inline-flex items-center gap-1 text-white/75">
                        <ImageIcon className="h-3.5 w-3.5" />
                        {item.kind}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>Size</span>
                      <span className="text-white/75">{formatBytes(item.size)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>Uploaded</span>
                      <span className="text-white/75">
                        {new Date(item.uploadedAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="rounded-none border border-white/10 bg-black/20 p-3 text-white/55">
                      {usageLabel(item)}
                    </div>
                    <div className="truncate font-mono text-[11px] text-white/35">{item.url}</div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-none border border-white/15 px-3 py-2 text-xs text-white/80 hover:bg-white/5"
                    >
                      <ArrowUpRight className="h-3.5 w-3.5" />
                      Open
                    </a>
                    <button
                      type="button"
                      onClick={() => void handleCopy(item.url)}
                      className="inline-flex items-center gap-2 rounded-none border border-white/15 px-3 py-2 text-xs text-white/80 hover:bg-white/5"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      Copy URL
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(item)}
                      disabled={deletingId === item.id || item.usageCount > 0}
                      className="inline-flex items-center gap-2 rounded-none border border-red-500/25 px-3 py-2 text-xs text-red-300 hover:bg-red-950/30 border border-red-900/50 text-red-500/10 disabled:opacity-50"
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
      </div>
    </div>
  );
}

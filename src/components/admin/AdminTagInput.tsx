'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';

import { Loader2, Plus, X } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * AdminTagInput — chip-style tag editor for any entity.
 *
 * Type to add (Enter or comma to commit), click chip × to remove.
 * Tags are auto-lowercased and dash-normalized server-side.
 *
 * Usage:
 *   <AdminTagInput entityType="shop.customer" entityId={c.id} />
 */

type Tag = {
  id: string;
  tag: string;
  createdAt: string;
};

export function AdminTagInput({
  entityType,
  entityId,
  className,
  suggestions = [],
}: {
  entityType: string;
  entityId: string;
  className?: string;
  suggestions?: string[];
}) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [composing, setComposing] = useState(false);
  const [text, setText] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/admin/tags/${encodeURIComponent(entityType)}/${encodeURIComponent(entityId)}`,
          { cache: 'no-store' }
        );
        const data = await response.json().catch(() => ({}));
        if (!cancelled && response.ok) setTags(data.tags || []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [entityType, entityId, reloadKey]);

  async function addTag(rawTag: string) {
    const candidate = rawTag.trim();
    if (!candidate) return;
    setComposing(true);
    try {
      const response = await fetch(
        `/api/admin/tags/${encodeURIComponent(entityType)}/${encodeURIComponent(entityId)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tag: candidate }),
        }
      );
      if (!response.ok) return;
      setText('');
      setReloadKey((k) => k + 1);
    } finally {
      setComposing(false);
      inputRef.current?.focus();
    }
  }

  async function removeTag(tag: string) {
    const response = await fetch(
      `/api/admin/tags/${encodeURIComponent(entityType)}/${encodeURIComponent(entityId)}?tag=${encodeURIComponent(tag)}`,
      { method: 'DELETE' }
    );
    if (response.ok) setReloadKey((k) => k + 1);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      void addTag(text);
    } else if (e.key === 'Backspace' && !text && tags.length > 0) {
      // backspace on empty input removes last tag
      void removeTag(tags[tags.length - 1].tag);
    }
  }

  const presentTagSet = new Set(tags.map((t) => t.tag));
  const availableSuggestions = suggestions.filter((s) => !presentTagSet.has(s.toLowerCase()));

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex flex-wrap items-center gap-1.5 rounded-[6px] border border-white/10 bg-black/30 px-2 py-2">
        {loading ? (
          <Loader2 className="h-3 w-3 motion-safe:animate-spin text-zinc-500" />
        ) : tags.length === 0 ? null : (
          tags.map((t) => (
            <span
              key={t.id}
              className="inline-flex items-center gap-1 rounded-full border border-blue-500/25 bg-blue-500/[0.08] px-2 py-0.5 text-[11px] text-blue-200"
            >
              {t.tag}
              <button
                type="button"
                onClick={() => void removeTag(t.tag)}
                aria-label={`Видалити «${t.tag}»`}
                className="rounded-full p-0.5 transition hover:bg-blue-500/[0.15]"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          ))
        )}
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={tags.length === 0 ? 'Додати теги (Enter — додати)' : ''}
          disabled={composing}
          className="min-w-[120px] flex-1 bg-transparent text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none"
        />
        {text.trim() ? (
          <button
            type="button"
            onClick={() => void addTag(text)}
            disabled={composing}
            aria-label="Додати тег"
            className="rounded-md p-1 text-zinc-500 transition hover:bg-blue-500/[0.1] hover:text-blue-300"
          >
            <Plus className="h-3 w-3" />
          </button>
        ) : null}
      </div>

      {availableSuggestions.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          <span className="text-[10px] uppercase tracking-wider text-zinc-600">Підказки:</span>
          {availableSuggestions.slice(0, 8).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => void addTag(s)}
              className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-0 text-[11px] text-zinc-400 transition hover:border-blue-500/25 hover:bg-blue-500/[0.06] hover:text-blue-300"
            >
              + {s}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

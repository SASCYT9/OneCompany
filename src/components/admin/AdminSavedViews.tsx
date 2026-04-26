'use client';

import { useEffect, useState } from 'react';

import { Bookmark, BookmarkPlus, Check, ChevronDown, Trash2 } from 'lucide-react';

import { useConfirm } from '@/components/admin/AdminConfirmDialog';
import { useToast } from '@/components/admin/AdminToast';
import { cn } from '@/lib/utils';

/**
 * Saved Views — named filter combinations stored in localStorage per page.
 *
 * Usage:
 *   const view = useSavedViews({
 *     scope: 'orders',
 *     currentValue: { status, paymentStatus, smartFilter, search },
 *     onApply: (value) => { setStatus(value.status); ... },
 *   });
 *   <AdminSavedViewsBar {...view} />
 *
 * Storage format: `oc-admin-views-{scope}` → Array<{ id, name, value, createdAt }>
 */

export type SavedView<T = Record<string, unknown>> = {
  id: string;
  name: string;
  value: T;
  createdAt: string;
};

export function useSavedViews<T extends Record<string, unknown>>({
  scope,
  currentValue,
  presets = [],
  onApply,
}: {
  scope: string;
  currentValue: T;
  presets?: Array<{ name: string; value: Partial<T> }>;
  onApply: (value: T) => void;
}) {
  const storageKey = `oc-admin-views-${scope}`;
  const [views, setViews] = useState<SavedView<T>[]>([]);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const toast = useToast();
  const confirm = useConfirm();

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as SavedView<T>[];
        if (Array.isArray(parsed)) setViews(parsed);
      }
    } catch {
      // ignore corrupted
    }
  }, [storageKey]);

  function persist(next: SavedView<T>[]) {
    setViews(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      toast.warning('Не вдалося зберегти вид у локальне сховище');
    }
  }

  function saveCurrentAs(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    const id = `view-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const view: SavedView<T> = {
      id,
      name: trimmed,
      value: { ...currentValue },
      createdAt: new Date().toISOString(),
    };
    persist([view, ...views]);
    setActiveViewId(id);
    toast.success(`Вид збережено · ${trimmed}`);
  }

  async function deleteView(id: string) {
    const view = views.find((v) => v.id === id);
    if (!view) return;
    const ok = await confirm({
      tone: 'danger',
      title: `Видалити вид «${view.name}»?`,
      description: 'Вид буде видалено з локального сховища. На інших пристроях власні види залишаться.',
      confirmLabel: 'Видалити',
    });
    if (!ok) return;
    persist(views.filter((v) => v.id !== id));
    if (activeViewId === id) setActiveViewId(null);
    toast.success('Вид видалено');
  }

  function applyView(id: string) {
    const view = views.find((v) => v.id === id);
    if (!view) return;
    onApply(view.value);
    setActiveViewId(id);
  }

  function applyPreset(preset: { name: string; value: Partial<T> }) {
    onApply({ ...currentValue, ...preset.value });
    setActiveViewId(null);
  }

  return {
    views,
    presets,
    activeViewId,
    saveCurrentAs,
    deleteView,
    applyView,
    applyPreset,
    clearActive: () => setActiveViewId(null),
  };
}

export function AdminSavedViewsBar<T extends Record<string, unknown>>({
  views,
  presets,
  activeViewId,
  saveCurrentAs,
  deleteView,
  applyView,
  applyPreset,
}: ReturnType<typeof useSavedViews<T>>) {
  const [open, setOpen] = useState(false);
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [name, setName] = useState('');

  // Close popover on outside click
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      const t = e.target as HTMLElement;
      if (!t.closest('[data-saved-views]')) {
        setOpen(false);
        setShowSaveInput(false);
        setName('');
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const activeName = views.find((v) => v.id === activeViewId)?.name;
  const totalCount = views.length + presets.length;

  return (
    <div data-saved-views className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-9 items-center gap-1.5 rounded-none border border-white/[0.08] bg-[#171717] px-3 text-xs font-medium text-zinc-200 transition hover:border-white/15 hover:bg-[#1F1F1F]"
        aria-haspopup="true"
        aria-expanded={open}
      >
        <Bookmark className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="hidden sm:inline">{activeName ?? 'Види'}</span>
        {totalCount > 0 ? (
          <span className="rounded-full bg-blue-500/15 px-1.5 py-0.5 text-[10px] font-bold text-blue-300 tabular-nums">
            {totalCount}
          </span>
        ) : null}
        <ChevronDown className={cn('h-3 w-3 text-zinc-500 transition', open && 'rotate-180')} aria-hidden="true" />
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-30 mt-2 w-[320px] overflow-hidden rounded-none border border-white/[0.08] bg-[#171717] shadow-[0_30px_80px_rgba(0,0,0,0.6)]">
          {/* Save current */}
          <div className="border-b border-white/[0.04] p-3">
            {showSaveInput ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  saveCurrentAs(name);
                  setName('');
                  setShowSaveInput(false);
                  setOpen(false);
                }}
                className="flex items-center gap-2"
              >
                <input
                  autoFocus
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Назва виду (напр. «Неоплачені >14д»)"
                  className="flex-1 rounded-none border border-white/[0.08] bg-[#0F0F0F] px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-blue-500/40 focus:outline-none focus:ring-2 focus:ring-blue-500/15"
                />
                <button
                  type="submit"
                  disabled={!name.trim()}
                  className="rounded-none bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-500 disabled:opacity-40"
                >
                  Зберегти
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setShowSaveInput(true)}
                className="flex w-full items-center gap-2 rounded-none px-2 py-1.5 text-sm text-blue-300 transition hover:bg-white/[0.03]"
              >
                <BookmarkPlus className="h-4 w-4" aria-hidden="true" />
                Зберегти поточні фільтри як вид…
              </button>
            )}
          </div>

          {/* Presets */}
          {presets.length > 0 ? (
            <div className="border-b border-white/[0.04] px-1.5 py-2">
              <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Швидкі види</div>
              {presets.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => {
                    applyPreset(preset);
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-none px-2 py-1.5 text-left text-sm text-zinc-200 transition hover:bg-white/[0.03]"
                >
                  <span className="flex-1 truncate">{preset.name}</span>
                </button>
              ))}
            </div>
          ) : null}

          {/* Saved views */}
          <div className="px-1.5 py-2">
            <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Збережені види {views.length > 0 ? `· ${views.length}` : ''}
            </div>
            {views.length === 0 ? (
              <div className="px-2 py-3 text-xs text-zinc-500">
                Поки немає збережених видів. Налаштуйте фільтри та натисніть «Зберегти поточні фільтри як вид».
              </div>
            ) : (
              views.map((view) => (
                <div
                  key={view.id}
                  className={cn(
                    'group flex items-center gap-1 rounded-none px-1 transition hover:bg-white/[0.03]',
                    activeViewId === view.id && 'bg-blue-500/[0.08]'
                  )}
                >
                  <button
                    type="button"
                    onClick={() => {
                      applyView(view.id);
                      setOpen(false);
                    }}
                    className="flex flex-1 items-center gap-2 rounded-none px-2 py-1.5 text-left text-sm text-zinc-200"
                  >
                    {activeViewId === view.id ? (
                      <Check className="h-3.5 w-3.5 shrink-0 text-blue-400" aria-hidden="true" />
                    ) : (
                      <span className="h-3.5 w-3.5 shrink-0" />
                    )}
                    <span className="flex-1 truncate">{view.name}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteView(view.id)}
                    aria-label={`Видалити вид «${view.name}»`}
                    className="rounded-none p-1.5 text-zinc-600 opacity-0 transition hover:bg-red-500/[0.1] hover:text-red-400 group-hover:opacity-100 focus:opacity-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

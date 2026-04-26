'use client';

import type { ReactNode } from 'react';

import Link from 'next/link';

import { ArrowLeft } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * Shopify-style sticky save bar for editor pages.
 *
 * Sticks to the top of the viewport, glassy backdrop, holds:
 *  - Back link (← Каталог)
 *  - Editable entity title (truncated)
 *  - Status badge slot
 *  - Right-side actions (typically the primary "Save" button + secondary)
 *
 * Pair with an editor body that has `scroll-mt-20` on its sections so anchor
 * jumps don't get covered by the bar.
 */
export function AdminEditorTopBar({
  backHref,
  backLabel = 'Назад',
  eyebrow,
  title,
  status,
  actions,
  unsavedChanges,
  className,
}: {
  backHref: string;
  backLabel?: string;
  eyebrow?: string;
  title: string;
  /** Status pill / badge node (rendered to the right of the title). */
  status?: ReactNode;
  /** Right-aligned action buttons (Save, etc.). */
  actions?: ReactNode;
  /** When true, renders an "unsaved" indicator — small amber dot + label. */
  unsavedChanges?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'sticky top-0 z-30 -mx-4 mb-6 border-b border-white/[0.06] bg-[#0F0F0F]/92 px-4 py-3 backdrop-blur-xl md:-mx-8 md:px-8 xl:-mx-10 xl:px-10',
        className
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Link
            href={backHref}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center border border-white/[0.08] bg-white/[0.03] text-zinc-300 transition hover:border-white/20 hover:bg-white/[0.06] hover:text-zinc-50"
            aria-label={backLabel}
            title={backLabel}
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0 flex-1">
            {eyebrow ? (
              <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-zinc-500">
                {eyebrow}
              </div>
            ) : null}
            <div className="flex min-w-0 items-center gap-2">
              <h1 className="truncate text-[15px] font-semibold tracking-tight text-zinc-50 sm:text-base">
                {title}
              </h1>
              {status ? <div className="shrink-0">{status}</div> : null}
              {unsavedChanges ? (
                <span
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-amber-300"
                  aria-live="polite"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400" aria-hidden="true" />
                  Незбережено
                </span>
              ) : null}
            </div>
          </div>
        </div>

        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </div>
    </div>
  );
}

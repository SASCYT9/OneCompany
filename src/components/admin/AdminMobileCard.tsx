'use client';

import type { ReactNode } from 'react';

import { ChevronRight } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * AdminMobileCard — replaces table rows on mobile (≤md breakpoint).
 *
 * Pattern: hide a `<table>` with `hidden lg:block` and render
 * a vertical stack of `<AdminMobileCard>` instances with `lg:hidden`.
 *
 * Each card is touch-friendly (>=44px tap target) and shows a 2-column
 * label/value grid with optional title/badge/actions blocks.
 *
 * Usage:
 *   <div className="lg:hidden space-y-2">
 *     {items.map(it => (
 *       <AdminMobileCard
 *         key={it.id}
 *         title={it.orderNumber}
 *         subtitle={it.customerName}
 *         badge={<AdminStatusBadge tone="success">PAID</AdminStatusBadge>}
 *         href={`/admin/shop/orders/${it.id}`}
 *         rows={[
 *           { label: 'Total', value: '€450' },
 *           { label: 'Items', value: 3 },
 *         ]}
 *         footer={<button>Quick view</button>}
 *       />
 *     ))}
 *   </div>
 */

export type MobileCardRow = {
  label: string;
  value: ReactNode;
};

type Props = {
  title?: ReactNode;
  subtitle?: ReactNode;
  badge?: ReactNode;
  /** Optional slot rendered to the left of title/subtitle (e.g. product thumbnail). */
  leading?: ReactNode;
  rows?: MobileCardRow[];
  footer?: ReactNode;
  href?: string;
  onClick?: () => void;
  className?: string;
  tone?: 'default' | 'accent' | 'warning' | 'danger';
};

export function AdminMobileCard({
  title,
  subtitle,
  badge,
  leading,
  rows,
  footer,
  href,
  onClick,
  className,
  tone = 'default',
}: Props) {
  const toneClass =
    tone === 'accent'
      ? 'border-blue-500/25 bg-blue-500/[0.04]'
      : tone === 'warning'
        ? 'border-amber-500/25 bg-amber-500/[0.04]'
        : tone === 'danger'
          ? 'border-red-500/25 bg-red-500/[0.04]'
          : 'border-white/[0.05] bg-[#171717]';

  const content = (
    <>
      {(title || badge || leading) ? (
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            {leading ? <div className="shrink-0">{leading}</div> : null}
            <div className="min-w-0 flex-1">
              {title ? <div className="font-semibold text-zinc-50">{title}</div> : null}
              {subtitle ? <div className="mt-0.5 truncate text-xs text-zinc-500">{subtitle}</div> : null}
            </div>
          </div>
          {badge ? <div className="shrink-0">{badge}</div> : null}
        </div>
      ) : null}

      {rows && rows.length > 0 ? (
        <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
          {rows.map((row, idx) => (
            <div key={idx} className="flex items-baseline justify-between gap-2 border-b border-white/[0.04] pb-1.5 last:border-b-0 last:pb-0">
              <span className="text-zinc-500">{row.label}</span>
              <span className="truncate text-right font-medium text-zinc-200 tabular-nums">{row.value}</span>
            </div>
          ))}
        </div>
      ) : null}

      {footer ? <div className="mt-3 border-t border-white/[0.04] pt-3">{footer}</div> : null}

      {href || onClick ? (
        <ChevronRight
          className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600 transition group-hover:text-zinc-400"
          aria-hidden="true"
        />
      ) : null}
    </>
  );

  const baseClass = cn(
    'group relative block rounded-none border p-3 transition active:scale-[0.99]',
    toneClass,
    (href || onClick) && 'cursor-pointer hover:border-blue-500/30 hover:bg-blue-500/[0.06] pr-9',
    className
  );

  if (href) {
    // Use a real anchor for navigation
    return (
      <a href={href} className={baseClass}>
        {content}
      </a>
    );
  }

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cn(baseClass, 'w-full text-left')}>
        {content}
      </button>
    );
  }

  return <div className={baseClass}>{content}</div>;
}

/**
 * Bottom sticky action bar — for detail pages on mobile.
 *
 * Renders fixed at the bottom edge with safe-area inset padding.
 * Hidden on desktop (lg+).
 *
 * Usage:
 *   <AdminMobileBottomBar>
 *     <button>Save</button>
 *     <button>Discard</button>
 *   </AdminMobileBottomBar>
 *
 * IMPORTANT: add bottom padding to your page content equal to ~80px
 * so the bar doesn't cover content (e.g. `pb-24 lg:pb-0`).
 */
export function AdminMobileBottomBar({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'fixed inset-x-0 bottom-0 z-30 border-t border-white/[0.08] bg-[#0F0F0F]/95 backdrop-blur-xl lg:hidden',
        'px-4 py-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]',
        className
      )}
    >
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

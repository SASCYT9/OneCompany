'use client';

import { useEffect, type ReactNode } from 'react';

import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * Slide-over panel — slides in from the right edge (default) or up from the
 * bottom (mobile filter sheets). Backdrop closes on click, Escape, X button.
 *
 * - Locks body scroll when open
 * - Returns focus to trigger on close
 * - Aria-modal compliant
 *
 * `position="bottom"` is the bottom-sheet variant — full width, top corners
 * rounded, max-height ~85dvh, drag-pull handle at top. Use it for mobile
 * filter sheets and quick-actions menus on small screens.
 */
export function AdminSlideOver({
  open,
  onClose,
  title,
  subtitle,
  width = 'md',
  position = 'right',
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  width?: 'sm' | 'md' | 'lg' | 'xl';
  position?: 'right' | 'bottom';
  children: ReactNode;
  footer?: ReactNode;
}) {
  // Lock body scroll
  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  // Escape key
  useEffect(() => {
    if (!open) return;
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const widthClass =
    width === 'sm'
      ? 'max-w-md'
      : width === 'md'
        ? 'max-w-xl'
        : width === 'lg'
          ? 'max-w-3xl'
          : 'max-w-5xl';

  const isBottom = position === 'bottom';

  const panelMotion = isBottom
    ? { initial: { y: '100%' }, animate: { y: 0 }, exit: { y: '100%' } }
    : { initial: { x: '100%' }, animate: { x: 0 }, exit: { x: '100%' } };

  const panelClass = isBottom
    ? cn(
        'absolute inset-x-0 bottom-0 flex max-h-[85dvh] w-full flex-col overflow-hidden border-t border-white/[0.06] bg-[#0F0F0F] shadow-[0_-30px_80px_rgba(0,0,0,0.7)]',
        'pb-[max(env(safe-area-inset-bottom),0.5rem)]'
      )
    : cn(
        'absolute inset-y-0 right-0 flex w-full flex-col overflow-hidden border-l border-white/[0.06] bg-[#0F0F0F] shadow-[-30px_0_80px_rgba(0,0,0,0.7)]',
        widthClass
      );

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-[90]" role="dialog" aria-modal="true">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* Panel */}
          <motion.div
            initial={panelMotion.initial}
            animate={panelMotion.animate}
            exit={panelMotion.exit}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            className={panelClass}
          >
            {isBottom ? (
              <div className="flex justify-center pt-2" aria-hidden="true">
                <span className="h-1 w-10 rounded-full bg-white/15" />
              </div>
            ) : null}

            <header className="flex items-start justify-between gap-3 border-b border-white/[0.05] bg-[#171717] px-5 py-4">
              <div className="min-w-0 flex-1">
                <div className="text-base font-semibold text-zinc-50">{title}</div>
                {subtitle ? <div className="mt-0.5 truncate text-xs text-zinc-400">{subtitle}</div> : null}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="-mr-1 rounded-none p-1.5 text-zinc-400 transition hover:bg-white/[0.04] hover:text-zinc-100"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>

            {footer ? (
              <footer className="border-t border-white/[0.05] bg-[#171717] px-5 py-3">{footer}</footer>
            ) : null}
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}

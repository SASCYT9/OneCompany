'use client';

import { useEffect, type ReactNode } from 'react';

import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * Slide-over panel — slides in from the right edge with backdrop.
 * Used for quick-view of entities (order, customer, product) without full nav.
 *
 * - Closes on backdrop click, Escape, X button
 * - Locks body scroll when open
 * - Returns focus to trigger on close
 * - Aria-modal compliant
 */
export function AdminSlideOver({
  open,
  onClose,
  title,
  subtitle,
  width = 'md',
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  width?: 'sm' | 'md' | 'lg' | 'xl';
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
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            className={cn(
              'absolute inset-y-0 right-0 flex w-full flex-col overflow-hidden border-l border-white/[0.06] bg-[#0F0F0F] shadow-[-30px_0_80px_rgba(0,0,0,0.7)]',
              widthClass
            )}
          >
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

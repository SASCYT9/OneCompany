"use client";

import { type ReactNode } from "react";

import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

export type BulkAction = {
  id: string;
  label: string;
  icon?: ReactNode;
  /** danger renders red; primary blue; default neutral */
  tone?: "default" | "primary" | "danger";
  onClick: () => void;
  disabled?: boolean;
  /** When set, replaces the action with a custom rendered element (advanced) */
  render?: () => ReactNode;
};

/**
 * Sticky bottom bulk-action bar that animates in when selection > 0.
 * Place at the bottom of any list page that has selectable rows.
 *
 * Usage:
 *   <AdminBulkActionBar
 *     count={selectedIds.length}
 *     onClear={() => setSelectedIds([])}
 *     actions={[
 *       { id: 'export', label: 'Export', icon: <Download />, onClick: ... },
 *       { id: 'archive', label: 'Archive', tone: 'danger', icon: <Archive />, onClick: ... },
 *     ]}
 *   />
 */
export function AdminBulkActionBar({
  count,
  onClear,
  actions,
  label = "selected",
  centerSlot,
  className,
}: {
  count: number;
  onClear: () => void;
  actions: BulkAction[];
  /** Singular label suffix; "selected" → "12 selected" */
  label?: string;
  /** Optional middle slot (e.g. status selector dropdown) */
  centerSlot?: ReactNode;
  className?: string;
}) {
  return (
    <AnimatePresence>
      {count > 0 ? (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: "spring", stiffness: 380, damping: 30 }}
          className={cn(
            "fixed bottom-4 left-1/2 z-40 w-[calc(100%-2rem)] max-w-[920px] -translate-x-1/2",
            className
          )}
          role="region"
          aria-label="Bulk actions"
        >
          <div className="flex flex-wrap items-center gap-3 rounded-none border border-white/10 bg-[#171717]/95 px-3 py-2.5 shadow-[0_30px_60px_rgba(0,0,0,0.5)] backdrop-blur-xl">
            {/* Counter */}
            <div className="flex items-center gap-2 pl-1">
              <span className="flex h-7 min-w-[28px] items-center justify-center rounded-full bg-blue-600 px-2 text-[11px] font-bold text-white tabular-nums">
                {count}
              </span>
              <span className="text-sm font-medium text-zinc-200">{label}</span>
              <button
                type="button"
                onClick={onClear}
                aria-label="Clear selection"
                className="rounded-none p-1 text-zinc-500 transition hover:bg-white/4 hover:text-zinc-200"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>

            {/* Optional center slot (e.g. status select) */}
            {centerSlot ? (
              <div className="flex flex-1 items-center gap-2 border-l border-white/6 pl-3">
                {centerSlot}
              </div>
            ) : (
              <div className="flex-1" />
            )}

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-1.5">
              {actions.map((action) => {
                if (action.render) {
                  return <span key={action.id}>{action.render()}</span>;
                }
                const tone = action.tone ?? "default";
                const cls =
                  tone === "primary"
                    ? "bg-blue-600 text-white hover:bg-blue-500 disabled:bg-blue-600/40"
                    : tone === "danger"
                      ? "border border-red-500/30 bg-red-500/8 text-red-300 hover:border-red-500/50 hover:bg-red-500/15"
                      : "border border-white/10 bg-white/3 text-zinc-100 hover:border-white/20 hover:bg-white/6";
                return (
                  <button
                    key={action.id}
                    type="button"
                    onClick={action.onClick}
                    disabled={action.disabled}
                    className={cn(
                      "inline-flex h-8 items-center gap-1.5 rounded-none px-3 text-xs font-semibold transition",
                      "focus:outline-hidden focus:ring-2 focus:ring-blue-500/40 focus:ring-offset-2 focus:ring-offset-[#171717]",
                      "disabled:cursor-not-allowed disabled:opacity-50",
                      cls
                    )}
                  >
                    {action.icon ? (
                      <span
                        className="flex items-center [&>svg]:h-3.5 [&>svg]:w-3.5"
                        aria-hidden="true"
                      >
                        {action.icon}
                      </span>
                    ) : null}
                    {action.label}
                  </button>
                );
              })}
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

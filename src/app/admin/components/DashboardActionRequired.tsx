import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { cn } from "@/lib/utils";

export type ActionItem = {
  id: string;
  severity: "red" | "amber" | "green";
  label: string;
  count: number;
  detail: ReactNode;
  href: string;
};

const SEVERITY_RANK: Record<ActionItem["severity"], number> = { red: 0, amber: 1, green: 2 };

export function DashboardActionRequired({ items }: { items: ActionItem[] }) {
  // Sort: red first, then amber, then green; within each severity by count desc.
  // Filter out green entries (they're not actionable — keep the panel about issues).
  const actionable = items
    .filter((i) => i.severity !== "green" && i.count > 0)
    .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || b.count - a.count);

  return (
    <section className="relative overflow-hidden rounded-none border border-white/5 bg-[#171717]">
      <div className="flex items-center gap-2.5 border-b border-white/5 px-4 py-3">
        <h3 className="font-display text-[13px] font-semibold tracking-tight text-zinc-100">
          Потребує дії
        </h3>
        <span className="font-display ml-auto text-[12px] tabular-nums text-zinc-500">
          {actionable.length}
        </span>
      </div>

      {actionable.length === 0 ? (
        <div className="font-display flex items-center gap-3 px-4 py-6 text-[13px] text-zinc-400">
          <span className="h-2 w-2 rounded-full bg-green-500" />
          <span>Все спокійно. Активних проблем немає.</span>
        </div>
      ) : (
        <ul className="divide-y divide-white/5">
          {actionable.map((item) => (
            <li key={item.id}>
              <ActionRow item={item} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ActionRow({ item }: { item: ActionItem }) {
  const dotClass =
    item.severity === "red"
      ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]"
      : item.severity === "amber"
        ? "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.7)]"
        : "bg-green-500";

  const stripeClass =
    item.severity === "red"
      ? "bg-red-500"
      : item.severity === "amber"
        ? "bg-amber-400"
        : "bg-green-500";

  const countClass =
    item.severity === "red"
      ? "text-red-300"
      : item.severity === "amber"
        ? "text-amber-200"
        : "text-green-200";

  // Spell out severity for assistive tech.
  const severityText =
    item.severity === "red" ? "Critical" : item.severity === "amber" ? "Warning" : "Info";

  return (
    <Link
      href={item.href}
      aria-label={`${severityText}: ${item.label}, count ${item.count}`}
      className="group relative flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-white/[0.025] focus-visible:outline-hidden focus-visible:bg-white/4 focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:ring-inset"
    >
      <span className={cn("absolute left-0 top-0 h-full w-px", stripeClass)} aria-hidden="true" />
      <span className={cn("h-2 w-2 shrink-0 rounded-full", dotClass)} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <span className="font-display text-[14px] font-semibold text-zinc-100">{item.label}</span>
          <span
            className={cn(
              "font-condensed text-[20px] font-normal tabular-nums leading-none",
              countClass
            )}
          >
            {item.count}
          </span>
        </div>
        <div className="font-display mt-1 truncate text-[12px] text-zinc-400">{item.detail}</div>
      </div>
      <ArrowUpRight
        className="h-4 w-4 shrink-0 text-zinc-600 transition-colors group-hover:text-blue-400"
        aria-hidden="true"
      />
    </Link>
  );
}

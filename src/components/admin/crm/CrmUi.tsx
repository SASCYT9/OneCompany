import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { crmMono, crmSans } from "./crmFonts";

/**
 * Building blocks of the CRM screens (customers): dark, square, dense — in
 * the spirit of Attio / Twenty / Folk. Colours stay in this file so every
 * CRM screen reads the same.
 */

export const crmButton =
  "inline-flex h-8 items-center justify-center gap-1.5 border border-[#24262B] px-3 text-[13px] text-zinc-100 transition hover:bg-[#1C1D21] disabled:cursor-not-allowed disabled:opacity-45";
export const crmPrimaryButton =
  "inline-flex h-8 items-center justify-center gap-1.5 bg-[#2563EB] px-3 text-[13px] font-medium text-white transition hover:bg-[#3B74F0] disabled:cursor-not-allowed disabled:opacity-45";
export const crmIconButton =
  "inline-flex h-8 w-8 items-center justify-center border border-[#24262B] text-zinc-400 transition hover:bg-[#1C1D21] hover:text-white disabled:opacity-45";
export const crmInput =
  "h-8 w-full border border-[#24262B] bg-[#0A0A0B] px-2.5 text-[13px] text-zinc-100 placeholder:text-zinc-600 focus:border-[#3B82F6] focus:outline-none";
export const crmLine = "border-[#1F2125]";

export function CrmSurface({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("crm-surface", crmSans.variable, crmMono.variable, className)}>
      {children}
    </div>
  );
}

export type CrmTone = "blue" | "green" | "amber" | "gray" | "red";

const TONES: Record<CrmTone, string> = {
  blue: "border-[#203A66] bg-[#0F1A2E] text-[#9CC0FF]",
  green: "border-[#23432F] bg-[#0F1A13] text-[#86E0A3]",
  amber: "border-[#5A4214] bg-[#22190A] text-[#F5C46B]",
  gray: "border-[#2A2C31] bg-[#151619] text-[#C9CBD0]",
  red: "border-[#5B2323] bg-[#1F0E0E] text-[#F19B9B]",
};

export function CrmChip({
  tone = "gray",
  children,
  className,
}: {
  tone?: CrmTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap border px-1.5 py-px text-[12px] leading-[18px]",
        TONES[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

export function crmInitials(name: string) {
  const words = name
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return "?";
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return (words[0]![0]! + words[1]![0]!).toUpperCase();
}

export function CrmAvatar({
  name,
  partner,
  size = 28,
}: {
  name: string;
  partner?: boolean;
  size?: number;
}) {
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
      className={cn(
        "inline-flex shrink-0 items-center justify-center font-semibold",
        partner ? "bg-[#1E2A44] text-[#A9C4FF]" : "bg-[#1C1D21] text-[#C9CBD0]"
      )}
    >
      {crmInitials(name)}
    </span>
  );
}

export function CrmTabs<K extends string>({
  tabs,
  active,
  onChange,
  label,
  className,
}: {
  tabs: ReadonlyArray<{ key: K; label: string; count?: number | string | null }>;
  active: K;
  onChange: (key: K) => void;
  label: string;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn("no-scrollbar flex gap-0.5 overflow-x-auto", className)}
    >
      {tabs.map((tab) => {
        const selected = tab.key === active;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(tab.key)}
            className={cn(
              "inline-flex h-9 shrink-0 items-center gap-1.5 px-3 text-[13px] transition",
              selected
                ? "text-white shadow-[inset_0_-2px_0_#3B82F6]"
                : "text-zinc-400 hover:bg-white/[0.03] hover:text-zinc-100"
            )}
          >
            {tab.label}
            {tab.count != null && tab.count !== "" ? (
              <span className="crm-mono text-[11px] text-zinc-500">{tab.count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function customerTypeChip(group: string) {
  if (group === "B2B_APPROVED") return <CrmChip tone="blue">B2B-партнер</CrmChip>;
  if (group === "B2B_PENDING") return <CrmChip tone="amber">Заявка B2B</CrmChip>;
  return <CrmChip tone="gray">Роздріб</CrmChip>;
}

/** Maps the admin status tones (orderStatusTone) onto CRM chip tones. */
export function crmStatusTone(tone: string): CrmTone {
  if (tone === "success") return "green";
  if (tone === "warning") return "amber";
  if (tone === "danger") return "red";
  return "gray";
}

/** «3 дні тому» / «сьогодні» from an ISO date. */
export function crmAgo(iso: string | null | undefined) {
  if (!iso) return null;
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "сьогодні";
  if (days === 1) return "вчора";
  if (days < 31) return `${days} дн. тому`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} міс. тому`;
  return `${Math.floor(months / 12)} р. тому`;
}

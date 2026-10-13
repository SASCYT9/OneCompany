"use client";

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { Loader2, Plus, Search } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Shared pieces of the B2B pricing screens, drawn in the CRM language of the
 * customers pages: dark, square, dense, IBM Plex.
 */

export async function sendB2bJson<T = unknown>(
  url: string,
  method: string,
  body?: unknown
): Promise<T> {
  const response = await fetch(url, {
    method,
    cache: "no-store",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(data.error || "Запит не вдався");
  return data;
}

export function formatPct(value: number) {
  return `${Number.isInteger(value) ? value : value.toFixed(2).replace(/0$/, "")}%`;
}

function plural(count: number, one: string, few: string, many: string) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

export const pluralPartners = (count: number) => plural(count, "партнер", "партнери", "партнерів");
export const pluralBrands = (count: number) => plural(count, "бренд", "бренди", "брендів");
export const pluralGroups = (count: number) => plural(count, "група", "групи", "груп");

// ── Group accents ────────────────────────────────────────────────────────────

export type GroupAccent = { solid: string; soft: string; text: string };

const NAMED_ACCENTS: Array<[RegExp, GroupAccent]> = [
  [/silver|срібл|серебр/i, { solid: "#AEB4BF", soft: "#1A1C20", text: "#D5D9E0" }],
  [/gold|золот/i, { solid: "#E5B547", soft: "#221A0A", text: "#F5D27E" }],
  [/platinum|платин/i, { solid: "#A5B4FC", soft: "#161830", text: "#C7D0FF" }],
  [/bronze|бронз/i, { solid: "#C98A55", soft: "#22160C", text: "#E6B48A" }],
];

const PALETTE: GroupAccent[] = [
  { solid: "#3B82F6", soft: "#0F1A2E", text: "#9CC0FF" },
  { solid: "#34D399", soft: "#0D1C16", text: "#8EE8C1" },
  { solid: "#A78BFA", soft: "#191430", text: "#CDBDFF" },
  { solid: "#FB7185", soft: "#240F14", text: "#FFB0BC" },
  { solid: "#22D3EE", soft: "#0B1D22", text: "#93E9F6" },
];

/** Silver looks silver and Gold looks gold; other groups take the palette in order. */
export function groupAccent(name: string, index: number): GroupAccent {
  const named = NAMED_ACCENTS.find(([pattern]) => pattern.test(name));
  return named ? named[1] : PALETTE[index % PALETTE.length]!;
}

export function GroupMark({
  name,
  accent,
  size = 28,
}: {
  name: string;
  accent: GroupAccent;
  size?: number;
}) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.42),
        background: accent.soft,
        color: accent.text,
        boxShadow: `inset 0 0 0 1px ${accent.solid}55, inset 3px 0 0 ${accent.solid}`,
      }}
      className="inline-flex shrink-0 items-center justify-center font-semibold"
    >
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}

// ── Inline percent cell ──────────────────────────────────────────────────────

/**
 * A discount you edit in place, spreadsheet style: click, type, Enter (or click
 * away) saves, Esc cancels, an empty value removes the rule.
 */
export function PctCell({
  value,
  onSave,
  label,
  muted,
  inherited,
  emptyHint = "+ знижка",
  className,
}: {
  value: number | null;
  /** What applies when this cell is empty (e.g. the rule for every partner), shown faded. */
  inherited?: number | null;
  /** Resolves true when saved; the cell then shows the new value from props. */
  onSave: (next: number | null) => Promise<boolean>;
  label: string;
  /** Rule exists but is overridden elsewhere — show it quieter. */
  muted?: boolean;
  emptyHint?: string;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  /** Set once Enter, blur or Esc has handled this edit, so a late blur cannot save twice. */
  const settledRef = useRef(false);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  async function commit() {
    if (settledRef.current) return;
    const raw = draft.trim().replace(",", ".").replace(/%$/, "").replace(/^[−-]/, "");
    const next = raw === "" ? null : Number(raw);
    if (next != null && (!Number.isFinite(next) || next < 0 || next > 100)) {
      setInvalid(true);
      return;
    }
    settledRef.current = true;
    if (next === value) {
      setEditing(false);
      return;
    }
    setSaving(true);
    const ok = await onSave(next);
    setSaving(false);
    if (ok) setEditing(false);
    else settledRef.current = false;
  }

  if (editing) {
    return (
      <div className={cn("relative", className)}>
        <input
          ref={inputRef}
          autoFocus
          inputMode="decimal"
          value={draft}
          disabled={saving}
          aria-label={label}
          aria-invalid={invalid || undefined}
          onChange={(event) => {
            setDraft(event.target.value);
            setInvalid(false);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") void commit();
            if (event.key === "Escape") {
              settledRef.current = true;
              setEditing(false);
            }
          }}
          onBlur={() => void commit()}
          placeholder="—"
          className={cn(
            "crm-mono h-8 w-full border bg-[#0A0A0B] pl-2 pr-6 text-right text-[13px] text-white focus:outline-none",
            invalid ? "border-[#F19B9B]" : "border-[#3B82F6]"
          )}
        />
        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[12px] text-zinc-500">
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : "%"}
        </span>
        {invalid ? (
          <span className="absolute left-0 top-full z-10 mt-1 whitespace-nowrap border border-[#5B2323] bg-[#1F0E0E] px-1.5 py-0.5 text-[11px] text-[#F19B9B]">
            Від 0 до 100
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <button
      type="button"
      aria-label={`${label}: ${value == null ? "немає" : formatPct(value)}. Змінити`}
      onClick={() => {
        settledRef.current = false;
        setDraft(value == null ? "" : String(value));
        setInvalid(false);
        setEditing(true);
      }}
      className={cn(
        "group/cell flex h-8 w-full items-center justify-end border border-transparent px-2 text-right transition hover:border-[#2A2C31] hover:bg-[#141518]",
        className
      )}
    >
      {value == null ? (
        <>
          <span
            className="crm-mono text-[12px] text-zinc-700 group-hover/cell:hidden"
            title={inherited != null ? "Діє знижка для всіх партнерів" : undefined}
          >
            {inherited != null ? (inherited === 0 ? "0%" : `−${formatPct(inherited)}`) : "—"}
          </span>
          <span className="hidden text-[12px] text-[#9CC0FF] group-hover/cell:inline">
            {emptyHint}
          </span>
        </>
      ) : (
        <span
          className={cn(
            "crm-mono text-[13px]",
            value === 0 ? "text-zinc-400" : muted ? "text-zinc-500" : "text-[#86E0A3]"
          )}
        >
          {value === 0 ? "0%" : `−${formatPct(value)}`}
        </span>
      )}
    </button>
  );
}

// ── Searchable picker ────────────────────────────────────────────────────────

export type CrmPickerOption = {
  value: string;
  label: string;
  /** Second line / right side: product count, current group… */
  meta?: ReactNode;
  /** Extra words to match (email, company). */
  keywords?: string;
  disabled?: boolean;
};

export function CrmPicker({
  options,
  onSelect,
  placeholder,
  emptyText = "Нічого не знайдено",
  label,
  loading,
  className,
  autoFocus,
}: {
  options: ReadonlyArray<CrmPickerOption>;
  onSelect: (value: string) => void;
  placeholder: string;
  emptyText?: string;
  label: string;
  loading?: boolean;
  className?: string;
  autoFocus?: boolean;
}) {
  const listId = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const filtered = useMemo(() => {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const matches = options.filter((option) => {
      if (!words.length) return true;
      const haystack = `${option.label} ${option.keywords ?? ""}`.toLowerCase();
      return words.every((word) => haystack.includes(word));
    });
    return matches.slice(0, 80);
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active]);

  function choose(option: CrmPickerOption | undefined) {
    if (!option || option.disabled) return;
    onSelect(option.value);
    setQuery("");
    setOpen(false);
    setActive(0);
  }

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <label className="flex h-8 items-center gap-2 border border-[#24262B] bg-[#0A0A0B] px-2.5 focus-within:border-[#3B82F6]">
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-500" />
        ) : (
          <Search className="h-3.5 w-3.5 text-zinc-500" />
        )}
        <input
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-label={label}
          aria-activedescendant={open && filtered[active] ? `${listId}-${active}` : undefined}
          autoFocus={autoFocus}
          value={query}
          placeholder={placeholder}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setOpen(true);
              setActive((current) => Math.min(current + 1, filtered.length - 1));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActive((current) => Math.max(current - 1, 0));
            } else if (event.key === "Enter") {
              event.preventDefault();
              if (open) choose(filtered[active]);
            } else if (event.key === "Escape") {
              setOpen(false);
            }
          }}
          className="w-full bg-transparent text-[13px] text-zinc-100 placeholder:text-zinc-600 focus:outline-none"
        />
      </label>
      {open ? (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-40 mt-1 max-h-72 overflow-y-auto border border-[#2A2C31] bg-[#111113] py-1 shadow-[0_12px_32px_rgba(0,0,0,0.55)]"
        >
          {filtered.length ? (
            filtered.map((option, index) => (
              <li
                key={option.value}
                id={`${listId}-${index}`}
                role="option"
                data-index={index}
                aria-selected={index === active}
                aria-disabled={option.disabled || undefined}
                onMouseEnter={() => setActive(index)}
                onMouseDown={(event) => {
                  event.preventDefault();
                  choose(option);
                }}
                className={cn(
                  "flex cursor-pointer items-center justify-between gap-3 px-2.5 py-1.5",
                  index === active ? "bg-[#1A2236]" : "",
                  option.disabled && "cursor-not-allowed opacity-45"
                )}
              >
                <span className="min-w-0 truncate text-zinc-100">{option.label}</span>
                {option.meta ? (
                  <span className="shrink-0 text-[12px] text-zinc-500">{option.meta}</span>
                ) : null}
              </li>
            ))
          ) : (
            <li className="px-2.5 py-2 text-zinc-500">{emptyText}</li>
          )}
        </ul>
      ) : null}
    </div>
  );
}

/** A dashed «+ Додати…» row that turns into a picker. */
export function AddRow({
  label,
  children,
  open,
  onOpen,
}: {
  label: string;
  children: ReactNode;
  open: boolean;
  onOpen: () => void;
}) {
  if (open) return <div className="border-t border-[#1F2125] px-3 py-2.5">{children}</div>;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-1.5 border-t border-[#1F2125] px-3 py-2.5 text-left text-[13px] text-zinc-500 transition hover:bg-[#111113] hover:text-[#9CC0FF]"
    >
      <Plus className="h-3.5 w-3.5" /> {label}
    </button>
  );
}

export function TariffPriorityNote({ className }: { className?: string }) {
  const steps = [
    "Виняток на картці партнера",
    "Тарифна група",
    "Знижка бренду для всіх",
    "«Інші бренди» партнера",
  ];
  return (
    <div className={cn("flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12px]", className)}>
      <span className="mr-1 text-zinc-500">Порядок правил:</span>
      {steps.map((step, index) => (
        <span key={step} className="flex items-center gap-1.5">
          {index ? <span className="text-zinc-700">→</span> : null}
          <span className="text-zinc-400">
            <span className="crm-mono text-zinc-600">{index + 1}</span> {step}
          </span>
        </span>
      ))}
    </div>
  );
}

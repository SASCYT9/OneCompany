"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Lower-case + strip diacritics so a user typing "porsh" / "audi" / "гольф"
 * matches "Porsche" / "Audi" / "Golf" without worrying about accents.
 */
function normalizeQuery(value: string) {
  return value.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/**
 * Tolerant match. Substring first (after stripping punctuation), then
 * gap-limited subsequence — same approach as the catalog product search.
 *   "porsh" → "porsche"      ✓ (subsequence, gap=1)
 *   "gol"   → "Golf GTI"     ✓ (substring)
 *   "mk7"   → "Golf Mk7"     ✓ (substring of "mk7")
 *   "abz"   → "Audi"         ✗ (no 'b'/'z')
 *   "ah"    → "Audi"         ✗ (subsequence gap "udi" = 3 > MAX_GAP)
 */
const MAX_SUBSEQUENCE_GAP = 2;

function isSubsequenceMatch(query: string, label: string) {
  if (!query) return true;
  const haystack = normalizeQuery(label);
  const stripped = haystack.replace(/[^a-z0-9]/g, "");
  const strippedQ = query.replace(/[^a-z0-9]/g, "");
  if (strippedQ && stripped.includes(strippedQ)) return true;
  let i = 0;
  let gap = 0;
  for (const ch of haystack) {
    if (ch === query[i]) {
      i += 1;
      gap = 0;
      if (i === query.length) return true;
    } else if (i > 0) {
      gap += 1;
      if (gap > MAX_SUBSEQUENCE_GAP) return false;
    }
  }
  return false;
}

// Show the type-to-search input as soon as we have 5+ options. Brand list is
// exactly 5 (Porsche/BMW/Audi/VW/Toyota), so this threshold ensures search
// shows up everywhere it's potentially useful, including the brand picker.
const SEARCH_INPUT_MIN_OPTIONS = 5;

export type FilterOption = {
  value: string;
  label: string;
};

export type FilterGroup = {
  label?: string;
  options: FilterOption[];
};

export type Do88ListboxProps = {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  groups: FilterGroup[];
  clearLabel: string;
  clearValue: string;
  disabled?: boolean;
  disabledPlaceholder?: string;
};

export default function Do88Listbox({
  label,
  placeholder,
  value,
  onChange,
  groups,
  clearLabel,
  clearValue,
  disabled = false,
  disabledPlaceholder,
}: Do88ListboxProps) {
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  // Reset and refocus on open/close so each opening starts with a clean
  // search box and keystrokes go straight into the filter.
  useEffect(() => {
    if (open) {
      setQuery("");
      // Defer focus until the popover paints — same render cycle won't
      // have mounted the input yet.
      requestAnimationFrame(() => {
        searchInputRef.current?.focus();
      });
    }
  }, [open]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    if (disabled) {
      setOpen(false);
    }
  }, [disabled]);

  const selectedOption = useMemo(
    () => groups.flatMap((group) => group.options).find((option) => option.value === value) ?? null,
    [groups, value]
  );

  const displayValue = disabled
    ? (disabledPlaceholder ?? placeholder)
    : (selectedOption?.label ?? placeholder);
  const isClearSelected = value === clearValue;

  // Total option count drives whether we render a search input — for small
  // dropdowns (≤5 options) it just clutters the panel.
  const totalOptionCount = useMemo(
    () => groups.reduce((sum, group) => sum + group.options.length, 0),
    [groups]
  );
  const showSearchInput = totalOptionCount >= SEARCH_INPUT_MIN_OPTIONS;
  const normalizedQuery = normalizeQuery(query);

  const filteredGroups = useMemo(() => {
    if (!normalizedQuery) return groups;
    return groups
      .map((group) => ({
        ...group,
        options: group.options.filter((option) =>
          isSubsequenceMatch(normalizedQuery, option.label)
        ),
      }))
      .filter((group) => group.options.length > 0);
  }, [groups, normalizedQuery]);

  const hasAnyMatch = filteredGroups.length > 0;

  return (
    <div ref={rootRef} className={cn("relative overflow-visible", open && "z-60")}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            setOpen((current) => !current);
          }
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        className={cn(
          "group relative flex min-h-[72px] w-full items-center justify-between gap-4 overflow-hidden rounded-[22px] border px-5 py-4 text-left transition-all duration-300",
          disabled
            ? "cursor-not-allowed border-foreground/8 bg-foreground/10 dark:bg-black/35 text-foreground/55 dark:text-foreground/30"
            : open
              ? "border-primary/30 bg-card/95 dark:bg-black/75 shadow-2xl"
              : "border-foreground/10 bg-card/80 dark:bg-black/55 hover:border-primary/18 hover:bg-foreground/15 dark:hover:bg-black/70"
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-x-5 top-0 h-px bg-transparent transition-colors duration-300",
            !disabled && "group-hover:bg-primary/12",
            open && "bg-primary/25"
          )}
        />
        <span className="min-w-0">
          <span className="block text-[10px] uppercase tracking-[0.24em] text-foreground/38">
            {label}
          </span>
          <span
            className={cn(
              "mt-2 block truncate text-[15px] font-light",
              selectedOption && !disabled
                ? "text-foreground"
                : "text-foreground/70 dark:text-foreground/55"
            )}
          >
            {displayValue}
          </span>
        </span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-foreground/42 transition-transform duration-300",
            open && "rotate-180"
          )}
        />
      </button>

      {open ? (
        <div className="absolute inset-x-0 top-[calc(100%+12px)] z-60 overflow-hidden rounded-[22px] border border-primary/16 bg-card/95 shadow-[0_28px_60px_rgba(0,0,0,0.55)] backdrop-blur-xl">
          {showSearchInput ? (
            <div className="border-b border-foreground/10 bg-card/90 px-3 py-2.5">
              <div className="relative flex items-center">
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 size-3.5 text-foreground/40"
                />
                <input
                  ref={searchInputRef}
                  type="text"
                  inputMode="search"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      event.stopPropagation();
                      if (query) setQuery("");
                      else setOpen(false);
                    }
                  }}
                  placeholder={placeholder}
                  aria-label={`${label}: ${placeholder}`}
                  className="w-full rounded-[14px] border border-foreground/12 bg-background/85 py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-foreground/45 focus:border-primary/40 focus:outline-hidden"
                />
              </div>
            </div>
          ) : null}

          <div id={listboxId} role="listbox" className="max-h-[320px] overflow-y-auto p-2">
            {!normalizedQuery ? (
              <button
                type="button"
                role="option"
                aria-selected={isClearSelected}
                onClick={() => {
                  onChange(clearValue);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center justify-between rounded-[18px] px-4 py-3 text-left text-sm transition-colors duration-200",
                  isClearSelected
                    ? "bg-primary/10 text-foreground"
                    : "text-foreground/72 hover:bg-foreground/6 hover:text-foreground"
                )}
              >
                <span>{clearLabel}</span>
                <span
                  aria-hidden="true"
                  className={cn(
                    "size-2 rounded-full border transition-colors duration-200",
                    isClearSelected
                      ? "border-primary bg-primary"
                      : "border-foreground/20 bg-transparent"
                  )}
                />
              </button>
            ) : null}

            {!hasAnyMatch ? (
              <p className="px-4 py-6 text-center text-xs text-foreground/55">
                {placeholder} — {query}
              </p>
            ) : null}

            {filteredGroups.map((group) => (
              <div key={group.label ?? "group"} className="mt-2">
                {group.label ? (
                  <p className="px-4 pb-2 pt-1 text-[10px] uppercase tracking-[0.22em] text-primary/58">
                    {group.label}
                  </p>
                ) : null}
                <div className="space-y-1">
                  {group.options.map((option) => {
                    const isSelected = option.value === value;

                    return (
                      <button
                        key={option.value}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => {
                          onChange(option.value);
                          setOpen(false);
                        }}
                        className={cn(
                          "flex w-full items-center justify-between rounded-[18px] px-4 py-3 text-left text-sm transition-colors duration-200",
                          isSelected
                            ? "bg-primary/10 text-foreground"
                            : "text-foreground/72 hover:bg-foreground/6 hover:text-foreground"
                        )}
                      >
                        <span className="truncate">{option.label}</span>
                        <span
                          aria-hidden="true"
                          className={cn(
                            "size-2 rounded-full border transition-colors duration-200",
                            isSelected
                              ? "border-primary bg-primary"
                              : "border-foreground/20 bg-transparent"
                          )}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

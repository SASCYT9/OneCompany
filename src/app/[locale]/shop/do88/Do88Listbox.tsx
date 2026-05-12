"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

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
  const [open, setOpen] = useState(false);

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
          <div id={listboxId} role="listbox" className="max-h-[320px] overflow-y-auto p-2">
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

            {groups.map((group) => (
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

"use client";

import { useCallback, useEffect, useState } from "react";

const COLLAPSED_KEY = "adminSidebarCollapsed";
const PINNED_KEY = "adminPinnedNav";
const OPEN_SECTIONS_KEY = "adminOpenNavSections";
const RECENT_KEY = "adminRecentPages";
const RECENT_LIMIT = 6;
const PINNED_LIMIT = 8;

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeValue(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
  } catch {
    // Private mode or blocked storage: preferences simply do not persist.
  }
}

function asStringList(value: unknown, limit: number) {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string").slice(0, limit)
    : [];
}

/**
 * Per-browser shell conveniences: sidebar width, pinned pages, which nav groups
 * are open, and recently visited pages for the command palette.
 */
export function useAdminShellPreferences() {
  const [collapsed, setCollapsed] = useState(false);
  const [pinned, setPinned] = useState<string[]>([]);
  const [openSections, setOpenSections] = useState<string[] | null>(null);
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    setCollapsed(readJson<unknown>(COLLAPSED_KEY, false) === true);
    setPinned(asStringList(readJson<unknown>(PINNED_KEY, []), PINNED_LIMIT));
    const storedSections = readJson<unknown>(OPEN_SECTIONS_KEY, null);
    setOpenSections(storedSections === null ? null : asStringList(storedSections, 32));
    setRecent(asStringList(readJson<unknown>(RECENT_KEY, []), RECENT_LIMIT));
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((current) => {
      writeValue(COLLAPSED_KEY, String(!current));
      return !current;
    });
  }, []);

  const togglePinned = useCallback((href: string) => {
    setPinned((current) => {
      const next = current.includes(href)
        ? current.filter((entry) => entry !== href)
        : [...current, href].slice(-PINNED_LIMIT);
      writeValue(PINNED_KEY, next);
      return next;
    });
  }, []);

  const setSectionOpen = useCallback((key: string, open: boolean, defaults: string[]) => {
    setOpenSections((current) => {
      const base = current ?? defaults;
      const next = open
        ? Array.from(new Set([...base, key]))
        : base.filter((entry) => entry !== key);
      writeValue(OPEN_SECTIONS_KEY, next);
      return next;
    });
  }, []);

  const rememberVisit = useCallback((href: string) => {
    setRecent((current) => {
      if (current[0] === href) return current;
      const next = [href, ...current.filter((entry) => entry !== href)].slice(0, RECENT_LIMIT);
      writeValue(RECENT_KEY, next);
      return next;
    });
  }, []);

  return {
    collapsed,
    toggleCollapsed,
    pinned,
    togglePinned,
    /** null until the user opens or closes a group; the shell then opens only the active group. */
    openSections,
    setSectionOpen,
    recent,
    rememberVisit,
  };
}

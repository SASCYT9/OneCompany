"use client";

import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";

export default function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const current = (theme === "system" ? resolvedTheme : theme) ?? "dark";
  const isDark = current === "dark";

  // Smooth crossfade is handled in globals.css via 350ms transitions on
  // background-color / border-color / color across html, body, header, etc.
  const handleToggle = () => {
    setTheme(isDark ? "light" : "dark");
  };

  return (
    <button
      ref={btnRef}
      onClick={handleToggle}
      className="relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-foreground/25 bg-foreground/5 text-foreground hover:bg-foreground/10 hover:border-foreground/40 transition-all duration-300"
      aria-label="Toggle theme"
      title={isDark ? "Switch to light" : "Switch to dark"}
    >
      {isDark ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-yellow-400">
          <path
            d="M12 4V2M12 22v-2M4.93 4.93L3.52 3.52M20.48 20.48l-1.41-1.41M4 12H2m20 0h-2M4.93 19.07l-1.41 1.41M20.48 3.52l-1.41 1.41"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-blue-500">
          <path
            d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="none"
          />
        </svg>
      )}
    </button>
  );
}

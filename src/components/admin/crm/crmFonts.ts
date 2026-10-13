import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";

/**
 * CRM screens read dense data, so they use a compact UI face instead of the
 * site-wide Unbounded display font (kept for page titles via `.crm-title`).
 * Mono gets its own variable: the root `--font-mono` is shadowed by a
 * self-referencing Tailwind theme token.
 */
export const crmSans = IBM_Plex_Sans({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600"],
  variable: "--font-crm",
  display: "swap",
});

export const crmMono = IBM_Plex_Mono({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500"],
  variable: "--font-crm-mono",
  display: "swap",
  preload: false,
});

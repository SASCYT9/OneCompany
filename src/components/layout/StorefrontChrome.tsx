"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** The checkout owns a compact header and legal footer instead of shop navigation. */
export function StorefrontChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (/^\/(ua|en)\/shop\/checkout\/?$/.test(pathname ?? "")) return null;
  return children;
}

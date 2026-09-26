import type { ReactNode } from "react";

// Metadata is exported by the page, where Next.js supports searchParams.
// Layout metadata cannot receive query parameters.

export default function StockLayout({ children }: { children: ReactNode }) {
  return children;
}

import type { ReactNode } from "react";

// The approved /shop/catalog UI is internally rewritten to this route, so
// Next.js resolves metadata here instead of catalog/page.tsx. Both URLs render
// the same catalog; /shop/stock remains noindex via next.config.ts headers.
export { generateMetadata } from "../catalog/metadata";

export default function StockLayout({ children }: { children: ReactNode }) {
  return children;
}

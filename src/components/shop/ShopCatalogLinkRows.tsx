import Link from "next/link";

import type { ShopCatalogLandingLinkGroup } from "@/lib/shopCatalogLandings";

/**
 * Rows of links to neighbouring landing pages. On phones each row is one
 * line that scrolls sideways, so the products do not move further down.
 */
export default function ShopCatalogLinkRows({ groups }: { groups: ShopCatalogLandingLinkGroup[] }) {
  if (!groups.length) return null;
  return (
    <div className="mt-3 space-y-2 sm:mt-4">
      {groups.map((group) => (
        <div
          key={group.title}
          className="flex items-center gap-2 overflow-x-auto whitespace-nowrap [scrollbar-width:none] sm:flex-wrap sm:overflow-visible sm:whitespace-normal [&::-webkit-scrollbar]:hidden"
        >
          <span className="shrink-0 text-[10px] uppercase tracking-[0.18em] text-foreground/40">
            {group.title}
          </span>
          {group.links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="shrink-0 border border-foreground/12 px-2.5 py-1 text-[11px] text-foreground/70 transition-colors hover:border-foreground/40 hover:text-foreground"
            >
              {link.name}
            </Link>
          ))}
        </div>
      ))}
    </div>
  );
}

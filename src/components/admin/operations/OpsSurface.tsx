import type { ReactNode } from "react";

import { OpsMobileNav } from "./OpsMobileNav";

export function OpsSurface({
  children,
  inboxCount,
  showMobileNav = true,
  className = "",
  permissions = [],
}: {
  children: ReactNode;
  inboxCount?: number;
  showMobileNav?: boolean;
  className?: string;
  permissions?: readonly string[];
}) {
  return (
    <div
      className={`min-h-full bg-[#f7f9fc] text-slate-900 [color-scheme:light] ${className}`}
      data-ops-workspace
    >
      <div className={showMobileNav ? "min-h-full pb-24 lg:pb-0" : "min-h-full"}>{children}</div>
      {showMobileNav ? <OpsMobileNav inboxCount={inboxCount} permissions={permissions} /> : null}
    </div>
  );
}

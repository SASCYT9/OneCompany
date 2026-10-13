import type { ReactNode } from "react";

/**
 * Dark Operations canvas inside the admin shell. Navigation (including the
 * mobile drawer) comes from the shell, so there is no separate bottom bar.
 */
export function OpsSurface({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`min-h-full bg-[#0A0A0A] text-zinc-100 [color-scheme:dark] ${className}`}
      data-ops-workspace
    >
      {children}
    </div>
  );
}

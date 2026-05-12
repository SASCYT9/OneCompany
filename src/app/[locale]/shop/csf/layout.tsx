import { ReactNode } from "react";

export default function CSFSizingLayout({ children }: { children: ReactNode }) {
  // CSF Racing is cinematic-dark (cooling tech / red accent on near-black);
  // individual sections opt-in to `dark` scope, layout stays theme-aware.
  return <div className="relative min-h-screen bg-background text-foreground">{children}</div>;
}

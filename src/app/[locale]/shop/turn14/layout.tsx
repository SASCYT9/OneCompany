export default function Turn14ShopLayout({ children }: { children: React.ReactNode }) {
  // Turn14 is a live catalog proxy with cinematic dark UI;
  // individual pages opt-in to `dark` scope, layout stays theme-aware.
  return <div className="min-h-screen bg-background text-foreground">{children}</div>;
}

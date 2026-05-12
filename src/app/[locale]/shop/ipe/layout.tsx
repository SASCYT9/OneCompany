import "./ipe-shop.css";

export default function IpeShopLayout({ children }: { children: React.ReactNode }) {
  // iPE Exhaust is cinematic-dark (titanium bronze on black, F1 aesthetic);
  // individual sections opt-in to `dark` scope, layout stays theme-aware.
  return <div className="min-h-screen bg-background text-foreground">{children}</div>;
}

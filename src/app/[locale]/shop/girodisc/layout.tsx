import "./girodisc-shop.css";

export default function GiroDiscShopLayout({ children }: { children: React.ReactNode }) {
  // GiroDisc is cinematic-dark (orange-on-black "forged precision" editorial);
  // individual sections opt-in to `dark` scope, layout stays theme-aware.
  return <div className="min-h-screen bg-background text-foreground">{children}</div>;
}

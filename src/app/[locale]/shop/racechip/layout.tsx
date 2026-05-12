import "./racechip-shop.css";

export default function RaceChipShopLayout({ children }: { children: React.ReactNode }) {
  // RaceChip is cinematic-dark (electric-orange-on-black tuning aesthetic);
  // individual sections opt-in to `dark` scope, layout stays theme-aware.
  return <div className="min-h-screen bg-background text-foreground">{children}</div>;
}

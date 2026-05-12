import "./ohlins-shop.css";

export default function OhlinsShopLayout({ children }: { children: React.ReactNode }) {
  // Öhlins content is intrinsically cinematic-dark (gold particles, dark CSS palette);
  // individual sections opt-in to `dark` scope while the layout stays theme-aware
  // so the surrounding header/footer follow the active theme.
  return <div className="min-h-screen bg-background text-foreground">{children}</div>;
}

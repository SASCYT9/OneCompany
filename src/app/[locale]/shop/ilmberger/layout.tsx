import { ReactNode } from "react";
import "./ilmberger-shop.css";

type Props = {
  children: ReactNode;
};

export default function ShopIlmbergerLayout({ children }: Props) {
  // Theme-aware: shop respects the user's global light/dark preference.
  // CSS variables in ilmberger-shop.css branch on the global `.dark` /
  // `.light` class on <html>, so the page adapts automatically.
  return <div className="min-h-screen bg-background text-foreground il-shop-page">{children}</div>;
}

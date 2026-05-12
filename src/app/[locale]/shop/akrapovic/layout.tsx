import { ReactNode } from "react";
import "./akrapovic-shop.css";

type Props = {
  children: ReactNode;
};

export default function ShopAkrapovicLayout({ children }: Props) {
  // Akrapovic is cinematic-dark (titanium + carbon + audio heritage, red ember accent);
  // individual sections opt-in to `dark` scope, layout stays theme-aware.
  return <div className="min-h-screen bg-background text-foreground ak-shop-page">{children}</div>;
}

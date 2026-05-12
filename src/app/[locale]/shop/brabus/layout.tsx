import { ReactNode } from "react";
import "@/styles/urban-shop.css";
import "@/styles/uh7-theme.css";
import "@/styles/urban-collections.css";

type Props = {
  children: ReactNode;
};

export default function ShopBrabusLayout({ children }: Props) {
  // Reusing urban classes for now since they define the layout structure.
  // Brabus content (hero, fleet, rocket, PDP) is intrinsically cinematic-dark,
  // so individual sections opt-in to `dark` scope; the layout itself stays theme-aware.
  return (
    <div className="min-h-screen bg-background text-foreground urban-shop-page">{children}</div>
  );
}

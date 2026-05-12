import { ReactNode } from "react";
import "./burger-shop.css";

type Props = {
  children: ReactNode;
};

export default function ShopBurgerLayout({ children }: Props) {
  // Burger Motorsports is cinematic-dark (red/yellow on near-black);
  // individual sections opt-in to `dark` scope, layout stays theme-aware.
  return <div className="min-h-screen bg-background text-foreground">{children}</div>;
}

import { ReactNode } from "react";
import "@/styles/urban-shop.css";
import "@/styles/uh7-theme.css";
import "@/styles/urban-collections.css";

type Props = {
  children: ReactNode;
};

/** Urban theme тільки для /shop/urban; головна /shop залишається в стилі One Company.
 *  Urban content is intrinsically cinematic-dark (Cormorant serif on black with bronze accents);
 *  individual sections opt-in to `dark` scope, layout stays theme-aware so the
 *  surrounding header/footer follow the active theme. */
export default function ShopUrbanLayout({ children }: Props) {
  return (
    <div className="min-h-screen bg-background text-foreground urban-shop-page">{children}</div>
  );
}

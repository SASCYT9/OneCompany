import { ReactNode } from "react";
import "@/styles/urban-shop.css";
import "@/styles/uh7-theme.css";
import "@/styles/urban-collections.css";

type Props = {
  children: ReactNode;
};

/** Urban theme тільки для /shop/urban; головна /shop залишається в стилі One Company. */
export default function ShopUrbanLayout({ children }: Props) {
  return (
    <div className="dark min-h-screen bg-[#0a0a0a] text-white urban-shop-page">{children}</div>
  );
}

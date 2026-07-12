import { ReactNode } from "react";
import ShopAmbientBackground from "./components/ShopAmbientBackground";
import ShopImpersonationGate from "./components/ShopImpersonationGate";

type Props = {
  children: ReactNode;
};

/** Головна /shop — у стилі One Company (без Urban-теми); Urban-тема тільки в shop/urban/layout. */
export default function ShopLayout({ children }: Props) {
  return (
    <div className="shop-context">
      <ShopImpersonationGate />
      <ShopAmbientBackground />
      {children}
    </div>
  );
}

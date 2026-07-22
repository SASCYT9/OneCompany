import { ReactNode } from "react";
import AuthProvider from "@/components/AuthProvider";
import { ShopCurrencySessionSync } from "@/components/shop/ShopCurrencySessionSync";
import ShopAmbientBackground from "./components/ShopAmbientBackground";
import ShopImpersonationGate from "./components/ShopImpersonationGate";

type Props = {
  children: ReactNode;
};

/** Головна /shop — у стилі One Company (без Urban-теми); Urban-тема тільки в shop/urban/layout. */
export default function ShopLayout({ children }: Props) {
  return (
    <AuthProvider>
      <ShopCurrencySessionSync />
      <div className="shop-context">
        <ShopImpersonationGate />
        <ShopAmbientBackground />
        {children}
      </div>
    </AuthProvider>
  );
}

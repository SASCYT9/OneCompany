import { ReactNode } from "react";
import "./akrapovic-shop.css";

type Props = {
  children: ReactNode;
};

export default function ShopAkrapovicLayout({ children }: Props) {
  return <div className="dark min-h-screen bg-[#0a0a0a] text-white ak-shop-page">{children}</div>;
}

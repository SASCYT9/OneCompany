import { ReactNode } from "react";
import "./burger-shop.css";

type Props = {
  children: ReactNode;
};

export default function ShopBurgerLayout({ children }: Props) {
  return <div className="dark min-h-screen bg-[#0a0a0a] text-white bm-home">{children}</div>;
}

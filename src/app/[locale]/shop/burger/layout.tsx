import { ReactNode } from "react";
import "./burger-shop.css";

type Props = {
  children: ReactNode;
};

export default function ShopBurgerLayout({ children }: Props) {
  return <div className="dark bm-home">{children}</div>;
}

import { ReactNode } from "react";
import "./akrapovic-shop.css";

type Props = {
  children: ReactNode;
};

export default function ShopAkrapovicLayout({ children }: Props) {
  return <div className="ak-shop-page">{children}</div>;
}

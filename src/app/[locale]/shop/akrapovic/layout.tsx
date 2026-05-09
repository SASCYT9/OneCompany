import { ReactNode } from "react";
import "./akrapovic-shop.css";

type Props = {
  children: ReactNode;
};

export default function ShopAkrapovicLayout({ children }: Props) {
  // Force .dark scope: Akrapovic is a luxury brand showroom with custom dark
  // CSS (titanium + carbon). Light theme would dilute the brand identity.
  return <div className="dark ak-shop-page bg-background">{children}</div>;
}

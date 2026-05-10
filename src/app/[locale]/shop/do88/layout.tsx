import { ReactNode } from "react";
import "@/styles/urban-shop.css";
import "@/styles/uh7-theme.css";
import "@/styles/urban-collections.css";
import "./do88-shop.css";
// We leverage the Urban engine CSS for layout, but apply specific DO88 hooks

type Props = {
  children: ReactNode;
};

/** DO88 theme wrapper */
export default function ShopDo88Layout({ children }: Props) {
  // reusing urban-shop-page to inherit the exact same spacing and dark aesthetics
  return <div className="dark urban-shop-page">{children}</div>;
}

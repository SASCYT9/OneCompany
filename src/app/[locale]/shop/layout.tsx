import { ReactNode } from 'react';

type Props = {
  children: ReactNode;
};

/** Головна /shop — у стилі One Company (без Urban-теми); Urban-тема тільки в shop/urban/layout. */
export default function ShopLayout({ children }: Props) {
  return <>{children}</>;
}

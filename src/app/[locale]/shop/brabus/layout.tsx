import { ReactNode } from 'react';
import '@/styles/urban-shop.css';
import '@/styles/uh7-theme.css';
import '@/styles/urban-collections.css';

type Props = {
  children: ReactNode;
};

export default function ShopBrabusLayout({ children }: Props) {
  // Reusing urban classes for now since they define the layout structure
  return <div className="urban-shop-page">{children}</div>;
}

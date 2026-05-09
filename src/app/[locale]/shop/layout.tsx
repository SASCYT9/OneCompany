import { ReactNode } from 'react';
import ShopAmbientBackground from './components/ShopAmbientBackground';
import ShopImpersonationBanner from './components/ShopImpersonationBanner';
import { getCurrentShopCustomerSession } from '@/lib/shopCustomerSession';

type Props = {
  children: ReactNode;
};

/** Головна /shop — у стилі One Company (без Urban-теми); Urban-тема тільки в shop/urban/layout. */
export default async function ShopLayout({ children }: Props) {
  const session = await getCurrentShopCustomerSession();
  const impersonator = session?.impersonator ?? null;

  return (
    <>
      {impersonator ? (
        <ShopImpersonationBanner
          customerEmail={session!.email}
          customerName={session!.name}
          adminEmail={impersonator.email}
        />
      ) : null}
      <ShopAmbientBackground />
      {children}
    </>
  );
}

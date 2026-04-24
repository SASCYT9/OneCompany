import { resolveLocale } from '@/lib/seo';
import Image from 'next/image';
import Link from 'next/link';
import { fetchTurn14ItemDetail, fetchTurn14ItemPricing } from '@/lib/turn14';
import { formatShopMoney } from '@/lib/shopMoneyFormat';
import { ArrowLeft, Box } from 'lucide-react';
import Turn14AddToCartButton from './Turn14AddToCartButton';
import { getCurrentShopCustomerSession } from '@/lib/shopCustomerSession';
import { getEffectiveMarkup } from '@/lib/turn14Pricing';
import { MobileProductDisclosure } from '../../../components/MobileProductDisclosure';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function Turn14ProductPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const resolvedLocale = resolveLocale(locale);
  const isUa = resolvedLocale === 'ua';

  const [detailData, pricingData] = await Promise.all([
    fetchTurn14ItemDetail(id).catch(() => null),
    fetchTurn14ItemPricing(id).catch(() => null),
  ]);

  if (!detailData || !detailData.data) {
    return (
      <main className="min-h-screen bg-black pt-32 pb-24 text-center text-white">
        <h1 className="text-2xl">{isUa ? 'Товар не знайдено' : 'Product Not Found'}</h1>
        <Link href={`/${resolvedLocale}/shop/turn14`} className="mt-4 inline-block text-indigo-400 hover:text-indigo-300">
          {isUa ? 'Повернутися до каталогу' : 'Back to catalog'}
        </Link>
      </main>
    );
  }

  const attr = detailData.data.attributes || {};
  const media = attr.files || [];
  const primaryImage = media.length > 0 ? (media[0].links?.image_preview || media[0].links?.image_thumbnail) : null;
  const brandId = attr.brand_id?.toString() || '';
  
  // Calculate price
  // Usually Turn14 provides jobber_price, retail_price, map_price
  const priceList = pricingData?.data || [];
  const pData = priceList.length > 0 ? priceList[0].attributes : null;
  
  const customerSession = await getCurrentShopCustomerSession();
  const customerId = customerSession?.customerId ?? undefined;
  
  // Base cost is what Turn14 charges us (usually 'jobber_price' or 'purchase_price', but let's use 'map_price' or 'retail_price' for safety if we don't have jobber access)
  // Let's assume retail_price is the default fallback B2C price
  let displayPriceEur = 0;
  if (pData) {
    // We will use retail_price directly for B2C if available, else jobber + markup
    const retail = pData.retail_price || pData.map_price || pData.jobber_price || 0;
    displayPriceEur = retail;
    
    // Check if we have B2B markup override
    if (customerId) {
      const markupInfo = await getEffectiveMarkup(brandId, customerId);
      const baseCost = pData.jobber_price || pData.purchase_price || (retail * 0.7); // Fallback assumption
      const customPrice = baseCost * (1 + markupInfo.markupPct / 100);
      if (customPrice > 0 && customPrice < retail) {
        displayPriceEur = customPrice;
      }
    }
  }

  return (
    <main className="min-h-screen bg-black text-white pt-28 pb-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Link
          href={`/${resolvedLocale}/shop/turn14`}
          className="inline-flex items-center gap-2 text-sm text-white/50 hover:text-white transition-colors mb-8"
        >
          <ArrowLeft className="h-4 w-4" />
          {isUa ? 'Повернутися до каталогу' : 'Back to catalog'}
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16">
          {/* Gallery */}
          <div className="flex flex-col gap-4">
            <div className="relative aspect-square w-full overflow-hidden rounded-3xl border border-white/10 bg-white/5 flex items-center justify-center p-8">
              {primaryImage ? (
                <Image src={primaryImage} alt={attr.part_description || ''} fill className="object-contain" sizes="(max-width: 768px) 100vw, 50vw" priority />
              ) : (
                <div className="text-white/20 uppercase tracking-widest text-sm flex flex-col items-center gap-2">
                  <Box className="w-12 h-12" />
                  No Image
                </div>
              )}
            </div>
            {media.length > 1 && (
              <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
                {media.slice(1).map((m: any, idx: number) => {
                  const img = m.links?.image_thumbnail || m.links?.image_preview;
                  if (!img) return null;
                  return (
                    <div key={idx} className="relative w-24 h-24 flex-shrink-0 cursor-pointer overflow-hidden rounded-xl border border-white/10 bg-white/5 opacity-60 hover:opacity-100 transition-opacity">
                      <Image src={img} alt="" fill className="object-contain" sizes="96px" />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Details */}
          <div className="flex flex-col">
            <div className="mb-6">
              <span className="text-sm font-mono tracking-widest text-indigo-400 mb-2 block uppercase">
                {attr.brand_name || attr.brand}
              </span>
              <h1 className="text-3xl sm:text-4xl font-light tracking-tight text-white mb-4">
                {attr.part_description}
              </h1>
              <div className="flex flex-wrap items-center gap-3 text-sm text-white/60 font-mono mb-2">
                <span className="bg-white/10 px-2 py-1 rounded">PN: {attr.part_number}</span>
                {attr.mfr_part_number && <span className="bg-white/5 px-2 py-1 rounded border border-white/10">MFR: {attr.mfr_part_number}</span>}
              </div>
              
              {/* Dimensions */}
              <div className="flex flex-wrap items-center gap-4 text-xs tracking-wider uppercase text-white/40 mt-4">
                {attr.weight && <span>Weight: {attr.weight} lbs</span>}
                {attr.length && <span>Dims: {attr.length}x{attr.width}x{attr.height} in</span>}
              </div>
            </div>

            <div className="mb-8 border-t border-b border-white/10 py-6">
              {displayPriceEur > 0 ? (
                <div className="flex flex-col gap-1">
                  <span className="text-4xl font-medium tracking-tight text-white">
                    {formatShopMoney(resolvedLocale, displayPriceEur, 'EUR')}
                  </span>
                  <span className="text-xs text-white/40">{isUa ? '* Орієнтовна міжнародна ціна' : '* Estimated global price'}</span>
                </div>
              ) : (
                <div className="text-xl text-white/60">
                  {isUa ? 'Ціна за запитом' : 'Price on request'}
                </div>
              )}
            </div>

            <div className="mb-8">
              <Turn14AddToCartButton 
                productId={id.toString()} 
                sku={attr.part_number}
                locale={resolvedLocale} 
              />
            </div>

            <MobileProductDisclosure title={isUa ? 'Деталі' : 'Details'}>
              <div className="prose prose-invert prose-sm max-w-none text-white/70">
                <h3 className="text-white text-lg font-medium mb-4">{isUa ? 'Деталі' : 'Details'}</h3>
                <p className="whitespace-pre-wrap">{attr.marketing_description || (isUa ? 'Опис відсутній в каталозі дистриб\'ютора.' : 'No description available in distributor catalog.')}</p>

                {attr.prop65_warning && (
                  <p className="mt-4 text-xs text-amber-500/80 p-3 rounded-lg border border-amber-500/20 bg-amber-500/5">
                    <strong>Prop 65 Warning:</strong> {attr.prop65_warning}
                  </p>
                )}
              </div>
            </MobileProductDisclosure>
          </div>
        </div>
      </div>
    </main>
  );
}

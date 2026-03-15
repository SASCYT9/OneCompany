import Image from 'next/image';
import Link from 'next/link';
import { AddToCartButton } from '@/components/shop/AddToCartButton';
import type { SupportedLocale } from '@/lib/seo';
import type { ShopProduct } from '@/lib/shopCatalog';
import { buildShopProductPath } from '@/lib/urbanCollectionMatcher';
import type { UrbanProductGridConfig } from '../data/urbanCollectionPages';

type UrbanCollectionProductGridProps = {
  locale: SupportedLocale;
  handle: string;
  title: string;
  brand: string;
  products: ShopProduct[];
  settings: UrbanProductGridConfig;
};

function localize(locale: SupportedLocale, value: { ua: string; en: string }) {
  return locale === 'ua' ? value.ua : value.en;
}

function formatPrice(locale: SupportedLocale, amount: number) {
  const formatter = new Intl.NumberFormat(locale === 'ua' ? 'uk-UA' : 'en-US', {
    maximumFractionDigits: 0,
  });

  return locale === 'ua'
    ? `${formatter.format(amount)} грн`
    : `EUR ${formatter.format(amount)}`;
}

export default function UrbanCollectionProductGrid({
  locale,
  handle,
  title,
  brand,
  products,
  settings,
}: UrbanCollectionProductGridProps) {
  const isUa = locale === 'ua';

  return (
    <section
      className="urban-product-grid"
      style={
        {
          '--upg-padding-top': `${settings.paddingTop}px`,
          '--upg-padding-bottom': `${settings.paddingBottom}px`,
          '--upg-mobile-cols': settings.columnsMobile,
          '--upg-desktop-cols': settings.columnsDesktop,
        } as React.CSSProperties
      }
    >
      <div className="urban-product-grid__inner">
        <div className="urban-product-grid__head">
          <div>
            <p className="urban-product-grid__eyebrow">
              {brand || 'Urban Automotive'}
            </p>
            <h2 className="urban-product-grid__title">
              {isUa ? `Товари для ${title}` : `${title} Products`}
            </h2>
            <p className="urban-product-grid__sub">
              {products.length > 0
                ? isUa
                  ? `Підібрані позиції для колекції ${title}.`
                  : `Curated parts currently mapped to the ${title} collection.`
                : isUa
                  ? 'Theme section перенесено. Товари для цієї колекції можна підв’язати через shop catalog.'
                  : 'Theme section is now ported. Products for this collection can be attached via the shop catalog.'}
            </p>
          </div>
          <Link
            href={`/${locale}/shop/urban/collections`}
            className="urban-product-grid__all-link"
          >
            {isUa ? 'Усі колекції' : 'All collections'}
          </Link>
        </div>

        {products.length > 0 ? (
          <div className="urban-product-grid__cards">
            {products.map((product) => (
              <article key={product.slug} className="urban-product-grid__card">
                <Link
                  href={buildShopProductPath(locale, product)}
                  className="urban-product-grid__card-link"
                  aria-label={localize(locale, product.title)}
                />
                <div className="urban-product-grid__media">
                  <Image
                    src={product.image}
                    alt={localize(locale, product.title)}
                    fill
                    sizes="(max-width: 768px) 100vw, 25vw"
                    className="object-cover"
                  />
                </div>
                <div className="urban-product-grid__body">
                  <p className="urban-product-grid__brand">{product.brand}</p>
                  <h3 className="urban-product-grid__name">
                    {localize(locale, product.title)}
                  </h3>
                  <p className="urban-product-grid__description">
                    {localize(locale, product.shortDescription)}
                  </p>
                  <div className="urban-product-grid__meta">
                    <span>{localize(locale, product.collection)}</span>
                    <span>{formatPrice(locale, locale === 'ua' ? product.price.uah : product.price.eur)}</span>
                  </div>
                  <div className="urban-product-grid__actions">
                    <AddToCartButton
                      slug={product.slug}
                      locale={locale}
                      redirect={false}
                      variant="inline"
                      className="urban-product-grid__add"
                      label={isUa ? 'Додати в кошик' : 'Add to cart'}
                      labelAdded={isUa ? 'Додано' : 'Added'}
                    />
                    <Link
                      href={buildShopProductPath(locale, product)}
                      className="urban-product-grid__details"
                    >
                      {isUa ? 'Деталі' : 'Details'}
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="urban-product-grid__empty">
            <p className="urban-product-grid__empty-title">
              {isUa ? 'Колекція готова до каталогу' : 'Collection is ready for catalog data'}
            </p>
            <p className="urban-product-grid__empty-copy">
              {isUa
                ? `Наступний крок для ${title} — додати продукти в admin shop і зв’язати їх з handle "${handle}".`
                : `Next step for ${title} is to add products in admin shop and map them to the "${handle}" handle.`}
            </p>
            <Link href={`/${locale}/#contact`} className="urban-product-grid__empty-cta">
              {isUa ? 'Запитати комплект' : 'Request a package'}
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}

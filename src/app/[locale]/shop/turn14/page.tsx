import { resolveLocale } from '@/lib/seo';
import Image from 'next/image';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { fetchTurn14Brands, searchTurn14Items } from '@/lib/turn14';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function Turn14CatalogPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; page?: string; brandId?: string }>;
}) {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);
  const isUa = resolvedLocale === 'ua';
  const queryParams = await searchParams;
  const { q, brandId } = queryParams;
  const pageNum = parseInt(queryParams.page || '1', 10);

  // If there's a search term or brand selected, we use the items proxy
  const isSearch = !!(q || brandId);
  const data = isSearch
    ? await searchTurn14Items(q || '', pageNum, { brandId }).catch(() => null)
    : await fetchTurn14Brands().catch(() => null);

  const items = data?.data || [];
  const meta = data?.meta || {};

  return (
    <main className="min-h-screen bg-black pt-32 pb-24 text-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-12 border-b border-white/10 pb-8 flex flex-col md:flex-row gap-6 md:items-end justify-between">
          <div>
            <h1 className="text-3xl font-light tracking-tight text-white uppercase sm:text-5xl">
              Turn14 <span className="text-indigo-400">Hub</span>
            </h1>
            <p className="mt-3 text-sm text-white/50 max-w-xl">
              {isUa
                ? 'Прямий доступ до глобальної платформи дистриб\'юції продукції. Шукайте понад 700 000+ запчастин.'
                : 'Direct access to global automotive distribution platform. Search over 700,000+ parts live.'}
            </p>
          </div>
          <form className="relative w-full md:max-w-md pt-2">
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder={isUa ? 'Пошук по артикулу, бренду, ключовим словам...' : 'Search for part number, brand...'}
              className="w-full rounded-full border border-white/20 bg-white/5 px-5 py-3.5 pl-12 text-sm text-white placeholder:text-white/40 focus:border-indigo-500/50 focus:bg-white/10 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-all shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)]"
            />
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 h-5 w-5" />
            <button type="submit" className="hidden" />
          </form>
        </div>

        {items.length === 0 ? (
          <div className="py-24 text-center">
            <p className="text-white/40">{isUa ? 'Нічого не знайдено' : 'No results found'}</p>
          </div>
        ) : isSearch ? (
          <div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {items.map((item: any) => {
                const attr = item.attributes || {};
                const imageUrl = Array.isArray(attr.files) && attr.files.length > 0
                  ? attr.files[0].links?.image_preview || attr.files[0].links?.image_thumbnail
                  : null;

                return (
                  <Link
                    key={item.id}
                    href={`/${resolvedLocale}/shop/turn14/product/${item.id}`}
                    className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-black/40 p-4 transition-all hover:border-white/20 hover:bg-white/5"
                  >
                    <div className="relative mb-4 aspect-square w-full overflow-hidden rounded-xl bg-white/5 flex items-center justify-center p-4">
                      {imageUrl ? (
                        <Image src={imageUrl} alt={attr.part_description || item.id} fill className="object-contain" sizes="300px" />
                      ) : (
                        <span className="text-white/20 uppercase tracking-widest text-xs">No Image</span>
                      )}
                    </div>
                    <div className="mt-auto flex flex-col gap-1">
                      <span className="text-[10px] font-mono text-indigo-400">{attr.brand_name || attr.brand}</span>
                      <h3 className="line-clamp-2 text-sm text-white/90 group-hover:text-white">{attr.part_description}</h3>
                      <p className="text-xs text-white/50 mt-1 font-mono tracking-wider">PN: {attr.part_number}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
            {/* Simple Pagination */}
            {meta?.last_page > 1 && (
              <div className="mt-12 flex items-center justify-center gap-2">
                {pageNum > 1 && (
                  <Link href={`/${resolvedLocale}/shop/turn14?q=${q || ''}&page=${pageNum - 1}`} className="px-4 py-2 border border-white/20 rounded-lg text-sm hover:bg-white/10">
                    {isUa ? 'Попередня' : 'Prev'}
                  </Link>
                )}
                <span className="text-xs text-white/40 px-4">
                  {pageNum} / {meta.last_page}
                </span>
                {pageNum < meta.last_page && (
                  <Link href={`/${resolvedLocale}/shop/turn14?q=${q || ''}&page=${pageNum + 1}`} className="px-4 py-2 border border-white/20 rounded-lg text-sm hover:bg-white/10">
                    {isUa ? 'Наступна' : 'Next'}
                  </Link>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {items.map((brand: any) => {
              const name = brand.attributes?.name || brand.name;
              return (
                <Link
                  key={brand.id}
                  href={`/${resolvedLocale}/shop/turn14?brandId=${brand.id}`}
                  className="flex aspect-[3/2] items-center justify-center rounded-xl border border-white/10 bg-white/[0.02] p-4 text-center text-sm font-medium text-white/70 transition-all hover:bg-white/5 hover:text-white"
                >
                  {name}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

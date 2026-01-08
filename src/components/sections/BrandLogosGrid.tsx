"use client";
import Image from 'next/image';
import { useState, useMemo } from 'react';
import { BrandModal } from '../ui/BrandModal';
import { shouldInvertBrandOrLogo, shouldSmartInvertBrand } from '@/lib/invertBrands';

export interface BrandItem {
  name: string;
  logoSrc: string;
  country?: string;
  subcategory?: string;
  description?: string;
  website?: string;
  headline?: string;
  highlights?: string[];
}

interface BrandLogosGridProps {
  title?: string;
  items: BrandItem[];
}

export default function BrandLogosGrid({ title, items }: BrandLogosGridProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBrand, setSelectedBrand] = useState<BrandItem | null>(null);

  const filteredItems = useMemo(() => {
    if (!searchQuery) return items;
    return items.filter(item =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [items, searchQuery]);

  const groupedItems = filteredItems.reduce((acc, item) => {
    const firstChar = item.name[0].toUpperCase();
    const group = (firstChar >= 'A' && firstChar <= 'Z') ? firstChar : '#';
    if (!acc[group]) {
      acc[group] = [];
    }
    acc[group].push(item);
    return acc;
  }, {} as Record<string, BrandItem[]>);

  const sortedGroupKeys = Object.keys(groupedItems).sort((a, b) => {
    if (a === '#') return -1;
    if (b === '#') return 1;
    return a.localeCompare(b);
  });

  const alphabet = ['#', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')];

  return (
    <section className="mb-14">
      <div className="mb-8">
        <input
          type="text"
          placeholder="Search brands..."
          className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
      </div>
      <div className="flex">
        <div className="w-full">
          {title ? (
            <h2 className="text-2xl md:text-3xl font-semibold mb-6 tracking-tight">{title}</h2>
          ) : null}

          {sortedGroupKeys.length > 0 ? (
            sortedGroupKeys.map(letter => (
              <div key={letter} id={`letter-${letter}`} className="mb-10 scroll-mt-20">
                <h3 className="text-3xl font-bold mb-6 text-white/50 sticky top-16 bg-black/80 backdrop-blur-sm py-3 z-10">
                  {letter}
                </h3>
                <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
                  {groupedItems[letter].map((brand) => (
                    <li
                      key={brand.name}
                      className="group relative rounded-md border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 transition-colors p-4 flex flex-col items-center justify-center text-center overflow-hidden cursor-pointer"
                      title={brand.name}
                      onClick={() => setSelectedBrand(brand)}
                    >
                      {/* Radial white backlight for dark logos */}
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-[80%] h-[60%] bg-[radial-gradient(circle,_rgba(255,255,255,0.20)_0%,_rgba(255,255,255,0.05)_50%,_transparent_70%)] group-hover:bg-[radial-gradient(circle,_rgba(255,255,255,0.25)_0%,_rgba(255,255,255,0.10)_50%,_transparent_70%)] transition-all duration-500 rounded-full" />
                      </div>

                      {/* Logo with unified sizing */}
                      <div className="relative w-full z-10" style={{ paddingTop: '56%' }}>
                        <div className="absolute inset-0 p-2">
                          <Image
                            src={brand.logoSrc}
                            alt={brand.name}
                            fill
                            className={`object-contain ${shouldSmartInvertBrand(brand.name) || shouldInvertBrandOrLogo(brand.name, brand.logoSrc) ? 'opacity-95 group-hover:opacity-100' : 'opacity-80 group-hover:opacity-100'} transition-opacity ${shouldSmartInvertBrand(brand.name) ? 'filter invert hue-rotate-180' : shouldInvertBrandOrLogo(brand.name, brand.logoSrc) ? 'filter brightness-0 invert' : ''}`}
                            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 16vw"
                            unoptimized
                            priority={false}
                          />
                        </div>
                      </div>

                      {/* Removed duplicated brand name as per design request */}
                      {/* <span className="relative z-10 mt-3 text-xs text-white/70 truncate w-full font-medium">{brand.name}</span> */}

                      {brand.country && (
                        <div className="relative z-10 w-full flex justify-center mt-4 pt-2 border-t border-white/5">
                          <span className="text-[9px] text-white/30 uppercase tracking-widest font-sans">{brand.country}</span>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))
          ) : (
            <p className="text-center text-white/50">No brands found.</p>
          )}
        </div>

        <aside className="hidden md:block fixed right-0 top-1/2 -translate-y-1/2 h-full" style={{ maxHeight: 'calc(100vh - 200px)' }}>
          <ul className="flex flex-col space-y-1 text-center pr-4">
            {alphabet.map(letter => (
              <li key={letter}>
                <a
                  href={`#letter-${letter}`}
                  className="text-xs font-medium text-white/40 hover:text-white transition-colors px-2 py-1 rounded-md"
                >
                  {letter}
                </a>
              </li>
            ))}
          </ul>
        </aside>
      </div>

      <BrandModal
        brand={selectedBrand}
        isOpen={!!selectedBrand}
        onClose={() => setSelectedBrand(null)}
      />
    </section>
  );
}

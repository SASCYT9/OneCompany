"use client";
import Image from 'next/image';
import { useState, useMemo } from 'react';

export interface BrandItem {
  name: string;
  logoSrc: string;
  country?: string;
  subcategory?: string;
}

interface BrandLogosGridProps {
  title?: string;
  items: BrandItem[];
}

export default function BrandLogosGrid({ title, items }: BrandLogosGridProps) {
  const [searchQuery, setSearchQuery] = useState('');

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
                  {groupedItems[letter].map(({ name, logoSrc, country, subcategory }) => (
                    <li
                      key={name}
                      className="group rounded-md border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 transition-colors p-4 flex flex-col items-center justify-center text-center"
                      title={name}
                    >
                      <div className="relative w-full" style={{ paddingTop: '56%' }}>
                        <Image
                          src={logoSrc}
                          alt={name}
                          fill
                          className="object-contain opacity-80 group-hover:opacity-100 transition-opacity"
                          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 16vw"
                          unoptimized
                          priority={false}
                        />
                      </div>
                      <span className="mt-3 text-xs text-white/70 truncate w-full font-medium">{name}</span>
                      {(country || subcategory) && (
                        <div className="flex flex-col items-center mt-1 gap-0.5">
                          {country && <span className="text-[10px] text-white/40 uppercase tracking-wider">{country}</span>}
                          {subcategory && <span className="text-[10px] text-blue-400/60">{subcategory}</span>}
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
    </section>
  );
}

// src/components/sections/BrandLogosGrid.tsx
import Image from 'next/image';

export interface BrandItem {
  name: string;
  logoSrc: string;
}

interface BrandLogosGridProps {
  title?: string;
  items: BrandItem[];
}

export default function BrandLogosGrid({ title, items }: BrandLogosGridProps) {
  return (
    <section className="mb-14">
      {title ? (
        <h2 className="text-2xl md:text-3xl font-semibold mb-6 tracking-tight">{title}</h2>
      ) : null}
      <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
        {items.map(({ name, logoSrc }) => (
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
                className="object-contain opacity-90 group-hover:opacity-100 transition-opacity"
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 16vw"
                unoptimized
                priority={false}
              />
            </div>
            <span className="mt-3 text-xs text-white/70 truncate w-full">{name}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

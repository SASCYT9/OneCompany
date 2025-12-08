"use client";

import Image from "next/image";
import Link from "next/link";

interface ProductCardProps {
  name: string;
  image: string;
  href: string;
  category?: string;
  className?: string;
}

export default function ProductCard({ name, image, href, category, className }: ProductCardProps) {
  return (
    <Link href={href}>
      <div
        className={`group relative overflow-hidden bg-white dark:bg-zinc-900/30 border border-zinc-100 dark:border-white/5 transition-colors duration-300 ${className || ''}`}
      >
        {/* Image Container */}
        <div className="relative aspect-square overflow-hidden bg-zinc-50 dark:bg-zinc-900/50 p-8">
          <Image
            src={image}
            alt={name}
            fill
            className="object-contain p-4"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
          
          {/* Category Badge */}
          {category && (
            <div className="absolute top-4 left-4 px-3 py-1 bg-white/90 dark:bg-black/90 backdrop-blur-sm">
              <span className="text-xs uppercase tracking-widest font-light text-zinc-900 dark:text-white">
                {category}
              </span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-6 border-t border-zinc-100 dark:border-white/5">
          <h3 className="text-lg font-light text-zinc-900 dark:text-white tracking-wide">
            {name}
          </h3>
        </div>
      </div>
    </Link>
  );
}

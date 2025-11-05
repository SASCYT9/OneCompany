'use client';

import Image from 'next/image';
import Link from 'next/link';

interface BrandCardProps {
  name: string;
  logo: string;
  url: string;
  description?: string;
  category?: string;
}

export function BrandCard({ name, logo, url, description, category }: BrandCardProps) {
  return (
    <Link
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative block pointer-events-auto"
    >
      {/* Card container with glass morphism */}
      <div className="relative overflow-hidden rounded-lg border border-white/10 bg-black/20 backdrop-blur-md p-8 transition-all duration-500 hover:border-white/30 hover:bg-white/5">
        {/* Animated gradient border on hover */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
          <div className="absolute inset-[-2px] bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500 rounded-lg blur-sm -z-10" />
        </div>

        {/* Category badge */}
        {category && (
          <div className="absolute top-4 right-4 px-3 py-1 rounded-full bg-white/10 backdrop-blur-sm border border-white/20">
            <span className="text-xs font-thin text-white/60 uppercase tracking-wider">
              {category}
            </span>
          </div>
        )}

        {/* Logo */}
        <div className="relative h-24 mb-6 flex items-center justify-center">
          <div className="relative w-full h-full transition-transform duration-500 group-hover:scale-110">
            <Image
              src={logo}
              alt={name}
              fill
              className="object-contain filter brightness-0 invert opacity-80 group-hover:opacity-100 transition-opacity duration-300"
            />
          </div>
        </div>

        {/* Brand name */}
        <h3 className="text-2xl font-thin text-white mb-2 transition-all duration-300 group-hover:text-cyan-400">
          {name}
        </h3>

        {/* Description */}
        {description && (
          <p className="text-sm font-thin text-white/60 line-clamp-2 mb-4">
            {description}
          </p>
        )}

        {/* Hover indicator */}
        <div className="flex items-center gap-2 text-white/40 group-hover:text-cyan-400 transition-colors duration-300">
          <span className="text-xs font-thin uppercase tracking-wider">Перейти до сайту</span>
          <span className="transform transition-transform duration-300 group-hover:translate-x-2">→</span>
        </div>

        {/* Scan line effect */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-500/5 to-transparent animate-scan" />
        </div>
      </div>
    </Link>
  );
}

'use client';

import Link from 'next/link';
import { useState } from 'react';

interface FeaturedProductProps {
  name: string;
  store: 'kw' | 'fi' | 'eventuri';
  price: string;
  image: string;
  url: string;
  description: string;
}

export function FeaturedProduct({ name, store, price, image, url, description }: FeaturedProductProps) {
  const [isHovered, setIsHovered] = useState(false);

  const storeColors = {
    kw: 'from-orange-500 to-red-600',
    fi: 'from-blue-500 to-cyan-600',
    eventuri: 'from-purple-500 to-pink-600',
  };

  const storeNames = {
    kw: 'KW Suspension',
    fi: 'Fi Exhaust',
    eventuri: 'Eventuri',
  };

  return (
    <Link
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="group block relative h-[600px] pointer-events-auto"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="relative h-full rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl overflow-hidden transition-all duration-700 hover:border-white/30 hover:scale-[1.02]">
        
        {/* Product Image */}
        <div className="relative h-2/3 bg-gradient-to-br from-white/5 to-white/0 overflow-hidden">
          <div className={`absolute inset-0 bg-gradient-to-br ${storeColors[store]} opacity-10 group-hover:opacity-20 transition-opacity duration-700`} />
          
          {/* Placeholder for product image */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-white/20 text-6xl font-thin">
              {/* Product image will go here */}
              <div className={`w-64 h-64 rounded-full bg-gradient-to-br ${storeColors[store]} opacity-20 blur-3xl`} />
            </div>
          </div>

          {/* Store badge */}
          <div className="absolute top-4 left-4">
            <span className={`px-4 py-1.5 rounded-full bg-gradient-to-r ${storeColors[store]} text-white text-xs font-thin uppercase tracking-wider`}>
              {storeNames[store]}
            </span>
          </div>

          {/* Hover glow */}
          <div className={`absolute inset-0 bg-gradient-to-br ${storeColors[store]} opacity-0 group-hover:opacity-30 transition-opacity duration-700 blur-3xl`} />
        </div>

        {/* Product Info */}
        <div className="relative h-1/3 p-6 flex flex-col">
          <h3 className="text-2xl font-thin text-white mb-2 line-clamp-2 transition-all duration-300 group-hover:text-cyan-400">
            {name}
          </h3>
          
          <p className="text-sm font-thin text-white/60 mb-4 flex-1 line-clamp-2">
            {description}
          </p>

          <div className="flex items-center justify-between">
            <span className="text-3xl font-thin text-white">
              {price}
            </span>
            
            <div className={`flex items-center gap-2 text-white/60 group-hover:text-white transition-all duration-300 ${isHovered ? 'translate-x-0' : 'translate-x-2'}`}>
              <span className="text-sm font-thin uppercase tracking-wider">Переглянути</span>
              <span className="transform transition-transform duration-300 group-hover:translate-x-2">→</span>
            </div>
          </div>
        </div>

        {/* Scan effect */}
        <div className={`absolute inset-0 pointer-events-none transition-opacity duration-1000 ${isHovered ? 'opacity-100' : 'opacity-0'}`}>
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/5 to-transparent animate-scan" />
        </div>
      </div>
    </Link>
  );
}

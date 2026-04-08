'use client';

import { useState } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag } from 'lucide-react';

type Props = {
  images: string[];
  productTitle: string;
  category?: string;
  isInStock?: boolean;
  isUa?: boolean;
};

export function ShopProductGallery({ images, productTitle, category, isInStock, isUa }: Props) {
  const [activeIndex, setActiveIndex] = useState(0);

  const activeImage = images[activeIndex];

  return (
    <div className="space-y-4">
      {/* Main Image */}
      <div className="group relative aspect-[4/5] overflow-hidden rounded-3xl border border-white/10 bg-zinc-950 shadow-2xl">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeIndex}
            initial={{ opacity: 0, scale: 1.05 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }}
            className="absolute inset-0"
          >
            {activeImage && activeImage.length > 0 ? (
              <Image
                src={activeImage}
                alt={`${productTitle} - Image ${activeIndex + 1}`}
                fill
                sizes="(max-width: 1280px) 100vw, 58vw"
                className="object-contain p-4 transition duration-1000 group-hover:scale-105"
                priority
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-white/5">
                <ShoppingBag className="h-20 w-20" />
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-black/15 to-black/80" />
        <div className="pointer-events-none absolute inset-0 rounded-3xl border border-white/5 mix-blend-overlay" />
        
        {/* Badges */}
        {(category || isInStock !== undefined) && (
          <div className="absolute left-4 right-4 top-4 flex items-start justify-between gap-3 z-10 pointer-events-none">
            {category ? (
              <span className="rounded-full border border-white/20 bg-black/60 px-4 py-1.5 text-[10px] uppercase tracking-[0.2em] text-white/80 backdrop-blur-md">
                {category}
              </span>
            ) : <div />}
            {isInStock !== undefined && (
              <span
                className={`rounded-full border px-4 py-1.5 text-[10px] uppercase tracking-[0.2em] backdrop-blur-md shadow-lg ${
                  isInStock
                    ? 'border-emerald-300/30 bg-emerald-500/10 text-emerald-300 shadow-emerald-500/10'
                    : 'border-[#c29d59]/30 bg-[#c29d59]/10 text-[#c29d59] shadow-[#c29d59]/10'
                }`}
              >
                {isInStock ? (isUa ? 'В наявності' : 'In stock') : (isUa ? 'Під замовлення' : 'Pre-order')}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Thumbnails */}
      {images.length > 1 && (
        <div className="grid grid-cols-4 gap-3 sm:grid-cols-5">
          {images.slice(0, 5).map((image, index) => {
            const isActive = index === activeIndex;
            return (
              <button
                key={index}
                onClick={() => setActiveIndex(index)}
                className={`relative aspect-square overflow-hidden rounded-2xl border bg-black/60 transition-all duration-300 ${
                  isActive
                    ? 'border-[#c29d59]/50 shadow-[0_0_15px_-3px_rgba(194,157,89,0.2)]'
                    : 'border-white/10 hover:border-white/30'
                }`}
              >
                {image && image.length > 0 && (
                  <Image
                    src={image}
                    alt={`${productTitle} thumbnail ${index + 1}`}
                    fill
                    sizes="15vw"
                    className={`object-cover p-2 transition-transform duration-700 ${
                      isActive ? 'scale-110' : 'hover:scale-105'
                    }`}
                  />
                )}
                {!isActive && (
                  <div className="absolute inset-0 bg-black/50 transition-colors duration-300 hover:bg-black/20" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

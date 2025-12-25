'use client';

import { useEffect } from 'react';
import Image from 'next/image';
import { X, ChevronRight, ArrowUpRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { BrandItem } from '../sections/BrandLogosGrid';
import { shouldInvertBrandOrLogo, shouldSmartInvertBrand } from '@/lib/invertBrands';

interface BrandModalProps {
  brand: BrandItem | null;
  isOpen: boolean;
  onClose: () => void;
}

export function BrandModal({ brand, isOpen, onClose }: BrandModalProps) {
  // Close on escape key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  return (
    <AnimatePresence>
      {isOpen && brand && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/90 backdrop-blur-xl"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-4xl max-h-[85vh] overflow-y-auto rounded-[24px] bg-[#0A0A0A] shadow-2xl border border-white/10 flex flex-col md:flex-row min-h-[400px] md:min-h-[500px]"
          >
            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 text-white/40 hover:text-white transition-colors z-50 rounded-full bg-black/20 hover:bg-white/10 backdrop-blur-sm"
            >
              <X size={24} />
            </button>

            {/* Left Column: Logo & Visuals */}
            <div className="relative w-full md:w-2/5 bg-gradient-to-br from-[#1a1a1a] via-[#151515] to-[#0a0a0a] p-8 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-white/5">
              {/* Background Pattern */}
              <div className="absolute inset-0 opacity-[0.15]"
                style={{
                  backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.15) 1px, transparent 0)',
                  backgroundSize: '24px 24px'
                }}
              />

              {/* Logo Container */}
              <div className="relative w-full aspect-video max-w-[240px] flex items-center justify-center z-10">
                {/* Subtle glow behind logo */}
                <div className="absolute inset-0 bg-white/5 blur-[60px] rounded-full scale-110 opacity-40" />
                <div className="relative w-full h-full">
                  <Image
                    src={brand.logoSrc}
                    alt={brand.name}
                    fill
                    className={`object-contain drop-shadow-2xl ${shouldSmartInvertBrand(brand.name) ? 'filter invert hue-rotate-180' : shouldInvertBrandOrLogo(brand.name, brand.logoSrc) ? 'filter brightness-0 invert' : ''}`}
                    unoptimized
                  />
                </div>
              </div>
            </div>

            {/* Right Column: Content */}
            <div className="relative w-full md:w-3/5 p-8 md:p-10 flex flex-col">

              {/* Headline */}
              {brand.headline && (
                <motion.h3
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="text-xl md:text-2xl font-bold text-white leading-tight mb-6 uppercase tracking-wide"
                >
                  {brand.headline}
                </motion.h3>
              )}

              {/* Description */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="prose prose-invert max-w-none"
              >
                <p className="text-white/70 text-sm md:text-base leading-relaxed font-light">
                  {brand.description || "Premium automotive brand known for excellence and performance."}
                </p>
              </motion.div>

              {/* Highlights List */}
              {brand.highlights && brand.highlights.length > 0 && (
                <motion.ul
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="mt-8 space-y-3"
                >
                  {brand.highlights.map((highlight, index) => (
                    <li key={index} className="flex items-start gap-3 text-sm text-white/80">
                      <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-red-600 flex-shrink-0" />
                      <span className="font-medium">{highlight}</span>
                    </li>
                  ))}
                </motion.ul>
              )}

              {/* Footer Actions */}
              <div className="mt-auto pt-10 flex flex-col sm:flex-row gap-4 font-sans">
                {brand.website ? (
                  <a
                    href={brand.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-2 px-6 py-4 border border-white/10 bg-white/[0.03] hover:bg-white/[0.08] hover:border-white/20 rounded-xl text-white text-sm font-medium transition-all uppercase tracking-wider group backdrop-blur-sm"
                  >
                    <span>Офіційний сайт</span>
                    <ArrowUpRight size={16} className="text-white/40 group-hover:text-white transition-colors" />
                  </a>
                ) : (
                  <button disabled className="flex-1 flex items-center justify-center gap-2 px-6 py-4 border border-white/5 bg-white/[0.02] rounded-xl text-white/20 text-sm font-medium cursor-not-allowed uppercase tracking-wider">
                    <span>Офіційний сайт</span>
                  </button>
                )}

                <button
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-white hover:bg-[#f0f0f0] rounded-xl text-black text-sm font-bold transition-all shadow-[0_0_20px_rgba(255,255,255,0.15)] hover:shadow-[0_0_30px_rgba(255,255,255,0.25)] uppercase tracking-wider group"
                >
                  <span>Замовити</span>
                  <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </button>
              </div>

            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

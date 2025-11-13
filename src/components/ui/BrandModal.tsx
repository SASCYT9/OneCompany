'use client';

import { useEffect } from 'react';
import { BrandLogo } from '@/components/ui/BrandLogo';
import Link from 'next/link';

import type { SimpleBrand } from '@/lib/types';

interface BrandModalProps {
  isOpen: boolean;
  onClose: () => void;
  brand: SimpleBrand | null;
}

export function BrandModal({ isOpen, onClose, brand }: BrandModalProps) {
  useEffect(() => {
    if (isOpen) {
      const scrollY = window.scrollY;
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      document.body.dataset.scrollY = String(scrollY);
    } else {
      const scrollY = document.body.dataset.scrollY || '0';
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      window.scrollTo(0, parseInt(scrollY, 10));
      delete document.body.dataset.scrollY;
    }
    return () => {
      // Ensure styles are cleaned up on unmount
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
    };
  }, [isOpen]);

  if (!isOpen || !brand) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/80 backdrop-blur-md animate-fade-in"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto my-auto bg-gradient-to-br from-white/[0.12] via-white/[0.08] to-white/[0.04] backdrop-blur-xl animate-scale-in shadow-2xl rounded-xl">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 z-10 w-10 h-10 flex items-center justify-center bg-white/10 hover:bg-white/20 transition-all duration-300 group rounded-full"
        >
          <svg className="w-5 h-5 text-white/60 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Content */}
        <div className="p-8 md:p-12">
          {/* Header with Logo */}
          <div className="flex flex-col md:flex-row gap-8 mb-10">
            <div className="flex-shrink-0 w-full md:w-64 h-40 bg-white/5 p-6 flex items-center justify-center rounded-xl shadow-lg">
              <BrandLogo name={brand.name} src={brand.logo} className="w-full" />
            </div>
            <div className="flex-1">
              <div className="inline-block px-4 py-1.5 bg-white/10 mb-4 rounded-full">
                <span className="text-[10px] tracking-[0.3em] uppercase text-white/60 font-light">{brand.category}</span>
              </div>
              <h2 className="text-4xl md:text-5xl font-light tracking-tight text-white mb-4">{brand.name}</h2>
              <p className="text-white/70 leading-relaxed text-base">
                {brand.description}
              </p>
            </div>
          </div>

          {/* Features */}
          {brand.features && brand.features.length > 0 && (
            <div className="mb-10">
              <h3 className="text-xs tracking-[0.3em] uppercase text-white/40 font-light mb-6">Ключові особливості</h3>
              <div className="grid md:grid-cols-2 gap-4">
                {brand.features.map((feature, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-4 bg-white/5 rounded-xl shadow-sm">
                    <svg className="w-5 h-5 text-orange-400/60 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-sm text-white/70 font-light">{feature}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Technologies */}
          {brand.technologies && brand.technologies.length > 0 && (
            <div className="mb-10">
              <h3 className="text-xs tracking-[0.3em] uppercase text-white/40 font-light mb-6">Технології</h3>
              <div className="flex flex-wrap gap-3">
                {brand.technologies.map((tech, idx) => (
                  <div key={idx} className="px-4 py-2 bg-gradient-to-br from-orange-500/20 to-rose-500/20 backdrop-blur-sm rounded-full">
                    <span className="text-xs text-white/80 font-light">{tech}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-4 pt-6">
            <Link 
              href="/contact"
              onClick={onClose}
              className="group relative px-8 py-4 bg-gradient-to-r from-orange-500 to-rose-500 text-white hover:shadow-xl hover:shadow-orange-500/30 transition-all duration-500 text-sm tracking-[0.2em] uppercase font-light overflow-hidden"
            >
              <span className="relative z-10">Замовити консультацію</span>
              <div className="absolute inset-0 bg-gradient-to-r from-rose-500 to-amber-500 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            </Link>
            {brand.website && (
              <a 
                href={brand.website} 
                target="_blank" 
                rel="noopener noreferrer"
                className="px-8 py-4 bg-white/10 hover:bg-white/20 text-white/70 hover:text-white text-sm tracking-[0.2em] uppercase font-light transition-all duration-300 rounded-xl shadow-sm"
              >
                Офіційний сайт →
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

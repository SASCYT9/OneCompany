'use client';

import Image from 'next/image';
import { useRef, useEffect } from 'react';
import gsap from 'gsap';
import type { FeaturedProductItem } from '@/lib/featuredProducts';

interface ProductCardShowcaseProps {
  product: FeaturedProductItem;
  index: number;
}

// Subtle gradient palette mapping to category for accent ring / badge
const categoryAccents: Record<string, string> = {
  exhaust: 'from-orange-500/30 to-rose-500/30',
  suspension: 'from-amber-500/30 to-orange-500/30',
  wheels: 'from-cyan-500/30 to-blue-500/30',
  brakes: 'from-red-500/40 to-rose-500/30',
  intake: 'from-purple-500/40 to-rose-500/30',
  performance: 'from-emerald-500/40 to-teal-500/30',
  interior: 'from-fuchsia-500/40 to-pink-500/30',
};

export function ProductCardShowcase({ product, index }: ProductCardShowcaseProps) {
  const ref = useRef<HTMLDivElement>(null);
  const shineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    gsap.fromTo(el,
      { y: 40, opacity: 0, scale: 0.96 },
      { y: 0, opacity: 1, scale: 1, duration: 0.9, ease: 'power3.out', delay: index * 0.05 }
    );

    const handleMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const rotateX = (y - rect.height / 2) / 60;
      const rotateY = (rect.width / 2 - x) / 60;
      gsap.to(el, { rotateX, rotateY, duration: 0.6, ease: 'power2.out', transformPerspective: 900 });
      if (shineRef.current) {
        gsap.to(shineRef.current, { x: x - rect.width / 2, y: y - rect.height / 2, duration: 0.4, ease: 'power2.out' });
      }
    };
    const reset = () => {
      gsap.to(el, { rotateX: 0, rotateY: 0, duration: 0.8, ease: 'power3.out' });
      if (shineRef.current) gsap.to(shineRef.current, { opacity: 0, duration: 0.5 });
    };
    const enter = () => {
      gsap.to(el, { scale: product.highlight ? 1.025 : 1.015, duration: 0.5, ease: 'power2.out' });
      if (shineRef.current) gsap.to(shineRef.current, { opacity: 1, duration: 0.6 });
    };
    el.addEventListener('mousemove', handleMove);
    el.addEventListener('mouseleave', reset);
    el.addEventListener('mouseenter', enter);
    return () => {
      el.removeEventListener('mousemove', handleMove);
      el.removeEventListener('mouseleave', reset);
      el.removeEventListener('mouseenter', enter);
    };
  }, [index, product.highlight]);

  const accent = categoryAccents[product.categorySlug] || 'from-white/20 to-white/5';

  return (
    <div
      ref={ref}
      className={`group relative flex flex-col overflow-hidden rounded-2xl bg-gradient-to-br from-white/[0.07] via-white/[0.03] to-white/[0.02] backdrop-blur-sm border border-white/10 shadow-lg transition-all duration-700 ${product.highlight ? 'md:col-span-2 lg:col-span-2' : ''}`}
      style={{ transformStyle: 'preserve-3d' }}
      tabIndex={0}
      aria-label={`${product.name} by ${product.brand}`}
    >
      {/* Interactive glow */}
      <div ref={shineRef} className={`absolute w-64 h-64 -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl opacity-0 pointer-events-none bg-gradient-to-r from-orange-500/25 to-rose-500/25`} style={{ top: '50%', left: '50%' }} />
      <div className={`absolute inset-0 bg-gradient-to-br ${accent} opacity-0 group-hover:opacity-10 transition-opacity duration-700`} />

      {/* Image / visual */}
      <div className="relative h-72 md:h-64 flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-black/40 via-black/20 to-transparent" />
        <Image src={product.image} alt={product.name} width={600} height={400} className="object-contain w-[70%] h-[70%] transition-transform duration-700 group-hover:scale-105" />
        {/* Brand badge */}
        <div className="absolute top-4 left-4 flex items-center gap-2">
          <div className="px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-[10px] tracking-[0.35em] uppercase font-light text-white/80 group-hover:text-white transition-colors duration-500">
            {product.brand}
          </div>
        </div>
        {/* Category badge */}
        <div className="absolute top-4 right-4 px-3 py-1 rounded-full bg-gradient-to-r from-white/10 to-white/5 text-[10px] tracking-[0.3em] uppercase text-white/60 border border-white/10">{product.category}</div>
        {/* Accent corners */}
        <div className="absolute -top-10 -left-10 w-40 h-40 bg-gradient-to-br from-orange-500/20 to-transparent blur-3xl opacity-40 group-hover:opacity-60 transition-opacity" />
        <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-gradient-to-tl from-rose-500/20 to-transparent blur-3xl opacity-40 group-hover:opacity-60 transition-opacity" />
      </div>

      {/* Content */}
      <div className="relative flex flex-col flex-1 p-8">
        <h3 className="text-2xl font-light tracking-tight text-white mb-3 group-hover:text-white/90 transition-colors duration-500">
          {product.name}
        </h3>
        <p className="text-white/60 font-light text-sm leading-relaxed mb-6 group-hover:text-white/75 transition-colors duration-500 line-clamp-3">
          {product.description}
        </p>
        <div className="mt-auto flex items-end justify-between gap-4">
          <div className="flex flex-col">
            <span className="text-[11px] tracking-[0.35em] uppercase text-white/40 mb-1">Price</span>
            <span className="text-3xl font-light text-white bg-clip-text bg-gradient-to-r from-white via-white to-white/70">
              {product.price}
            </span>
          </div>
          {product.url && (
            <a
              href={product.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group/cta relative px-6 py-4 rounded-xl bg-gradient-to-r from-orange-500 to-rose-500 text-white text-[11px] tracking-[0.25em] uppercase font-medium overflow-hidden shadow-lg hover:shadow-rose-500/30 transition-all duration-500"
              onClick={(e) => e.stopPropagation()}
            >
              <span className="relative z-10">Переглянути</span>
              <div className="absolute inset-0 bg-gradient-to-r from-rose-500 to-amber-500 opacity-0 group-hover/cta:opacity-100 transition-opacity duration-500" />
            </a>
          )}
        </div>
      </div>
      {/* Bottom accent line */}
      <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/0 to-transparent group-hover:via-white/25 transition-all duration-700" />
    </div>
  );
}

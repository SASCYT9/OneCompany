import React, { useMemo, useState, useRef, useEffect } from 'react';
import Image from 'next/image';

interface BrandLogoProps {
  name: string;
  src?: string; // optional manual override
  className?: string;
  alt?: string;
  variant?: 'default' | 'compact';
  monochrome?: boolean; // render grayscale -> color on hover
  lazy?: boolean; // defer loading until in viewport
  shimmer?: boolean; // show skeleton shimmer until loaded
}

// Maps brand name to expected slug file prefix
function slugify(name: string) {
  // Normalize accents (Akrapovič -> Akrapovic), then slugify
  const normalized = name
    .normalize('NFD')
    .replace(/\p{Diacritic}+/gu, '')
    .toLowerCase();
  return normalized.replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// Try multiple extensions prioritizing svg then png
const EXTENSIONS = ['svg', 'png', 'webp'];

export const BrandLogo: React.FC<BrandLogoProps> = ({ name, src, className = '', alt, variant = 'default', lazy = true, shimmer = true }) => {
  const slug = useMemo(() => slugify(name), [name]);
  const generated = useMemo(() => EXTENSIONS.map(ext => `/logos/${slug}.${ext}`), [slug]);
  const candidates = useMemo(() => (src ? [src, ...generated] : generated), [src, generated]);
  const [idx, setIdx] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [inView, setInView] = useState(!lazy); // if not lazy, load immediately
  const ref = useRef<HTMLDivElement | null>(null);

  // IntersectionObserver for lazy load
  useEffect(() => {
    if (!lazy || inView) return;
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          setInView(true);
          obs.disconnect();
        }
      });
    }, { rootMargin: '100px 0px' });
    obs.observe(el);
    return () => obs.disconnect();
  }, [lazy, inView]);

  const current = idx < candidates.length ? candidates[idx] : '/logos/placeholder.svg';
  const heightClass = variant === 'compact' ? 'h-20' : 'h-28';

  return (
    <div ref={ref} className={`relative flex items-center justify-center ${heightClass} ${className}`}>
      {shimmer && !loaded && (
        <div className="absolute inset-0 rounded-md overflow-hidden">
          <div className="w-full h-full bg-gradient-to-r from-white/5 via-white/10 to-white/5 animate-[shimmer_1.6s_linear_infinite]" />
        </div>
      )}
      {inView && (
        <Image
          src={current}
          alt={alt || name}
          fill
          className={`object-contain transition-all duration-500 ${loaded ? 'opacity-90 hover:opacity-100' : 'opacity-0'}`}
          loading={lazy ? 'lazy' : 'eager'}
          onLoad={() => setLoaded(true)}
          onError={() => {
            setLoaded(false);
            setIdx(prev => (prev + 1));
          }}
        />
      )}
      <style jsx>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        div:has(> .animate-[shimmer_1.6s_linear_infinite])::after { display:none; }
      `}</style>
    </div>
  );
};

export default BrandLogo;
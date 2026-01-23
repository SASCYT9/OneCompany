'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { AnimatePresence, motion, useMotionValue, useSpring, useTransform } from 'framer-motion';

type Props = {
  name: string;
  logo: string;
  categoryLabel: string;
};

export function BrandExpandableCard({ name, logo, categoryLabel }: Props) {
  const [open, setOpen] = useState(false);
  const [imgSrc, setImgSrc] = useState(logo);
  const [modalImgSrc, setModalImgSrc] = useState(logo);
  const ref = useRef<HTMLButtonElement | null>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rX = useSpring(useTransform(my, [ -50, 50 ], [ 6, -6 ]), { stiffness: 180, damping: 20 });
  const rY = useSpring(useTransform(mx, [ -50, 50 ], [ -6, 6 ]), { stiffness: 180, damping: 20 });

  useEffect(() => {
    function handleMove(e: MouseEvent) {
      if (!ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      mx.set(x);
      my.set(y);
    }
    const el = ref.current;
    if (!el) return;
    el.addEventListener('mousemove', handleMove);
    el.addEventListener('mouseleave', () => { mx.set(0); my.set(0); });
    return () => {
      el.removeEventListener('mousemove', handleMove);
      el.removeEventListener('mouseleave', () => { mx.set(0); my.set(0); });
    };
  }, [mx, my]);

  return (
    <>
      <motion.button
        ref={ref}
        style={{ rotateX: rX, rotateY: rY, transformPerspective: 800 }}
        className="group relative w-full p-6 rounded-xl bg-[linear-gradient(160deg,var(--surface-1),var(--surface-2))] border border-white/10 hover:border-white/20 transition-all duration-300 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <div className="flex flex-col items-center">
          <div className="relative h-12 w-full flex items-center justify-center">
            <Image
              src={imgSrc}
              alt={name}
              fill
              className="object-contain opacity-60 group-hover:opacity-100 transition-opacity duration-300"
              onError={() => setImgSrc('/logos/placeholder.svg')}
            />
          </div>
          <div className="mt-3 text-sm font-light text-white/80 group-hover:text-white transition-colors">{name}</div>
          <div className="text-[9px] tracking-wider uppercase text-white/30 mt-1">{categoryLabel}</div>
        </div>
        {/* subtle shine */}
        {/* layered shine & soft grid */}
        <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700" style={{ background: 'radial-gradient(800px 200px at 50% -20%, rgba(255,255,255,0.08), transparent 70%)' }} />
        <div className="pointer-events-none absolute inset-0 mix-blend-overlay opacity-10 group-hover:opacity-20" style={{ backgroundImage: 'linear-gradient(90deg,rgba(255,255,255,0.08) 1px,transparent 1px),linear-gradient(180deg,rgba(255,255,255,0.08) 1px,transparent 1px)', backgroundSize: '22px 22px' }} />
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[60] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/70 backdrop-blur-xl" onClick={() => setOpen(false)} />
            <motion.div
              role="dialog"
              aria-modal="true"
              className="relative z-10 w-full max-w-2xl overflow-hidden border border-white/10 rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.6)]"
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 180, damping: 22 }}
              style={{ background: 'linear-gradient(165deg, rgba(24,26,30,0.92), rgba(14,16,20,0.92))' }}
            >
              <div className="p-8">
                <div className="flex items-center gap-4">
                  <div className="relative h-12 w-12 flex items-center justify-center rounded-lg bg-white/5 border border-white/10 shadow-inner">
                    <Image
                      src={modalImgSrc}
                      alt=""
                      fill
                      className="object-contain p-2 opacity-80"
                      onError={() => setModalImgSrc('/logos/placeholder.svg')}
                    />
                  </div>
                  <div>
                    <h3 className="text-xl font-light text-white">{name}</h3>
                    <p className="text-[11px] tracking-wider uppercase text-white/40">{categoryLabel}</p>
                  </div>
                </div>

                <p className="mt-6 text-sm text-white/75 leading-relaxed font-light">
                  Premium components engineered for performance. Explore curated products, availability, and expert support tailored for your build.
                </p>

                <div className="mt-8 flex items-center gap-3">
                  <button
                    className="cta-primary text-xs tracking-wider uppercase font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                    onClick={() => setOpen(false)}
                  >
                    Close
                  </button>
                </div>
              </div>

              {/* decorative bottom gradient */}
              <div className="h-1 w-full bg-gradient-to-r from-orange-400/70 via-fuchsia-400/70 to-cyan-400/70" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

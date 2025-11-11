'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import gsap from 'gsap';

export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const overlayRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const overlay = overlayRef.current;
    const content = contentRef.current;
    if (!overlay || !content) return;

    // Page enter animation
    const tl = gsap.timeline();
    
    tl.set(overlay, { scaleY: 1, transformOrigin: 'top' })
      .to(overlay, {
        scaleY: 0,
        duration: 0.8,
        ease: 'power3.inOut',
      })
      .from(content, {
        opacity: 0,
        y: 20,
        duration: 0.6,
        ease: 'power2.out',
      }, '-=0.4');

  }, [pathname]);

  return (
    <>
      {/* Black overlay */}
      <div
        ref={overlayRef}
        className="fixed inset-0 z-[9999] bg-black pointer-events-none"
        style={{ transform: 'scaleY(0)', transformOrigin: 'bottom' }}
      />
      
      {/* Content */}
      <div ref={contentRef}>
        {children}
      </div>
    </>
  );
}

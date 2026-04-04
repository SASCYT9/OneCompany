'use client';

import { useEffect, useRef } from 'react';

/**
 * BrabusThemeScript – scroll‑driven animations for the Brabus "Stealth‑Red" storefront.
 *
 * Features:
 *   • Hero parallax (subtle vertical shift)
 *   • IntersectionObserver fade‑up reveals (`[data-br-reveal]`)
 *   • Horizontal snap‑scroll progress dots for the Showcases carousel
 *   • Counter animation for stats
 */
export default function BrabusThemeScript() {
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const RM = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ── 1. Reveal on scroll ────────────────────────────── */
    const revealObs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            (e.target as HTMLElement).classList.add('br-vis');
            revealObs.unobserve(e.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: '0px 0px -40px 0px' }
    );
    document.querySelectorAll('[data-br-reveal]').forEach((el) => revealObs.observe(el));

    /* ── 2. Hero parallax ───────────────────────────────── */
    if (!RM) {
      const heroMedia = document.querySelector('[data-br-parallax]') as HTMLElement | null;
      let ticking = false;
      const onScroll = () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
          if (heroMedia) {
            const sy = window.scrollY;
            heroMedia.style.transform = `translateY(${sy * 0.25}px) scale(1.08)`;
          }
          ticking = false;
        });
      };
      window.addEventListener('scroll', onScroll, { passive: true });
    }

    /* ── 3. Counter animation — removed (stats bar deleted) ── */

    /* ── 4. Horizontal scroll progress for showcases ───── */
    const scroller = document.querySelector('[data-br-hscroll]') as HTMLElement | null;
    const dots = document.querySelectorAll('[data-br-dot]');
    if (scroller && dots.length > 0) {
      const updateDots = () => {
        const { scrollLeft, scrollWidth, clientWidth } = scroller;
        const maxScroll = scrollWidth - clientWidth;
        if (maxScroll <= 0) return;
        const ratio = scrollLeft / maxScroll;
        const activeIdx = Math.round(ratio * (dots.length - 1));
        dots.forEach((d, i) => {
          (d as HTMLElement).classList.toggle('active', i === activeIdx);
        });
      };
      
      dots.forEach((d, i) => {
        d.addEventListener('click', () => {
          const cardWidth = scroller.querySelector('.br-sc')?.clientWidth || 0;
          const gap = 24; // 1.5rem
          scroller.scrollTo({
            left: i * (cardWidth + gap),
            behavior: 'smooth'
          });
        });
      });

      scroller.addEventListener('scroll', updateDots, { passive: true });
      updateDots();
    }

    /* ── 5. Fleet card hover red‑line animation ────────── */
    document.querySelectorAll('[data-br-fleet-card]').forEach((card) => {
      const line = card.querySelector('.br-fleet__line') as HTMLElement | null;
      if (!line) return;
      card.addEventListener('mouseenter', () => { line.style.width = '100%'; });
      card.addEventListener('mouseleave', () => { line.style.width = '0'; });
    });
  }, []);

  return null;
}

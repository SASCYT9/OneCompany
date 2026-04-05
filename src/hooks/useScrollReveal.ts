'use client';

import { useEffect, MutableRefObject } from 'react';

/**
 * A highly optimized generic hook for revealing elements on scroll.
 * Applies the given CSS class to elements matching the selector
 * when they enter the viewport.
 */
export function useScrollReveal(
  selector: string = '[data-reveal]',
  revealClass: string = 'vis',
  threshold: number = 0.12,
  containerRef?: MutableRefObject<HTMLElement | null>
) {
  useEffect(() => {
    // Determine the root context to search within (defaults to document)
    const root = containerRef?.current || document;
    const elements = root.querySelectorAll(selector);

    if (!elements || elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add(revealClass);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold }
    );

    elements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [selector, revealClass, threshold, containerRef]);
}

'use client';

import { useEffect, MutableRefObject } from 'react';

/**
 * A performance-focused hook for rendering canvas animations (`requestAnimationFrame`).
 * The animation loop automatically pauses when the canvas is scrolled out of the viewport. 
 */
export function useOptimizedCanvas(
  canvasRef: MutableRefObject<HTMLCanvasElement | null>,
  renderCallback: (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => void
) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let animationFrameId: number;
    let isVisible = false;

    // The main render loop
    const render = () => {
      if (isVisible) {
        renderCallback(ctx, canvas);
        animationFrameId = window.requestAnimationFrame(render);
      }
    };

    // The intersection observer determines if we should be rendering
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        isVisible = entry.isIntersecting;

        if (isVisible) {
          // Restart animation loop if entering view
          animationFrameId = window.requestAnimationFrame(render);
        } else {
          // Cancel the loop when leaving view to save CPU/GPU/Battery
          if (animationFrameId) {
            window.cancelAnimationFrame(animationFrameId);
          }
        }
      },
      {
        rootMargin: '100% 0px 100% 0px', // Start rendering slightly before it enters view
        threshold: 0,
      }
    );

    observer.observe(canvas);

    // Initial resize handler
    const setSize = () => {
      // Handle high-DPI displays appropriately if needed, but for particle engines 
      // standard pixel ratio is usually fine to prevent exponential slowdown.
      canvas.width = canvas.parentElement?.clientWidth || window.innerWidth;
      canvas.height = canvas.parentElement?.clientHeight || window.innerHeight;
    };
    setSize();
    
    // Add simple debounce for window resize
    let resizeTimeout: NodeJS.Timeout;
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(setSize, 200);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', handleResize);
      if (animationFrameId) {
        window.cancelAnimationFrame(animationFrameId);
      }
    };
  }, [canvasRef, renderCallback]);
}

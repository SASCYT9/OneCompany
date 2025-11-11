'use client';

import { useEffect, useRef } from 'react';

export default function MagicCursor() {
  const cursorRef = useRef<HTMLDivElement>(null);
  const trailRefs = useRef<HTMLDivElement[]>([]);

  useEffect(() => {
    // Only run this effect on the client
    if (typeof window === 'undefined') {
      return;
    }

    const cursor = cursorRef.current;
    if (!cursor) return;

    let mouseX = 0;
    let mouseY = 0;
    let cursorX = 0;
    let cursorY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    };

    const animate = () => {
      // Smooth cursor follow
      cursorX += (mouseX - cursorX) * 0.15;
      cursorY += (mouseY - cursorY) * 0.15;

      if (cursor) {
        cursor.style.transform = `translate(${cursorX}px, ${cursorY}px)`;
      }

      // Trail effect
      trailRefs.current.forEach((trail, index) => {
        if (trail) {
          const delay = (index + 1) * 0.05;
          const trailX = cursorX + (mouseX - cursorX) * delay;
          const trailY = cursorY + (mouseY - cursorY) * delay;
          trail.style.transform = `translate(${trailX}px, ${trailY}px) scale(${1 - index * 0.15})`;
          trail.style.opacity = String(1 - index * 0.2);
        }
      });

      requestAnimationFrame(animate);
    };

    window.addEventListener('mousemove', handleMouseMove);
    const animationFrameId = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <>
      {/* Main cursor */}
      <div
        ref={cursorRef}
        className="fixed w-6 h-6 pointer-events-none z-[9999] mix-blend-difference"
        style={{
          left: -12,
          top: -12,
        }}
      >
        <div className="w-full h-full rounded-full border border-white/60" />
      </div>

      {/* Trail cursors */}
      {[...Array(5)].map((_, i) => (
        <div
          key={i}
          ref={(el) => {
            if (el) trailRefs.current[i] = el;
          }}
          className="fixed w-6 h-6 pointer-events-none z-[9998] mix-blend-difference"
          style={{
            left: -12,
            top: -12,
          }}
        >
          <div className="w-full h-full rounded-full border border-white/30" />
        </div>
      ))}
    </>
  );
}

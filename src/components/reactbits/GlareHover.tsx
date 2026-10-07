"use client";

// Adapted from React Bits "Glare Hover" (https://reactbits.dev/animations/glare-hover).
// Sizing and surface come from the caller's classes; the glare is a sweep of
// a soft diagonal highlight across the content on pointer enter.

import { useRef, type ReactNode } from "react";

type GlareHoverProps = {
  children?: ReactNode;
  className?: string;
  glareColor?: string;
  glareAngle?: number;
  glareSize?: number;
  transitionDuration?: number;
  disabled?: boolean;
};

export default function GlareHover({
  children,
  className = "",
  glareColor = "rgba(255, 255, 255, 0.55)",
  glareAngle = -45,
  glareSize = 250,
  transitionDuration = 800,
  disabled = false,
}: GlareHoverProps) {
  const overlayRef = useRef<HTMLSpanElement | null>(null);

  const sweep = (to: string, animate: boolean) => {
    const el = overlayRef.current;
    if (!el || disabled) return;
    el.style.transition = animate ? `background-position ${transitionDuration}ms ease` : "none";
    el.style.backgroundPosition = to;
  };

  return (
    <span
      className={`relative block overflow-hidden ${className}`}
      onPointerEnter={() => {
        sweep("-100% -100%", false);
        // Force the reset to apply before animating across.
        void overlayRef.current?.offsetWidth;
        sweep("100% 100%", true);
      }}
      onPointerLeave={() => sweep("-100% -100%", true)}
    >
      {children}
      <span
        ref={overlayRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-10"
        style={{
          background: `linear-gradient(${glareAngle}deg, transparent 60%, ${glareColor} 70%, transparent 100%)`,
          backgroundSize: `${glareSize}% ${glareSize}%`,
          backgroundRepeat: "no-repeat",
          backgroundPosition: "-100% -100%",
        }}
      />
    </span>
  );
}

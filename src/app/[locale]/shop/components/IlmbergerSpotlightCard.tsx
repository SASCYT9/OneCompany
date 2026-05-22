/**
 * Adapted from reactbits.dev (MIT + Commons Clause).
 * Source: https://github.com/DavidHDev/react-bits/tree/main/src/ts-tailwind/Components/SpotlightCard
 *
 * Per-card chrome spotlight glow following the cursor. Used as a wrapper
 * around `.il-card` product cards in the catalog grid. Subtle radial
 * gradient appears on hover/focus and tracks the mouse position.
 *
 * Adapted: dropped tailwind-only chrome (the parent already styles itself),
 * exposed `as` prop so it can render <article>, <a>, <div> etc.
 */

"use client";

import React, { useRef, useState } from "react";

interface Position {
  x: number;
  y: number;
}

interface IlmbergerSpotlightCardProps extends React.PropsWithChildren {
  className?: string;
  /** rgba() preferred. Defaults to subtle chrome glow. */
  spotlightColor?: string;
  /** Maximum spotlight opacity at hover. Default 0.6. */
  intensity?: number;
}

const IlmbergerSpotlightCard: React.FC<IlmbergerSpotlightCardProps> = ({
  children,
  className = "",
  spotlightColor = "rgba(192, 200, 208, 0.18)",
  intensity = 0.6,
}) => {
  const divRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [position, setPosition] = useState<Position>({ x: 0, y: 0 });
  const [opacity, setOpacity] = useState(0);

  const handleMouseMove: React.MouseEventHandler<HTMLDivElement> = (e) => {
    if (!divRef.current || isFocused) return;
    const rect = divRef.current.getBoundingClientRect();
    setPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const handleFocus = () => {
    setIsFocused(true);
    setOpacity(intensity);
  };

  const handleBlur = () => {
    setIsFocused(false);
    setOpacity(0);
  };

  const handleMouseEnter = () => setOpacity(intensity);
  const handleMouseLeave = () => setOpacity(0);

  return (
    <div
      ref={divRef}
      onMouseMove={handleMouseMove}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`relative ${className}`}
      style={{ isolation: "isolate" }}
    >
      <div
        aria-hidden
        className="il-spotlight-overlay"
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          zIndex: 10,
          opacity,
          transition: "opacity 0.5s ease-in-out",
          willChange: "opacity, background",
          background: `radial-gradient(circle at ${position.x}px ${position.y}px, ${spotlightColor}, transparent 70%)`,
        }}
      />
      {children}
    </div>
  );
};

export default IlmbergerSpotlightCard;

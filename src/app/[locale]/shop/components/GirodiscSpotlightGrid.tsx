"use client";

import { useRef } from "react";

/**
 * A wrapper grid that casts a subtle glassmorphism "spotlight"
 * light over all interactive cards inside it when moving the mouse.
 */
export default function GirodiscSpotlightGrid({
  children,
  className = "",
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    containerRef.current.style.setProperty("--mouse-x", `${e.clientX - rect.left}px`);
    containerRef.current.style.setProperty("--mouse-y", `${e.clientY - rect.top}px`);
  };

  const handleMouseEnter = () => {
    if (!containerRef.current) return;
    containerRef.current.style.setProperty("--spotlight-opacity", "1");
  };

  const handleMouseLeave = () => {
    if (!containerRef.current) return;
    containerRef.current.style.setProperty("--spotlight-opacity", "0");
  };

  return (
    <div
      ref={containerRef}
      className={`relative group ${className}`}
      style={
        {
          ...style,
          "--mouse-x": "0px",
          "--mouse-y": "0px",
          "--spotlight-opacity": "0",
        } as React.CSSProperties
      }
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div
        className="pointer-events-none absolute inset-0 z-10 transition duration-500 will-change-[background]"
        style={{
          opacity: "var(--spotlight-opacity)",
          background:
            "radial-gradient(800px circle at var(--mouse-x) var(--mouse-y), rgba(220,38,38,0.06), transparent 40%)",
        }}
      />
      {children}
    </div>
  );
}

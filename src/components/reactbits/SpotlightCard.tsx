"use client";

// Adapted from React Bits "Spotlight Card" (https://reactbits.dev/components/spotlight-card).
// The pointer position is written to CSS variables instead of React state, so
// hovering a grid of hundreds of cards never re-renders them.

import type { CSSProperties, HTMLAttributes, PointerEvent } from "react";

type SpotlightCardProps = HTMLAttributes<HTMLDivElement> & {
  /** Any CSS colour; a soft white works on dark cards, a soft black on light ones. */
  spotlightColor?: string;
  /** Optional second colour used under `.dark`. */
  darkSpotlightColor?: string;
};

function trackPointer(event: PointerEvent<HTMLDivElement>) {
  const rect = event.currentTarget.getBoundingClientRect();
  event.currentTarget.style.setProperty("--spot-x", `${event.clientX - rect.left}px`);
  event.currentTarget.style.setProperty("--spot-y", `${event.clientY - rect.top}px`);
}

export default function SpotlightCard({
  spotlightColor = "rgba(0, 0, 0, 0.05)",
  darkSpotlightColor = "rgba(255, 255, 255, 0.07)",
  className = "",
  style,
  children,
  onPointerMove,
  ...rest
}: SpotlightCardProps) {
  return (
    <div
      {...rest}
      onPointerMove={(event) => {
        trackPointer(event);
        onPointerMove?.(event);
      }}
      className={`group/spotlight relative isolate ${className}`}
      style={
        {
          ...style,
          "--spot-color": spotlightColor,
          "--spot-color-dark": darkSpotlightColor,
        } as CSSProperties
      }
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 rounded-[inherit] opacity-0 transition-opacity duration-500 ease-out group-hover/spotlight:opacity-100 bg-[radial-gradient(420px_circle_at_var(--spot-x,50%)_var(--spot-y,50%),var(--spot-color),transparent_65%)] dark:bg-[radial-gradient(420px_circle_at_var(--spot-x,50%)_var(--spot-y,50%),var(--spot-color-dark),transparent_65%)]"
      />
      {children}
    </div>
  );
}

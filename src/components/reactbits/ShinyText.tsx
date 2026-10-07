"use client";

// Adapted from React Bits "Shiny Text" (https://reactbits.dev/text-animations/shiny-text).
// Uses the project's framer-motion (same API as motion/react).

import { motion, useAnimationFrame, useMotionValue, useTransform } from "framer-motion";
import { useRef } from "react";

type ShinyTextProps = {
  text: string;
  disabled?: boolean;
  /** Seconds for one pass of the shine. */
  speed?: number;
  /** Seconds of rest between passes. */
  delay?: number;
  className?: string;
  color?: string;
  shineColor?: string;
  spread?: number;
};

export default function ShinyText({
  text,
  disabled = false,
  speed = 2.4,
  delay = 2.6,
  className = "",
  color = "#b5b5b5",
  shineColor = "#ffffff",
  spread = 120,
}: ShinyTextProps) {
  const progress = useMotionValue(0);
  const elapsed = useRef(0);
  const last = useRef<number | null>(null);

  useAnimationFrame((time) => {
    if (disabled) {
      last.current = null;
      return;
    }
    if (last.current === null) {
      last.current = time;
      return;
    }
    elapsed.current += time - last.current;
    last.current = time;
    const run = speed * 1000;
    const cycle = elapsed.current % (run + delay * 1000);
    progress.set(cycle < run ? (cycle / run) * 100 : 100);
  });

  const backgroundPosition = useTransform(progress, (p) => `${150 - p * 2}% center`);

  return (
    <motion.span
      className={`inline-block ${className}`}
      style={{
        backgroundImage: `linear-gradient(${spread}deg, ${color} 0%, ${color} 35%, ${shineColor} 50%, ${color} 65%, ${color} 100%)`,
        backgroundSize: "200% auto",
        WebkitBackgroundClip: "text",
        backgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundPosition: disabled ? "150% center" : backgroundPosition,
      }}
    >
      {text}
    </motion.span>
  );
}

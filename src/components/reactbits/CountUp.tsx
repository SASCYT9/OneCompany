"use client";

// Adapted from React Bits "Count Up" (https://reactbits.dev/text-animations/count-up).
// Shows the real value immediately (no "0" flash, no dependence on viewport
// visibility) and glides to the new total whenever `to` changes while the
// number is on screen.

import { useInView, useMotionValue, useSpring } from "framer-motion";
import { useEffect, useRef } from "react";

type CountUpProps = {
  to: number;
  /** Seconds; controls spring stiffness. */
  duration?: number;
  className?: string;
  /** BCP 47 locale used for digit grouping, e.g. "uk-UA" or "en-US". */
  locale?: string;
  disabled?: boolean;
};

export default function CountUp({
  to,
  duration = 1.1,
  className = "",
  locale = "en-US",
  disabled = false,
}: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const motionValue = useMotionValue(to);
  const spring = useSpring(motionValue, {
    damping: 20 + 40 * (1 / duration),
    stiffness: 100 * (1 / duration),
  });
  const inView = useInView(ref);

  const format = (value: number) =>
    Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(Math.round(value));

  useEffect(() => {
    if (disabled || !inView) {
      motionValue.jump(to);
      spring.jump(to);
      if (ref.current) ref.current.textContent = format(to);
      return;
    }
    motionValue.set(to);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled, inView, to, locale]);

  useEffect(
    () =>
      spring.on("change", (latest) => {
        if (ref.current) ref.current.textContent = format(latest);
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [spring, locale]
  );

  return (
    <span ref={ref} className={`tabular-nums ${className}`}>
      {format(to)}
    </span>
  );
}

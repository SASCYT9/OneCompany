"use client";

// Adapted from React Bits "Count Up" (https://reactbits.dev/text-animations/count-up).
// Re-animates from the current value whenever `to` changes, so a filtered
// product count glides to its new total instead of jumping.

import { useInView, useMotionValue, useSpring } from "framer-motion";
import { useEffect, useRef } from "react";

type CountUpProps = {
  to: number;
  from?: number;
  /** Seconds; controls spring stiffness. */
  duration?: number;
  className?: string;
  /** Thousands separator, e.g. a narrow space for Ukrainian. */
  separator?: string;
  disabled?: boolean;
};

export default function CountUp({
  to,
  from = 0,
  duration = 1.1,
  className = "",
  separator = " ",
  disabled = false,
}: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const motionValue = useMotionValue(disabled ? to : from);
  const spring = useSpring(motionValue, {
    damping: 20 + 40 * (1 / duration),
    stiffness: 100 * (1 / duration),
  });
  const inView = useInView(ref, { once: true, margin: "0px" });

  const format = (value: number) =>
    Intl.NumberFormat("en-US", { maximumFractionDigits: 0 })
      .format(Math.round(value))
      .replace(/,/g, separator);

  useEffect(() => {
    if (disabled) {
      motionValue.jump(to);
      spring.jump(to);
      if (ref.current) ref.current.textContent = format(to);
      return;
    }
    if (inView) motionValue.set(to);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled, inView, to]);

  useEffect(
    () =>
      spring.on("change", (latest) => {
        if (ref.current) ref.current.textContent = format(latest);
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [spring, separator]
  );

  return (
    <span ref={ref} className={`tabular-nums ${className}`}>
      {format(disabled ? to : from)}
    </span>
  );
}

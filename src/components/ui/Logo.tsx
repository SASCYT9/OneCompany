import React from 'react';
import Link from 'next/link';

type Props = {
  className?: string;
  asLink?: boolean;
};

/**
 * Minimal, uppercase logotype: "ONE COMPANY" with generous tracking.
 * Matches the provided reference (clean, bold, white on dark/video background).
 */
export function Logo({ className = '', asLink = false }: Props) {
  const content = (
    <span
      className={
        "select-none text-white tracking-[0.32em] uppercase leading-none font-semibold " +
        "[text-shadow:0_1px_0_rgba(0,0,0,0.3),0_4px_24px_rgba(0,0,0,0.35)] " +
        className
      }
    >
      ONE COMPANY
    </span>
  );

  if (asLink) {
    return (
      <Link href="/" className="inline-block focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40">
        {content}
      </Link>
    );
  }

  return content;
}

export default Logo;

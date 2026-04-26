'use client';

import { useState } from 'react';

import { cn } from '@/lib/utils';

type Size = 'sm' | 'md' | 'lg';

const SIZE_CLASS: Record<Size, string> = {
  sm: 'h-11 w-11',
  md: 'h-[60px] w-[60px]',
  lg: 'h-[72px] w-[72px]',
};

const FONT_SIZE_CLASS: Record<Size, string> = {
  sm: 'text-sm',
  md: 'text-lg',
  lg: 'text-xl',
};

function getInitials(...candidates: Array<string | null | undefined>): string {
  for (const candidate of candidates) {
    if (!candidate) continue;
    const trimmed = candidate.trim();
    if (!trimmed) continue;
    const parts = trimmed.split(/\s+/).filter(Boolean);
    if (parts.length === 0) continue;
    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase();
    }
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return '—';
}

function pickGradient(seed: string): { from: string; to: string } {
  // Deterministic pleasant gradient from a string seed.
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  const hue1 = Math.abs(hash) % 360;
  const hue2 = (hue1 + 35) % 360;
  return {
    from: `hsla(${hue1}, 32%, 28%, 0.85)`,
    to: `hsla(${hue2}, 28%, 14%, 0.95)`,
  };
}

export function AdminProductThumbnail({
  imageUrl,
  brand,
  title,
  size = 'md',
  tintHex,
  className,
}: {
  imageUrl?: string | null;
  brand?: string | null;
  title?: string | null;
  size?: Size;
  /** Optional brand tint to colorize the placeholder (overrides hash-based gradient). */
  tintHex?: string;
  className?: string;
}) {
  const [errored, setErrored] = useState(false);
  const initials = getInitials(brand, title);
  const seed = (brand || title || 'oc-product').toString();
  const gradient = pickGradient(seed);
  const fallbackBg = tintHex
    ? `linear-gradient(135deg, ${tintHex}33 0%, ${tintHex}10 100%)`
    : `linear-gradient(135deg, ${gradient.from} 0%, ${gradient.to} 100%)`;
  const showImage = Boolean(imageUrl) && !errored;

  return (
    <div
      className={cn(
        'admin-product-thumb relative shrink-0 overflow-hidden rounded-none border border-white/[0.08] bg-[#0A0A0A]',
        'shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]',
        SIZE_CLASS[size],
        className
      )}
      aria-hidden={!imageUrl}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl as string}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setErrored(true)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center"
          style={{ backgroundImage: fallbackBg }}
        >
          <span
            className={cn(
              'font-semibold tracking-[0.04em] text-white/85',
              FONT_SIZE_CLASS[size]
            )}
            style={tintHex ? { color: tintHex } : undefined}
          >
            {initials}
          </span>
        </div>
      )}
      <div className="pointer-events-none absolute inset-0 rounded-none shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]" />
    </div>
  );
}

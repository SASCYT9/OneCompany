"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

import {
  brandLogoNeedsContrastLift,
  brandLogoNeedsInvert,
  brandLogoNeedsLightInvert,
  brandLogoNeedsLightOutline,
  brandLogoNeedsWideBoost,
  getBrandLightLogoPath,
  getBrandLogoBackdropClass,
} from "@/lib/shopBrandLogos";

const TILE_SIZES = {
  xs: { box: "h-6 w-[72px]", image: "max-h-5 max-w-[72px]", text: "text-[8px]" },
  sm: { box: "h-6 w-[76px]", image: "max-h-5 max-w-[76px]", text: "text-[8px]" },
  md: { box: "h-8 w-24", image: "max-h-7 max-w-24", text: "text-[8px]" },
  lg: { box: "h-9 w-28", image: "max-h-8 max-w-28", text: "text-[8px]" },
  // Product pages: the image hugs the mark, so it lines up with the title below.
  xl: { box: "h-12 max-w-40", image: "h-auto w-auto max-h-11 max-w-40", text: "text-xs" },
} as const;

/** A brand's logo in the shop's catalogue and product pages, with a text fallback. */
export function BrandLogoTile({
  brandName,
  logoPath,
  size = "sm",
  className = "",
  decorative = false,
}: {
  brandName: string;
  logoPath: string | null;
  size?: keyof typeof TILE_SIZES;
  className?: string;
  decorative?: boolean;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [logoPath]);

  if (!logoPath) return null;

  const needsContrastLift = brandLogoNeedsContrastLift(brandName);
  const needsInvert = brandLogoNeedsInvert(brandName);
  const needsLightInvert = brandLogoNeedsLightInvert(brandName);
  const needsLightOutline = brandLogoNeedsLightOutline(brandName);
  const needsWideBoost = brandLogoNeedsWideBoost(brandName);
  const logoBackdropClass = getBrandLogoBackdropClass(brandName);
  const lightThemeLogoPath = getBrandLightLogoPath(brandName, logoPath);
  const hasThemeSpecificLogo = lightThemeLogoPath !== logoPath;
  const { box: sizeClass, image: imageSizeClass, text: fallbackTextClass } = TILE_SIZES[size];
  const imageWidth = size === "xl" ? 160 : 112;
  const imageHeight = size === "xl" ? 48 : 36;
  const logoFilterClass = needsInvert
    ? "[filter:brightness(0.88)_contrast(1.12)_drop-shadow(0_1px_1px_rgba(0,0,0,0.2))] dark:[filter:invert(1)_brightness(1.08)_contrast(1.1)_drop-shadow(0_1px_2px_rgba(0,0,0,0.65))]"
    : needsLightInvert
      ? "[filter:invert(1)_brightness(0.72)_contrast(1.25)_drop-shadow(0_1px_1px_rgba(0,0,0,0.16))] dark:[filter:drop-shadow(0_1px_2px_rgba(0,0,0,0.62))]"
      : needsLightOutline
        ? "[filter:drop-shadow(1px_0_0_rgba(0,0,0,0.5))_drop-shadow(-1px_0_0_rgba(0,0,0,0.5))_drop-shadow(0_1px_0_rgba(0,0,0,0.5))_drop-shadow(0_-1px_0_rgba(0,0,0,0.5))] dark:[filter:drop-shadow(0_0_1px_rgba(255,255,255,0.72))_drop-shadow(0_0_7px_rgba(255,255,255,0.16))_drop-shadow(0_1px_2px_rgba(0,0,0,0.7))_brightness(1.08)_contrast(1.18)]"
        : needsContrastLift
          ? "[filter:drop-shadow(0_1px_1px_rgba(0,0,0,0.2))_brightness(0.98)_contrast(1.12)] dark:[filter:drop-shadow(0_0_1px_rgba(255,255,255,0.72))_drop-shadow(0_0_7px_rgba(255,255,255,0.16))_drop-shadow(0_1px_2px_rgba(0,0,0,0.7))_brightness(1.08)_contrast(1.18)]"
          : "[filter:drop-shadow(0_1px_1px_rgba(0,0,0,0.2))] dark:[filter:drop-shadow(0_1px_2px_rgba(0,0,0,0.62))]";
  const imageScaleClass = needsWideBoost && size !== "xs" ? "scale-[1.1]" : "scale-100";

  if (failed) {
    return (
      <span
        className={`flex shrink-0 items-center justify-start overflow-hidden ${sizeClass} ${className}`}
        title={brandName}
        aria-hidden={decorative || undefined}
      >
        <span
          className={`max-w-full truncate ${fallbackTextClass} font-semibold uppercase tracking-[0.08em] text-foreground/65`}
        >
          {brandName}
        </span>
      </span>
    );
  }

  return (
    <span
      className={`relative flex shrink-0 items-center ${size === "xs" ? "justify-center" : "justify-start"} overflow-visible ${sizeClass} ${className}`}
      title={brandName}
      aria-hidden={decorative || undefined}
    >
      <Image
        src={lightThemeLogoPath}
        alt={decorative ? "" : brandName}
        width={imageWidth}
        height={imageHeight}
        unoptimized
        className={`relative ${imageSizeClass} origin-left object-contain opacity-100 transition duration-200 ${imageScaleClass} ${logoFilterClass} ${logoBackdropClass} ${
          hasThemeSpecificLogo ? "dark:hidden" : ""
        }`}
        onError={() => setFailed(true)}
      />
      {hasThemeSpecificLogo ? (
        <Image
          src={logoPath}
          alt={decorative ? "" : brandName}
          width={imageWidth}
          height={imageHeight}
          unoptimized
          className={`relative hidden ${imageSizeClass} origin-left object-contain opacity-100 transition duration-200 dark:block ${imageScaleClass} ${logoFilterClass} ${logoBackdropClass}`}
          onError={() => setFailed(true)}
        />
      ) : null}
    </span>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { findCarBySlug } from "@/lib/forged/carLibrary";
import { getForgedCarRenderUrl } from "@/lib/forged/renderMatrix";
import { findForgedDesign, getForgedDesignVisual } from "@/data/forgedDesigns";
import { useForgedConfig } from "./store";
import type { SupportedLocale } from "@/lib/seo";

type Props = { locale: SupportedLocale };

const PREVIEW_ASPECT = 16 / 10;
const DEFAULT_BACKDROP_ASPECT = 16 / 9;
const WHEEL_FIT = 198;

type WheelMask = { x: number; y: number; r: number };

function coverWheelMask(mask: WheelMask, sourceAspect: number, containerAspect: number) {
  if (sourceAspect > containerAspect) {
    const renderedWidth = sourceAspect / containerAspect;
    const cropX = (renderedWidth - 1) / 2;
    return {
      xPct: (mask.x * renderedWidth - cropX) * 100,
      yPct: mask.y * 100,
      sizePct: mask.r * WHEEL_FIT * renderedWidth,
    };
  }

  const renderedHeight = containerAspect / sourceAspect;
  const cropY = (renderedHeight - 1) / 2;
  return {
    xPct: mask.x * 100,
    yPct: (mask.y * renderedHeight - cropY) * 100,
    sizePct: mask.r * WHEEL_FIT,
  };
}

/**
 * Image-based preview composite.
 *
 * Layer 1: car backdrop (from library entry, uploaded photo, or studio gradient).
 * Layer 2: a transparent-PNG photo of the configured wheel, positioned at
 *          the front and rear wheel-mask coords (or centred for "none" mode).
 *
 * No 3D, no Suspense. We trust real product photography over a
 * procedural mesh — the brand has actual studio shots that read more
 * authentically than a parametric stand-in.
 *
 * Tinting hint: when the customer dials in a colour, we apply a CSS
 * `mix-blend-mode: multiply` overlay on the wheel image. This is a
 * lightweight visual hint, NOT a colour-accurate render — final colour
 * is confirmed by the engineer in the manual quote.
 */
export default function ConfiguratorPreview({ locale }: Props) {
  const isUa = locale === "ua";
  const previewMode = useForgedConfig((s) => s.config.carPreviewMode);
  const carLibrarySlug = useForgedConfig((s) => s.config.carLibrarySlug);
  const carPhotoUrl = useForgedConfig((s) => s.config.carPhotoUrl);
  const designSlug = useForgedConfig((s) => s.config.designSlug);
  const material = useForgedConfig((s) => s.config.material);
  const finish = useForgedConfig((s) => s.config.finish);
  const primaryColor = useForgedConfig((s) => s.config.primaryColor);
  const previewRef = useRef<HTMLDivElement>(null);
  const [previewAspect, setPreviewAspect] = useState(PREVIEW_ASPECT);
  const [backdropAspect, setBackdropAspect] = useState(DEFAULT_BACKDROP_ASPECT);
  const [missingRenderUrls, setMissingRenderUrls] = useState<Set<string>>(() => new Set());

  const car = carLibrarySlug ? findCarBySlug(carLibrarySlug) : undefined;
  const design = findForgedDesign(designSlug);
  const wheelImg = design
    ? getForgedDesignVisual(design, material).wheelTransparentImage
    : undefined;

  const onLibraryCar = previewMode === "library" && car;
  const onUploadedCar = previewMode === "upload" && carPhotoUrl;
  const backdrop = onLibraryCar ? car.photoUrl : onUploadedCar ? carPhotoUrl : null;
  const baseCarRenderUrl =
    onLibraryCar && design ? getForgedCarRenderUrl(car.slug, design.slug, material) : undefined;
  const carRenderUrl = baseCarRenderUrl;
  const hasGeneratedCarRender = Boolean(carRenderUrl && !missingRenderUrls.has(carRenderUrl));
  const frontWheelMask = onLibraryCar
    ? coverWheelMask(car.wheelMaskFront, backdropAspect, previewAspect)
    : undefined;
  const rearWheelMask = onLibraryCar
    ? coverWheelMask(car.wheelMaskRear, backdropAspect, previewAspect)
    : undefined;

  useEffect(() => {
    const node = previewRef.current;
    if (!node) return;

    const updateAspect = () => {
      const rect = node.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setPreviewAspect(rect.width / rect.height);
      }
    };

    updateAspect();
    const observer = new ResizeObserver(updateAspect);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setBackdropAspect(DEFAULT_BACKDROP_ASPECT);
  }, [backdrop]);

  // Probe whether the wheel asset actually exists. If not (placeholder
  // path, file not delivered yet), we fall back to a CSS silhouette so
  // the preview still reads as something rather than a broken image.
  const [wheelOk, setWheelOk] = useState(false);
  useEffect(() => {
    if (!wheelImg) {
      setWheelOk(false);
      return;
    }
    let alive = true;
    const img = new Image();
    img.onload = () => {
      if (alive) setWheelOk(true);
    };
    img.onerror = () => {
      if (alive) setWheelOk(false);
    };
    img.src = wheelImg;
    return () => {
      alive = false;
    };
  }, [wheelImg]);

  return (
    <div
      ref={previewRef}
      className="relative aspect-[16/10] w-full overflow-hidden rounded-2xl border border-white/10 bg-[#0c0d10]"
    >
      {/* Backdrop */}
      {hasGeneratedCarRender && carRenderUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={carRenderUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          onError={() => {
            setMissingRenderUrls((current) => {
              const next = new Set(current);
              next.add(carRenderUrl);
              return next;
            });
          }}
        />
      ) : backdrop ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={backdrop}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          onLoad={(event) => {
            const image = event.currentTarget;
            if (image.naturalWidth > 0 && image.naturalHeight > 0) {
              setBackdropAspect(image.naturalWidth / image.naturalHeight);
            }
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,#1a1c20_0%,#08090b_70%)]" />
      )}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#08090b]/40 via-transparent to-[#08090b]/30" />

      {/* Wheel composites */}
      {onLibraryCar && carRenderUrl && missingRenderUrls.has(carRenderUrl) ? (
        <div className="absolute inset-x-6 bottom-5 rounded-xl border border-white/10 bg-[#08090b]/75 px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-white/65 backdrop-blur">
          {isUa
            ? "Фоторендер для цієї комбінації ще не згенеровано"
            : "Photo render pending for this combination"}
        </div>
      ) : onLibraryCar && hasGeneratedCarRender ? null : !hasGeneratedCarRender &&
        onLibraryCar &&
        car ? (
        <>
          <Wheel
            xPct={frontWheelMask?.xPct ?? 0}
            yPct={frontWheelMask?.yPct ?? 0}
            sizePct={frontWheelMask?.sizePct ?? 0}
            wheelImg={wheelImg}
            wheelOk={wheelOk}
            tintColor={primaryColor}
            finish={finish}
            onCar
          />
          <Wheel
            xPct={rearWheelMask?.xPct ?? 0}
            yPct={rearWheelMask?.yPct ?? 0}
            sizePct={rearWheelMask?.sizePct ?? 0}
            wheelImg={wheelImg}
            wheelOk={wheelOk}
            tintColor={primaryColor}
            finish={finish}
            onCar
          />
        </>
      ) : onUploadedCar ? (
        // Uploaded photo: we can't know wheel-arch coords automatically
        // on MVP, so render two wheels centred horizontally as a hint —
        // operator will composite the real shot in the quote response.
        <>
          <Wheel
            xPct={28}
            yPct={70}
            sizePct={22}
            wheelImg={wheelImg}
            wheelOk={wheelOk}
            tintColor={primaryColor}
            finish={finish}
            onCar
          />
          <Wheel
            xPct={72}
            yPct={70}
            sizePct={22}
            wheelImg={wheelImg}
            wheelOk={wheelOk}
            tintColor={primaryColor}
            finish={finish}
            onCar
          />
        </>
      ) : (
        <Wheel
          xPct={50}
          yPct={50}
          sizePct={62}
          wheelImg={wheelImg}
          wheelOk={wheelOk}
          tintColor={primaryColor}
          finish={finish}
          centered
        />
      )}

      {/* Mode label */}
      <div className="absolute left-4 top-4 rounded-full bg-[#08090b]/70 px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] text-white/70 backdrop-blur">
        {previewMode === "library"
          ? car
            ? `${car.make} ${car.model}`
            : isUa
              ? "Оберіть авто"
              : "Pick a car"
          : previewMode === "upload"
            ? carPhotoUrl
              ? isUa
                ? "Ваше фото"
                : "Your photo"
              : isUa
                ? "Завантажте фото"
                : "Upload a photo"
            : isUa
              ? "Студія"
              : "Studio"}
      </div>

      {/* Asset hint when wheel image is missing */}
      {!onLibraryCar && !wheelOk && (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
          <p className="rounded-full bg-[#08090b]/70 px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] text-white/50 backdrop-blur">
            {isUa ? "Фото диска ще не завантажено" : "Wheel photo not yet uploaded"}
          </p>
        </div>
      )}
    </div>
  );
}

function Wheel({
  xPct,
  yPct,
  sizePct,
  wheelImg,
  wheelOk,
  tintColor,
  finish,
  centered,
  onCar,
}: {
  xPct: number;
  yPct: number;
  /** Diameter as percent of preview width. */
  sizePct: number;
  wheelImg?: string;
  wheelOk: boolean;
  tintColor: string;
  finish: string;
  centered?: boolean;
  onCar?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const wheelFilter = onCar ? "brightness(0.9) contrast(0.98) saturate(0.92)" : undefined;
  return (
    <div
      ref={ref}
      className="absolute"
      style={{
        left: `${xPct}%`,
        top: `${yPct}%`,
        width: `${sizePct}%`,
        aspectRatio: "1 / 1",
        transform: "translate(-50%, -50%)",
        animation: centered ? "forged-spin 24s linear infinite" : undefined,
      }}
    >
      {wheelOk && wheelImg ? (
        <div className="relative h-full w-full">
          {onCar && (
            <>
              <div className="absolute -inset-[3%] rounded-full bg-[#020304] shadow-[inset_0_0_28px_rgba(255,255,255,0.05),0_16px_24px_rgba(0,0,0,0.68)]" />
              <div className="absolute -inset-[1%] rounded-full border-[3px] border-black/70" />
            </>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={wheelImg}
            alt=""
            className={
              onCar
                ? "relative h-full w-full object-contain drop-shadow-[0_13px_22px_rgba(0,0,0,0.72)]"
                : "relative h-full w-full object-contain drop-shadow-[0_18px_30px_rgba(0,0,0,0.55)]"
            }
            style={{ filter: wheelFilter }}
          />
          {/* Colour tint hint — multiply blend over the metal photo. We
              only apply it for non-default-ish colours so a stock brushed
              alu looks unaltered. */}
          {tintColor.toLowerCase() !== "#1c1c1c" && (
            <div
              className="pointer-events-none absolute inset-0 mix-blend-multiply opacity-60"
              style={{
                backgroundColor: tintColor,
                maskImage: `url(${wheelImg})`,
                maskRepeat: "no-repeat",
                maskSize: "contain",
                maskPosition: "center",
                WebkitMaskImage: `url(${wheelImg})`,
                WebkitMaskRepeat: "no-repeat",
                WebkitMaskSize: "contain",
                WebkitMaskPosition: "center",
              }}
            />
          )}
          {finish === "matte" && (
            <div
              className="pointer-events-none absolute inset-0 opacity-30"
              style={{
                backgroundColor: "#000",
                maskImage: `url(${wheelImg})`,
                WebkitMaskImage: `url(${wheelImg})`,
                maskRepeat: "no-repeat",
                WebkitMaskRepeat: "no-repeat",
                maskSize: "contain",
                WebkitMaskSize: "contain",
                maskPosition: "center",
                WebkitMaskPosition: "center",
              }}
            />
          )}
          {onCar && (
            <>
              <div className="pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(circle_at_50%_38%,transparent_0%,transparent_58%,rgba(0,0,0,0.2)_80%,rgba(0,0,0,0.45)_100%)] mix-blend-multiply" />
              <div className="pointer-events-none absolute inset-x-[5%] top-0 h-[30%] rounded-t-full bg-gradient-to-b from-black/48 to-transparent" />
            </>
          )}
        </div>
      ) : (
        // CSS-only silhouette fallback when the wheel asset is missing.
        <div className="relative h-full w-full">
          <div
            className="absolute inset-0 rounded-full border-[3px] border-white/30 bg-[radial-gradient(circle,#262931_0%,#0c0d10_70%)]"
            style={{ boxShadow: "0 18px 30px rgba(0,0,0,0.55)" }}
          />
          <div className="absolute inset-[14%] rounded-full border-2 border-white/15" />
          <div
            className="absolute inset-[42%] rounded-full"
            style={{ backgroundColor: tintColor }}
          />
        </div>
      )}
      <style jsx>{`
        @keyframes forged-spin {
          from {
            transform: translate(-50%, -50%) rotate(0deg);
          }
          to {
            transform: translate(-50%, -50%) rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}

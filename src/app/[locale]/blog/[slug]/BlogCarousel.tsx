"use client";

import Image from "next/image";
import { useState, useCallback, useRef, type TouchEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface CarouselImage {
  src: string;
  alt: string;
}

interface BlogCarouselProps {
  images: CarouselImage[];
}

export function BlogCarousel({ images }: BlogCarouselProps) {
  const [current, setCurrent] = useState(0);
  const touchStartX = useRef(0);
  const touchDeltaX = useRef(0);

  const total = images.length;

  const prev = useCallback(() => {
    setCurrent((c) => (c === 0 ? total - 1 : c - 1));
  }, [total]);

  const next = useCallback(() => {
    setCurrent((c) => (c === total - 1 ? 0 : c + 1));
  }, [total]);

  const handleTouchStart = (e: TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchDeltaX.current = 0;
  };

  const handleTouchMove = (e: TouchEvent) => {
    touchDeltaX.current = e.touches[0].clientX - touchStartX.current;
  };

  const handleTouchEnd = () => {
    if (touchDeltaX.current > 50) prev();
    else if (touchDeltaX.current < -50) next();
  };

  if (total === 0) return null;

  return (
    <div className="group relative">
      {/* Main image */}
      <div
        className="relative aspect-[4/5] overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] sm:aspect-[3/4] lg:rounded-3xl"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {images.map((img, i) => (
          <div
            key={i}
            className={`absolute inset-0 transition-opacity duration-500 ${
              i === current ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
          >
            <Image
              src={img.src}
              alt={img.alt}
              fill
              sizes="(max-width: 1024px) 100vw, 55vw"
              className="object-cover"
              priority={i === 0}
              unoptimized={img.src.startsWith("http")}
              loader={img.src.startsWith("http") ? ({ src }) => src : undefined}
            />
          </div>
        ))}

        {/* Gradient overlays for buttons */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-black/30 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-black/30 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

        {/* Nav arrows */}
        {total > 1 && (
          <>
            <button
              onClick={prev}
              className="absolute left-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/50 text-white/80 backdrop-blur-md transition-all hover:border-white/50 hover:bg-black/70 hover:text-white opacity-0 group-hover:opacity-100 sm:h-11 sm:w-11"
              aria-label="Previous image"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={next}
              className="absolute right-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/50 text-white/80 backdrop-blur-md transition-all hover:border-white/50 hover:bg-black/70 hover:text-white opacity-0 group-hover:opacity-100 sm:h-11 sm:w-11"
              aria-label="Next image"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}

        {/* Slide counter pill */}
        {total > 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full border border-white/15 bg-black/60 px-3 py-1 backdrop-blur-md">
            <span className="text-xs font-medium tabular-nums tracking-wider text-white/80">
              {current + 1} / {total}
            </span>
          </div>
        )}
      </div>

      {/* Thumbnail strip */}
      {total > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {images.map((img, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg border transition-all sm:h-[72px] sm:w-[72px] ${
                i === current
                  ? "border-white/40 ring-1 ring-white/20"
                  : "border-white/8 opacity-50 hover:opacity-80"
              }`}
              aria-label={`Go to image ${i + 1}`}
            >
              <Image
                src={img.src}
                alt=""
                fill
                sizes="72px"
                className="object-cover"
                unoptimized={img.src.startsWith("http")}
                loader={img.src.startsWith("http") ? ({ src }) => src : undefined}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

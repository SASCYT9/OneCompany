"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

type Props = {
  videoSrc: string;
  fallbackImage?: string;
  /** Intrinsic dimensions of the fallback image — set both to reserve layout
   * space and pass Lighthouse's unsized-images audit (avoids CLS). */
  fallbackWidth?: number;
  fallbackHeight?: number;
  className?: string;
  overlayStyle?: "hero" | "material" | "heritage";
  /** If true, renders a mute/unmute toggle and starts with audio */
  withAudio?: boolean;
  onMuteChange?: (muted: boolean) => void;
  isMuted?: boolean;
  /** When true, the <video> element is not mounted until the wrapper enters
   * the viewport (with 300px rootMargin pre-load). The fallback image stays
   * visible until then. Use for below-the-fold instances to avoid loading
   * megabytes of video on initial page render. */
  defer?: boolean;
};

export default function AkrapovicVideoBackground({
  videoSrc,
  fallbackImage,
  fallbackWidth,
  fallbackHeight,
  className = "",
  overlayStyle = "hero",
  withAudio = false,
  isMuted = true,
  defer = false,
}: Props) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [shouldMountVideo, setShouldMountVideo] = useState(!defer);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!defer || shouldMountVideo) return;
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldMountVideo(true);
          io.disconnect();
        }
      },
      { rootMargin: "300px 0px" }
    );
    io.observe(wrapper);
    return () => io.disconnect();
  }, [defer, shouldMountVideo]);

  return (
    <div
      ref={wrapperRef}
      className={`absolute inset-0 w-full h-full overflow-hidden bg-[#0d0d0b] ${className}`}
    >
      {/* Fallback image shown while video loads */}
      {fallbackImage && (
        <motion.img
          initial={{ opacity: 1 }}
          animate={{ opacity: isLoaded ? 0 : 1 }}
          transition={{ duration: 1.5 }}
          src={fallbackImage}
          alt=""
          width={fallbackWidth}
          height={fallbackHeight}
          loading={defer ? "lazy" : "eager"}
          fetchPriority={defer ? "low" : "high"}
          decoding="async"
          className="absolute inset-0 w-full h-full object-cover z-0"
        />
      )}

      {/* Native HTML5 Video */}
      {shouldMountVideo && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: isLoaded ? 1 : 0 }}
          transition={{ duration: 2 }}
          className="absolute pointer-events-none z-0 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 min-w-full min-h-full w-auto h-auto"
        >
          {/* No `poster` attr: the motion.img above already provides the
             fallback frame. Adding the same image as poster makes the
             browser repaint it on the <video> when isLoaded flips, which
             Lighthouse counts as a fresh LCP candidate (regression to ~12s
             on Slow 4G — confirmed empirically). */}
          <video
            src={videoSrc}
            autoPlay
            loop
            muted={withAudio ? isMuted : true}
            playsInline
            onCanPlay={() => setIsLoaded(true)}
            className="absolute inset-0 w-full h-full object-cover"
          />
        </motion.div>
      )}

      {/* Overlays */}
      {overlayStyle === "hero" && (
        <>
          {/* Radial center fade for text readability */}
          <div className="absolute inset-0 z-10 bg-[radial-gradient(ellipse_at_center,rgba(13,13,11,0.65)_0%,rgba(13,13,11,0.3)_60%,rgba(13,13,11,0.7)_100%)]" />
          {/* Bottom vignette */}
          <div className="absolute inset-0 z-10 bg-[linear-gradient(to_top,rgba(13,13,11,0.9)_0%,transparent_30%)]" />
          {/* Top warm accent line */}
          <div className="absolute top-0 left-0 right-0 h-px z-20 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.3)_20%,rgba(255,255,255,0.3)_80%,transparent)]" />
        </>
      )}

      {overlayStyle === "heritage" && (
        <>
          <div className="absolute inset-0 z-10 bg-[radial-gradient(ellipse_at_center,rgba(13,13,11,0.6)_0%,rgba(13,13,11,0.8)_100%)]" />
          <div className="absolute inset-0 z-10 bg-[linear-gradient(to_top,rgba(13,13,11,0.85)_0%,transparent_40%)]" />
        </>
      )}
    </div>
  );
}

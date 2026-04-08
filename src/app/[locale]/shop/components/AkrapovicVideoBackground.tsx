"use client";

import { useState } from "react";
import { motion } from "framer-motion";

type Props = {
  videoSrc: string;
  fallbackImage?: string;
  className?: string;
  overlayStyle?: "hero" | "material" | "heritage";
  /** If true, renders a mute/unmute toggle and starts with audio */
  withAudio?: boolean;
  onMuteChange?: (muted: boolean) => void;
  isMuted?: boolean;
};

export default function AkrapovicVideoBackground({
  videoSrc,
  fallbackImage,
  className = "",
  overlayStyle = "hero",
  withAudio = false,
  isMuted = true,
}: Props) {
  const [isLoaded, setIsLoaded] = useState(false);

  return (
    <div
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
          className="absolute inset-0 w-full h-full object-cover z-0"
        />
      )}

      {/* Native HTML5 Video */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: isLoaded ? 1 : 0 }}
        transition={{ duration: 2 }}
        className="absolute pointer-events-none z-0 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 min-w-full min-h-full w-auto h-auto"
      >
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

      {/* Overlays */}
      {overlayStyle === "hero" && (
        <>
          {/* Radial center fade for text readability */}
          <div className="absolute inset-0 z-10 bg-[radial-gradient(ellipse_at_center,rgba(13,13,11,0.65)_0%,rgba(13,13,11,0.3)_60%,rgba(13,13,11,0.7)_100%)]" />
          {/* Bottom vignette */}
          <div className="absolute inset-0 z-10 bg-[linear-gradient(to_top,rgba(13,13,11,0.9)_0%,transparent_30%)]" />
          {/* Top warm accent line */}
          <div className="absolute top-0 left-0 right-0 h-[1px] z-20 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.3)_20%,rgba(255,255,255,0.3)_80%,transparent)]" />
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

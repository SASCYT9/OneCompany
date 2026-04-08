"use client";

import { useState } from "react";
import { motion } from "framer-motion";

type Props = {
  videoSrc: string;
  fallbackImage?: string;
  className?: string;
  overlayStyle?: "hero" | "collection" | "rocket";
};

export default function BrabusVideoBackground({ 
  videoSrc, 
  fallbackImage, 
  className = "",
  overlayStyle = "hero" 
}: Props) {
  const [isLoaded, setIsLoaded] = useState(false);

  return (
    <div className={`absolute inset-0 w-full h-full overflow-hidden bg-black ${className}`}>
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

      {/* Native HTML5 Video covering the entire wrapper */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: isLoaded ? 1 : 0 }}
        transition={{ duration: 2 }}
        className="absolute pointer-events-none z-0 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 min-w-full min-h-full w-auto h-auto object-cover"
      >
        <video
          src={videoSrc}
          autoPlay
          loop
          muted
          playsInline
          onCanPlay={() => setIsLoaded(true)}
          className="absolute inset-0 w-full h-full object-cover"
        />
      </motion.div>

      {/* Lightened Gradient Overlays for better visibility */}
      {overlayStyle === "hero" && (
        <>
          {/* Subtle gradient behind text on the left */}
          <div className="absolute inset-0 z-10 bg-[linear-gradient(105deg,rgba(0,0,0,0.7)_0%,rgba(0,0,0,0.2)_40%,transparent_60%)]" />
          <div className="absolute inset-0 z-10 bg-[linear-gradient(to_top,rgba(0,0,0,0.6)_0%,transparent_30%)]" />
          <div className="absolute top-0 left-0 right-0 h-[1px] z-20 bg-[linear-gradient(90deg,transparent,#c29d59_15%,#c29d59_85%,transparent)]" />
        </>
      )}
      
      {overlayStyle === "rocket" && (
        <div className="absolute inset-0 z-10 bg-[linear-gradient(105deg,rgba(0,0,0,0.7)_0%,rgba(0,0,0,0.2)_40%,transparent_60%)]" />
      )}

      {overlayStyle === "collection" && (
        <>
          <div className="absolute inset-0 z-10 bg-[linear-gradient(to_top,rgba(0,0,0,0.8)_0%,rgba(0,0,0,0.2)_40%,transparent_100%)]" />
          <div className="absolute bottom-0 left-0 right-0 h-[1px] z-20 bg-[linear-gradient(90deg,transparent,#c29d59_15%,#c29d59_85%,transparent)]" />
        </>
      )}
    </div>
  );
}

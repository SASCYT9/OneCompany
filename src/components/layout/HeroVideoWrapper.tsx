"use client";

import { useEffect, useState, useRef } from 'react';
import { useTranslations } from 'next-intl';

const STORAGE_KEY = 'heroVideoDisabled';

export function HeroVideoWrapper({ src, mobileSrc, poster, serverEnabled = true }: { src: string, mobileSrc?: string, poster?: string, serverEnabled?: boolean }) {
  const [disabled, setDisabled] = useState(false);
  const [isMobile, setIsMobile] = useState<boolean | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const t = useTranslations('admin');

  useEffect(() => {
    // Check if mobile device (width < 768px)
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    
    try {
      const value = localStorage.getItem(STORAGE_KEY);
      setDisabled(value === 'true');
    } catch {
      // ignore
    }

    function onToggle() {
      try {
        const value = localStorage.getItem(STORAGE_KEY);
        setDisabled(value === 'true');
      } catch {
        // ignore
      }
    }

    window.addEventListener('heroVideoToggle', onToggle);
    window.addEventListener('storage', onToggle);
    window.addEventListener('resize', checkMobile);
    return () => {
      window.removeEventListener('heroVideoToggle', onToggle);
      window.removeEventListener('storage', onToggle);
      window.removeEventListener('resize', checkMobile);
    };
  }, []);

  // Force play video when it's ready (mobile autoplay fix)
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const tryPlay = async () => {
      try {
        // Ensure video is muted (required for autoplay on mobile)
        video.muted = true;
        await video.play();
      } catch {
        // Autoplay blocked - that's okay, poster will show
      }
    };

    // Try to play when video can start
    video.addEventListener('canplay', tryPlay);
    // Also try immediately in case it's already loaded
    if (video.readyState >= 3) {
      tryPlay();
    }

    return () => {
      video.removeEventListener('canplay', tryPlay);
    };
  }, [isMobile]); // Re-run when device type changes

  const enabled = serverEnabled && !disabled;
  const isReady = isMobile !== null;
  // Use mobile-optimized video (480p, 4MB) for phones, full HD for desktop
  const videoSrc = isMobile && mobileSrc ? mobileSrc : src;

  return (
    <>
      <div className="fixed inset-0 z-0 w-full h-full pointer-events-none">
        {/* Base background */}
        <div className="absolute inset-0 bg-black" />
        
        {/* Poster image - always visible as fallback */}
        {poster && (
          <div 
            className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-30"
            style={{ backgroundImage: `url(${poster})` }}
          />
        )}
        
        {/* Video - wait for device detection to pick correct source */}
        {enabled && isReady && (
          <video
            ref={videoRef}
            key={videoSrc}
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            className="h-full w-full object-cover opacity-30"
            poster={poster}
          >
            <source src={videoSrc} type="video/mp4" />
            <track kind="captions" />
          </video>
        )}
        
        {/* Overlay */}
        <div className="absolute inset-0 bg-black/60 pointer-events-none" />
      </div>
      {!serverEnabled && (
        <div className="fixed top-4 right-4 z-40 rounded-md bg-zinc-900/80 text-white px-3 py-1 text-xs">{t?.('heroVideoDisabledByAdmin') || 'Hero video disabled'}</div>
      )}
    </>
  );
}

export default HeroVideoWrapper;

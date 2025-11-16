'use client';

import { useEffect, useRef, useState } from 'react';

type FullScreenVideoProps = {
  src?: string;
  className?: string;
  enabled?: boolean;
  overlayOpacity?: string; // e.g., 'from-black/20 via-black/12 to-black/36'
  poster?: string;
  preload?: 'none' | 'metadata' | 'auto';
};

export function FullScreenVideo({ src, className, enabled = true, overlayOpacity = 'from-black/20 via-black/12 to-black/36', poster, preload = 'none' }: FullScreenVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedData = () => {
      setIsLoaded(true);
      video.playbackRate = 0.8;
    };

    const handleError = (e: Event) => {
      console.error('Video failed to load:', e);
      setHasError(true);
    };

    video.addEventListener('loadeddata', handleLoadedData);
    video.addEventListener('error', handleError);

    return () => {
      video.removeEventListener('loadeddata', handleLoadedData);
      video.removeEventListener('error', handleError);
    };
  }, []);

  if (hasError || !enabled) {
    console.log('Video error, falling back to gradient background');
    return (
      <div className="fixed inset-0 w-full h-full -z-10 bg-gradient-to-br from-black via-zinc-900 to-black" />
    );
  }

  return (
    <div className="fixed inset-0 w-full h-full -z-10 overflow-hidden">
      {poster && (
        <div className="absolute inset-0 -z-20 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: `url(${poster})` }} />
      )}
      <video
        ref={videoRef}
        {...(src ? { src } : {})}
        autoPlay
        loop
        muted
        playsInline
        preload={preload}
        className="w-full h-full object-cover"
        style={{ opacity: isLoaded ? 1 : 0 }}
        // allow user toggle to reduce/remove overlay and increase opacity if needed
        aria-hidden={!isLoaded}
        poster={poster}
      />
      {enabled && !isLoaded && (
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
          <svg className="w-12 h-12 text-white opacity-70 animate-spin" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeOpacity="0.25" />
            <path d="M22 12a10 10 0 10-10 10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeOpacity="0.9" />
          </svg>
        </div>
      )}
      <div className={`absolute inset-0 bg-gradient-to-b ${overlayOpacity} pointer-events-none`} />
    </div>
  );
}

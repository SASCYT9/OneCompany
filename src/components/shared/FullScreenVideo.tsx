'use client';

import { useEffect, useRef, useState } from 'react';

type FullScreenVideoProps = {
  src?: string;
  mobileSrc?: string;
  enabled?: boolean;
  overlayOpacity?: string;
  poster?: string;
  preload?: 'none' | 'metadata' | 'auto';
};

export function FullScreenVideo({ src, mobileSrc, enabled = true, overlayOpacity = 'from-black/20 via-black/12 to-black/36', poster, preload = 'none' }: FullScreenVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Reset state when source changes
    setIsLoaded(false);
    setHasError(false);

    const handleLoadedData = () => {
      setIsLoaded(true);
      video.playbackRate = 0.8;
    };


    const handleError = (e: Event) => {
      // Provide cleaner logging for video failures
      const videoEl = e.target as HTMLVideoElement;
      if (videoEl && videoEl.error) {
        // Code 4 = MEDIA_ERR_SRC_NOT_SUPPORTED (often 404)
        // Code 3 = MEDIA_ERR_DECODE
        // Code 2 = MEDIA_ERR_NETWORK
        // Code 1 = MEDIA_ERR_ABORTED
        if (videoEl.error.code === 1) {
           return; // Ignore aborted requests (navigation)
        }
        console.warn(`Video failed to load (code ${videoEl.error.code}):`, videoEl.currentSrc || 'No src');
      } else {
         console.warn('Video failed to load (unknown error)');
      }
      setHasError(true);
    };

    if (video.readyState >= 2) {
      handleLoadedData();
    }

    video.addEventListener('loadeddata', handleLoadedData);
    video.addEventListener('error', handleError);

    // Fallback: if video doesn't report loaded within 4 seconds, show it anyway (poster will be visible)
    const timeout = setTimeout(() => {
      if (!isLoaded) {
        console.warn('Video load timeout, forcing display');
        setIsLoaded(true);
      }
    }, 4000);

    return () => {
      video.removeEventListener('loadeddata', handleLoadedData);
      video.removeEventListener('error', handleError);
      clearTimeout(timeout);
    };
  }, [isLoaded]);

  if (hasError || !enabled) {
    console.log('Video error, falling back to gradient background');
    return (
      <div className="absolute inset-0 w-full h-full bg-gradient-to-br from-black via-zinc-900 to-black" />
    );
  }

  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden">
      {poster && (
        <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: `url(${poster})` }} />
      )}
      <video
        ref={videoRef}
        autoPlay
        loop
        muted
        playsInline
        preload={preload}
        className="w-full h-full object-cover"
        style={{ opacity: isLoaded ? 1 : 0 }}
        aria-hidden={!isLoaded}
        poster={poster}
      >
         {mobileSrc && <source src={mobileSrc} type="video/mp4" media="(max-width: 768px)" />}
         {src && <source src={src} type="video/mp4" />}
      </video>
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

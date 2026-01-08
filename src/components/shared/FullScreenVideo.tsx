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

  const loadedRef = useRef(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // If video isn't enabled, don't try to load/play it.
    if (!enabled || !src) {
      setIsLoaded(true);
      return;
    }

    // Reset state when source changes
    setIsLoaded(false);
    setHasError(false);
    loadedRef.current = false;

    const tryPlay = () => {
      // Ensure muted autoplay in strict browsers
      video.muted = true;
      const p = video.play();
      if (p !== undefined) {
        p.catch(() => {
          // No-op: some browsers will still block; leaving first frame is acceptable.
        });
      }
    };

    const handleLoadedData = () => {
      loadedRef.current = true;
      setIsLoaded(true);
      video.playbackRate = 0.8;
      tryPlay();
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

    // Kick playback once sources are attached.
    // `play()` can be ignored by some browsers, but it often fixes the “first frame only” issue.
    queueMicrotask(tryPlay);

    // Fallback: if video doesn't report loaded within 4 seconds, show it anyway (poster will be visible)
    const timeout = setTimeout(() => {
      if (!loadedRef.current) {
        console.warn('Video load timeout, forcing display');
        setIsLoaded(true);
      }
    }, 4000);

    return () => {
      video.removeEventListener('loadeddata', handleLoadedData);
      video.removeEventListener('error', handleError);
      clearTimeout(timeout);
    };
  }, [src, enabled]);

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
        key={src} // Force remount when source changes
        ref={videoRef}
        autoPlay
        loop
        muted
        playsInline
        preload={preload}
        className="w-full h-full object-cover"
        poster={poster}
      >
         {mobileSrc ? (
            <>
               <source src={mobileSrc} type="video/mp4" media="(max-width: 768px)" />
               <source src={src} type="video/mp4" />
            </>
         ) : (
            <source src={src} type="video/mp4" />
         )}
      </video>
      <div className={`absolute inset-0 bg-gradient-to-b ${overlayOpacity} pointer-events-none`} />
    </div>
  );
}

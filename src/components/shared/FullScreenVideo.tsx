'use client';

import { useEffect, useRef, useState } from 'react';

type FullScreenVideoProps = {
  src: string;
  className?: string;
};

export function FullScreenVideo({ src, className }: FullScreenVideoProps) {
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

  if (hasError) {
    console.log('Video error, falling back to gradient background');
    return (
      <div className="fixed inset-0 w-full h-full -z-10 bg-gradient-to-br from-black via-zinc-900 to-black" />
    );
  }

  return (
    <div className="fixed inset-0 w-full h-full -z-10 overflow-hidden">
      <video
        ref={videoRef}
        src={src}
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        className="w-full h-full object-cover"
        style={{ opacity: isLoaded ? 1 : 0 }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/30 to-black/50 pointer-events-none" />
    </div>
  );
}

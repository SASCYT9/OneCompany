'use client';

import { useState, useRef, useEffect } from 'react';

type Props = {
  youtubeId: string;
  className?: string;
};

/**
 * Lightweight YouTube embed that loads only on intersection.
 * Used as ambient background — no controls, autoplay, muted.
 */
export default function CSFVideoBackground({ youtubeId, className = '' }: Props) {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setIsVisible(true); io.disconnect(); } },
      { rootMargin: '200px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className={`csf-video-bg ${className}`}>
      {isVisible && (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1&mute=1&controls=0&loop=1&playlist=${youtubeId}&showinfo=0&rel=0&modestbranding=1&playsinline=1&enablejsapi=1&disablekb=1`}
          title="CSF Racing Ambient Video"
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          loading="lazy"
        />
      )}
    </div>
  );
}

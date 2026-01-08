'use client';

import { useMemo, useState } from 'react';

type FullScreenVideoProps = {
  src?: string;
  mobileSrc?: string;
  enabled?: boolean;
  overlayOpacity?: string;
  poster?: string;
  preload?: 'none' | 'metadata' | 'auto';
};

export function FullScreenVideo({ src, mobileSrc, enabled = true, overlayOpacity = 'from-black/20 via-black/12 to-black/36', poster, preload = 'none' }: FullScreenVideoProps) {
  const [hasError, setHasError] = useState(false);

  const sources = useMemo(() => {
    if (!src) return null;
    if (!mobileSrc) return [{ src, media: undefined } as const];
    return [
      { src: mobileSrc, media: '(max-width: 768px)' } as const,
      { src, media: undefined } as const,
    ];
  }, [src, mobileSrc]);

  if (hasError || !enabled || !sources) {
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
        autoPlay
        loop
        muted
        playsInline
        preload={preload}
        className="w-full h-full object-cover"
        poster={poster}
        onError={() => setHasError(true)}
      >
        {sources.map((s) => (
          <source key={s.src} src={s.src} type="video/mp4" media={s.media} />
        ))}
      </video>
      <div className={`absolute inset-0 bg-gradient-to-b ${overlayOpacity} pointer-events-none`} />
    </div>
  );
}

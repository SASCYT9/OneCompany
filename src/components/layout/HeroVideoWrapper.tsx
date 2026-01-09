"use client";

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

const STORAGE_KEY = 'heroVideoDisabled';

export function HeroVideoWrapper({ src, poster, serverEnabled = true }: { src: string, mobileSrc?: string, poster?: string, serverEnabled?: boolean }) {
  const [disabled, setDisabled] = useState(false);
  const t = useTranslations('admin');

  useEffect(() => {
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
    return () => {
      window.removeEventListener('heroVideoToggle', onToggle);
      window.removeEventListener('storage', onToggle);
    };
  }, []);

  const enabled = serverEnabled && !disabled;

  return (
    <>
      <div className="fixed inset-0 z-0 w-full h-full pointer-events-none">
        {/* Base background */}
        <div className="absolute inset-0 bg-black" />
        
        {/* Poster image as fallback */}
        {poster && (
          <div 
            className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-30"
            style={{ backgroundImage: `url(${poster})` }}
          />
        )}
        
        {/* Video */}
        {enabled && (
          <video
            autoPlay
            loop
            muted
            playsInline
            className="h-full w-full object-cover opacity-30"
            poster={poster}
          >
            <source src={src} type="video/mp4" />
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

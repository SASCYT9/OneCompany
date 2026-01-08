"use client";

import { useEffect, useState, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { FullScreenVideo } from '@/components/shared/FullScreenVideo';

const STORAGE_KEY = 'heroVideoDisabled';

interface NavigatorWithConnection extends Navigator {
  connection?: {
    saveData: boolean;
    addEventListener?: (type: string, listener: EventListener) => void;
    removeEventListener?: (type: string, listener: EventListener) => void;
  }
}

export function HeroVideoWrapper({ src, mobileSrc, poster, serverEnabled = true }: { src: string, mobileSrc?: string, poster?: string, serverEnabled?: boolean }) {
  const [disabled, setDisabled] = useState(false);
  // Always load hero video immediately - no lazy loading for LCP element
  const [shouldLoad] = useState(true);
  const ref = useRef<HTMLDivElement | null>(null);
  const t = useTranslations('admin');

  useEffect(() => {
    try {
      const value = localStorage.getItem(STORAGE_KEY);
      setDisabled(value === 'true');
    } catch {
      console.error('Failed to read hero video preference');
    }

    function onToggle() {
      try {
        const value = localStorage.getItem(STORAGE_KEY);
        setDisabled(value === 'true');
      } catch {
        console.error('Failed to update hero video preference');
      }
    }

    window.addEventListener('heroVideoToggle', onToggle);
    window.addEventListener('storage', onToggle);
    return () => {
      window.removeEventListener('heroVideoToggle', onToggle);
      window.removeEventListener('storage', onToggle);
    };
  }, []);

  // Honor user preference for reduced motion or data saving
  useEffect(() => {
    // We want to play video by default unless explicitly disabled by admin
    // The previous logic was too aggressive with saveData/reducedMotion
    // setDisabled(false); 
  }, []);

  // Removed IntersectionObserver logic as hero video should load immediately

  const enabled = serverEnabled && !disabled;
  
  // Choose standard preload. If data saver, browers respect preload="none" usually, 
  // or we can force it if we detect it client-side.
  const getPreload = () => {
     if (typeof window !== 'undefined') {
        const nav = navigator as NavigatorWithConnection;
        if (nav.connection?.saveData) return 'none';
     }
     return 'auto';
  };

  return (
    <>
      <div ref={(el) => { ref.current = el; }} className="fixed inset-0 z-0 w-full h-full pointer-events-none">
        {/* Base background to prevent white flash and serve as backdrop */}
        <div className="absolute inset-0 bg-black" />
        <FullScreenVideo 
           src={src}
           mobileSrc={mobileSrc}
           poster={poster} 
           preload={getPreload()} 
           enabled={enabled && shouldLoad} 
        />
        <div className="absolute inset-0 bg-black/60 pointer-events-none" />
      </div>
      {!serverEnabled && (
        <div className="fixed top-4 right-4 z-40 rounded-md bg-zinc-900/80 text-white px-3 py-1 text-xs">{t?.('heroVideoDisabledByAdmin') || 'Hero video disabled'}</div>
      )}
    </>
  );
}

export default HeroVideoWrapper;

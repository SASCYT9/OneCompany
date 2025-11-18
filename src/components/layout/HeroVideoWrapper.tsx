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
  const [shouldLoad, setShouldLoad] = useState(true);
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
    const mq = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
    const nav = navigator as NavigatorWithConnection;
    const saveData = nav.connection?.saveData;
    
    const updateDisabledState = () => {
      const mq = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
      const nav = navigator as NavigatorWithConnection;
      setDisabled((mq?.matches ?? false) || (nav.connection?.saveData ?? false));
    };

    if (mq && mq.matches) {
      setDisabled(true);
    }
    if (saveData) {
      setDisabled(true);
    }

    mq?.addEventListener?.('change', updateDisabledState);
    try {
      const nav = navigator as NavigatorWithConnection;
      nav.connection?.addEventListener?.('change', updateDisabledState);
    } catch {
      // some browsers may not support addEventListener on connection
    }
    return () => {
      mq?.removeEventListener?.('change', updateDisabledState);
      try {
        const nav = navigator as NavigatorWithConnection;
        nav.connection?.removeEventListener?.('change', updateDisabledState);
      } catch {
        // ignore
      }
    };
  }, []);

  // Removed IntersectionObserver logic as hero video should load immediately

  const enabled = serverEnabled && !disabled;
  // Select mobile variant if mobileSrc present and either small viewport or saveData
  const chooseVariant = () => {
    if (mobileSrc) {
      const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
      const nav = navigator as NavigatorWithConnection;
      const saveData = nav.connection?.saveData;
      if (isMobile || saveData) {
        return mobileSrc;
      }
    }
    return src;
  };

  const selected = chooseVariant();

  return (
    <>
      <div ref={(el) => { ref.current = el; }} className="fixed inset-0 -z-10 w-full h-full">
        <FullScreenVideo src={shouldLoad ? selected : undefined} poster={poster} preload={shouldLoad ? 'metadata' : 'none'} enabled={enabled && shouldLoad} />
        <div className="absolute inset-0 bg-black/60 pointer-events-none" />
      </div>
      {!serverEnabled && (
        <div className="fixed top-4 right-4 z-40 rounded-md bg-zinc-900/80 text-white px-3 py-1 text-xs">{t?.('heroVideoDisabledByAdmin') || 'Hero video disabled'}</div>
      )}
    </>
  );
}

export default HeroVideoWrapper;

"use client";

import { useEffect, useState, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { FullScreenVideo } from '@/components/shared/FullScreenVideo';

const STORAGE_KEY = 'heroVideoDisabled';

export function HeroVideoWrapper({ src, mobileSrc, poster, serverEnabled = true }: { src: string, mobileSrc?: string, poster?: string, serverEnabled?: boolean }) {
  const [disabled, setDisabled] = useState(false);
  const [shouldLoad, setShouldLoad] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const t = useTranslations('admin');

  useEffect(() => {
    try {
      const value = localStorage.getItem(STORAGE_KEY);
      setDisabled(value === 'true');
    } catch (e) {
      console.error('Failed to read hero video preference', e);
    }

    function onToggle() {
      try {
        const value = localStorage.getItem(STORAGE_KEY);
        setDisabled(value === 'true');
      } catch (e) {
        console.error('Failed to update hero video preference', e);
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
    const saveData = (navigator as any).connection?.saveData;
    if (mq && mq.matches) {
      setDisabled(true);
    }
    if (saveData) {
      setDisabled(true);
    }
    function handleChange(e: MediaQueryListEvent) {
      setDisabled(e.matches || ((navigator as any).connection?.saveData ?? false));
    }
    mq?.addEventListener?.('change', handleChange);
    try {
      (navigator as any).connection?.addEventListener?.('change', handleChange);
    } catch (e) {
      // some browsers may not support addEventListener on connection
    }
    return () => {
      mq?.removeEventListener?.('change', handleChange);
      try {
        (navigator as any).connection?.removeEventListener?.('change', handleChange);
      } catch (e) {
        // ignore
      }
    };
  }, []);

  useEffect(() => {
    let observer: IntersectionObserver | null = null;
    if (!ref.current) return;
    const saveData = (navigator as any).connection?.saveData;
    if (saveData) {
      // Avoid loading video when user opted to save data
      setShouldLoad(false);
      return;
    }
    try {
      observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setShouldLoad(true);
            observer?.disconnect();
          }
        });
      }, { root: null, rootMargin: '200px', threshold: 0.1 });
      observer.observe(ref.current);
      // Fallback: load after 2 seconds if not intersecting to avoid never loading
      const fallback = setTimeout(() => setShouldLoad(true), 2000);
      return () => {
        observer?.disconnect();
        clearTimeout(fallback);
      };
    } catch (e) {
      // If IntersectionObserver is not supported, load immediately
      setShouldLoad(true);
    }
  }, [ref.current]);

  const enabled = serverEnabled && !disabled;
  // Select mobile variant if mobileSrc present and either small viewport or saveData
  const chooseVariant = () => {
    if (mobileSrc) {
      const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
      const saveData = (navigator as any).connection?.saveData;
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
      </div>
      {!serverEnabled && (
        <div className="fixed top-4 right-4 z-40 rounded-md bg-zinc-900/80 text-white px-3 py-1 text-xs">{t?.('heroVideoDisabledByAdmin') || 'Hero video disabled'}</div>
      )}
    </>
  );
}

export default HeroVideoWrapper;

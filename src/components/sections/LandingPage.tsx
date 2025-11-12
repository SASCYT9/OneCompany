'use client';

import React, { useRef, useEffect } from 'react';
import { gsap } from 'gsap';
import { Link } from '@/navigation';
import { useTranslations } from 'next-intl';

const LandingPage = () => {
  const t = useTranslations('landing');
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const sections = [
    {
      key: 'auto',
      label: t('automotive'),
      video: '/videos/eventuri-intake.mp4',
      href: '/brands',
    },
    {
      key: 'moto',
      label: t('motorcycles'),
      video: '/videos/kw-suspension.mp4',
      href: '/brands/moto',
    },
  ];

  useEffect(() => {
    if (containerRef.current) {
      gsap.fromTo(
        containerRef.current.children,
        { opacity: 0, y: 30 },
        { opacity: 1, y: 0, duration: 0.8, stagger: 0.2, ease: 'power3.out' }
      );
    }
  }, []);

  const onButtonHover = (video: string) => {
    if (videoRef.current) {
      videoRef.current.src = video;
    }
  };

  return (
    <div className="relative w-full h-screen bg-black flex items-center justify-center overflow-hidden">
      <video
        ref={videoRef}
        className="absolute top-0 left-0 w-full h-full object-cover filter blur-sm scale-110"
        src="/videos/hero-smoke.mp4"
        autoPlay
        muted
        loop
        playsInline
      />
      <div className="absolute inset-0 bg-black/60" />
      <div
        ref={containerRef}
        className="relative z-10 flex flex-col items-center gap-8"
      >
        <div className="flex flex-col md:flex-row items-center gap-8">
          {sections.map((section) => (
            <Link
              key={section.key}
              href={section.href}
              className="group"
              onMouseEnter={() => onButtonHover(section.video)}
            >
              <div className="text-4xl md:text-6xl text-white font-thin tracking-wider uppercase transition-all duration-300 ease-in-out group-hover:text-white group-hover:tracking-widest">
                {section.label}
              </div>
            </Link>
          ))}
        </div>
        <div className="mt-16">
          <Link href="/about" className="group">
            <div className="text-xl text-gray-400 font-thin tracking-wider uppercase transition-all duration-300 ease-in-out group-hover:text-white group-hover:tracking-widest">
              {t('learnMore')}
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;

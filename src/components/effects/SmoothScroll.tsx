'use client';

import { useEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

export default function SmoothScroll() {
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    // Smooth scroll configuration
    // const lenis = {
    //   duration: 1.2,
    //   easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    //   smooth: true,
    // };

    // Update ScrollTrigger on scroll
    ScrollTrigger.refresh();

    return () => {
      ScrollTrigger.getAll().forEach(trigger => trigger.kill());
    };
  }, []);

  return null;
}

'use client';

import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

export default function AkrapovicCinematicScroll({ isUa }: { isUa: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<(HTMLDivElement | null)[]>([]);
  const textRefs = useRef<(HTMLDivElement | null)[]>([]);

  useLayoutEffect(() => {
    let ctx = gsap.context(() => {
      if (!containerRef.current) return;
      
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: containerRef.current,
          start: 'top top',
          end: 'bottom bottom',
          scrub: 1.5, // Super smooth scrubbing
        }
      });

      // Initialize all except first to be invisible
      gsap.set(videoRefs.current.slice(1), { opacity: 0, scale: 1.1 });
      gsap.set(textRefs.current.slice(1), { opacity: 0, y: 100 });
      
      gsap.set(videoRefs.current[0], { opacity: 1, scale: 1 });
      gsap.set(textRefs.current[0], { opacity: 1, y: 0 });

      // Scene 1 ends, Scene 2 begins
      tl.to(textRefs.current[0], { opacity: 0, y: -100, duration: 1 }, 0);
      tl.to(videoRefs.current[0], { scale: 1.1, opacity: 0, duration: 2, ease: 'power2.inOut' }, 0);
      
      tl.fromTo(videoRefs.current[1], { scale: 1.1, opacity: 0 }, { scale: 1, opacity: 1, duration: 2 }, 0.5);
      tl.fromTo(textRefs.current[1], { opacity: 0, y: 100 }, { opacity: 1, y: 0, duration: 1 }, 1.5);

      // Scene 2 ends, Scene 3 begins
      tl.to(textRefs.current[1], { opacity: 0, y: -100, duration: 1 }, 3);
      tl.to(videoRefs.current[1], { scale: 1.1, opacity: 0, duration: 2, ease: 'power2.inOut' }, 3);
      
      tl.fromTo(videoRefs.current[2], { scale: 1.1, opacity: 0 }, { scale: 1, opacity: 1, duration: 2 }, 3.5);
      tl.fromTo(textRefs.current[2], { opacity: 0, y: 100 }, { opacity: 1, y: 0, duration: 1 }, 4.5);
      
      // Hold scene 3 at the end for a bit before page scrolls
      tl.to({}, { duration: 1 });

    }, containerRef);
    return () => ctx.revert();
  }, []);

  // Selected top-tier Akrapovic videos downloaded locally
  const scenes = [
    {
      title: isUa ? "Звук Досконалості" : "The Sound of Perfection",
      subtitle: isUa ? "Безкомпромісний титан" : "Uncompromising Titanium",
      video: "/videos/shop/akrapovic/scene1.mp4"
    },
    {
      title: isUa ? "Фокус на Деталях" : "Focus on Details",
      subtitle: isUa ? "Ручне зварювання. Карбонові насадки. Створено інженерами." : "Hand-welded. Carbon fibre tips. Engineered by masters.",
      video: "/videos/shop/akrapovic/scene2.mp4"
    },
    {
      title: isUa ? "Відчуй Різницю" : "Feel the Difference",
      subtitle: isUa ? "Вихлоп, що стає ритмом серця." : "The exhaust that becomes a heartbeat.",
      video: "/videos/shop/akrapovic/scene3.mp4"
    }
  ];

  return (
    <div ref={containerRef} className="relative w-full" style={{ height: '400vh' }}>
      {/* Sticky wrapper that stays locked to the screen while scrolling the 400vh */}
      <div className="sticky top-0 left-0 h-screen w-full overflow-hidden bg-[#030303]">
        
        {/* Videos Container */}
        <div className="absolute inset-0 z-0 bg-[#030303]">
          {scenes.map((scene, i) => (
            <div 
              key={i} 
              ref={el => { videoRefs.current[i] = el; }}
              className="absolute inset-0 w-full h-full overflow-hidden"
              style={{ willChange: 'transform, opacity' }}
            >
              <video
                src={scene.video}
                autoPlay
                muted
                loop
                playsInline
                className="absolute inset-0 w-full h-full object-cover pointer-events-none opacity-[0.65]"
              />
              
              {/* Luxury dark gradients to frame the text */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#030303] via-transparent to-[#030303]/80" />
              <div className="absolute inset-0 bg-black/20" />
            </div>
          ))}
        </div>

        {/* Dynamic Text Container */}
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center pointer-events-none">
          {scenes.map((scene, i) => (
            <div 
              key={`text-${i}`}
              ref={el => { textRefs.current[i] = el; }}
              className="absolute flex flex-col items-center justify-center text-center px-4 w-full"
              style={{ willChange: 'transform, opacity' }}
            >
              <h2 className="text-4xl sm:text-6xl md:text-8xl font-black uppercase tracking-tighter text-white mb-4 sm:mb-8 drop-shadow-2xl">
                {scene.title}
              </h2>
              <p className="text-lg sm:text-2xl md:text-3xl font-light text-zinc-300 max-w-2xl drop-shadow-lg mx-auto">
                {scene.subtitle}
              </p>
              
              {/* Tiny decorative elements */}
              {i === 0 && (
                <div className="mt-16 flex flex-col items-center gap-4 animate-bounce opacity-50">
                   <span className="text-xs tracking-widest uppercase font-mono text-white">Scroll</span>
                   <div className="w-[1px] h-12 bg-white" />
                </div>
              )}
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}

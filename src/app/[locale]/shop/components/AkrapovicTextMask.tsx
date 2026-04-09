'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export default function AkrapovicTextMask() {
  const containerRef = useRef<HTMLDivElement>(null);
  const textGroupRef = useRef<SVGGElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!containerRef.current || !textGroupRef.current) return;
    
    // We create a ScrollTrigger that pins the container.
    // The container spans the exact size of the viewport.
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: containerRef.current,
        start: "top top",
        end: "+=200%", // 2x viewport height for smooth scrolling
        scrub: 1,
        pin: true,
        // markers: true, // for debugging if needed
      }
    });

    // Scale up the text massively to zoom through the letter 'O'
    // AKRAPOVIČ. The 'O' is near the center, but slightly to the right.
    // We use transformOrigin to target the center of the 'O'.
    tl.to(textGroupRef.current, {
      scale: 150, // Massive scale to punch through
      transformOrigin: "58% 50%", // Approximate center of the 'O' 
      ease: "power3.inOut"
    });
    
    // When the zoom is huge, the letter bounds exceed the screen. 
    // We then fade out the entire SVG to ensure no black edges remain.
    tl.to(svgRef.current, {
      opacity: 0,
      duration: 0.1
    }, "-=0.1");

  }, []);

  return (
    <div 
      ref={containerRef} 
      className="ak-text-mask-wrapper"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100vh',
        zIndex: 50, // Above the video, below actual content headers
        pointerEvents: 'none' // allow clicking the video toggle
      }}
    >
      <svg 
        ref={svgRef}
        className="ak-text-mask-svg" 
        viewBox="0 0 1000 300" 
        preserveAspectRatio="xMidYMid slice"
        style={{ width: '100%', height: '100%' }}
      >
        <defs>
          <mask id="ak-text-mask">
            {/* The white rect makes everything visible (meaning the dark overlay is shown) */}
            <rect width="100%" height="100%" fill="white" />
            {/* The black text creates transparent holes in the dark overlay */}
            <g ref={textGroupRef}>
              <text 
                x="500" 
                y="170" 
                textAnchor="middle" 
                fontSize="110" 
                fontWeight="900" 
                fontFamily="Impact, sans-serif" 
                letterSpacing="4" 
                fill="black"
                style={{ textTransform: 'uppercase' }}
              >
                AKRAPOVIČ
              </text>
            </g>
          </mask>
        </defs>
        
        {/* The dark overlay that covers the hero video. We use #030303 (Stealth Wealth obsidian) */}
        <rect width="100%" height="100%" fill="#030303" mask="url(#ak-text-mask)" />
      </svg>
    </div>
  );
}

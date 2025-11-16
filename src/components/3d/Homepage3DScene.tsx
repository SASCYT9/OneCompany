'use client';

import { Canvas } from '@react-three/fiber';
import { Suspense, useEffect, useRef, useState } from 'react';
import { CinematicCamera } from './CinematicCamera';
import { StoreSlide } from './StoreSlide';
import { Environment } from '@react-three/drei';
import { StoreHeroSection } from '../ui/StoreHeroSection';
import { BrandsGrid } from '../ui/BrandsGrid';
import { VideoBackground } from './VideoBackground';
import { MorphingTitle } from './MorphingTitle';
import { ScrollProgress } from './ScrollProgress';
import { LightParticles3D } from './LightParticles3D';
import { LightRaysCanvas } from '../effects/LightRaysCanvas';
import { HeroLogo } from '../effects/HeroLogo';

export function Homepage3DScene() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      if (!containerRef.current) return;
      
      const scrollTop = window.scrollY;
      const scrollHeight = containerRef.current.scrollHeight - window.innerHeight;
      const scrollProgress = scrollTop / scrollHeight;
      
      // Визначаємо поточний слайд (0-4)
      const slideIndex = Math.min(Math.floor(scrollProgress * 5), 4);
      setCurrentSlide(slideIndex);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div ref={containerRef} className="w-full h-[500vh] relative" style={{ touchAction: 'pan-y' }}>
      {/* Scroll Progress Indicator */}
      <ScrollProgress currentSlide={currentSlide} totalSlides={5} />
      
      {/* Canvas Light Rays - тільки для головного екрану */}
      <LightRaysCanvas 
        isActive={currentSlide === 0} 
        rayCount={12}
        colors={['#ff6b35', '#4fc3f7', '#c24fc7']}
        speed={0.002}
      />
      
      {/* Fixed 3D Canvas */}
      <div className="fixed top-0 left-0 w-full h-screen">
        <Canvas
          shadows
          dpr={[1, 2]}
          camera={{ position: [0, 0, 10], fov: 50 }}
          gl={{ 
            antialias: true, 
            alpha: true,
            powerPreference: "high-performance",
            toneMapping: 2 // ACESFilmic
          }}
        >
          <ambientLight intensity={0.25} />
          <directionalLight
            position={[10, 10, 5]}
            intensity={1}
            castShadow
            shadow-mapSize-width={1024}
            shadow-mapSize-height={1024}
            shadow-camera-near={0.5}
            shadow-camera-far={50}
            shadow-bias={-0.0001}
          />
          <Suspense fallback={null}>
            {/* Neutral studio reflections */}
            <Environment preset="studio" />
             {/* Gentle depth fog removed for pure video background */}

            {/* Cinematic video backgrounds per slide (no white floor, pure video) */}
            <group>
              {currentSlide === 0 && <VideoBackground src="/videos/onecompany-intro.mp4" inView intensity={0.6} />}
              {currentSlide === 1 && <VideoBackground src="/videos/kw-suspension.mp4" inView intensity={0.75} />}
              {currentSlide === 2 && <VideoBackground src="/videos/fi-exhaust.mp4" inView intensity={0.75} />}
              {currentSlide === 3 && <VideoBackground src="/videos/eventuri-intake.mp4" inView intensity={0.75} />}
            </group>
            
            {/* Dynamic spotlights based on current slide */}
            {currentSlide === 0 && (
              <>
                <spotLight position={[10, 10, 10]} angle={0.35} penumbra={1} intensity={1.25} castShadow color="#ffffff" />
              </>
            )}
            {currentSlide === 1 && (
              <>
                <spotLight position={[10, 10, 10]} angle={0.35} penumbra={1} intensity={1.4} castShadow color="#ff6b35" />
              </>
            )}
            {currentSlide === 2 && (
              <>
                <spotLight position={[10, 10, 10]} angle={0.35} penumbra={1} intensity={1.4} castShadow color="#4fc3f7" />
              </>
            )}
            {currentSlide === 3 && (
              <>
                <spotLight position={[10, 10, 10]} angle={0.35} penumbra={1} intensity={1.35} castShadow color="#c24fc7" />
              </>
            )}
            
            {/* Clean scene: no stars/sparkles */}

            {/* Cinematic Camera Controller with GSAP */}
            <CinematicCamera containerRef={containerRef} />

            {/* 3D Light Particles - різні кольори для кожного слайду */}
            {currentSlide === 0 && <LightParticles3D count={300} color="#ffffff" speed={0.3} />}
            {currentSlide === 1 && <LightParticles3D count={200} color="#ff6b35" speed={0.5} />}
            {currentSlide === 2 && <LightParticles3D count={200} color="#4fc3f7" speed={0.5} />}
            {currentSlide === 3 && <LightParticles3D count={200} color="#c24fc7" speed={0.5} />}

            {/* No extra particle systems for a premium clean look */}

            {/* Store Slides - розкладені моделі, без підлоги, ближче до камери */}
            {currentSlide === 1 && (
              <group position={[0, 0, 0]}>
                <StoreSlide storeId="kw" inView />
              </group>
            )}
            {currentSlide === 2 && (
              <group position={[0, 0, 0]}>
                <StoreSlide storeId="fi" inView />
              </group>
            )}
            {currentSlide === 3 && (
              <group position={[0, 0, 0]}>
                <StoreSlide storeId="eventuri" inView />
              </group>
            )}

            {/* Brand effects disabled for now to keep focus on real models */}

            {/* No canvas videos; hero overlays provide video background */}

            {/* Minimal post-processing for clarity (removed) */}
          </Suspense>
        </Canvas>
      </div>

      {/* Scroll-triggered Text Overlays + Store Hero Sections */}
      <div className="relative z-10 pointer-events-none">
        {/* Cinematic vignette overlay */}
        <div className="fixed inset-0 pointer-events-none" aria-hidden>
          <div className="w-full h-full" style={{
            background:
              'radial-gradient(120% 120% at 50% 50%, rgba(0,0,0,0) 0%, rgba(0,0,0,0.06) 55%, rgba(0,0,0,0.2) 80%, rgba(0,0,0,0.35) 100%)'
          }} />
        </div>
        {/* Screen 0: Logo появление з енергетичною хвилею */}
        <section className="h-screen flex items-center justify-center">
          <div className={`transition-all duration-1000 w-full ${currentSlide === 0 ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-10'}`}>
            <HeroLogo />
          </div>
        </section>

        {/* Screen 1: KW Suspension */}
        <section className="h-screen flex items-center justify-center relative">
          <StoreHeroSection storeId="kw" isVisible={currentSlide === 1} />
        </section>

        {/* Screen 2: Fi Exhaust */}
        <section className="h-screen flex items-center justify-center relative">
          <StoreHeroSection storeId="fi" isVisible={currentSlide === 2} />
        </section>

        {/* Screen 3: Eventuri */}
        <section className="h-screen flex items-center justify-center relative">
          <StoreHeroSection storeId="eventuri" isVisible={currentSlide === 3} />
        </section>

        {/* Screen 4: Stores section (final - all cards) */}
        <section className="h-screen flex items-center justify-center" id="stores">
          <div id="brands-section" className={`w-full max-w-6xl px-8 transition-all duration-1000 ${currentSlide === 4 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-20'}`}>
            <BrandsGrid />
          </div>
        </section>
      </div>
    </div>
  );
}

'use client';

import React, { useRef, useEffect, useState } from 'react';
import { gsap } from 'gsap';
import { Link } from '@/navigation';
import { useTranslations } from 'next-intl';
import BrandCarousel from '@/components/ui/BrandCarousel';
import AnimatedButton from '@/components/ui/AnimatedButton';
import AnimatedSection from '@/components/ui/AnimatedSection';
import MagneticButton from '@/components/ui/MagneticButton';
import AnimatedCard from '@/components/ui/AnimatedCard';

// Top automotive brands with logos
const topAutomotiveBrands = [
  { name: 'Eventuri', logo: '/logos/eventuri.png' },
  { name: 'KW Suspension', logo: '/logos/kw-official.png' },
  { name: 'TechArt', logo: '/logos/techart.svg' },
  { name: 'Urban Automotive', logo: '/logos/urban-automotive.png' },
  { name: 'HRE Wheels', logo: '/logos/hre-wheels.png' },
  { name: 'Brembo', logo: '/logos/brembo.png' },
  { name: 'Akrapovic', logo: '/logos/akrapovic.png' },
  { name: 'Liberty Walk', logo: '/logos/liberty-walk.png' },
  { name: 'Vorsteiner', logo: '/logos/vorsteiner.png' },
  { name: 'Milltek', logo: '/logos/milltek.png' },
  { name: 'FI Exhaust', logo: '/logos/fi-exhaust.png' },
  { name: 'Remus', logo: '/logos/remus.png' },
  { name: 'IPE Exhaust', logo: '/logos/ipe-exhaust.png' },
  { name: 'Capristo', logo: '/logos/capristo.png' },
  { name: 'Armytrix', logo: '/logos/armytrix.png' },
];

// Top motorcycle brands with logos
const topMotoBrands = [
  { name: 'Akrapovic', logo: '/logos/akrapovic.png' },
  { name: 'SC-Project', logo: '/logos/sc-project.png' },
  { name: 'Ohlins', logo: '/logos/ohlins.png' },
  { name: 'Brembo', logo: '/logos/brembo.png' },
  { name: 'Marchesini', logo: '/logos/marchesini.png' },
  { name: 'OZ Racing', logo: '/logos/oz-racing.png' },
  { name: 'Termignoni', logo: '/logos/termignoni.png' },
  { name: 'Arrow', logo: '/logos/arrow.png' },
  { name: 'SparkExhaust', logo: '/logos/sparkexhaust.png' },
  { name: 'Bitubo', logo: '/logos/bitubo.svg' },
];

const LandingPage = () => {
  const heroRef = useRef<HTMLDivElement>(null);
  const [heroVideo, setHeroVideo] = useState<string>('hero-fixed.mp4');
  const t = useTranslations('landing');

  useEffect(() => {
    if (heroRef.current) {
      gsap.fromTo(
        heroRef.current.querySelectorAll('.fade-in'),
        { opacity: 0, y: 30 },
        { 
          opacity: 1, 
          y: 0, 
          duration: 1, 
          stagger: 0.2, 
          ease: 'power3.out',
          delay: 0.2
        }
      );
    }
  }, []);

  // Fetch hero video from admin config
  useEffect(() => {
    let isMounted = true;
    const fetchConfig = async () => {
      try {
        const res = await fetch('/api/admin/video-config', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (isMounted && data?.heroVideo && typeof data.heroVideo === 'string') {
          setHeroVideo(data.heroVideo);
        }
      } catch {
        // silently ignore and keep default video
      }
    };
    fetchConfig();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <>
      {/* Hero Section - Full-Screen Video Background */}
      <section 
        ref={heroRef}
        className="relative w-full h-screen overflow-hidden"
      >
        {/* Video Background */}
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        >
          <source src={`/videos/${heroVideo}`} type="video/mp4" />
        </video>
        
        {/* Dark Overlay */}
        <div className="absolute inset-0 bg-black/50" />
        
        {/* Content */}
        <div className="relative z-10 h-full flex items-center justify-center">
          <div className="max-w-7xl mx-auto px-6 text-center">
            <h1 className="fade-in text-4xl md:text-6xl lg:text-7xl text-white font-light tracking-tight mb-16 leading-tight">
              {t('premiumPerformance')}
            </h1>
            
            <div className="fade-in flex flex-col md:flex-row items-center justify-center gap-8 md:gap-16">
              <MagneticButton>
                <Link 
                  href="/auto"
                  className="group text-2xl md:text-4xl text-white/90 hover:text-white font-light tracking-wider uppercase transition-all duration-500"
                >
                  <span className="inline-block relative">
                    {t('automotive')}
                    <span className="absolute bottom-0 left-0 w-0 h-px bg-white group-hover:w-full transition-all duration-500" />
                  </span>
                </Link>
              </MagneticButton>
              
              <div className="text-white/40 text-2xl md:text-4xl font-thin">|</div>
              
              <MagneticButton>
                <Link 
                  href="/moto"
                  className="group text-2xl md:text-4xl text-white/90 hover:text-white font-light tracking-wider uppercase transition-all duration-500"
                >
                  <span className="inline-block relative">
                    {t('motorcycles')}
                    <span className="absolute bottom-0 left-0 w-0 h-px bg-white group-hover:w-full transition-all duration-500" />
                  </span>
                </Link>
              </MagneticButton>
            </div>
            
            {/* Scroll Indicator */}
            <div className="fade-in absolute bottom-12 left-1/2 -translate-x-1/2">
              <div className="flex flex-col items-center gap-2 text-white/60">
                <span className="text-xs uppercase tracking-widest">Scroll</span>
                <svg className="w-6 h-6 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Welcome Section */}
      <section className="bg-white dark:bg-zinc-950 py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <AnimatedSection delay={0.2}>
            <div className="text-center mb-24">
              <h2 className="text-4xl md:text-6xl font-extralight text-zinc-900 dark:text-white mb-12 tracking-tight leading-tight">
                {t('welcomeHeading')}<br />
                <span className="font-light">{t('premiumBrands')}</span>
              </h2>
              <div className="w-32 h-px bg-zinc-300 dark:bg-white/20 mx-auto mb-16" />
              <p className="text-xl md:text-2xl text-zinc-600 dark:text-white/60 leading-relaxed max-w-5xl mx-auto font-light">
                {t('welcomeText')}
              </p>
            </div>
          </AnimatedSection>

          {/* Values - Clean Grid */}
          <AnimatedSection delay={0.3}>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-8 max-w-6xl mx-auto">
              {[
                'PERFORMANCE',
                'QUALITY',
                'SERVICE',
                'SOUND',
                'INNOVATION',
              ].map((value, index) => (
                <AnimatedCard
                  key={index}
                  className="group p-8 text-center bg-zinc-50 dark:bg-zinc-900/50 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-all duration-300"
                  hoverScale={1.02}
                >
                  <p className="text-sm font-light uppercase tracking-[0.2em] text-zinc-700 dark:text-white/70">
                    {value}
                  </p>
                </AnimatedCard>
              ))}
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* What We Offer Section */}
      <section className="bg-zinc-50 dark:bg-black py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <AnimatedSection delay={0.2}>
            <div className="text-center mb-24">
              <h2 className="text-4xl md:text-6xl font-extralight text-zinc-900 dark:text-white mb-8 tracking-tight">
                What We <span className="font-light">Offer</span>
              </h2>
              <div className="w-32 h-px bg-zinc-300 dark:bg-white/20 mx-auto" />
            </div>
          </AnimatedSection>

          <div className="grid md:grid-cols-3 gap-12 max-w-6xl mx-auto">
            {/* Expert Selection */}
            <AnimatedSection delay={0.3}>
              <AnimatedCard className="bg-white dark:bg-zinc-900/30 p-12 hover:shadow-2xl dark:hover:bg-zinc-900/50 transition-all duration-500 h-full">
                <div className="mb-8">
                  <div className="w-16 h-16 flex items-center justify-center border border-zinc-200 dark:border-white/10">
                    <span className="text-3xl font-extralight text-zinc-900 dark:text-white">01</span>
                  </div>
                </div>
                <h3 className="text-2xl font-light text-zinc-900 dark:text-white mb-6 tracking-wide">Expert Selection</h3>
                <p className="text-zinc-600 dark:text-white/50 text-base leading-relaxed font-light">
                  Our team of specialists provides personalized consultations to select the perfect 
                  performance parts for your specific vehicle and requirements.
                </p>
              </AnimatedCard>
            </AnimatedSection>

            {/* Global Network */}
            <AnimatedSection delay={0.4}>
              <AnimatedCard className="bg-white dark:bg-zinc-900/30 p-12 hover:shadow-2xl dark:hover:bg-zinc-900/50 transition-all duration-500 h-full">
                <div className="mb-8">
                  <div className="w-16 h-16 flex items-center justify-center border border-zinc-200 dark:border-white/10">
                    <span className="text-3xl font-extralight text-zinc-900 dark:text-white">02</span>
                  </div>
                </div>
                <h3 className="text-2xl font-light text-zinc-900 dark:text-white mb-6 tracking-wide">Global Network</h3>
                <p className="text-zinc-600 dark:text-white/50 text-base leading-relaxed font-light">
                  Access to certified installation partners worldwide, ensuring professional 
                  fitment and optimal performance of all components.
                </p>
              </AnimatedCard>
            </AnimatedSection>

            {/* Premium Support */}
            <AnimatedSection delay={0.5}>
              <AnimatedCard className="bg-white dark:bg-zinc-900/30 p-12 hover:shadow-2xl dark:hover:bg-zinc-900/50 transition-all duration-500 h-full">
                <div className="mb-8">
                  <div className="w-16 h-16 flex items-center justify-center border border-zinc-200 dark:border-white/10">
                    <span className="text-3xl font-extralight text-zinc-900 dark:text-white">03</span>
                  </div>
                </div>
                <h3 className="text-2xl font-light text-zinc-900 dark:text-white mb-6 tracking-wide">Premium Support</h3>
                <p className="text-zinc-600 dark:text-white/50 text-base leading-relaxed font-light">
                  Comprehensive after-sales support and technical assistance to ensure 
                  complete satisfaction with every purchase.
                </p>
              </AnimatedCard>
            </AnimatedSection>
          </div>
        </div>
      </section>


      {/* Brands Showcase - Clean Grid Style */}
      <section className="bg-white dark:bg-black py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <AnimatedSection delay={0.2}>
            <div className="text-center mb-24">
              <h2 className="text-4xl md:text-6xl font-extralight text-zinc-900 dark:text-white mb-8 tracking-tight">
                Premium <span className="font-light">Brands</span>
              </h2>
              <div className="w-32 h-px bg-zinc-300 dark:bg-white/20 mx-auto mb-10" />
              <p className="text-zinc-600 dark:text-white/50 max-w-3xl mx-auto text-lg font-light">
                We represent over 200+ world-leading brands in performance automotive and motorcycle parts
              </p>
            </div>
          </AnimatedSection>

          {/* Automotive Brands Carousel */}
          <AnimatedSection delay={0.4}>
            <div className="mb-20">
              <BrandCarousel 
                brands={topAutomotiveBrands}
                direction="left"
                speed={40}
                title="Automotive"
              />
            </div>
          </AnimatedSection>

          {/* Motorcycle Brands Carousel */}
          <AnimatedSection delay={0.6}>
            <div className="mb-20">
              <BrandCarousel 
                brands={topMotoBrands}
                direction="right"
                speed={35}
                title="Motorcycles"
              />
            </div>
          </AnimatedSection>

          {/* View All Button */}
          {/* <div className="text-center mt-20">
            <AnimatedButton href="/brands" variant="outline" size="lg">
              View All Brands
            </AnimatedButton>
          </div> */}
        </div>
      </section>

      {/* Product Categories Section */}
      <section className="bg-zinc-50 dark:bg-zinc-950 py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-24">
            <h2 className="text-4xl md:text-6xl font-extralight text-zinc-900 dark:text-white mb-8 tracking-tight">
              Product <span className="font-light">Categories</span>
            </h2>
            <div className="w-32 h-px bg-zinc-300 dark:bg-white/20 mx-auto" />
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
            {[
              { name: 'Exhaust Systems', desc: 'Performance exhausts, valved systems, headers' },
              { name: 'Suspension', desc: 'Coilovers, air suspension, dampers, springs' },
              { name: 'Wheels & Brakes', desc: 'Forged wheels, brake kits, calipers, rotors' },
              { name: 'Carbon Fiber', desc: 'Aero parts, interior trim, performance upgrades' },
              { name: 'Engine Tuning', desc: 'ECU tuning, intakes, turbos, superchargers' },
              { name: 'Body Kits', desc: 'Wide-body kits, splitters, diffusers, spoilers' },
              { name: 'Interior', desc: 'Seats, steering wheels, roll cages, gauges' },
              { name: 'Cooling', desc: 'Radiators, intercoolers, oil coolers' },
            ].map((category, index) => (
              <div
                key={index}
                className="bg-white dark:bg-zinc-900/30 p-10 hover:shadow-xl dark:hover:bg-zinc-900/50 transition-all duration-500 group"
              >
                <h3 className="text-xl font-light text-zinc-900 dark:text-white mb-4 tracking-wide group-hover:text-zinc-700 dark:hover:text-white/90 transition-colors">
                  {category.name}
                </h3>
                <p className="text-zinc-500 dark:text-white/40 text-sm leading-relaxed font-light">
                  {category.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact CTA Section */}
      <section className="bg-white dark:bg-black py-40 px-6">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="text-4xl md:text-6xl font-extralight text-zinc-900 dark:text-white mb-12 tracking-tight leading-tight">
            Ready to <span className="font-light">Upgrade</span>?
          </h2>
          <div className="w-32 h-px bg-zinc-300 dark:bg-white/20 mx-auto mb-16" />
          <p className="text-zinc-600 dark:text-white/50 text-xl md:text-2xl mb-16 max-w-3xl mx-auto leading-relaxed font-light">
            Contact our specialists for personalized recommendations and expert advice on premium performance parts
          </p>
          <AnimatedButton href="/contact" variant="outline" size="lg">
            Get In Touch
          </AnimatedButton>
        </div>
      </section>
    </>
  );
};

export default LandingPage;

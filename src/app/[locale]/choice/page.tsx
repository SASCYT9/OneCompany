'use client';

import { Link } from '@/navigation';
import { useEffect, useState, useRef, useMemo } from 'react';
import { useLanguage } from '@/lib/LanguageContext';
import { BrandExpandableCard } from '@/components/ui/BrandExpandableCard';
import CategoriesGrid from '@/components/sections/CategoriesGrid';
import BrandsMarquee from '@/components/sections/BrandsMarquee';
import { mainCategories } from '@/lib/data';
import StatsStrip from '@/components/ui/StatsStrip';
import gsap from 'gsap';
import { createSeededRandom } from '@/lib/random';

const allBrands = [
  { name: 'Akrapovič', logo: '/logos/akrapovi.png', category: 'Exhaust', popular: true },
  { name: 'Brembo', logo: '/logos/brembo.png', category: 'Brakes', popular: true },
  { name: 'Ohlins', logo: '/logos/ohlins.png', category: 'Suspension', popular: true },
  { name: 'Pirelli', logo: '/logos/pirelli.png', category: 'Tires', popular: true },
  { name: 'Sparco', logo: '/logos/sparco.png', category: 'Seats', popular: true },
  { name: 'Recaro', logo: '/logos/recaro.png', category: 'Seats', popular: true },
  { name: 'H&R', logo: '/logos/hr.png', category: 'Suspension', popular: true },
  { name: 'KW', logo: '/logos/kw.svg', category: 'Suspension', popular: true },
  { name: 'Bilstein', logo: '/logos/bilstein.png', category: 'Suspension', popular: true },
  { name: 'Eibach', logo: '/logos/eibach.png', category: 'Suspension', popular: true },
  { name: 'Fox', logo: '/logos/fox.png', category: 'Suspension', popular: true },
  { name: 'Tein', logo: '/logos/tein.png', category: 'Suspension', popular: true },
  { name: 'Endless', logo: '/logos/endless.png', category: 'Brakes', popular: true },
  { name: 'Ferodo', logo: '/logos/ferodo.png', category: 'Brakes', popular: true },
  { name: 'Pagid', logo: '/logos/pagid.png', category: 'Brakes', popular: true },
  { name: 'Mintex', logo: '/logos/mintex.png', category: 'Brakes', popular: true },
  { name: 'Bosch', logo: '/logos/bosch.png', category: 'Electronics', popular: true },
  { name: 'NGK', logo: '/logos/ngk.png', category: 'Electronics', popular: true },
  { name: 'Denso', logo: '/logos/denso.png', category: 'Electronics', popular: true },
  { name: 'Mann-Filter', logo: '/logos/mann-filter.png', category: 'Filters', popular: true },
  { name: 'Mahle', logo: '/logos/mahle.png', category: 'Filters', popular: true },
  { name: 'K&N', logo: '/logos/kn.png', category: 'Filters', popular: true },
  { name: 'AEM', logo: '/logos/aem.png', category: 'Electronics', popular: true },
  { name: 'Greddy', logo: '/logos/greddy.png', category: 'Tuning', popular: true },
  { name: 'HKS', logo: '/logos/hks.png', category: 'Tuning', popular: true },
  { name: 'Mugen', logo: '/logos/mugen.png', category: 'Tuning', popular: true },
  { name: 'Spoon', logo: '/logos/spoon.png', category: 'Tuning', popular: true },
  { name: 'Omni Power', logo: '/logos/omni-power.png', category: 'Tuning', popular: true },
  { name: 'Apexi', logo: '/logos/apexi.png', category: 'Tuning', popular: true },
  { name: 'Defi', logo: '/logos/defi.png', category: 'Tuning', popular: true },
  { name: 'Innovate Motorsports', logo: '/logos/innovate-motorsports.png', category: 'Tuning', popular: true },
  { name: 'Cobra', logo: '/logos/cobra.png', category: 'Exhaust', popular: true },
  { name: 'Flowmaster', logo: '/logos/flowmaster.png', category: 'Exhaust', popular: true },
  { name: 'MagnaFlow', logo: '/logos/magnaflow.png', category: 'Exhaust', popular: true },
  { name: 'Borla', logo: '/logos/borla.png', category: 'Exhaust', popular: true },
  { name: 'Gibson', logo: '/logos/gibson.png', category: 'Exhaust', popular: true },
  { name: 'Heartthrob', logo: '/logos/heartthrob.png', category: 'Exhaust', popular: true },
  { name: 'Pypes', logo: '/logos/pypes.png', category: 'Exhaust', popular: true },
  { name: 'Roush', logo: '/logos/roush.png', category: 'Exhaust', popular: true },
  { name: 'Steeda', logo: '/logos/steeda.png', category: 'Exhaust', popular: true },
  { name: 'Shelby', logo: '/logos/shelby.png', category: 'Exhaust', popular: true },
  { name: 'Saleen', logo: '/logos/saleen.png', category: 'Exhaust', popular: true },
  { name: 'Trd', logo: '/logos/trd.png', category: 'Exhaust', popular: true },
  { name: 'Nismo', logo: '/logos/nismo.png', category: 'Exhaust', popular: true },
  { name: 'Rays', logo: '/logos/rays.png', category: 'Wheels', popular: true },
  { name: 'OZ Racing', logo: '/logos/oz-racing.png', category: 'Wheels', popular: true },
  { name: 'Enkei', logo: '/logos/enkei.png', category: 'Wheels', popular: true },
  { name: 'HRE', logo: '/logos/hre.png', category: 'Wheels', popular: true },
  { name: 'Forgeline', logo: '/logos/forgeline.png', category: 'Wheels', popular: true },
  { name: 'Rotiform', logo: '/logos/rotiform.png', category: 'Wheels', popular: true },
  { name: 'Vossen', logo: '/logos/vossen.png', category: 'Wheels', popular: true },
  { name: 'Alpina', logo: '/logos/alpina.png', category: 'Tuning', popular: true },
  { name: 'Brabus', logo: '/logos/brabus.png', category: 'Tuning', popular: true },
  { name: 'Carlsson', logo: '/logos/carlsson.png', category: 'Tuning', popular: true },
  { name: 'G-Power', logo: '/logos/g-power.png', category: 'Tuning', popular: true },
  { name: 'Hamann', logo: '/logos/hamann.png', category: 'Tuning', popular: true },
  { name: 'Kleemann', logo: '/logos/kleemann.png', category: 'Tuning', popular: true },
  { name: 'Lorinsser', logo: '/logos/lorinsser.png', category: 'Tuning', popular: true },
  { name: 'Rieger', logo: '/logos/rieger.png', category: 'Tuning', popular: true },
  { name: 'Zender', logo: '/logos/zender.png', category: 'Tuning', popular: true },
  { name: 'TechArt', logo: '/logos/techart.png', category: 'Tuning', popular: true },
  { name: 'AC Schnitzer', logo: '/logos/ac-schnitzer.png', category: 'Tuning', popular: true },
  { name: 'Bridgestone', logo: '/logos/bridgestone.png', category: 'Tires', popular: true },
  { name: 'Continental', logo: '/logos/continental.png', category: 'Tires', popular: true },
  { name: 'Dunlop', logo: '/logos/dunlop.png', category: 'Tires', popular: true },
  { name: 'Goodyear', logo: '/logos/goodyear.png', category: 'Tires', popular: true },
  { name: 'Hankook', logo: '/logos/hankook.png', category: 'Tires', popular: true },
  { name: 'Michelin', logo: '/logos/michelin.png', category: 'Tires', popular: true },
  { name: 'Nokian', logo: '/logos/nokian.png', category: 'Tires', popular: true },
  { name: 'Pirelli', logo: '/logos/pirelli.png', category: 'Tires', popular: true },
  { name: 'Uniroyal', logo: '/logos/uniroyal.png', category: 'Tires', popular: true },
  { name: 'Yokohama', logo: '/logos/yokohama.png', category: 'Tires', popular: true },
  { name: 'Alpina', logo: '/logos/alpina.png', category: 'Tuning', popular: true },
  { name: 'Brabus', logo: '/logos/brabus.png', category: 'Tuning', popular: true },
  { name: 'Carlsson', logo: '/logos/carlsson.png', category: 'Tuning', popular: true },
  { name: 'G-Power', logo: '/logos/g-power.png', category: 'Tuning', popular: true },
  { name: 'Hamann', logo: '/logos/hamann.png', category: 'Tuning', popular: true },
  { name: 'Kleemann', logo: '/logos/kleemann.png', category: 'Tuning', popular: true },
  { name: 'Lorinsser', logo: '/logos/lorinsser.png', category: 'Tuning', popular: true },
  { name: 'Rieger', logo: '/logos/rieger.png', category: 'Tuning', popular: true },
  { name: 'Zender', logo: '/logos/zender.png', category: 'Tuning', popular: true },
  { name: 'TechArt', logo: '/logos/techart.png', category: 'Tuning', popular: true },
  { name: 'AC Schnitzer', logo: '/logos/ac-schnitzer.png', category: 'Tuning', popular: true },
];

export default function ChoicePage() {
  const { t } = useLanguage();
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [hover, setHover] = useState<'auto' | 'moto' | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const autoRef = useRef<HTMLAnchorElement>(null);
  const motoRef = useRef<HTMLAnchorElement>(null);
  const particlesRef = useRef<HTMLDivElement>(null);
  const floatingParticles = useMemo(() => {
    const rand = createSeededRandom(1212);
    return Array.from({ length: 30 }, () => ({
      left: `${rand() * 100}%`,
      top: `${rand() * 100}%`,
    }));
  }, []);

  useEffect(() => {
    setMounted(true);

    // GSAP Magic Entrance Animation
    const tl = gsap.timeline();
    
    tl.from(autoRef.current, {
      x: -100,
      opacity: 0,
      duration: 1.2,
      ease: 'power4.out',
    })
    .from(motoRef.current, {
      x: 100,
      opacity: 0,
      duration: 1.2,
      ease: 'power4.out',
    }, '-=0.8');

    // Floating particles animation
    if (particlesRef.current) {
      const particles = particlesRef.current.children;
      Array.from(particles).forEach((particle, i) => {
        gsap.to(particle, {
          y: 'random(-100, 100)',
          x: 'random(-100, 100)',
          duration: 'random(3, 6)',
          repeat: -1,
          yoyo: true,
          ease: 'sine.inOut',
          delay: i * 0.1,
        });
      });
    }
  }, []);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white/60 text-sm tracking-widest uppercase">{t.choice.loading}</div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="min-h-screen w-full grid grid-cols-1 md:grid-cols-2 text-white relative overflow-hidden"
      onMouseMove={(e) => setPos({ x: e.clientX, y: e.clientY })}
      style={{ background: 'radial-gradient(1200px 600px at 50% -10%, rgba(255,255,255,0.06), transparent 60%), linear-gradient(180deg, #0b0b0d, #0d0d10)' }}
    >
      {/* SEO H1 - visually hidden but accessible */}
      <h1 className="sr-only">OneCompany — Оберіть напрям тюнінгу: Авто чи Мото</h1>

      {/* Floating Particles Background */}
      <div ref={particlesRef} className="absolute inset-0 pointer-events-none z-0">
        {floatingParticles.map((particle, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-white/20 rounded-full"
            style={{
              left: particle.left,
              top: particle.top,
              filter: 'blur(1px)',
            }}
          />
        ))}
      </div>

      {/* Animated gradient orbs */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div 
          className="absolute w-96 h-96 bg-orange-500/10 rounded-full blur-3xl animate-pulse"
          style={{
            left: `${pos.x * 0.05}px`,
            top: `${pos.y * 0.05}px`,
            transition: 'all 0.3s ease-out',
          }}
        />
        <div 
          className="absolute w-96 h-96 bg-rose-500/10 rounded-full blur-3xl animate-pulse"
          style={{
            right: `${pos.x * 0.03}px`,
            bottom: `${pos.y * 0.03}px`,
            transition: 'all 0.3s ease-out',
            animationDelay: '1s',
          }}
        />
      </div>

      {/* Left - Automotive */}
      <Link
        ref={autoRef}
        href="/auto"
        className="relative h-[50svh] md:h-screen flex items-center justify-center overflow-hidden group z-10"
        onMouseEnter={() => {
          setHover('auto');
          gsap.to(autoRef.current, {
            scale: 1.02,
            duration: 0.6,
            ease: 'power2.out',
          });
        }}
        onMouseLeave={() => {
          setHover(null);
          gsap.to(autoRef.current, {
            scale: 1,
            duration: 0.6,
            ease: 'power2.out',
          });
        }}
      >
        {/* Background video */}
        <div className="absolute inset-0 overflow-hidden">
          <video
            autoPlay
            muted
            loop
            playsInline
            className="absolute top-1/2 left-1/2 w-full h-full object-cover -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-30 group-hover:opacity-50 transition-opacity duration-700"
          >
            <source src="/videos/eventuri-intake.mp4#t=15" type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/60" />
        </div>
        <PanelBackdrop active={hover === 'auto'} x={pos.x} y={pos.y} accent="from-orange-400/30 via-rose-400/25 to-amber-300/20" />
        <div className="relative z-10 text-center select-none">
          <p className="text-[10px] tracking-[0.35em] uppercase text-white/40 mb-3">{t.choice.tagline}</p>
          <h2 className="text-4xl md:text-5xl font-light tracking-tight">{t.choice.automotive}</h2>
          <p className="mt-3 text-xs tracking-[0.25em] uppercase text-white/50">{t.choice.automotiveSubtitle}</p>
        </div>
        <CornerArrow active={hover === 'auto'} />
      </Link>

      {/* Right - Motorcycles */}
      <Link
        ref={motoRef}
        href="/moto"
        className="relative h-[50svh] md:h-screen flex items-center justify-center overflow-hidden group z-10"
        onMouseEnter={() => {
          setHover('moto');
          gsap.to(motoRef.current, {
            scale: 1.02,
            duration: 0.6,
            ease: 'power2.out',
          });
        }}
        onMouseLeave={() => {
          setHover(null);
          gsap.to(motoRef.current, {
            scale: 1,
            duration: 0.6,
            ease: 'power2.out',
          });
        }}
      >
        {/* Background video */}
        <div className="absolute inset-0 overflow-hidden">
          <video
            autoPlay
            muted
            loop
            playsInline
            className="absolute top-1/2 left-1/2 w-full h-full object-cover -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-30 group-hover:opacity-50 transition-opacity duration-700"
          >
            <source src="/videos/fi-exhaust.mp4#t=20" type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/60" />
        </div>
        <PanelBackdrop active={hover === 'moto'} x={pos.x} y={pos.y} accent="from-cyan-400/30 via-sky-400/25 to-indigo-300/20" />
        <div className="relative z-10 text-center select-none">
          <p className="text-[10px] tracking-[0.35em] uppercase text-white/40 mb-3">{t.choice.tagline}</p>
          <h2 className="text-4xl md:text-5xl font-light tracking-tight">{t.choice.motorcycles}</h2>
          <p className="mt-3 text-xs tracking-[0.25em] uppercase text-white/50">{t.choice.motorcyclesSubtitle}</p>
        </div>
        <CornerArrow active={hover === 'moto'} />
      </Link>
      {/* Stats under the two panels (full width below on small screens) */}
      <div className="md:col-span-2 w-full pb-10 z-10 relative">
        <StatsStrip />
      </div>

      <CategoriesGrid 
        categories={mainCategories}
        title="Що ми пропонуємо"
        subtitle="Обирайте категорію та знаходьте найкраще для вашого авто чи мото"
      />
      <BrandsMarquee />

      {/* All Brands Section */}
      <section className="md:col-span-2 w-full pb-10 z-10 relative">
        <h2 className="text-2xl md:text-3xl font-semibold text-center mb-10">{t.choice.featuredBrands}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-8 px-4">
          {allBrands.slice(0, 8).map((brand) => (
            <BrandExpandableCard 
              key={brand.name} 
              name={brand.name}
              logo={brand.logo}
              categoryLabel={brand.category}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function PanelBackdrop({ active, x, y, accent }: { active: boolean; x: number; y: number; accent: string }) {
  return (
    <>
      {/* gradient wash */}
      <div className="absolute inset-0 bg-white/[0.02]" />
      {/* cursor spotlight */}
      <div
        className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{
          background: `radial-gradient(300px 200px at ${x}px ${y}px, rgba(255,255,255,0.08), transparent 60%)`,
        }}
      />
      {/* accent when active */}
      <div className={`absolute inset-0 bg-gradient-to-br ${accent} opacity-0 ${active ? 'opacity-100' : ''} transition-opacity duration-700 mix-blend-soft-light`} />
      {/* divider */}
      <div className="absolute inset-0 ring-1 ring-inset ring-white/10" />
    </>
  );
}

function CornerArrow({ active }: { active: boolean }) {
  return (
    <svg
      className="absolute right-6 bottom-6 w-6 h-6 text-white/40 transition-all duration-500 group-hover:text-white/80"
      style={{ transform: active ? 'translate(4px, -4px)' : 'translate(0,0)' }}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 17l10-10M17 7H9M17 7v8" />
    </svg>
  );
}

'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

interface Category {
  title: string;
  subtitle: string;
  href: string;
  icon?: string;
  gradient: string;
}

interface CategoriesGridProps {
  categories: Category[];
  title: string;
  subtitle: string;
}

export default function CategoriesGrid({ categories, title, subtitle }: CategoriesGridProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const cardsRef = useRef<(HTMLAnchorElement | null)[]>([]);

  useEffect(() => {
    const ctx = gsap.context(() => {
      cardsRef.current.forEach((card, index) => {
        gsap.from(card, {
          scrollTrigger: {
            trigger: card,
            start: 'top bottom-=100',
            toggleActions: 'play none none reverse',
          },
          y: 80,
          opacity: 0,
          duration: 0.8,
          delay: index * 0.1,
          ease: 'power3.out',
        });
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} className="relative py-32 px-6 bg-black overflow-hidden">
      {/* Background elements */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.03),transparent_70%)]" />
      
      <div className="container mx-auto relative z-10">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
            {title}
          </h2>
          <p className="text-zinc-500 text-lg">
            {subtitle}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {categories.map((category, index) => (
            <Link
              key={category.href}
              href={category.href}
              ref={(el) => {
                if (el) cardsRef.current[index] = el;
              }}
              className="group relative p-8 rounded-2xl border border-white/10 bg-zinc-950/50 backdrop-blur-sm hover:border-white/20 transition-all duration-500 overflow-hidden"
            >
              {/* Gradient overlay on hover */}
              <div className={`absolute inset-0 bg-gradient-to-br ${category.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
              
              {/* Content */}
              <div className="relative z-10">
                <div className="text-5xl mb-4 transform group-hover:scale-110 transition-transform duration-500">
                  {category.icon || ' '}
                </div>
                <h3 className="text-2xl font-bold mb-2 text-white group-hover:text-white transition-colors">
                  {category.title}
                </h3>
                <p className="text-zinc-500 text-sm group-hover:text-zinc-300 transition-colors">
                  {category.subtitle}
                </p>
              </div>

              {/* Arrow icon */}
              <div className="absolute bottom-6 right-6 w-8 h-8 flex items-center justify-center rounded-full border border-white/20 text-white/40 group-hover:border-white/60 group-hover:text-white transition-all duration-300 group-hover:translate-x-1 group-hover:-translate-y-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

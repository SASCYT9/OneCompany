'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';

export function Navigation() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const stores = [
    {
      name: 'KW',
      url: 'https://kwsuspension.shop/',
      color: 'from-orange-500 to-red-600',
    },
    {
      name: 'Fi Exhaust',
      url: 'https://fiexhaust.shop/',
      color: 'from-blue-500 to-cyan-600',
    },
    {
      name: 'Eventuri',
      url: 'https://eventuri.shop/',
      color: 'from-purple-500 to-pink-600',
    },
  ];

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-700 ease-out`}
      style={{
        background: isScrolled 
          ? 'rgba(0, 0, 0, 0.4)' 
          : 'rgba(0, 0, 0, 0.1)',
        backdropFilter: isScrolled 
          ? 'blur(40px) saturate(180%)' 
          : 'blur(20px) saturate(150%)',
        boxShadow: isScrolled
          ? 'inset 0 -1px 0 0 rgba(255,255,255,0.08), 0 4px 24px rgba(0,0,0,0.3)'
          : 'inset 0 -1px 0 0 rgba(255,255,255,0.04)',
      }}
    >
      <div className="max-w-7xl mx-auto px-8 py-4">
        <div className="flex items-center justify-between">
          {/* Logo - Liquid Glass Style */}
          <Link href="/" className="group flex items-center gap-2">
            <span className="text-3xl font-thin tracking-tight transition-all duration-500 group-hover:scale-105">
              <span className="text-white/90">one</span><span 
                className="font-light bg-gradient-to-br from-orange-400 via-red-400 to-blue-400 bg-clip-text text-transparent"
                style={{
                  filter: 'drop-shadow(0 0 12px rgba(255,136,0,0.3))',
                }}
              >company</span>
            </span>
          </Link>          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            {/* Stores Dropdown */}
            <div className="group relative">
                <button className="px-5 py-2.5 text-white/80 hover:text-white font-light transition-all duration-500 flex items-center gap-2.5 rounded-full hover:bg-white/5">
                Магазини
                <svg className="w-3 h-3 transition-transform duration-500 group-hover:rotate-180" fill="none" viewBox="0 0 12 8">
                  <path d="M1 1L6 6L11 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
              
              {/* Dropdown - Liquid Glass */}
                <div className="absolute top-full left-0 mt-3 w-72 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-500 group-hover:translate-y-0 -translate-y-2">
                  <div 
                    className="rounded-3xl overflow-hidden"
                    style={{
                      background: 'rgba(0, 0, 0, 0.6)',
                      backdropFilter: 'blur(60px) saturate(180%)',
                      boxShadow: `
                        inset 0 1px 0 0 rgba(255,255,255,0.1),
                        0 12px 48px rgba(0,0,0,0.6),
                        0 0 0 1px rgba(255,255,255,0.08)
                      `,
                    }}
                  >
                  {stores.map((store, idx) => (
                    <Link
                      key={store.name}
                      href={store.url}
                      target="_blank"
                      rel="noopener noreferrer"
                        className="block px-7 py-5 text-white/80 hover:text-white transition-all duration-400 group/item relative overflow-hidden"
                        style={{
                          borderBottom: idx < stores.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                        }}
                    >
                      {/* Hover Glow */}
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 group-hover/item:opacity-100 transition-opacity duration-500" />
                      
                      <div className="relative z-10 flex items-center justify-between">
                          <span className="font-light tracking-wide">{store.name}</span>
                          <span 
                            className={`w-2 h-2 rounded-full bg-gradient-to-r ${store.color} opacity-0 group-hover/item:opacity-100 transition-all duration-400 group-hover/item:scale-125`}
                            style={{
                              boxShadow: '0 0 12px currentColor',
                            }}
                          />
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            {/* Other Links */}
            <Link
              href="/about"
              className={`px-5 py-2.5 font-light transition-all duration-500 rounded-full ${
                pathname === '/about'
                  ? 'text-white bg-white/5'
                  : 'text-white/80 hover:text-white hover:bg-white/5'
              }`}
            >
              Про нас
            </Link>

            {/* CTA Button - Liquid Glass */}
            <Link
              href="/#stores"
              className="relative px-8 py-3.5 rounded-full text-white font-medium transition-all duration-700 overflow-hidden group"
              style={{
                background: 'rgba(255,136,0,0.15)',
                backdropFilter: 'blur(20px) saturate(180%)',
                boxShadow: `
                  inset 0 1px 0 0 rgba(255,255,255,0.15),
                  0 4px 20px rgba(255,136,0,0.2),
                  0 0 0 1px rgba(255,136,0,0.2)
                `,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.05) translateY(-1px)'
                e.currentTarget.style.boxShadow = `
                  inset 0 1px 0 0 rgba(255,255,255,0.2),
                  0 8px 32px rgba(255,136,0,0.4),
                  0 0 0 1px rgba(255,136,0,0.4)
                `
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1) translateY(0)'
                e.currentTarget.style.boxShadow = `
                  inset 0 1px 0 0 rgba(255,255,255,0.15),
                  0 4px 20px rgba(255,136,0,0.2),
                  0 0 0 1px rgba(255,136,0,0.2)
                `
              }}
            >
              <span className="relative z-10 tracking-wide">Обрати магазин</span>
              
              {/* Shimmer */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
            </Link>
          </div>          {/* Mobile Menu Button */}
          <button
            className="md:hidden relative w-10 h-10 text-white"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            <span className="sr-only">Menu</span>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
              <span
                className={`block w-6 h-0.5 bg-white transition-all duration-300 ${
                  isMobileMenuOpen ? 'rotate-45 translate-y-0.5' : '-translate-y-1.5'
                }`}
              />
              <span
                className={`block w-6 h-0.5 bg-white transition-all duration-300 ${
                  isMobileMenuOpen ? 'opacity-0' : 'opacity-100'
                }`}
              />
              <span
                className={`block w-6 h-0.5 bg-white transition-all duration-300 ${
                  isMobileMenuOpen ? '-rotate-45 -translate-y-0.5' : 'translate-y-1.5'
                }`}
              />
            </div>
          </button>
        </div>

        {/* Mobile Menu */}
        <div
          className={`md:hidden transition-all duration-500 overflow-hidden ${
            isMobileMenuOpen ? 'max-h-screen opacity-100 mt-6' : 'max-h-0 opacity-0'
          }`}
        >
          <div className="flex flex-col gap-4 py-4 border-t border-white/10">
            <Link
              href="/about"
              className="px-4 py-2 text-white/60 hover:text-white font-thin transition-colors"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Про нас
            </Link>
            
            <div className="px-4 pt-2 border-t border-white/10">
              <p className="text-xs uppercase tracking-wider text-white/40 mb-3">Магазини</p>
              {stores.map((store) => (
                <Link
                  key={store.name}
                  href={store.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block py-2 text-white/60 hover:text-white font-thin transition-colors"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {store.name} →
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}

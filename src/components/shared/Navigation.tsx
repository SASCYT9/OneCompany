'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavigationProps {
  currentBrand?: 'kw' | 'fi' | 'eventuri' | 'home';
}

export function Navigation({ currentBrand = 'home' }: NavigationProps) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  const brands = [
    { 
      id: 'kw', 
      name: 'KW Suspension', 
      href: '/kw',
      color: 'from-orange-500 to-amber-600',
      description: 'Німецька точність'
    },
    { 
      id: 'fi', 
      name: 'Fi Exhaust', 
      href: '/fi',
      color: 'from-red-500 to-rose-600',
      description: 'Звук перемоги'
    },
    { 
      id: 'eventuri', 
      name: 'Eventuri', 
      href: '/eventuri',
      color: 'from-blue-500 to-cyan-600',
      description: 'Інженерна досконалість'
    },
  ];

  const getBrandColor = () => {
    switch (currentBrand) {
      case 'kw': return 'border-amber-500/50 bg-amber-500/10';
      case 'fi': return 'border-red-500/50 bg-red-500/10';
      case 'eventuri': return 'border-blue-500/50 bg-blue-500/10';
      default: return 'border-white/20 bg-white/5';
    }
  };

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 border-b backdrop-blur-xl ${getBrandColor()} transition-all duration-300`}>
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="group flex items-center gap-3">
            <div className="text-2xl font-light tracking-tight">
              <span className="bg-gradient-to-r from-amber-200 via-amber-400 to-amber-200 bg-clip-text text-transparent">
                one
              </span>
              <span className="text-white">company</span>
            </div>
            {currentBrand !== 'home' && (
              <span className="text-white/40 text-sm">
                / {brands.find(b => b.id === currentBrand)?.name}
              </span>
            )}
          </Link>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center gap-8">
            {brands.map((brand) => (
              <Link
                key={brand.id}
                href={brand.href}
                className={`group relative px-4 py-2 rounded-lg transition-all duration-300 ${
                  pathname === brand.href
                    ? `bg-gradient-to-r ${brand.color} text-white shadow-lg`
                    : 'text-white/70 hover:text-white hover:bg-white/5'
                }`}
              >
                <span className="font-medium">{brand.name}</span>
                {pathname === brand.href && (
                  <div className="absolute -bottom-1 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-white to-transparent" />
                )}
              </Link>
            ))}
            <Link
              href="/about"
              className="text-white/70 hover:text-white px-4 py-2 rounded-lg hover:bg-white/5 transition-all"
            >
              Про нас
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden p-2 text-white/70 hover:text-white"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {isOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile Menu */}
        {isOpen && (
          <div className="md:hidden mt-4 pt-4 border-t border-white/10 space-y-2">
            {brands.map((brand) => (
              <Link
                key={brand.id}
                href={brand.href}
                onClick={() => setIsOpen(false)}
                className={`block px-4 py-3 rounded-lg transition-all ${
                  pathname === brand.href
                    ? `bg-gradient-to-r ${brand.color} text-white`
                    : 'text-white/70 hover:bg-white/5'
                }`}
              >
                <div className="font-medium">{brand.name}</div>
                <div className="text-sm opacity-60">{brand.description}</div>
              </Link>
            ))}
            <Link
              href="/about"
              onClick={() => setIsOpen(false)}
              className="block px-4 py-3 rounded-lg text-white/70 hover:bg-white/5 transition-all"
            >
              Про нас
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}

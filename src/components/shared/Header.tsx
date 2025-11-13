'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import ThemeToggle from '@/components/ui/ThemeToggle';
import { usePathname } from 'next/navigation';

const Header = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  
  const currentLocale = pathname.startsWith('/en') ? 'en' : 'ua';
  
  const getToggleLanguagePath = () => {
    if (currentLocale === 'ua') {
      return pathname.replace('/ua', '/en');
    } else {
      return pathname.replace('/en', '/ua');
    }
  };

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header 
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled 
          ? 'bg-white/95 dark:bg-black/95 backdrop-blur-sm border-b border-zinc-200 dark:border-white/10' 
          : 'bg-transparent'
      }`}
    >
      <div className="container mx-auto px-6 py-6">
        <div className="flex items-center justify-between">
          {/* Logo - Minimal */}
          <Link href={`/${currentLocale}`} className="text-xl font-light text-zinc-900 dark:text-white tracking-wider hover:opacity-70 transition-opacity">
            ONECOMPANY
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-10">
            {[
              { href: '', label: 'Home' },
              { href: '/brands', label: 'Automotive' },
              { href: '/brands/moto', label: 'Motorcycles' },
              { href: '/about', label: 'About Us' },
              { href: '/contact', label: 'Contact' },
            ].map((link) => (
              <Link
                key={link.label}
                href={`/${currentLocale}${link.href}`}
                className="text-zinc-600 dark:text-white/70 hover:text-zinc-900 dark:hover:text-white transition-colors text-sm font-light uppercase tracking-wider"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Language & CTA */}
          <div className="hidden lg:flex items-center gap-6">
            {/* Language Switcher - Minimal */}
            <div className="flex items-center gap-1 border border-zinc-300 dark:border-white/20 rounded">
              <Link
                href={currentLocale === 'ua' ? getToggleLanguagePath() : pathname}
                className={`px-3 py-1.5 text-xs font-light uppercase tracking-wider transition-all ${
                  currentLocale === 'ua'
                    ? 'bg-black text-white dark:bg-white dark:text-black'
                    : 'text-zinc-500 dark:text-white/60 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                UA
              </Link>
              <Link
                href={currentLocale === 'en' ? pathname : getToggleLanguagePath()}
                className={`px-3 py-1.5 text-xs font-light uppercase tracking-wider transition-all ${
                  currentLocale === 'en'
                    ? 'bg-black text-white dark:bg-white dark:text-black'
                    : 'text-zinc-500 dark:text-white/60 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                EN
              </Link>
            </div>

            {/* Theme Toggle */}
            <ThemeToggle />

            {/* CTA - Minimal */}
            <Link 
              href={`/${currentLocale}/contact`}
              className="border border-zinc-400 dark:border-white/30 hover:border-zinc-900 dark:hover:border-white hover:bg-zinc-900 dark:hover:bg-white hover:text-white dark:hover:text-black px-6 py-2 text-zinc-900 dark:text-white text-xs font-light uppercase tracking-wider transition-all duration-300"
            >
              Get Quote
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden text-zinc-900 dark:text-white"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <nav className="lg:hidden mt-8 pb-6 flex flex-col gap-6 border-t border-zinc-200 dark:border-white/10 pt-6">
            {[
              { href: '', label: 'Home' },
              { href: '/brands', label: 'Automotive' },
              { href: '/brands/moto', label: 'Motorcycles' },
              { href: '/about', label: 'About Us' },
              { href: '/contact', label: 'Contact' },
            ].map((link) => (
              <Link
                key={link.label}
                href={`/${currentLocale}${link.href}`}
                className="text-zinc-600 dark:text-white/70 hover:text-zinc-900 dark:hover:text-white transition-colors text-sm font-light uppercase tracking-wider"
                onClick={() => setMobileMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            
            {/* Mobile Language Switcher */}
            <div className="flex items-center gap-1 border border-zinc-300 dark:border-white/20 rounded w-24">
              <Link
                href={currentLocale === 'ua' ? getToggleLanguagePath() : pathname}
                className={`px-3 py-1.5 text-xs font-light uppercase tracking-wider transition-all ${
                  currentLocale === 'ua' ? 'bg-black text-white dark:bg-white dark:text-black' : 'text-zinc-500 dark:text-white/60'
                }`}
              >
                UA
              </Link>
              <Link
                href={currentLocale === 'en' ? pathname : getToggleLanguagePath()}
                className={`px-3 py-1.5 text-xs font-light uppercase tracking-wider transition-all ${
                  currentLocale === 'en' ? 'bg-black text-white dark:bg-white dark:text-black' : 'text-zinc-500 dark:text-white/60'
                }`}
              >
                EN
              </Link>
            </div>

            {/* Mobile Theme Toggle */}
            <div className="pt-4 border-t border-zinc-200 dark:border-white/10">
              <ThemeToggle />
            </div>
          </nav>
        )}
      </div>
    </header>
  );
};

export default Header;

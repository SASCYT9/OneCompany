'use client';

import Link from 'next/link';
import { Logo } from '@/components/ui/Logo';
import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';

export function LocalizedNavigation() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('nav');

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const stores = [
    { name: 'KW', url: 'https://kwsuspension.shop/' },
    { name: 'Fi Exhaust', url: 'https://fiexhaust.shop/' },
    { name: 'Eventuri', url: 'https://eventuri.shop/' }
  ];

  function switchLocale(nextLocale: string) {
    if (!pathname) return;
    const parts = pathname.split('/');
    // ['', 'ua', ...] or ['', 'en', ...]
    if (parts.length > 1) parts[1] = nextLocale;
    const nextPath = parts.join('/') || '/';
    router.push(nextPath);
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 transition-all duration-700 ease-out" style={{ background: isScrolled ? 'rgba(0, 0, 0, 0.4)' : 'rgba(0, 0, 0, 0.1)', backdropFilter: isScrolled ? 'blur(40px) saturate(180%)' : 'blur(20px) saturate(150%)', boxShadow: isScrolled ? 'inset 0 -1px 0 0 rgba(255,255,255,0.08), 0 4px 24px rgba(0,0,0,0.3)' : 'inset 0 -1px 0 0 rgba(255,255,255,0.04)' }}>
      <div className="max-w-7xl mx-auto px-8 py-4">
        <div className="flex items-center justify-between">
          <Logo asLink priority className="w-48" tone="light" />
          <div className="hidden md:flex items-center gap-8">
            <div className="group relative">
              <button className="px-5 py-2.5 text-white/80 hover:text-white font-light transition-all duration-500 flex items-center gap-2.5 rounded-full hover:bg-white/5">
                {t('stores')}
                <svg className="w-3 h-3 transition-transform duration-500 group-hover:rotate-180" fill="none" viewBox="0 0 12 8"><path d="M1 1L6 6L11 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </button>
              <div className="absolute top-full left-0 mt-3 w-72 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-500 group-hover:translate-y-0 -translate-y-2">
                <div className="rounded-3xl overflow-hidden" style={{ background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(60px) saturate(180%)', boxShadow: 'inset 0 1px 0 0 rgba(255,255,255,0.1), 0 12px 48px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.08)' }}>
                  {stores.map((store) => (
                    <Link key={store.name} href={store.url} target="_blank" rel="noopener noreferrer" className="block px-7 py-5 text-white/80 hover:text-white transition-all">
                      {store.name}
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 px-3 py-2 rounded-full bg-white/5">
              <button onClick={() => switchLocale('ua')} className={'px-3 py-1 text-sm font-light rounded-full transition-all duration-300 ' + (locale === 'ua' ? 'text-white bg-white/10' : 'text-white/60 hover:text-white/80')}>UA</button>
              <button onClick={() => switchLocale('en')} className={'px-3 py-1 text-sm font-light rounded-full transition-all duration-300 ' + (locale === 'en' ? 'text-white bg-white/10' : 'text-white/60 hover:text-white/80')}>EN</button>
            </div>

            <Link href="categories" className={'px-5 py-2.5 font-light transition-all duration-500 rounded-full ' + (pathname?.endsWith('/categories') ? 'text-white bg-white/5' : 'text-white/80 hover:text-white hover:bg-white/5')}>
              {t('categories', { default: locale === 'ua' ? 'Категорії' : 'Categories' })}
            </Link>
            <Link href="about" className={'px-5 py-2.5 font-light transition-all duration-500 rounded-full ' + (pathname?.endsWith('/about') ? 'text-white bg-white/5' : 'text-white/80 hover:text-white hover:bg-white/5')}>
              {t('about')}
            </Link>
            <Link href="contact" className={'px-5 py-2.5 font-light transition-all duration-500 rounded-full ' + (pathname?.endsWith('/contact') ? 'text-white bg-white/5' : 'text-white/80 hover:text-white hover:bg-white/5')}>
              {t('contact')}
            </Link>
          </div>

          <button className="md:hidden relative w-10 h-10 text-white" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
            <span className="sr-only">Menu</span>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
              <span className={'block w-6 h-0.5 bg-white transition-all duration-300 ' + (isMobileMenuOpen ? 'rotate-45 translate-y-0.5' : '-translate-y-1.5')} />
              <span className={'block w-6 h-0.5 bg-white transition-all duration-300 ' + (isMobileMenuOpen ? 'opacity-0' : 'opacity-100')} />
              <span className={'block w-6 h-0.5 bg-white transition-all duration-300 ' + (isMobileMenuOpen ? '-rotate-45 -translate-y-0.5' : 'translate-y-1.5')} />
            </div>
          </button>
        </div>

        <div className={'md:hidden transition-all duration-500 overflow-hidden ' + (isMobileMenuOpen ? 'max-h-screen opacity-100 mt-6' : 'max-h-0 opacity-0')}>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex items-center gap-2 px-4">
              <button onClick={() => { switchLocale('ua'); setIsMobileMenuOpen(false); }} className={'px-4 py-2 text-sm font-light rounded-full transition-all duration-300 ' + (locale === 'ua' ? 'text-white bg-white/10' : 'text-white/60 hover:text-white/80')}>UA</button>
              <button onClick={() => { switchLocale('en'); setIsMobileMenuOpen(false); }} className={'px-4 py-2 text-sm font-light rounded-full transition-all duration-300 ' + (locale === 'en' ? 'text-white bg-white/10' : 'text-white/60 hover:text-white/80')}>EN</button>
            </div>
            <Link href="categories" className="px-4 py-2 text-white/60 hover:text-white font-light transition-colors" onClick={() => setIsMobileMenuOpen(false)}>
              {t('categories', { default: locale === 'ua' ? 'Категорії' : 'Categories' })}
            </Link>
            <Link href="about" className="px-4 py-2 text-white/60 hover:text-white font-light transition-colors" onClick={() => setIsMobileMenuOpen(false)}>{t('about')}</Link>
            <Link href="contact" className="px-4 py-2 text-white/60 hover:text-white font-light transition-colors" onClick={() => setIsMobileMenuOpen(false)}>{t('contact')}</Link>
          </div>
        </div>
      </div>
    </nav>
  );
}

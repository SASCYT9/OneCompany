'use client';

import Link from 'next/link';
import { Logo } from '@/components/ui/Logo';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useLanguage } from '@/lib/LanguageContext';
import { yearsOfExcellence, foundedYear } from '@/lib/company';

export function Navigation() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const { locale, setLocale, t } = useLanguage();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const stores = [
    { name: 'KW', url: 'https://kwsuspension.shop/', color: 'from-orange-500 to-red-600' },
    { name: 'Fi Exhaust', url: 'https://fiexhaust.shop/', color: 'from-blue-500 to-cyan-600' },
    { name: 'Eventuri', url: 'https://eventuri.shop/', color: 'from-purple-500 to-pink-600' },
  ];
  const extraLinks = [
    { href: '/auto', labelUa: 'Авто', labelEn: 'Automotive' },
    { href: '/moto', labelUa: 'Мото', labelEn: 'Moto' },
    { href: '/categories', labelUa: 'Категорії', labelEn: 'Categories' },
  ];

  const [contactOpen, setContactOpen] = useState(false);
  const [formState, setFormState] = useState<'idle'|'submitting'|'success'|'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [payload, setPayload] = useState({
    type: 'auto' as 'auto' | 'moto',
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  const years = yearsOfExcellence();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (formState === 'submitting') return;
    setFormState('submitting');
    setErrorMsg(null);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Failed');
      setFormState('success');
      setTimeout(() => { setContactOpen(false); setFormState('idle'); setPayload({ type: 'auto', name: '', email: '', subject: '', message: '' }); }, 2000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error';
      setErrorMsg(message);
      setFormState('error');
      setTimeout(() => setFormState('idle'), 2500);
    }
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 transition-all duration-700 ease-out" style={{ background: isScrolled ? 'rgba(0, 0, 0, 0.4)' : 'rgba(0, 0, 0, 0.1)', backdropFilter: isScrolled ? 'blur(40px) saturate(180%)' : 'blur(20px) saturate(150%)', boxShadow: isScrolled ? 'inset 0 -1px 0 0 rgba(255,255,255,0.08), 0 4px 24px rgba(0,0,0,0.3)' : 'inset 0 -1px 0 0 rgba(255,255,255,0.04)' }}>
      <div className="max-w-7xl mx-auto px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo
              asLink
              priority
              className="w-40 transition-transform duration-500 hover:scale-[1.02]"
              tone="light"
            />
            <span className="hidden sm:block text-[11px] font-light text-white/60 tracking-wide">
              {locale === 'ua' ? `З ${foundedYear} • ${years}+ років довіри` : `Since ${foundedYear} • ${years}+ years trusted`}
            </span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <div className="group relative">
              <button className="px-5 py-2.5 text-white/80 hover:text-white font-light transition-all duration-500 flex items-center gap-2.5 rounded-full hover:bg-white/5">
                {t.nav.stores}
                <svg className="w-3 h-3 transition-transform duration-500 group-hover:rotate-180" fill="none" viewBox="0 0 12 8"><path d="M1 1L6 6L11 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </button>
              <div className="absolute top-full left-0 mt-3 w-72 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-500 group-hover:translate-y-0 -translate-y-2">
                <div className="rounded-3xl overflow-hidden" style={{ background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(60px) saturate(180%)', boxShadow: 'inset 0 1px 0 0 rgba(255,255,255,0.1), 0 12px 48px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.08)' }}>
                  {stores.map((store, idx) => (
                    <Link key={store.name} href={store.url} target="_blank" rel="noopener noreferrer" className="block px-7 py-5 text-white/80 hover:text-white transition-all duration-400 group/item relative overflow-hidden" style={{ borderBottom: 'none' }}>
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 group-hover/item:opacity-100 transition-opacity duration-500" />
                      <div className="relative z-10 flex items-center justify-between">
                        <span className="font-light tracking-wide">{store.name}</span>
                        <span className={'w-2 h-2 rounded-full bg-gradient-to-r ' + store.color + ' opacity-0 group-hover/item:opacity-100 transition-all duration-400 group-hover/item:scale-125'} style={{ boxShadow: '0 0 12px currentColor' }} />
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1 px-3 py-2 rounded-full bg-white/5">
              <button onClick={() => setLocale('ua')} className={'px-3 py-1 text-sm font-light rounded-full transition-all duration-300 ' + (locale === 'ua' ? 'text-white bg-white/10' : 'text-white/60 hover:text-white/80')}>UA</button>
              <button onClick={() => setLocale('en')} className={'px-3 py-1 text-sm font-light rounded-full transition-all duration-300 ' + (locale === 'en' ? 'text-white bg-white/10' : 'text-white/60 hover:text-white/80')}>EN</button>
            </div>
            {extraLinks.map(link => (
              <Link key={link.href} href={link.href} className={'px-5 py-2.5 font-light transition-all duration-500 rounded-full ' + (pathname === link.href ? 'text-white bg-white/5' : 'text-white/80 hover:text-white hover:bg-white/5')}>
                {locale==='ua' ? link.labelUa : link.labelEn}
              </Link>
            ))}
            <Link href="/about" className={'px-5 py-2.5 font-light transition-all duration-500 rounded-full ' + (pathname === '/about' ? 'text-white bg-white/5' : 'text-white/80 hover:text-white hover:bg-white/5')}>{t.nav.about}</Link>
            <Link href="/#stores" className="cta-primary px-7 py-3 text-sm tracking-wide ease-soft-out">
              {t.nav.selectStore}
            </Link>
            <button
              onClick={() => setContactOpen(true)}
              className="cta-outline px-6 py-2.5 text-white/90 hover:text-black hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            >
              <span className="relative z-10 tracking-wide">{t.nav.contact}</span>
            </button>
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
              <button onClick={() => setLocale('ua')} className={'px-4 py-2 text-sm font-light rounded-full transition-all duration-300 ' + (locale === 'ua' ? 'text-white bg-white/10' : 'text-white/60 hover:text-white/80')}>UA</button>
              <button onClick={() => setLocale('en')} className={'px-4 py-2 text-sm font-light rounded-full transition-all duration-300 ' + (locale === 'en' ? 'text-white bg-white/10' : 'text-white/60 hover:text-white/80')}>EN</button>
            </div>
            <Link href="/about" className="px-4 py-2 text-white/60 hover:text-white font-light transition-colors" onClick={() => setIsMobileMenuOpen(false)}>{t.nav.about}</Link>
            {extraLinks.map(link => (
              <Link key={link.href} href={link.href} className="px-4 py-2 text-white/60 hover:text-white font-light transition-colors" onClick={() => setIsMobileMenuOpen(false)}>
                {locale==='ua' ? link.labelUa : link.labelEn}
              </Link>
            ))}
            <button
              onClick={() => { setContactOpen(true); setIsMobileMenuOpen(false); }}
              className="mx-4 mb-4 px-5 py-3 rounded-full bg-white/10 text-white/80 hover:text-white hover:bg-white/15 font-light tracking-wide transition-colors"
            >{t.nav.contact}</button>
            <div className="px-4 pt-2">
              <p className="text-xs uppercase tracking-wider text-white/40 mb-3">{t.nav.stores}</p>
              {stores.map((store) => (<Link key={store.name} href={store.url} target="_blank" rel="noopener noreferrer" className="block py-2 text-white/60 hover:text-white font-light transition-colors" onClick={() => setIsMobileMenuOpen(false)}>{store.name} </Link>))}
            </div>
          </div>
        </div>
      </div>

      {/* Contact Modal */}
      {contactOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-xl" onClick={() => formState==='submitting'?null:setContactOpen(false)} />
          <div className="relative z-10 w-full max-w-lg overflow-hidden" style={{ background: 'linear-gradient(165deg, rgba(22,22,26,0.92), rgba(12,12,16,0.92))' }}>
            <div className="p-8">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-light text-white">{t.nav.contact}</h3>
                <button onClick={() => setContactOpen(false)} className="text-white/50 hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 rounded-sm" disabled={formState==='submitting'}>
                  <span className="sr-only">Close</span>
                  ✕
                </button>
              </div>

              {/* Inquiry type selector */}
              <div className="flex gap-3 mb-6">
                <button
                  type="button"
                  onClick={() => setPayload(p => ({ ...p, type: 'auto' }))}
                  className={
                    'flex-1 py-3 px-4 rounded-lg text-sm font-medium transition-all duration-300 ' +
                    (payload.type === 'auto'
                      ? 'bg-gradient-to-r from-orange-500/20 to-red-500/20 text-white shadow-lg shadow-orange-500/20'
                      : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/80')
                  }
                >
                  🚗 {locale === 'ua' ? 'Авто' : 'Auto'}
                </button>
                <button
                  type="button"
                  onClick={() => setPayload(p => ({ ...p, type: 'moto' }))}
                  className={
                    'flex-1 py-3 px-4 rounded-lg text-sm font-medium transition-all duration-300 ' +
                    (payload.type === 'moto'
                      ? 'bg-gradient-to-r from-blue-500/20 to-cyan-500/20 text-white shadow-lg shadow-cyan-500/20'
                      : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/80')
                  }
                >
                  🏍️ {locale === 'ua' ? 'Мото' : 'Moto'}
                </button>
              </div>

              <form onSubmit={submit} className="space-y-4">
                <input
                  type="text"
                  placeholder={locale==='ua' ? 'Імʼя' : 'Name'}
                  className="w-full bg-white/5 text-white px-5 py-3 outline-none text-sm placeholder:text-white/30 rounded-md"
                  value={payload.name}
                  onChange={e => setPayload(p => ({ ...p, name: e.target.value }))}
                  required
                />
                <input
                  type="email"
                  placeholder="Email"
                  className="w-full bg-white/5 text-white px-5 py-3 outline-none text-sm placeholder:text-white/30 rounded-md"
                  value={payload.email}
                  onChange={e => setPayload(p => ({ ...p, email: e.target.value }))}
                  required
                />
                <input
                  type="text"
                  placeholder={locale==='ua' ? 'Тема' : 'Subject'}
                  className="w-full bg-white/5 text-white px-5 py-3 border border-white/10 focus:border-white/30 outline-none text-sm placeholder:text-white/30 rounded-md"
                  value={payload.subject}
                  onChange={e => setPayload(p => ({ ...p, subject: e.target.value }))}
                  required
                />
                <textarea
                  placeholder={locale==='ua' ? 'Повідомлення' : 'Message'}
                  rows={5}
                  className="w-full bg-white/5 text-white px-5 py-3 border border-white/10 focus:border-white/30 outline-none text-sm placeholder:text-white/30 resize-none rounded-md"
                  value={payload.message}
                  onChange={e => setPayload(p => ({ ...p, message: e.target.value }))}
                  required
                />
                <button
                  type="submit"
                  disabled={formState==='submitting'}
                  className="w-full py-3.5 rounded-full text-sm tracking-wider uppercase font-medium bg-white text-black hover:bg-white/90 transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                >
                  {formState==='submitting' ? (locale==='ua' ? 'Надсилання...' : 'Sending...') : (locale==='ua' ? 'Надіслати' : 'Send')}
                </button>
                {formState==='success' && <p className="text-center text-xs text-emerald-400">{locale==='ua' ? 'Надіслано успішно' : 'Sent successfully'}</p>}
                {formState==='error' && <p className="text-center text-xs text-red-400">{locale==='ua' ? 'Помилка надсилання' : 'Send error'} {errorMsg && ' • '+errorMsg}</p>}
              </form>
            </div>
            <div className="h-1 w-full bg-gradient-to-r from-orange-400/70 via-fuchsia-400/70 to-cyan-400/70" />
          </div>
        </div>
      )}
    </nav>
  );
}

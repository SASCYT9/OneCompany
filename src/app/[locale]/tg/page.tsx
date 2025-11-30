'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';

// Telegram WebApp types
interface TelegramWebApp {
  ready: () => void;
  expand: () => void;
  close: () => void;
  MainButton: {
    show: () => void;
    hide: () => void;
    onClick: (callback: () => void) => void;
    offClick: (callback: () => void) => void;
  };
  BackButton: {
    show: () => void;
    hide: () => void;
    onClick: (callback: () => void) => void;
    offClick: (callback: () => void) => void;
  };
  HapticFeedback: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
    notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
  };
  initDataUnsafe: {
    user?: {
      id: number;
      first_name: string;
      last_name?: string;
      username?: string;
      is_premium?: boolean;
    };
  };
  openLink: (url: string) => void;
  openTelegramLink: (url: string) => void;
  setHeaderColor: (color: string) => void;
  setBackgroundColor: (color: string) => void;
}

type Tab = 'home' | 'auto' | 'moto' | 'contact';

const siteContent = {
  hero: {
    badge: 'onecompany · B2B wholesale',
    title: 'Premium Importer',
    subtitle: 'B2B wholesale for service stations, detailing studios & tuning shops. VIP expert programs available.',
  },
  stats: [
    { value: '18', label: 'years of heritage' },
    { value: '200+', label: 'performance marques' },
    { value: '36h', label: 'global logistics' },
    { value: '4', label: 'continents weekly' },
  ],
  autoBrands: [
    { name: 'Eventuri', logo: '/logos/eventuri.png' },
    { name: 'KW Suspension', logo: '/logos/kw-suspension.png' },
    { name: 'Akrapovič', logo: '/logos/akrapovic.png' },
    { name: 'Brembo', logo: '/logos/brembo.png' },
    { name: 'HRE Wheels', logo: '/logos/hre-wheels.png' },
    { name: 'Mansory', logo: '/logos/mansory.png' },
    { name: 'Milltek', logo: '/logos/milltek.png' },
    { name: 'FI Exhaust', logo: '/logos/fi-exhaust.png' },
    { name: 'Capristo', logo: '/logos/capristo.png' },
    { name: 'Armytrix', logo: '/logos/armytrix.png' },
    { name: 'Liberty Walk', logo: '/logos/liberty-walk.png' },
    { name: 'Vorsteiner', logo: '/logos/vorsteiner.png' },
  ],
  motoBrands: [
    { name: 'Akrapovič', logo: '/logos/akrapovic.png' },
    { name: 'SC-Project', logo: '/logos/sc-project.png' },
    { name: 'Rizoma', logo: '/logos/rizoma.webp' },
    { name: 'Brembo', logo: '/logos/brembo.png' },
    { name: 'Arrow', logo: '/logos/arrow.png' },
    { name: 'Termignoni', logo: '/logos/termignoni.png' },
    { name: 'Yoshimura', logo: '/logos/yoshimura.png' },
    { name: 'Alpha Racing', logo: '/logos/alpha-racing.png' },
  ],
  categories: [
    { name: 'Exhaust Systems', description: 'Valved exhausts, headers, titanium race systems' },
    { name: 'Suspension', description: 'Coilovers, adaptive damping, motorsport setups' },
    { name: 'Wheels & Brakes', description: 'Forged wheels, carbon-ceramic upgrades' },
    { name: 'Carbon Fiber', description: 'Aero programs, interior trim, structural upgrades' },
    { name: 'Engine Tuning', description: 'ECU calibrations, hybrid turbos, intake systems' },
    { name: 'Body Kits', description: 'Widebody programs, splitters, GT diffusers' },
  ],
  contact: {
    heroBadge: 'B2B Wholesale Importer · відповідь до 12 годин',
    infoBody: 'Команда відповідає українською, англійською та польською. Підготуйте VIN та список бажаних оновлень.',
    slaPromise: 'Середній час першої відповіді — 2 години у робочі дні / 6 годин у вихідні.',
    channels: [
      { id: 'email', label: 'B2B wholesale email', value: 'info@onecompany.global', note: 'Відповідь до 12 годин' },
      { id: 'phone', label: 'Support phone', value: '+380 12 345 67 89', note: '10:00–21:00 GMT+2' },
      { id: 'telegram', label: 'Telegram', value: '@onecompany_wholesale', note: 'B2B запити' },
    ],
    budgets: [
      '€3k–€7k · street aero & sound',
      '€8k–€15k · підвіска та гальма',
      '€15k+ · трекові та rally raid комплекти',
    ],
  },
};

export default function TelegramMiniApp() {
  const [webApp, setWebApp] = useState<TelegramWebApp | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [user, setUser] = useState<{ name: string; isPremium: boolean } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showContactForm, setShowContactForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', message: '', category: 'general' });
  const [formStatus, setFormStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tgWindow = window as any;
    if (tgWindow.Telegram?.WebApp) {
      const tg = tgWindow.Telegram.WebApp as TelegramWebApp;
      tg.ready();
      tg.expand();
      tg.setHeaderColor('#000000');
      tg.setBackgroundColor('#000000');
      setWebApp(tg);
      if (tg.initDataUnsafe.user) {
        setUser({ name: tg.initDataUnsafe.user.first_name, isPremium: tg.initDataUnsafe.user.is_premium || false });
        setFormData(prev => ({ ...prev, name: tg.initDataUnsafe.user?.first_name || '' }));
      }
    } else {
      setUser({ name: 'Guest', isPremium: false });
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (!webApp) return;
    const handleBack = () => {
      if (showContactForm) { setShowContactForm(false); webApp.BackButton.hide(); }
      else if (activeTab !== 'home') { setActiveTab('home'); webApp.BackButton.hide(); }
    };
    if (showContactForm || activeTab !== 'home') {
      webApp.BackButton.show();
      webApp.BackButton.onClick(handleBack);
    } else {
      webApp.BackButton.hide();
    }
    return () => { webApp.BackButton.offClick(handleBack); };
  }, [webApp, activeTab, showContactForm]);

  const haptic = useCallback((type: 'light' | 'medium' | 'heavy' = 'light') => {
    webApp?.HapticFeedback.impactOccurred(type);
  }, [webApp]);

  const handleTabChange = (tab: Tab) => { haptic('light'); setActiveTab(tab); setShowContactForm(false); };

  const handleSubmitForm = async () => {
    if (!formData.name || !formData.message) return;
    haptic('medium');
    setFormStatus('sending');
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, source: 'telegram-miniapp' }),
      });
      if (res.ok) {
        setFormStatus('sent');
        webApp?.HapticFeedback.notificationOccurred('success');
        setTimeout(() => { setShowContactForm(false); setFormStatus('idle'); }, 2000);
      } else { setFormStatus('error'); }
    } catch { setFormStatus('error'); }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
          <div className="text-3xl font-light tracking-[0.3em] text-white mb-2">ONECOMPANY</div>
          <div className="text-xs tracking-[0.2em] text-neutral-500">B2B WHOLESALE</div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white pb-20">
      <header className="sticky top-0 z-50 bg-black/90 backdrop-blur-xl border-b border-white/5 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-light tracking-[0.2em]">ONECOMPANY</div>
            <div className="text-[10px] tracking-[0.15em] text-neutral-500">B2B WHOLESALE</div>
          </div>
          {user && <div className="text-xs text-neutral-400">{user.name} {user.isPremium && '⭐'}</div>}
        </div>
      </header>

      <main className="px-4 py-4">
        <AnimatePresence mode="wait">
          {showContactForm && (
            <motion.div key="form" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-4">
              <div className="text-center mb-6">
                <h2 className="text-xl font-light tracking-wide">Get in touch</h2>
                <p className="text-xs text-neutral-500 mt-2">{siteContent.contact.slaPromise}</p>
              </div>
              {formStatus === 'sent' ? (
                <div className="text-center py-12">
                  <div className="text-4xl mb-4">✓</div>
                  <h3 className="text-lg">Запит надіслано</h3>
                  <p className="text-sm text-neutral-500 mt-2">Відповімо протягом 12 годин</p>
                </div>
              ) : (
                <>
                  <select value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-3 text-sm">
                    <option value="auto">Automotive</option>
                    <option value="moto">Motorcycles</option>
                    <option value="partnership">Partnership / B2B</option>
                    <option value="general">General inquiry</option>
                  </select>
                  <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-3 text-sm" placeholder="Ім'я *" />
                  <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-3 text-sm" placeholder="Email" />
                  <input type="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-3 text-sm" placeholder="Телефон" />
                  <textarea value={formData.message} onChange={(e) => setFormData({ ...formData, message: e.target.value })} rows={4} className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-3 text-sm resize-none" placeholder="VIN, бренди, бюджет, терміни... *" />
                  <p className="text-[10px] text-neutral-600">{siteContent.contact.infoBody}</p>
                  <button onClick={handleSubmitForm} disabled={!formData.name || !formData.message || formStatus === 'sending'} className="w-full bg-white text-black font-medium py-3 rounded-lg text-sm disabled:opacity-50">
                    {formStatus === 'sending' ? 'Надсилання...' : 'Надіслати запит'}
                  </button>
                  {formStatus === 'error' && <p className="text-red-500 text-xs text-center">Помилка. Спробуйте ще раз.</p>}
                </>
              )}
            </motion.div>
          )}

          {activeTab === 'home' && !showContactForm && (
            <motion.div key="home" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="text-center py-8 border-b border-neutral-900 mb-6">
                <div className="text-[10px] tracking-[0.3em] text-neutral-500 mb-3">{siteContent.hero.badge.toUpperCase()}</div>
                <h1 className="text-2xl font-light tracking-wide mb-2">{siteContent.hero.title}</h1>
                <p className="text-xs text-neutral-400 max-w-xs mx-auto">{siteContent.hero.subtitle}</p>
              </div>
              <div className="grid grid-cols-4 gap-2 mb-6">
                {siteContent.stats.map((stat, i) => (
                  <div key={i} className="text-center py-3">
                    <div className="text-lg font-light">{stat.value}</div>
                    <div className="text-[9px] text-neutral-500 uppercase tracking-wider">{stat.label}</div>
                  </div>
                ))}
              </div>
              <div className="mb-6">
                <h2 className="text-xs tracking-[0.2em] text-neutral-500 mb-3">CATEGORIES</h2>
                <div className="space-y-2">
                  {siteContent.categories.map((cat, i) => (
                    <div key={i} className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-3">
                      <div className="text-sm font-light">{cat.name}</div>
                      <div className="text-[10px] text-neutral-500">{cat.description}</div>
                    </div>
                  ))}
                </div>
              </div>
              <button onClick={() => { haptic('medium'); setShowContactForm(true); }} className="w-full bg-white text-black font-medium py-3 rounded-lg text-sm">Get in touch</button>
            </motion.div>
          )}

          {activeTab === 'auto' && !showContactForm && (
            <motion.div key="auto" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="text-center py-6 mb-4">
                <h2 className="text-xl font-light tracking-wide">Automotive</h2>
                <p className="text-xs text-neutral-500 mt-1">Premium performance brands</p>
              </div>
              <div className="grid grid-cols-3 gap-3 mb-6">
                {siteContent.autoBrands.map((brand, i) => (
                  <motion.div key={brand.name} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-3 flex flex-col items-center justify-center aspect-square">
                    <div className="w-12 h-12 relative mb-2">
                      <Image src={brand.logo} alt={brand.name} fill className="object-contain filter brightness-0 invert opacity-80" />
                    </div>
                    <div className="text-[10px] text-neutral-400 text-center">{brand.name}</div>
                  </motion.div>
                ))}
              </div>
              <button onClick={() => { haptic('medium'); setShowContactForm(true); setFormData(prev => ({ ...prev, category: 'auto' })); }} className="w-full bg-white text-black font-medium py-3 rounded-lg text-sm">Request quote</button>
            </motion.div>
          )}

          {activeTab === 'moto' && !showContactForm && (
            <motion.div key="moto" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="text-center py-6 mb-4">
                <h2 className="text-xl font-light tracking-wide">Motorcycles</h2>
                <p className="text-xs text-neutral-500 mt-1">Race-proven components</p>
              </div>
              <div className="grid grid-cols-3 gap-3 mb-6">
                {siteContent.motoBrands.map((brand, i) => (
                  <motion.div key={brand.name} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-3 flex flex-col items-center justify-center aspect-square">
                    <div className="w-12 h-12 relative mb-2">
                      <Image src={brand.logo} alt={brand.name} fill className="object-contain filter brightness-0 invert opacity-80" />
                    </div>
                    <div className="text-[10px] text-neutral-400 text-center">{brand.name}</div>
                  </motion.div>
                ))}
              </div>
              <button onClick={() => { haptic('medium'); setShowContactForm(true); setFormData(prev => ({ ...prev, category: 'moto' })); }} className="w-full bg-white text-black font-medium py-3 rounded-lg text-sm">Request quote</button>
            </motion.div>
          )}

          {activeTab === 'contact' && !showContactForm && (
            <motion.div key="contact" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="text-center py-6 mb-4">
                <div className="text-[10px] tracking-[0.2em] text-neutral-500 mb-2">{siteContent.contact.heroBadge}</div>
                <h2 className="text-xl font-light tracking-wide">Contact</h2>
              </div>
              <div className="space-y-3 mb-6">
                {siteContent.contact.channels.map((ch) => (
                  <button key={ch.id} onClick={() => { haptic('light'); if (ch.id === 'telegram') webApp?.openTelegramLink('https://t.me/onecompany_wholesale'); else if (ch.id === 'phone') webApp?.openLink(`tel:${ch.value.replace(/\s/g, '')}`); else if (ch.id === 'email') webApp?.openLink(`mailto:${ch.value}`); }} className="w-full bg-neutral-900/50 border border-neutral-800 rounded-lg p-4 text-left">
                    <div className="text-xs text-neutral-500">{ch.label}</div>
                    <div className="text-sm font-light mt-1">{ch.value}</div>
                    <div className="text-[10px] text-neutral-600 mt-1">{ch.note}</div>
                  </button>
                ))}
              </div>
              <div className="mb-6">
                <div className="text-xs tracking-[0.15em] text-neutral-500 mb-3">BUDGET RANGES</div>
                {siteContent.contact.budgets.map((b, i) => <div key={i} className="text-xs text-neutral-400 py-2 border-b border-neutral-900">{b}</div>)}
              </div>
              <button onClick={() => { haptic('medium'); setShowContactForm(true); }} className="w-full bg-white text-black font-medium py-3 rounded-lg text-sm">Send inquiry</button>
              <button onClick={() => webApp?.openLink('https://one-company.vercel.app/ua')} className="w-full border border-neutral-800 text-neutral-400 font-medium py-3 rounded-lg text-sm mt-3">Open full website</button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-black/95 backdrop-blur-xl border-t border-neutral-900 px-2 py-2 z-50">
        <div className="flex justify-around max-w-md mx-auto">
          {(['home', 'auto', 'moto', 'contact'] as Tab[]).map((tab) => (
            <button key={tab} onClick={() => handleTabChange(tab)} className={`flex-1 py-2 text-center transition-colors ${activeTab === tab ? 'text-white' : 'text-neutral-600'}`}>
              <span className="text-xs tracking-wide capitalize">{tab}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}

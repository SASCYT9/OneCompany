'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';

interface TelegramWebApp {
  ready: () => void;
  expand: () => void;
  BackButton: { show: () => void; hide: () => void; onClick: (cb: () => void) => void; offClick: (cb: () => void) => void; };
  HapticFeedback: { impactOccurred: (s: 'light' | 'medium' | 'heavy') => void; notificationOccurred: (t: 'success' | 'error') => void; };
  initDataUnsafe: { user?: { id: number; first_name: string; is_premium?: boolean; }; };
  openLink: (url: string) => void;
  openTelegramLink: (url: string) => void;
  setHeaderColor: (c: string) => void;
  setBackgroundColor: (c: string) => void;
}

type Tab = 'home' | 'auto' | 'moto' | 'contact';
type FormType = 'b2b' | 'client' | null;

// Marquee brands - legends (як на сайті)
const marqueeBrands = [
  'Akrapovič', 'Eventuri', 'KW Suspensions', 'Brembo', 'Novitec', 
  'Mansory', 'HRE Wheels', 'Capristo', 'Brabus', 'ABT Sportsline'
];

// Stats without 36h
const stats = [
  { value: '18', labelUk: 'років досвіду', labelEn: 'years of heritage' },
  { value: '200+', labelUk: 'преміум брендів', labelEn: 'performance marques' },
  { value: '4', labelUk: 'континенти', labelEn: 'continents weekly' },
];

// Brand grid - same as site
const autoBrands = [
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
];

const motoBrands = [
  { name: 'Akrapovič', logo: '/logos/akrapovic.png' },
  { name: 'SC-Project', logo: '/logos/sc-project.png' },
  { name: 'Rizoma', logo: '/logos/rizoma.webp' },
  { name: 'Brembo', logo: '/logos/brembo.png' },
  { name: 'Arrow', logo: '/logos/arrow.png' },
  { name: 'Termignoni', logo: '/logos/termignoni.png' },
  { name: 'Yoshimura', logo: '/logos/yoshimura.png' },
  { name: 'Alpha Racing', logo: '/logos/alpha-racing.png' },
];

// Product categories from site
const categories = [
  { nameEn: 'Exhaust Systems', nameUk: 'Вихлопні системи', descEn: 'Valved exhausts, headers, titanium race systems', descUk: 'Вихлопи з клапанами, колектори, титанові системи' },
  { nameEn: 'Suspension', nameUk: 'Підвіска', descEn: 'Coilovers, adaptive damping, motorsport setups', descUk: 'Койловери, адаптивне демпфування, спортивні налаштування' },
  { nameEn: 'Wheels & Brakes', nameUk: 'Диски та гальма', descEn: 'Forged wheels, carbon-ceramic upgrades', descUk: 'Ковані диски, карбон-керамічні апгрейди' },
  { nameEn: 'Carbon Fiber', nameUk: 'Карбон', descEn: 'Aero programs, interior trim', descUk: 'Аеро програми, інтер\'єр' },
  { nameEn: 'Engine Tuning', nameUk: 'Тюнінг двигуна', descEn: 'ECU calibrations, intake systems', descUk: 'ECU калібрування, впускні системи' },
  { nameEn: 'Body Kits', nameUk: 'Боді-кіти', descEn: 'Widebody, splitters, diffusers', descUk: 'Розширення, спліттери, дифузори' },
];

export default function TelegramMiniApp() {
  const [webApp, setWebApp] = useState<TelegramWebApp | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [user, setUser] = useState<{ name: string; id?: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showContactForm, setShowContactForm] = useState<FormType>(null);
  const [formData, setFormData] = useState({ 
    name: '', email: '', phone: '', message: '', 
    model: '', vin: '', budget: '', category: 'auto',
    companyName: '', companyType: ''
  });
  const [formStatus, setFormStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [lang, setLang] = useState<'uk' | 'en'>('uk');

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
        setUser({ name: tg.initDataUnsafe.user.first_name, id: tg.initDataUnsafe.user.id });
        setFormData(prev => ({ ...prev, name: tg.initDataUnsafe.user?.first_name || '' }));
      }
    } else {
      setUser({ name: 'Guest' });
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (!webApp) return;
    const handleBack = () => {
      if (showContactForm) { setShowContactForm(null); webApp.BackButton.hide(); }
      else if (activeTab !== 'home') { setActiveTab('home'); webApp.BackButton.hide(); }
    };
    if (showContactForm || activeTab !== 'home') {
      webApp.BackButton.show();
      webApp.BackButton.onClick(handleBack);
    } else { webApp.BackButton.hide(); }
    return () => { webApp.BackButton.offClick(handleBack); };
  }, [webApp, activeTab, showContactForm]);

  const haptic = useCallback((type: 'light' | 'medium' | 'heavy' = 'light') => {
    webApp?.HapticFeedback.impactOccurred(type);
  }, [webApp]);

  const handleTabChange = (tab: Tab) => { haptic('light'); setActiveTab(tab); setShowContactForm(null); };

  const t = (uk: string, en: string) => lang === 'uk' ? uk : en;

  // Submit form to /api/contact
  const handleSubmitForm = async () => {
    if (!formData.name || !formData.message) return;
    haptic('medium');
    setFormStatus('sending');
    
    try {
      const type = formData.category === 'moto' ? 'moto' : 'auto';
      const payload = {
        type,
        carModel: type === 'auto' ? (formData.model || 'Not specified') : undefined,
        motoModel: type === 'moto' ? (formData.model || 'Not specified') : undefined,
        vin: formData.vin || '',
        wishes: `${showContactForm === 'b2b' ? '[B2B] ' : ''}${formData.companyName ? `Company: ${formData.companyName}\nType: ${formData.companyType}\n\n` : ''}${formData.message}`,
        budget: formData.budget || '',
        email: formData.email || `telegram-${user?.id || 'unknown'}@miniapp.local`,
        name: formData.name,
        phone: formData.phone || '+0000000000',
        contactMethod: 'telegram',
        source: 'telegram-miniapp',
        telegramId: user?.id,
      };

      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      
      if (res.ok) {
        setFormStatus('sent');
        webApp?.HapticFeedback.notificationOccurred('success');
        setTimeout(() => { 
          setShowContactForm(null); 
          setFormStatus('idle');
          setFormData(prev => ({ ...prev, message: '', model: '', vin: '', budget: '', companyName: '', companyType: '' }));
        }, 2500);
      } else {
        console.error('Form error:', await res.text());
        setFormStatus('error');
        webApp?.HapticFeedback.notificationOccurred('error');
      }
    } catch (e) {
      console.error('Submit error:', e);
      setFormStatus('error');
      webApp?.HapticFeedback.notificationOccurred('error');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
          <div className="text-2xl font-light tracking-[0.3em] text-white mb-2">ONECOMPANY</div>
          <div className="text-[10px] tracking-[0.2em] text-neutral-500">B2B WHOLESALE</div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white pb-20">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-black/90 backdrop-blur-xl border-b border-white/5 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-light tracking-[0.2em]">ONECOMPANY</div>
            <div className="text-[10px] tracking-[0.15em] text-neutral-500">B2B WHOLESALE</div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setLang(lang === 'uk' ? 'en' : 'uk')} className="text-[10px] text-neutral-500 border border-neutral-800 px-2 py-1 rounded">
              {lang.toUpperCase()}
            </button>
            {user && <div className="text-xs text-neutral-400">{user.name}</div>}
          </div>
        </div>
      </header>

      <main className="px-4 py-4">
        <AnimatePresence mode="wait">
          {/* Contact Form */}
          {showContactForm && (
            <motion.div key="form" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-4">
              <div className="text-center mb-4">
                <h2 className="text-lg font-light tracking-wide">
                  {showContactForm === 'b2b' ? t('B2B Запит', 'B2B Inquiry') : t('Запит', 'Inquiry')}
                </h2>
                <p className="text-[10px] text-neutral-500 mt-1">
                  {t('Відповідь протягом 2-12 годин', 'Response within 2-12 hours')}
                </p>
              </div>

              {formStatus === 'sent' ? (
                <div className="text-center py-12">
                  <div className="text-3xl mb-4">✓</div>
                  <h3 className="text-base">{t('Запит надіслано', 'Request sent')}</h3>
                  <p className="text-xs text-neutral-500 mt-2">{t('Зв\'яжемось найближчим часом', 'We\'ll contact you soon')}</p>
                </div>
              ) : (
                <>
                  {showContactForm === 'b2b' && (
                    <>
                      <input type="text" value={formData.companyName} onChange={(e) => setFormData({ ...formData, companyName: e.target.value })} 
                        className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-3 text-sm focus:border-neutral-600 focus:outline-none" 
                        placeholder={t('Назва компанії', 'Company name')} />
                      <select value={formData.companyType} onChange={(e) => setFormData({ ...formData, companyType: e.target.value })} 
                        className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-3 text-sm">
                        <option value="">{t('Тип бізнесу', 'Business type')}</option>
                        <option value="sto">{t('СТО / Сервіс', 'Service station')}</option>
                        <option value="dealer">{t('Дилер', 'Dealer')}</option>
                        <option value="detailing">{t('Детейлінг студія', 'Detailing studio')}</option>
                        <option value="tuning">{t('Тюнінг ательє', 'Tuning shop')}</option>
                        <option value="other">{t('Інше', 'Other')}</option>
                      </select>
                    </>
                  )}

                  <select value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} 
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-3 text-sm">
                    <option value="auto">{t('Автомобілі', 'Automotive')}</option>
                    <option value="moto">{t('Мотоцикли', 'Motorcycles')}</option>
                  </select>

                  <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} 
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-3 text-sm focus:border-neutral-600 focus:outline-none" 
                    placeholder={t('Ім\'я *', 'Name *')} />
                  
                  <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} 
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-3 text-sm focus:border-neutral-600 focus:outline-none" 
                    placeholder="Email" />
                  
                  <input type="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} 
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-3 text-sm focus:border-neutral-600 focus:outline-none" 
                    placeholder={t('Телефон', 'Phone')} />

                  <input type="text" value={formData.model} onChange={(e) => setFormData({ ...formData, model: e.target.value })} 
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-3 text-sm focus:border-neutral-600 focus:outline-none" 
                    placeholder={t('Модель авто/мото', 'Car/Moto model')} />

                  <input type="text" value={formData.vin} onChange={(e) => setFormData({ ...formData, vin: e.target.value })} 
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-3 text-sm focus:border-neutral-600 focus:outline-none" 
                    placeholder="VIN" />

                  <input type="text" value={formData.budget} onChange={(e) => setFormData({ ...formData, budget: e.target.value })} 
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-3 text-sm focus:border-neutral-600 focus:outline-none" 
                    placeholder={t('Бюджет (€)', 'Budget (€)')} />

                  <textarea value={formData.message} onChange={(e) => setFormData({ ...formData, message: e.target.value })} rows={3} 
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-3 text-sm resize-none focus:border-neutral-600 focus:outline-none" 
                    placeholder={t('Опишіть запит *', 'Describe your request *')} />

                  <button onClick={handleSubmitForm} disabled={!formData.name || !formData.message || formStatus === 'sending'} 
                    className="w-full bg-white text-black font-medium py-3 rounded-lg text-sm disabled:opacity-50">
                    {formStatus === 'sending' ? t('Надсилання...', 'Sending...') : t('Надіслати', 'Send')}
                  </button>
                  {formStatus === 'error' && <p className="text-red-500 text-xs text-center">{t('Помилка. Спробуйте ще.', 'Error. Try again.')}</p>}
                </>
              )}
            </motion.div>
          )}

          {/* Home */}
          {activeTab === 'home' && !showContactForm && (
            <motion.div key="home" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="text-center py-6 border-b border-neutral-900 mb-4">
                <div className="text-[9px] tracking-[0.3em] text-neutral-500 mb-2">ONECOMPANY · B2B WHOLESALE</div>
                <h1 className="text-xl font-light tracking-wide mb-2">Premium Importer</h1>
                <p className="text-[11px] text-neutral-400 max-w-xs mx-auto">
                  {t('B2B оптова торгівля для СТО, детейлінг студій та тюнінг ательє', 
                     'B2B wholesale for service stations, detailing studios & tuning shops')}
                </p>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                {stats.map((stat, i) => (
                  <div key={i} className="text-center py-2">
                    <div className="text-lg font-light">{stat.value}</div>
                    <div className="text-[8px] text-neutral-500 uppercase tracking-wider">{lang === 'uk' ? stat.labelUk : stat.labelEn}</div>
                  </div>
                ))}
              </div>

              {/* Marquee brands */}
              <div className="mb-4 overflow-hidden">
                <div className="text-[9px] tracking-[0.15em] text-neutral-600 mb-2">{t('БРЕНДИ ЛЕГЕНДИ', 'LEGENDARY BRANDS')}</div>
                <div className="flex flex-wrap gap-2">
                  {marqueeBrands.map((brand, i) => (
                    <span key={i} className="text-[10px] text-neutral-400 bg-neutral-900/50 px-2 py-1 rounded">{brand}</span>
                  ))}
                </div>
              </div>

              {/* Categories */}
              <div className="mb-4">
                <div className="text-[9px] tracking-[0.15em] text-neutral-600 mb-2">{t('КАТЕГОРІЇ', 'CATEGORIES')}</div>
                <div className="space-y-1.5">
                  {categories.map((cat, i) => (
                    <div key={i} className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-2.5">
                      <div className="text-xs font-light">{lang === 'uk' ? cat.nameUk : cat.nameEn}</div>
                      <div className="text-[9px] text-neutral-500">{lang === 'uk' ? cat.descUk : cat.descEn}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* CTAs */}
              <div className="space-y-2">
                <button onClick={() => { haptic('medium'); setShowContactForm('b2b'); }} 
                  className="w-full bg-white text-black font-medium py-3 rounded-lg text-sm">
                  {t('B2B Запит (оптом)', 'B2B Inquiry (wholesale)')}
                </button>
                <button onClick={() => { haptic('medium'); setShowContactForm('client'); }} 
                  className="w-full border border-neutral-700 text-white font-medium py-3 rounded-lg text-sm">
                  {t('Запит для клієнта', 'Client Inquiry')}
                </button>
              </div>
            </motion.div>
          )}

          {/* Auto */}
          {activeTab === 'auto' && !showContactForm && (
            <motion.div key="auto" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="text-center py-4 mb-3">
                <h2 className="text-lg font-light tracking-wide">{t('Автомобілі', 'Automotive')}</h2>
                <p className="text-[10px] text-neutral-500 mt-1">{t('Преміум performance бренди', 'Premium performance brands')}</p>
              </div>
              <div className="grid grid-cols-3 gap-2 mb-4">
                {autoBrands.map((brand, i) => (
                  <motion.div key={brand.name} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }} 
                    className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-2 flex flex-col items-center justify-center aspect-square">
                    <div className="w-10 h-10 relative mb-1">
                      <Image src={brand.logo} alt={brand.name} fill className="object-contain filter brightness-0 invert opacity-70" />
                    </div>
                    <div className="text-[8px] text-neutral-400 text-center leading-tight">{brand.name}</div>
                  </motion.div>
                ))}
              </div>
              <div className="space-y-2">
                <button onClick={() => { haptic('medium'); setFormData(prev => ({ ...prev, category: 'auto' })); setShowContactForm('b2b'); }} 
                  className="w-full bg-white text-black font-medium py-3 rounded-lg text-sm">
                  {t('B2B Запит', 'B2B Inquiry')}
                </button>
                <button onClick={() => { haptic('medium'); setFormData(prev => ({ ...prev, category: 'auto' })); setShowContactForm('client'); }} 
                  className="w-full border border-neutral-700 text-white font-medium py-2.5 rounded-lg text-sm">
                  {t('Запит клієнта', 'Client Inquiry')}
                </button>
              </div>
            </motion.div>
          )}

          {/* Moto */}
          {activeTab === 'moto' && !showContactForm && (
            <motion.div key="moto" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="text-center py-4 mb-3">
                <h2 className="text-lg font-light tracking-wide">{t('Мотоцикли', 'Motorcycles')}</h2>
                <p className="text-[10px] text-neutral-500 mt-1">{t('Гоночні компоненти', 'Race-proven components')}</p>
              </div>
              <div className="grid grid-cols-3 gap-2 mb-4">
                {motoBrands.map((brand, i) => (
                  <motion.div key={brand.name} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }} 
                    className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-2 flex flex-col items-center justify-center aspect-square">
                    <div className="w-10 h-10 relative mb-1">
                      <Image src={brand.logo} alt={brand.name} fill className="object-contain filter brightness-0 invert opacity-70" />
                    </div>
                    <div className="text-[8px] text-neutral-400 text-center leading-tight">{brand.name}</div>
                  </motion.div>
                ))}
              </div>
              <div className="space-y-2">
                <button onClick={() => { haptic('medium'); setFormData(prev => ({ ...prev, category: 'moto' })); setShowContactForm('b2b'); }} 
                  className="w-full bg-white text-black font-medium py-3 rounded-lg text-sm">
                  {t('B2B Запит', 'B2B Inquiry')}
                </button>
                <button onClick={() => { haptic('medium'); setFormData(prev => ({ ...prev, category: 'moto' })); setShowContactForm('client'); }} 
                  className="w-full border border-neutral-700 text-white font-medium py-2.5 rounded-lg text-sm">
                  {t('Запит клієнта', 'Client Inquiry')}
                </button>
              </div>
            </motion.div>
          )}

          {/* Contact */}
          {activeTab === 'contact' && !showContactForm && (
            <motion.div key="contact" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="text-center py-4 mb-3">
                <div className="text-[9px] tracking-[0.15em] text-neutral-500 mb-1">
                  {t('B2B WHOLESALE IMPORTER', 'B2B WHOLESALE IMPORTER')}
                </div>
                <h2 className="text-lg font-light tracking-wide">{t('Контакти', 'Contact')}</h2>
              </div>

              <div className="space-y-2 mb-4">
                <button onClick={() => { haptic('light'); webApp?.openLink('mailto:info@onecompany.global'); }} 
                  className="w-full bg-neutral-900/50 border border-neutral-800 rounded-lg p-3 text-left">
                  <div className="text-[10px] text-neutral-500">Email</div>
                  <div className="text-sm font-light">info@onecompany.global</div>
                </button>
                <button onClick={() => { haptic('light'); webApp?.openTelegramLink('https://t.me/onecompany_wholesale'); }} 
                  className="w-full bg-neutral-900/50 border border-neutral-800 rounded-lg p-3 text-left">
                  <div className="text-[10px] text-neutral-500">Telegram</div>
                  <div className="text-sm font-light">@onecompany_wholesale</div>
                </button>
              </div>

              <div className="text-[9px] text-neutral-600 mb-4">
                {t('Команда відповідає українською, англійською та польською. Середній час відповіді — 2-12 годин.',
                   'Team responds in Ukrainian, English and Polish. Average response time — 2-12 hours.')}
              </div>

              <div className="space-y-2">
                <button onClick={() => { haptic('medium'); setShowContactForm('b2b'); }} 
                  className="w-full bg-white text-black font-medium py-3 rounded-lg text-sm">
                  {t('B2B Запит (оптом)', 'B2B Inquiry (wholesale)')}
                </button>
                <button onClick={() => { haptic('medium'); setShowContactForm('client'); }} 
                  className="w-full border border-neutral-700 text-white font-medium py-2.5 rounded-lg text-sm">
                  {t('Запит клієнта', 'Client Inquiry')}
                </button>
                <button onClick={() => webApp?.openLink('https://one-company.vercel.app/ua')} 
                  className="w-full border border-neutral-800 text-neutral-400 font-medium py-2.5 rounded-lg text-sm">
                  {t('Відкрити сайт', 'Open website')}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-black/95 backdrop-blur-xl border-t border-neutral-900 px-2 py-2 z-50">
        <div className="flex justify-around max-w-md mx-auto">
          {([
            { id: 'home' as Tab, labelUk: 'Головна', labelEn: 'Home' },
            { id: 'auto' as Tab, labelUk: 'Авто', labelEn: 'Auto' },
            { id: 'moto' as Tab, labelUk: 'Мото', labelEn: 'Moto' },
            { id: 'contact' as Tab, labelUk: 'Контакти', labelEn: 'Contact' },
          ]).map((tab) => (
            <button key={tab.id} onClick={() => handleTabChange(tab.id)} 
              className={`flex-1 py-2 text-center transition-colors ${activeTab === tab.id ? 'text-white' : 'text-neutral-600'}`}>
              <span className="text-[10px] tracking-wide">{lang === 'uk' ? tab.labelUk : tab.labelEn}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}

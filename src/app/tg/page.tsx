'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Telegram WebApp types
interface TelegramWebApp {
  ready: () => void;
  expand: () => void;
  close: () => void;
  MainButton: {
    text: string;
    color: string;
    textColor: string;
    isVisible: boolean;
    isActive: boolean;
    show: () => void;
    hide: () => void;
    onClick: (callback: () => void) => void;
    offClick: (callback: () => void) => void;
    setText: (text: string) => void;
    enable: () => void;
    disable: () => void;
  };
  BackButton: {
    isVisible: boolean;
    show: () => void;
    hide: () => void;
    onClick: (callback: () => void) => void;
    offClick: (callback: () => void) => void;
  };
  HapticFeedback: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
    notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
    selectionChanged: () => void;
  };
  themeParams: {
    bg_color?: string;
    text_color?: string;
    hint_color?: string;
    link_color?: string;
    button_color?: string;
    button_text_color?: string;
    secondary_bg_color?: string;
  };
  colorScheme: 'light' | 'dark';
  initDataUnsafe: {
    user?: {
      id: number;
      first_name: string;
      last_name?: string;
      username?: string;
      language_code?: string;
      is_premium?: boolean;
    };
    start_param?: string;
  };
  sendData: (data: string) => void;
  openLink: (url: string) => void;
  openTelegramLink: (url: string) => void;
  setHeaderColor: (color: string) => void;
  setBackgroundColor: (color: string) => void;
}

type Tab = 'home' | 'catalog' | 'contact' | 'about';

interface Category {
  id: string;
  name: string;
  icon: string;
  description: string;
}

const categories: Category[] = [
  { id: 'tuning', name: 'Тюнінг', icon: '🏎️', description: 'Чіп-тюнінг, Stage 1-3' },
  { id: 'parts', name: 'Запчастини', icon: '⚙️', description: 'Оригінал та аналоги' },
  { id: 'service', name: 'Сервіс', icon: '🔧', description: 'ТО та ремонт' },
  { id: 'detailing', name: 'Детейлінг', icon: '✨', description: 'Полірування, захист' },
  { id: 'wrap', name: 'Оклейка', icon: '🎨', description: 'Плівки та вініл' },
  { id: 'audio', name: 'Аудіо', icon: '🔊', description: 'Музика та шумоізоляція' },
];

export default function TelegramMiniApp() {
  const [webApp, setWebApp] = useState<TelegramWebApp | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [user, setUser] = useState<{ name: string; isPremium: boolean } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize Telegram WebApp
  useEffect(() => {
    const initWebApp = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tgWindow = window as any;
      if (typeof window !== 'undefined' && tgWindow.Telegram?.WebApp) {
        const tg = tgWindow.Telegram.WebApp as TelegramWebApp;
        tg.ready();
        tg.expand();
        
        // Set theme colors
        tg.setHeaderColor('#0a0a0a');
        tg.setBackgroundColor('#0a0a0a');
        
        setWebApp(tg);
        
        // Get user info
        if (tg.initDataUnsafe.user) {
          setUser({
            name: tg.initDataUnsafe.user.first_name,
            isPremium: tg.initDataUnsafe.user.is_premium || false,
          });
        }
        
        setIsLoading(false);
      } else {
        // Development mode - simulate without Telegram
        setTimeout(() => {
          setUser({ name: 'Developer', isPremium: true });
          setIsLoading(false);
        }, 500);
      }
    };

    initWebApp();
  }, []);

  // Handle back button
  useEffect(() => {
    if (!webApp) return;

    const handleBack = () => {
      if (selectedCategory) {
        setSelectedCategory(null);
        webApp.BackButton.hide();
      } else if (activeTab !== 'home') {
        setActiveTab('home');
        webApp.BackButton.hide();
      }
    };

    if (selectedCategory || activeTab !== 'home') {
      webApp.BackButton.show();
      webApp.BackButton.onClick(handleBack);
    } else {
      webApp.BackButton.hide();
    }

    return () => {
      webApp.BackButton.offClick(handleBack);
    };
  }, [webApp, activeTab, selectedCategory]);

  const haptic = useCallback((type: 'light' | 'medium' | 'heavy' = 'light') => {
    webApp?.HapticFeedback.impactOccurred(type);
  }, [webApp]);

  const handleTabChange = (tab: Tab) => {
    haptic('light');
    setActiveTab(tab);
    setSelectedCategory(null);
  };

  const handleCategorySelect = (category: Category) => {
    haptic('medium');
    setSelectedCategory(category);
  };

  const handleContact = () => {
    haptic('heavy');
    webApp?.sendData(JSON.stringify({ action: 'contact', category: selectedCategory?.id }));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center"
        >
          <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
            <span className="text-4xl">🚗</span>
          </div>
          <h1 className="text-2xl font-bold text-white">OneCompany</h1>
          <p className="text-gray-400 mt-2">Завантаження...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white pb-20">
      {/* Header */}
      <motion.header 
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="sticky top-0 z-50 bg-[#0a0a0a]/90 backdrop-blur-xl border-b border-white/5 px-4 py-3"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
              <span className="text-xl">🚗</span>
            </div>
            <div>
              <h1 className="font-bold text-lg">OneCompany</h1>
              <p className="text-xs text-gray-400">Автосервіс & Тюнінг</p>
            </div>
          </div>
          {user && (
            <div className="flex items-center gap-2 bg-white/5 rounded-full px-3 py-1.5">
              <span className="text-sm">{user.name}</span>
              {user.isPremium && <span className="text-yellow-400">⭐</span>}
            </div>
          )}
        </div>
      </motion.header>

      {/* Content */}
      <main className="px-4 py-4">
        <AnimatePresence mode="wait">
          {activeTab === 'home' && !selectedCategory && (
            <motion.div
              key="home"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              {/* Hero Banner */}
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-600 via-red-600 to-purple-700 p-6 mb-6">
                <div className="absolute inset-0 bg-[url('/images/pattern.png')] opacity-10" />
                <div className="relative z-10">
                  <h2 className="text-2xl font-bold mb-2">Вітаємо! 👋</h2>
                  <p className="text-white/80 text-sm mb-4">
                    Преміум автосервіс у Києві. Тюнінг, детейлінг, запчастини.
                  </p>
                  <button 
                    onClick={() => handleTabChange('contact')}
                    className="bg-white text-black font-semibold px-4 py-2 rounded-xl text-sm"
                  >
                    Записатись на сервіс
                  </button>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-3 gap-3 mb-6">
                {[
                  { value: '500+', label: 'Клієнтів' },
                  { value: '8+', label: 'Років досвіду' },
                  { value: '98%', label: 'Задоволених' },
                ].map((stat, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.1 }}
                    className="bg-white/5 rounded-xl p-3 text-center"
                  >
                    <p className="text-xl font-bold text-orange-400">{stat.value}</p>
                    <p className="text-xs text-gray-400">{stat.label}</p>
                  </motion.div>
                ))}
              </div>

              {/* Categories */}
              <h3 className="text-lg font-semibold mb-3">Наші послуги</h3>
              <div className="grid grid-cols-2 gap-3">
                {categories.map((cat, i) => (
                  <motion.button
                    key={cat.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    onClick={() => handleCategorySelect(cat)}
                    className="bg-white/5 hover:bg-white/10 transition-colors rounded-xl p-4 text-left"
                  >
                    <span className="text-3xl mb-2 block">{cat.icon}</span>
                    <h4 className="font-semibold">{cat.name}</h4>
                    <p className="text-xs text-gray-400 mt-1">{cat.description}</p>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          {selectedCategory && (
            <motion.div
              key="category"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
            >
              <div className="text-center mb-6">
                <span className="text-6xl mb-4 block">{selectedCategory.icon}</span>
                <h2 className="text-2xl font-bold">{selectedCategory.name}</h2>
                <p className="text-gray-400 mt-2">{selectedCategory.description}</p>
              </div>

              {/* Category specific content */}
              <div className="space-y-3 mb-6">
                {selectedCategory.id === 'tuning' && (
                  <>
                    <ServiceCard title="Stage 1" price="від 8 000 ₴" desc="Прошивка ECU, +15-30% потужності" />
                    <ServiceCard title="Stage 2" price="від 15 000 ₴" desc="Stage 1 + даунпайп, інтеркулер" />
                    <ServiceCard title="Stage 3" price="від 35 000 ₴" desc="Повний тюнінг пакет" />
                  </>
                )}
                {selectedCategory.id === 'parts' && (
                  <>
                    <ServiceCard title="Оригінал" price="Під замовлення" desc="BMW, Mercedes, Audi, VW" />
                    <ServiceCard title="OEM якість" price="В наявності" desc="Перевірені аналоги" />
                    <ServiceCard title="Performance" price="Під замовлення" desc="Brembo, Bilstein, KW" />
                  </>
                )}
                {selectedCategory.id === 'service' && (
                  <>
                    <ServiceCard title="ТО" price="від 2 500 ₴" desc="Заміна масла, фільтрів" />
                    <ServiceCard title="Діагностика" price="від 500 ₴" desc="Комп'ютерна діагностика" />
                    <ServiceCard title="Ремонт" price="За запитом" desc="Двигун, ходова, електрика" />
                  </>
                )}
                {selectedCategory.id === 'detailing' && (
                  <>
                    <ServiceCard title="Полірування" price="від 4 000 ₴" desc="Видалення подряпин" />
                    <ServiceCard title="Кераміка" price="від 12 000 ₴" desc="Захисне покриття 3+ роки" />
                    <ServiceCard title="PPF" price="від 25 000 ₴" desc="Антигравійна плівка" />
                  </>
                )}
                {selectedCategory.id === 'wrap' && (
                  <>
                    <ServiceCard title="Часткова" price="від 5 000 ₴" desc="Дах, дзеркала, спойлер" />
                    <ServiceCard title="Повна" price="від 35 000 ₴" desc="Весь кузов" />
                    <ServiceCard title="Хром видалення" price="від 8 000 ₴" desc="Чорний глянець/мат" />
                  </>
                )}
                {selectedCategory.id === 'audio' && (
                  <>
                    <ServiceCard title="Базова система" price="від 15 000 ₴" desc="Динаміки + підсилювач" />
                    <ServiceCard title="Преміум" price="від 50 000 ₴" desc="Повна аудіосистема" />
                    <ServiceCard title="Шумоізоляція" price="від 8 000 ₴" desc="Двері, підлога, дах" />
                  </>
                )}
              </div>

              <button
                onClick={handleContact}
                className="w-full bg-gradient-to-r from-orange-500 to-red-600 text-white font-semibold py-4 rounded-xl text-lg"
              >
                Записатись на {selectedCategory.name}
              </button>
            </motion.div>
          )}

          {activeTab === 'catalog' && (
            <motion.div
              key="catalog"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <h2 className="text-xl font-bold mb-4">Каталог послуг</h2>
              <div className="space-y-3">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => handleCategorySelect(cat)}
                    className="w-full bg-white/5 hover:bg-white/10 transition-colors rounded-xl p-4 flex items-center gap-4"
                  >
                    <span className="text-3xl">{cat.icon}</span>
                    <div className="text-left">
                      <h4 className="font-semibold">{cat.name}</h4>
                      <p className="text-sm text-gray-400">{cat.description}</p>
                    </div>
                    <span className="ml-auto text-gray-400">→</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === 'contact' && (
            <motion.div
              key="contact"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="text-center"
            >
              <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
                <span className="text-5xl">📞</span>
              </div>
              <h2 className="text-xl font-bold mb-2">Зв&apos;язатись з нами</h2>
              <p className="text-gray-400 mb-6">Оберіть зручний спосіб</p>

              <div className="space-y-3">
                <ContactButton icon="📱" label="Зателефонувати" sublabel="+380 XX XXX XX XX" onClick={() => webApp?.openLink('tel:+380XXXXXXXXX')} />
                <ContactButton icon="💬" label="Написати в Telegram" sublabel="@OneCompany" onClick={() => webApp?.openTelegramLink('https://t.me/OneCompany')} />
                <ContactButton icon="📍" label="Ми на карті" sublabel="Київ, вул. Автозаводська" onClick={() => webApp?.openLink('https://maps.google.com')} />
                <ContactButton icon="🌐" label="Наш сайт" sublabel="one-company.vercel.app" onClick={() => webApp?.openLink('https://one-company.vercel.app/ua')} />
              </div>
            </motion.div>
          )}

          {activeTab === 'about' && (
            <motion.div
              key="about"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <div className="text-center mb-6">
                <div className="w-24 h-24 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
                  <span className="text-5xl">🚗</span>
                </div>
                <h2 className="text-xl font-bold">OneCompany</h2>
                <p className="text-gray-400">Преміум автосервіс</p>
              </div>

              <div className="bg-white/5 rounded-xl p-4 mb-4">
                <h3 className="font-semibold mb-2">Про нас</h3>
                <p className="text-sm text-gray-400">
                  Ми — команда ентузіастів, які люблять автомобілі. 8+ років досвіду у тюнінгу, 
                  детейлінгу та обслуговуванні преміум авто. Працюємо з BMW, Mercedes, Audi, 
                  Porsche та іншими марками.
                </p>
              </div>

              <div className="bg-white/5 rounded-xl p-4 mb-4">
                <h3 className="font-semibold mb-2">Графік роботи</h3>
                <div className="text-sm text-gray-400 space-y-1">
                  <p>Пн-Пт: 09:00 - 20:00</p>
                  <p>Сб: 10:00 - 18:00</p>
                  <p>Нд: Вихідний</p>
                </div>
              </div>

              <div className="bg-white/5 rounded-xl p-4">
                <h3 className="font-semibold mb-2">Гарантії</h3>
                <ul className="text-sm text-gray-400 space-y-1">
                  <li>✓ Гарантія на роботи до 2 років</li>
                  <li>✓ Оригінальні запчастини</li>
                  <li>✓ Прозорі ціни</li>
                  <li>✓ Безкоштовна діагностика</li>
                </ul>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-[#0a0a0a]/95 backdrop-blur-xl border-t border-white/5 px-4 py-2 z-50">
        <div className="flex justify-around">
          <NavButton icon="🏠" label="Головна" active={activeTab === 'home'} onClick={() => handleTabChange('home')} />
          <NavButton icon="📋" label="Каталог" active={activeTab === 'catalog'} onClick={() => handleTabChange('catalog')} />
          <NavButton icon="📞" label="Контакти" active={activeTab === 'contact'} onClick={() => handleTabChange('contact')} />
          <NavButton icon="ℹ️" label="Про нас" active={activeTab === 'about'} onClick={() => handleTabChange('about')} />
        </div>
      </nav>
    </div>
  );
}

// Helper components
function NavButton({ icon, label, active, onClick }: { icon: string; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center py-1 px-4 rounded-xl transition-colors ${
        active ? 'text-orange-400' : 'text-gray-400'
      }`}
    >
      <span className="text-xl">{icon}</span>
      <span className="text-xs mt-1">{label}</span>
    </button>
  );
}

function ServiceCard({ title, price, desc }: { title: string; price: string; desc: string }) {
  return (
    <div className="bg-white/5 rounded-xl p-4 flex justify-between items-center">
      <div>
        <h4 className="font-semibold">{title}</h4>
        <p className="text-sm text-gray-400">{desc}</p>
      </div>
      <span className="text-orange-400 font-semibold text-sm">{price}</span>
    </div>
  );
}

function ContactButton({ icon, label, sublabel, onClick }: { icon: string; label: string; sublabel: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full bg-white/5 hover:bg-white/10 transition-colors rounded-xl p-4 flex items-center gap-4"
    >
      <span className="text-2xl">{icon}</span>
      <div className="text-left">
        <p className="font-semibold">{label}</p>
        <p className="text-sm text-gray-400">{sublabel}</p>
      </div>
      <span className="ml-auto text-gray-400">→</span>
    </button>
  );
}

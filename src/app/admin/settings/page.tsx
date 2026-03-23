'use client';

import { useState, useEffect } from 'react';
import {
  Bell, Shield, Globe, Store, Palette, Search, Save,
  CheckCircle2, Mail, Phone, MapPin, DollarSign, Percent
} from 'lucide-react';

type SettingsSection = 'notifications' | 'company' | 'shop' | 'seo' | 'appearance' | 'security';

const SECTIONS: { id: SettingsSection; label: string; icon: React.ReactNode }[] = [
  { id: 'notifications', label: 'Сповіщення', icon: <Bell className="w-4 h-4" /> },
  { id: 'company', label: 'Компанія', icon: <Store className="w-4 h-4" /> },
  { id: 'shop', label: 'Магазин', icon: <DollarSign className="w-4 h-4" /> },
  { id: 'seo', label: 'SEO', icon: <Search className="w-4 h-4" /> },
  { id: 'appearance', label: 'Зовнішній вигляд', icon: <Palette className="w-4 h-4" /> },
  { id: 'security', label: 'Безпека', icon: <Shield className="w-4 h-4" /> },
];

const STORAGE_KEY = 'adminSettings';

type AppSettings = {
  // Notifications
  soundEnabled: boolean;
  // Company
  companyName: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  // Shop
  defaultCurrency: string;
  defaultMarkup: number;
  defaultLanguage: string;
  showPricesWithVat: boolean;
  // SEO
  metaTitle: string;
  metaDescription: string;
  ogImage: string;
  // Appearance
  accentColor: string;
  logoUrl: string;
  darkMode: boolean;
};

const DEFAULT_SETTINGS: AppSettings = {
  soundEnabled: false,
  companyName: 'OneCompany',
  contactEmail: 'info@onecompany.com.ua',
  contactPhone: '+380 XX XXX XX XX',
  address: 'Україна',
  defaultCurrency: 'USD',
  defaultMarkup: 25,
  defaultLanguage: 'ua',
  showPricesWithVat: false,
  metaTitle: 'OneCompany — Premium Tuning & Performance Parts',
  metaDescription: 'Офіційний дистриб\'ютор Urban Automotive, KW Suspension, FI Exhaust. Оригінальні деталі для BMW, Porsche, Mercedes та інших.',
  ogImage: '/branding/one-company-logo.png',
  accentColor: '#6366f1',
  logoUrl: '/branding/one-company-logo.png',
  darkMode: true,
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [activeSection, setActiveSection] = useState<SettingsSection>('notifications');
  const [permissionStatus, setPermissionStatus] = useState('default');
  const [saved, setSaved] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        setSettings({ ...DEFAULT_SETTINGS, ...parsed });
      }
    } catch {}

    if ('Notification' in window) {
      setPermissionStatus(Notification.permission);
    }
  }, []);

  const update = (key: keyof AppSettings, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    setSaved(true);
    setHasChanges(false);
    setTimeout(() => setSaved(false), 2000);
  };

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) return;
    try {
      const permission = await Notification.requestPermission();
      setPermissionStatus(permission);
      if (permission === 'granted') {
        new Notification('OneCompany Admin', {
          body: 'Сповіщення увімкнено!',
          icon: '/branding/one-company-logo.png',
        });
      }
    } catch {}
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto px-4 md:px-8 py-8 text-white pb-20">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Налаштування</h1>
            <p className="text-sm text-white/40 mt-1">Конфігурація додатку, магазину та зовнішнього вигляду.</p>
          </div>
          <button
            onClick={handleSave}
            disabled={!hasChanges && !saved}
            className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${
              saved
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : hasChanges
                  ? 'bg-white text-black hover:bg-zinc-200'
                  : 'bg-white/5 text-white/30 border border-white/10 cursor-not-allowed'
            }`}
          >
            {saved ? <><CheckCircle2 className="w-4 h-4" /> Збережено</> : <><Save className="w-4 h-4" /> Зберегти</>}
          </button>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar Sections */}
          <nav className="lg:w-56 shrink-0">
            <div className="sticky top-8 space-y-1">
              {SECTIONS.map(s => (
                <button
                  key={s.id}
                  onClick={() => setActiveSection(s.id)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm transition-all text-left ${
                    activeSection === s.id
                      ? 'bg-white/[0.08] text-white font-medium'
                      : 'text-white/40 hover:text-white/60 hover:bg-white/[0.03]'
                  }`}
                >
                  <span className={activeSection === s.id ? 'text-indigo-400' : ''}>{s.icon}</span>
                  {s.label}
                </button>
              ))}
            </div>
          </nav>

          {/* Content */}
          <div className="flex-1 min-w-0 space-y-6">

            {/* ─── Notifications ─── */}
            {activeSection === 'notifications' && (
              <SettingsCard title="Сповіщення" subtitle="Налаштування push-сповіщень та звукових ефектів." icon={<Bell className="w-5 h-5" />} color="blue">
                <SettingsRow label="Push-сповіщення" description="Отримуйте сповіщення навіть коли вкладка у фоні.">
                  <button
                    onClick={requestNotificationPermission}
                    disabled={permissionStatus === 'granted'}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      permissionStatus === 'granted'
                        ? 'bg-emerald-500/10 text-emerald-400 cursor-default'
                        : 'bg-white text-black hover:bg-zinc-200'
                    }`}
                  >
                    {permissionStatus === 'granted' ? '✓ Увімкнено' : permissionStatus === 'denied' ? 'Заблоковано' : 'Увімкнути'}
                  </button>
                </SettingsRow>
                <SettingsRow label="Звукові ефекти" description="Звук при надходженні нового запиту.">
                  <Toggle value={settings.soundEnabled} onChange={v => update('soundEnabled', v)} />
                </SettingsRow>
              </SettingsCard>
            )}

            {/* ─── Company ─── */}
            {activeSection === 'company' && (
              <SettingsCard title="Компанія" subtitle="Основна інформація про ваш бізнес." icon={<Store className="w-5 h-5" />} color="purple">
                <SettingsInput label="Назва компанії" icon={<Store className="w-4 h-4" />}
                  value={settings.companyName} onChange={v => update('companyName', v)} />
                <SettingsInput label="Email для зв'язку" icon={<Mail className="w-4 h-4" />}
                  value={settings.contactEmail} onChange={v => update('contactEmail', v)} type="email" />
                <SettingsInput label="Телефон" icon={<Phone className="w-4 h-4" />}
                  value={settings.contactPhone} onChange={v => update('contactPhone', v)} type="tel" />
                <SettingsInput label="Адреса" icon={<MapPin className="w-4 h-4" />}
                  value={settings.address} onChange={v => update('address', v)} />
              </SettingsCard>
            )}

            {/* ─── Shop ─── */}
            {activeSection === 'shop' && (
              <SettingsCard title="Магазин" subtitle="Валюта, маржинальність та мова каталогу." icon={<DollarSign className="w-5 h-5" />} color="emerald">
                <SettingsRow label="Валюта за замовчуванням" description="Основна валюта для відображення цін.">
                  <select
                    value={settings.defaultCurrency}
                    onChange={e => update('defaultCurrency', e.target.value)}
                    className="bg-white/[0.03] border border-white/10 text-sm text-white px-3 py-2 rounded-lg focus:outline-none focus:border-white/30 min-w-[120px]"
                  >
                    <option value="USD" className="bg-[#121216]">USD ($)</option>
                    <option value="EUR" className="bg-[#121216]">EUR (€)</option>
                    <option value="UAH" className="bg-[#121216]">UAH (₴)</option>
                  </select>
                </SettingsRow>
                <SettingsRow label="Маржа за замовчуванням" description="Відсоток надбавки на закупівельну ціну.">
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={settings.defaultMarkup}
                      onChange={e => update('defaultMarkup', Number(e.target.value))}
                      className="w-20 bg-white/[0.03] border border-white/10 text-sm text-white px-3 py-2 rounded-lg focus:outline-none focus:border-white/30 text-center"
                    />
                    <Percent className="w-4 h-4 text-white/30" />
                  </div>
                </SettingsRow>
                <SettingsRow label="Мова інтерфейсу" description="Мова каталогу та кабінету клієнта.">
                  <select
                    value={settings.defaultLanguage}
                    onChange={e => update('defaultLanguage', e.target.value)}
                    className="bg-white/[0.03] border border-white/10 text-sm text-white px-3 py-2 rounded-lg focus:outline-none focus:border-white/30 min-w-[140px]"
                  >
                    <option value="ua" className="bg-[#121216]">🇺🇦 Українська</option>
                    <option value="en" className="bg-[#121216]">🇬🇧 English</option>
                  </select>
                </SettingsRow>
                <SettingsRow label="Ціни з ПДВ" description="Показувати ціни з урахуванням ПДВ.">
                  <Toggle value={settings.showPricesWithVat} onChange={v => update('showPricesWithVat', v)} />
                </SettingsRow>
              </SettingsCard>
            )}

            {/* ─── SEO ─── */}
            {activeSection === 'seo' && (
              <SettingsCard title="SEO" subtitle="Мета-теги та Open Graph для пошукових систем." icon={<Search className="w-5 h-5" />} color="amber">
                <SettingsInput label="Meta Title" icon={<Globe className="w-4 h-4" />}
                  value={settings.metaTitle} onChange={v => update('metaTitle', v)}
                  hint={`${settings.metaTitle.length}/60 символів`} />
                <div className="px-6 py-4">
                  <label className="block text-xs uppercase tracking-widest text-white/40 mb-2">Meta Description</label>
                  <textarea
                    value={settings.metaDescription}
                    onChange={e => update('metaDescription', e.target.value)}
                    rows={3}
                    className="w-full bg-white/[0.03] border border-white/10 text-sm text-white px-4 py-3 rounded-lg focus:outline-none focus:border-white/30 resize-none"
                  />
                  <p className="text-[10px] text-white/25 mt-1">{settings.metaDescription.length}/160 символів</p>
                </div>
                <SettingsInput label="OG Image URL" icon={<Palette className="w-4 h-4" />}
                  value={settings.ogImage} onChange={v => update('ogImage', v)} />
                
                {/* SEO Preview */}
                <div className="px-6 py-4 border-t border-white/5">
                  <p className="text-[10px] uppercase tracking-widest text-white/30 mb-3">Попередній перегляд Google</p>
                  <div className="bg-white rounded-lg p-4 max-w-lg">
                    <p className="text-[#1a0dab] text-lg font-normal leading-tight truncate">{settings.metaTitle || 'OneCompany'}</p>
                    <p className="text-[#006621] text-sm mt-1 truncate">onecompany.com.ua</p>
                    <p className="text-[#545454] text-sm mt-1 line-clamp-2 leading-relaxed">{settings.metaDescription || 'Опис сайту...'}</p>
                  </div>
                </div>
              </SettingsCard>
            )}

            {/* ─── Appearance ─── */}
            {activeSection === 'appearance' && (
              <SettingsCard title="Зовнішній вигляд" subtitle="Кольори, тема та логотип." icon={<Palette className="w-5 h-5" />} color="pink">
                <SettingsRow label="Акцентний колір" description="Основний колір інтерфейсу адмін-панелі.">
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={settings.accentColor}
                      onChange={e => update('accentColor', e.target.value)}
                      className="w-10 h-10 rounded-lg border border-white/10 cursor-pointer bg-transparent"
                    />
                    <span className="text-xs text-white/40 font-mono">{settings.accentColor}</span>
                  </div>
                </SettingsRow>
                <SettingsInput label="URL логотипу" icon={<Palette className="w-4 h-4" />}
                  value={settings.logoUrl} onChange={v => update('logoUrl', v)} />
                <SettingsRow label="Темна тема" description="Завжди використовувати темну тему.">
                  <Toggle value={settings.darkMode} onChange={v => update('darkMode', v)} />
                </SettingsRow>
              </SettingsCard>
            )}

            {/* ─── Security ─── */}
            {activeSection === 'security' && (
              <SettingsCard title="Безпека" subtitle="Управління сесією та доступами." icon={<Shield className="w-5 h-5" />} color="red">
                <SettingsRow label="Адмін-сесія" description="Ви зараз авторизовані як адміністратор.">
                  <button
                    onClick={() => {
                      sessionStorage.removeItem('adminAuth');
                      window.location.reload();
                    }}
                    className="px-4 py-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg text-sm font-medium transition-colors"
                  >
                    Вийти
                  </button>
                </SettingsRow>
                <SettingsRow label="Очистити кеш" description="Скинути збережені налаштування до стандартних.">
                  <button
                    onClick={() => {
                      if (confirm('Скинути всі налаштування?')) {
                        localStorage.removeItem(STORAGE_KEY);
                        setSettings(DEFAULT_SETTINGS);
                        setHasChanges(false);
                      }
                    }}
                    className="px-4 py-2 bg-white/5 text-white/60 hover:bg-white/10 rounded-lg text-sm font-medium transition-colors border border-white/10"
                  >
                    Скинути
                  </button>
                </SettingsRow>
              </SettingsCard>
            )}

            {/* App Info */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-4 bg-white/[0.02] rounded-xl border border-white/5">
                <div className="text-[9px] uppercase tracking-widest text-white/25 mb-2">Версія</div>
                <div className="text-white font-mono text-sm">2.1.0</div>
              </div>
              <div className="p-4 bg-white/[0.02] rounded-xl border border-white/5">
                <div className="text-[9px] uppercase tracking-widest text-white/25 mb-2">Статус</div>
                <div className="flex items-center gap-2 text-emerald-400 text-sm">
                  <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                  Online
                </div>
              </div>
              <div className="p-4 bg-white/[0.02] rounded-xl border border-white/5">
                <div className="text-[9px] uppercase tracking-widest text-white/25 mb-2">PWA</div>
                <div className="text-white/60 text-sm">Standalone</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════
// Sub-components
// ═══════════════════════════════

function SettingsCard({ title, subtitle, icon, color, children }: {
  title: string; subtitle: string; icon: React.ReactNode; color: string; children: React.ReactNode;
}) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-500/10 text-blue-400',
    purple: 'bg-purple-500/10 text-purple-400',
    emerald: 'bg-emerald-500/10 text-emerald-400',
    amber: 'bg-amber-500/10 text-amber-400',
    pink: 'bg-pink-500/10 text-pink-400',
    red: 'bg-red-500/10 text-red-400',
  };
  return (
    <div className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden">
      <div className="p-6 border-b border-white/5">
        <div className="flex items-center gap-3 mb-1">
          <div className={`p-2 rounded-lg ${colors[color] || colors.blue}`}>{icon}</div>
          <h2 className="text-lg font-medium text-white">{title}</h2>
        </div>
        <p className="text-sm text-white/40 pl-[52px]">{subtitle}</p>
      </div>
      <div className="divide-y divide-white/5">{children}</div>
    </div>
  );
}

function SettingsRow({ label, description, children }: {
  label: string; description: string; children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-6 py-4 gap-4">
      <div className="min-w-0">
        <div className="text-sm font-medium text-white/80">{label}</div>
        <div className="text-xs text-white/30 mt-0.5">{description}</div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function SettingsInput({ label, icon, value, onChange, type = 'text', hint }: {
  label: string; icon: React.ReactNode; value: string; onChange: (v: string) => void; type?: string; hint?: string;
}) {
  return (
    <div className="px-6 py-4">
      <label className="flex items-center gap-2 text-xs uppercase tracking-widest text-white/40 mb-2">
        <span className="text-white/20">{icon}</span>
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-white/[0.03] border border-white/10 text-sm text-white px-4 py-2.5 rounded-lg focus:outline-none focus:border-white/30 transition-colors"
      />
      {hint && <p className="text-[10px] text-white/25 mt-1">{hint}</p>}
    </div>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`w-12 h-6 rounded-full transition-colors relative ${value ? 'bg-indigo-500' : 'bg-white/10'}`}
    >
      <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform shadow-sm ${
        value ? 'translate-x-6' : 'translate-x-0'
      }`} />
    </button>
  );
}

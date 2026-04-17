'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Bell, Shield, Globe, Store, Palette, Search, Save,
  CheckCircle2, Mail, Phone, MapPin, DollarSign, Percent,
  Loader2, AlertTriangle, RefreshCw
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

type AppSettings = {
  soundEnabled: boolean;
  companyName: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  defaultCurrency: string;
  defaultMarkup: number;
  defaultLanguage: string;
  showPricesWithVat: boolean;
  metaTitle: string;
  metaDescription: string;
  ogImage: string;
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ─── Load settings from DB on mount ───
  const fetchSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/settings/app');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: AppSettings = await res.json();
      let merged = { ...DEFAULT_SETTINGS, ...data };

      // One-time migration: if the DB has defaults and localStorage has real data, merge it
      try {
        const raw = localStorage.getItem('adminSettings');
        if (raw) {
          const local = JSON.parse(raw) as Partial<AppSettings>;
          const isDbDefault = data.companyName === DEFAULT_SETTINGS.companyName
            && data.contactEmail === DEFAULT_SETTINGS.contactEmail
            && data.metaTitle === DEFAULT_SETTINGS.metaTitle;

          if (isDbDefault && Object.keys(local).length > 0) {
            // DB has defaults — overlay localStorage values and auto-save
            merged = { ...merged, ...local };
            setHasChanges(true); // Mark for save to persist migration
          }
        }
      } catch {}

      setSettings(merged);
    } catch (err) {
      console.error('Failed to load settings:', err);
      setError('Не вдалося завантажити налаштування');
      // Hard fallback: try loading from localStorage directly
      try {
        const raw = localStorage.getItem('adminSettings');
        if (raw) {
          const parsed = JSON.parse(raw);
          setSettings({ ...DEFAULT_SETTINGS, ...parsed });
          setHasChanges(true);
        }
      } catch {}
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();

    if ('Notification' in window) {
      setPermissionStatus(Notification.permission);
    }
  }, [fetchSettings]);

  const update = (key: keyof AppSettings, value: unknown) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  // ─── Save settings to DB ───
  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/settings/app', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }

      const data: AppSettings = await res.json();
      setSettings({ ...DEFAULT_SETTINGS, ...data });

      // Clean up legacy localStorage data after successful save
      localStorage.removeItem('adminSettings');

      setSaved(true);
      setHasChanges(false);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Failed to save settings:', err);
      setError('Не вдалося зберегти налаштування');
    } finally {
      setSaving(false);
    }
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

  // ─── Loading state ───
  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-white/40">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span className="text-sm">Завантаження налаштувань…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-[1920px] mx-auto px-4 md:px-8 py-8 text-white pb-20">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Налаштування</h1>
            <p className="text-sm text-white/40 mt-1">Конфігурація додатку, магазину та зовнішнього вигляду.</p>
          </div>
          <div className="flex items-center gap-3">
            {error && (
              <div className="flex items-center gap-2 px-3 py-2 bg-red-950/30 border border-red-900/50 text-red-500/10 border border-red-500/20 rounded-none text-red-400 text-xs">
                <AlertTriangle className="w-3.5 h-3.5" />
                {error}
                <button onClick={fetchSettings} className="ml-1 hover:text-red-300 transition-colors">
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            <button
              onClick={handleSave}
              disabled={(!hasChanges && !saved) || saving}
              className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-none text-sm font-medium transition-all ${
                saved
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : saving
                    ? 'bg-white/10 text-white/50 border border-white/10 cursor-wait'
                    : hasChanges
                      ? 'bg-white text-black hover:bg-zinc-200'
                      : 'bg-white/5 text-white/30 border border-white/10 cursor-not-allowed'
              }`}
            >
              {saving ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Зберігаю…</>
              ) : saved ? (
                <><CheckCircle2 className="w-4 h-4" /> Збережено</>
              ) : (
                <><Save className="w-4 h-4" /> Зберегти</>
              )}
            </button>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar Sections */}
          <nav className="lg:w-56 shrink-0">
            <div className="sticky top-8 space-y-1">
              {SECTIONS.map(s => (
                <button
                  key={s.id}
                  onClick={() => setActiveSection(s.id)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-none text-sm transition-all text-left ${
                    activeSection === s.id
                      ? 'bg-white/[0.08] text-white font-medium'
                      : 'text-white/40 hover:text-white/60 hover:bg-white/[0.03]'
                  }`}
                >
                  <span className={activeSection === s.id ? 'text-zinc-400' : ''}>{s.icon}</span>
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
                    className={`px-4 py-2 rounded-none text-sm font-medium transition-all ${
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
                    className="bg-white/[0.03] border border-white/10 text-sm text-white px-3 py-2 rounded-none focus:outline-none focus:border-white/30 min-w-[120px]"
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
                      className="w-20 bg-white/[0.03] border border-white/10 text-sm text-white px-3 py-2 rounded-none focus:outline-none focus:border-white/30 text-center"
                    />
                    <Percent className="w-4 h-4 text-white/30" />
                  </div>
                </SettingsRow>
                <SettingsRow label="Мова інтерфейсу" description="Мова каталогу та кабінету клієнта.">
                  <select
                    value={settings.defaultLanguage}
                    onChange={e => update('defaultLanguage', e.target.value)}
                    className="bg-white/[0.03] border border-white/10 text-sm text-white px-3 py-2 rounded-none focus:outline-none focus:border-white/30 min-w-[140px]"
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
                    className="w-full bg-white/[0.03] border border-white/10 text-sm text-white px-4 py-3 rounded-none focus:outline-none focus:border-white/30 resize-none"
                  />
                  <p className="text-[10px] text-white/25 mt-1">{settings.metaDescription.length}/160 символів</p>
                </div>
                <SettingsInput label="OG Image URL" icon={<Palette className="w-4 h-4" />}
                  value={settings.ogImage} onChange={v => update('ogImage', v)} />
                
                {/* SEO Preview */}
                <div className="px-6 py-4 border-t border-white/5">
                  <p className="text-[10px] uppercase tracking-widest text-white/30 mb-3">Попередній перегляд Google</p>
                  <div className="bg-white rounded-none p-4 max-w-lg">
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
                      className="w-10 h-10 rounded-none border border-white/10 cursor-pointer bg-transparent"
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
                    className="px-4 py-2 bg-red-950/30 border border-red-900/50 text-red-500/10 text-red-400 hover:bg-red-950/30 border border-red-900/50 text-red-500/20 rounded-none text-sm font-medium transition-colors"
                  >
                    Вийти
                  </button>
                </SettingsRow>
                <SettingsRow label="Скинути до стандартних" description="Повернути всі налаштування до значень за замовчуванням.">
                  <button
                    onClick={async () => {
                      if (!confirm('Скинути всі налаштування до стандартних?')) return;
                      try {
                        const res = await fetch('/api/admin/settings/app', {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify(DEFAULT_SETTINGS),
                        });
                        if (res.ok) {
                          setSettings(DEFAULT_SETTINGS);
                          setHasChanges(false);
                          localStorage.removeItem('adminSettings');
                        }
                      } catch {}
                    }}
                    className="px-4 py-2 bg-white/5 text-white/60 hover:bg-white/10 rounded-none text-sm font-medium transition-colors border border-white/10"
                  >
                    Скинути
                  </button>
                </SettingsRow>
              </SettingsCard>
            )}

            {/* App Info */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-4 bg-white/[0.02] rounded-none border border-white/5">
                <div className="text-[9px] uppercase tracking-widest text-white/25 mb-2">Версія</div>
                <div className="text-white font-mono text-sm">2.2.0</div>
              </div>
              <div className="p-4 bg-white/[0.02] rounded-none border border-white/5">
                <div className="text-[9px] uppercase tracking-widest text-white/25 mb-2">Сховище</div>
                <div className="flex items-center gap-2 text-emerald-400 text-sm">
                  <div className="w-1.5 h-1.5 bg-emerald-400 rounded-none-full animate-pulse" />
                  PostgreSQL
                </div>
              </div>
              <div className="p-4 bg-white/[0.02] rounded-none border border-white/5">
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
    blue: 'bg-zinc-100 text-black/10 text-zinc-400',
    purple: 'bg-zinc-100 text-black/10 text-zinc-400',
    emerald: 'bg-emerald-500/10 text-emerald-400',
    amber: 'bg-amber-500/10 text-amber-400',
    pink: 'bg-zinc-100 text-black/10 text-zinc-400',
    red: 'bg-red-950/30 border border-red-900/50 text-red-500/10 text-red-400',
  };
  return (
    <div className="bg-white/[0.02] border border-white/5 rounded-none overflow-hidden">
      <div className="p-6 border-b border-white/5">
        <div className="flex items-center gap-3 mb-1">
          <div className={`p-2 rounded-none ${colors[color] || colors.blue}`}>{icon}</div>
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
        className="w-full bg-white/[0.03] border border-white/10 text-sm text-white px-4 py-2.5 rounded-none focus:outline-none focus:border-white/30 transition-colors"
      />
      {hint && <p className="text-[10px] text-white/25 mt-1">{hint}</p>}
    </div>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`w-12 h-6 rounded-none-full transition-colors relative ${value ? 'bg-zinc-100 text-black' : 'bg-white/10'}`}
    >
      <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-none-full transition-transform border border-white/5 ${
        value ? 'translate-x-6' : 'translate-x-0'
      }`} />
    </button>
  );
}

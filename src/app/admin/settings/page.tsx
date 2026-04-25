'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  Bell,
  Globe,
  Loader2,
  Mail,
  MapPin,
  Palette,
  Phone,
  RefreshCw,
  Save,
  Search,
  Shield,
  Store,
} from 'lucide-react';

import {
  AdminDangerZone,
  AdminEmptyState,
  AdminInlineAlert,
  AdminInsightPanel,
  AdminInspectorCard,
  AdminKeyValueGrid,
  AdminPage,
  AdminPageHeader,
  AdminSettingsNav,
  AdminSettingsShell,
  AdminStatusBadge,
  AdminStickyActionBar,
} from '@/components/admin/AdminPrimitives';
import {
  AdminCheckboxField,
  AdminInputField,
  AdminSelectField,
  AdminTextareaField,
} from '@/components/admin/AdminFormFields';

type SettingsSection = 'notifications' | 'company' | 'shop' | 'seo' | 'appearance' | 'security';

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

const SETTINGS_SECTIONS: Array<{ id: SettingsSection; label: string; description: string }> = [
  { id: 'notifications', label: 'Notifications', description: 'Push alerts and operator sound feedback.' },
  { id: 'company', label: 'Company', description: 'Core business identity and contact details.' },
  { id: 'shop', label: 'Shop defaults', description: 'Default currency, language, markup, and VAT visibility.' },
  { id: 'seo', label: 'SEO', description: 'Search metadata and Open Graph defaults.' },
  { id: 'appearance', label: 'Appearance', description: 'Brand accents, logo, and admin UI preferences.' },
  { id: 'security', label: 'Security', description: 'Admin session handling and reset controls.' },
];

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
  metaDescription:
    "Офіційний дистриб'ютор Urban Automotive, KW Suspension, FI Exhaust. Оригінальні деталі для BMW, Porsche, Mercedes та інших.",
  ogImage: '/branding/one-company-logo.png',
  accentColor: '#6366f1',
  logoUrl: '/branding/one-company-logo.png',
  darkMode: true,
};

function createSnapshot(value: AppSettings) {
  return JSON.stringify(value);
}

export default function AdminSettingsPage() {
  const [activeSection, setActiveSection] = useState<SettingsSection>('notifications');
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [draft, setDraft] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<'default' | 'granted' | 'denied'>('default');

  const hasChanges = useMemo(() => createSnapshot(settings) !== createSnapshot(draft), [settings, draft]);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/settings/app', { cache: 'no-store' });
      const payload = (await response.json().catch(() => ({}))) as Partial<AppSettings> & { error?: string };

      if (!response.ok) {
        throw new Error(payload.error || 'Failed to load settings');
      }

      let merged = { ...DEFAULT_SETTINGS, ...payload };

      try {
        const localRaw = localStorage.getItem('adminSettings');
        if (localRaw) {
          const localSettings = JSON.parse(localRaw) as Partial<AppSettings>;
          const isServerDefault =
            payload.companyName === DEFAULT_SETTINGS.companyName &&
            payload.contactEmail === DEFAULT_SETTINGS.contactEmail &&
            payload.metaTitle === DEFAULT_SETTINGS.metaTitle;

          if (isServerDefault && Object.keys(localSettings).length > 0) {
            merged = { ...merged, ...localSettings };
          }
        }
      } catch {
        // Keep settings resilient if legacy local storage is malformed.
      }

      setSettings(merged);
      setDraft(merged);
      setSaved(false);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Failed to load settings';
      setError(message);

      try {
        const localRaw = localStorage.getItem('adminSettings');
        if (localRaw) {
          const localSettings = JSON.parse(localRaw) as Partial<AppSettings>;
          const merged = { ...DEFAULT_SETTINGS, ...localSettings };
          setSettings(merged);
          setDraft(merged);
        }
      } catch {
        // Nothing else to do here.
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSettings();

    if ('Notification' in window) {
      setPermissionStatus(Notification.permission);
    }
  }, [loadSettings]);

  const updateDraft = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setDraft((current) => ({
      ...current,
      [key]: value,
    }));
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/settings/app', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });

      const payload = (await response.json().catch(() => ({}))) as Partial<AppSettings> & { error?: string };

      if (!response.ok) {
        throw new Error(payload.error || 'Failed to save settings');
      }

      const merged = { ...DEFAULT_SETTINGS, ...payload };
      setSettings(merged);
      setDraft(merged);
      setSaved(true);
      localStorage.removeItem('adminSettings');
      window.setTimeout(() => setSaved(false), 2_000);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      setPermissionStatus(permission);
      if (permission === 'granted') {
        new Notification('OneCompany Admin', {
          body: 'Notifications are now enabled.',
          icon: '/branding/one-company-logo.png',
        });
      }
    } catch {
      setError('Notification permission could not be updated');
    }
  };

  const handleReset = async () => {
    setDraft(DEFAULT_SETTINGS);
    setSettings(DEFAULT_SETTINGS);
    setSaved(false);
    localStorage.removeItem('adminSettings');

    try {
      const response = await fetch('/api/admin/settings/app', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(DEFAULT_SETTINGS),
      });

      if (!response.ok) {
        throw new Error('Failed to reset settings');
      }
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : 'Failed to reset settings');
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/admin/auth', { method: 'DELETE' });
      window.location.reload();
    } catch {
      setError('Failed to close admin session');
    }
  };

  if (loading) {
    return (
      <AdminPage>
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="flex items-center gap-3 text-sm text-zinc-400">
            <Loader2 className="h-4 w-4 motion-safe:animate-spin" />
            Loading global settings…
          </div>
        </div>
      </AdminPage>
    );
  }

  if (!settings && !draft) {
    return (
      <AdminPage>
        <AdminEmptyState
          title="Settings are unavailable"
          description={error || 'The system settings payload could not be loaded.'}
          action={
            <button
              type="button"
              onClick={() => void loadSettings()}
              className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-zinc-200 transition hover:bg-white/[0.06]"
            >
              Retry
            </button>
          }
        />
      </AdminPage>
    );
  }

  const activeLabel = SETTINGS_SECTIONS.find((section) => section.id === activeSection)?.label ?? 'Settings';

  return (
    <AdminPage className="space-y-6">
      <AdminPageHeader
        eyebrow="System"
        title="Global settings"
        description="Structured business defaults for notifications, company identity, shop behavior, SEO, appearance, and security."
      />

      <AdminStickyActionBar>
        <div className="flex flex-wrap items-center gap-2">
          <AdminStatusBadge tone={hasChanges ? 'warning' : 'success'}>
            {hasChanges ? 'Unsaved changes' : saved ? 'Saved' : 'In sync'}
          </AdminStatusBadge>
          <AdminStatusBadge tone={permissionStatus === 'granted' ? 'success' : permissionStatus === 'denied' ? 'danger' : 'warning'}>
            Notifications {permissionStatus}
          </AdminStatusBadge>
          <AdminStatusBadge>{activeLabel}</AdminStatusBadge>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void loadSettings()}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-xs uppercase tracking-[0.18em] text-zinc-300 transition hover:text-zinc-100"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Reload
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className="inline-flex items-center gap-2 rounded-full border border-blue-500/25 bg-blue-500/[0.08] px-4 py-2 text-xs uppercase tracking-[0.18em] text-blue-300 transition disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 motion-safe:animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {saving ? 'Saving' : 'Save changes'}
          </button>
        </div>
      </AdminStickyActionBar>

      {error ? <AdminInlineAlert tone="warning">{error}</AdminInlineAlert> : null}

      <AdminSettingsShell
        navigation={
          <AdminSettingsNav
            items={SETTINGS_SECTIONS}
            activeId={activeSection}
            onChange={(section) => setActiveSection(section as SettingsSection)}
          />
        }
        content={
          <>
            {activeSection === 'notifications' ? (
              <AdminInsightPanel
                title="Notifications"
                description="Manage operator-facing notification behavior without mixing it with broader system settings."
              >
                <div className="grid gap-6 md:grid-cols-2">
                  <AdminCheckboxField
                    label="Enable sound feedback"
                    checked={draft.soundEnabled}
                    onChange={(value) => updateDraft('soundEnabled', value)}
                    helper="Play a sound cue when new requests enter the admin queue."
                  />
                  <div className="rounded-[6px] border border-white/8 bg-black/25 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium text-zinc-100">Push notifications</div>
                        <div className="mt-1 text-xs leading-5 text-zinc-500">
                          Browser-level notification permission for this workstation.
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => void requestNotificationPermission()}
                        disabled={permissionStatus === 'granted'}
                        className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-xs uppercase tracking-[0.18em] text-zinc-300 transition hover:text-zinc-100 disabled:opacity-40"
                      >
                        {permissionStatus === 'granted' ? 'Enabled' : permissionStatus === 'denied' ? 'Blocked' : 'Request'}
                      </button>
                    </div>
                  </div>
                </div>
              </AdminInsightPanel>
            ) : null}

            {activeSection === 'company' ? (
              <AdminInsightPanel
                title="Company identity"
                description="These values power business metadata and shared contact references across the admin and storefront."
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <AdminInputField
                    label="Company name"
                    value={draft.companyName}
                    onChange={(value) => updateDraft('companyName', value)}
                    helper="Internal and customer-facing business name."
                  />
                  <AdminInputField
                    label="Contact email"
                    type="email"
                    value={draft.contactEmail}
                    onChange={(value) => updateDraft('contactEmail', value)}
                    helper="Public-facing email for storefront contact blocks."
                  />
                  <AdminInputField
                    label="Contact phone"
                    value={draft.contactPhone}
                    onChange={(value) => updateDraft('contactPhone', value)}
                    helper="Displayed in contact and support contexts."
                  />
                  <AdminInputField
                    label="Address"
                    value={draft.address}
                    onChange={(value) => updateDraft('address', value)}
                    helper="Primary office or warehouse address."
                  />
                </div>
              </AdminInsightPanel>
            ) : null}

            {activeSection === 'shop' ? (
              <AdminInsightPanel
                title="Shop defaults"
                description="These defaults shape how catalog pricing and language behave before route-level overrides."
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <AdminSelectField
                    label="Default currency"
                    value={draft.defaultCurrency}
                    onChange={(value) => updateDraft('defaultCurrency', value)}
                    options={[
                      { value: 'USD', label: 'USD ($)' },
                      { value: 'EUR', label: 'EUR (€)' },
                      { value: 'UAH', label: 'UAH (₴)' },
                    ]}
                  />
                  <AdminSelectField
                    label="Default language"
                    value={draft.defaultLanguage}
                    onChange={(value) => updateDraft('defaultLanguage', value)}
                    options={[
                      { value: 'ua', label: 'Українська' },
                      { value: 'en', label: 'English' },
                    ]}
                  />
                  <AdminInputField
                    label="Default markup"
                    type="number"
                    step="1"
                    value={String(draft.defaultMarkup)}
                    onChange={(value) => updateDraft('defaultMarkup', Number(value || 0))}
                    helper="Base markup percent used by admin pricing defaults."
                  />
                  <AdminCheckboxField
                    label="Show prices with VAT"
                    checked={draft.showPricesWithVat}
                    onChange={(value) => updateDraft('showPricesWithVat', value)}
                    helper="Use VAT-inclusive messaging as the default storefront posture."
                  />
                </div>
              </AdminInsightPanel>
            ) : null}

            {activeSection === 'seo' ? (
              <AdminInsightPanel
                title="Search and social metadata"
                description="System-wide metadata defaults for Google and Open Graph surfaces."
              >
                <div className="grid gap-4">
                  <AdminInputField
                    label="Meta title"
                    value={draft.metaTitle}
                    onChange={(value) => updateDraft('metaTitle', value)}
                    helper={`${draft.metaTitle.length}/60 characters`}
                  />
                  <AdminTextareaField
                    label="Meta description"
                    value={draft.metaDescription}
                    onChange={(value) => updateDraft('metaDescription', value)}
                    helper={`${draft.metaDescription.length}/160 characters`}
                    rows={4}
                  />
                  <div className="grid gap-4 md:grid-cols-2">
                    <AdminInputField
                      label="Open Graph image"
                      value={draft.ogImage}
                      onChange={(value) => updateDraft('ogImage', value)}
                    />
                    <AdminInputField
                      label="Logo URL"
                      value={draft.logoUrl}
                      onChange={(value) => updateDraft('logoUrl', value)}
                    />
                  </div>
                  <div className="rounded-[6px] border border-white/8 bg-white p-4">
                    <div className="text-lg text-[#1a0dab]">{draft.metaTitle || 'OneCompany'}</div>
                    <div className="mt-1 text-sm text-[#006621]">onecompany.com.ua</div>
                    <div className="mt-1 text-sm leading-6 text-[#545454]">{draft.metaDescription || 'Description preview'}</div>
                  </div>
                </div>
              </AdminInsightPanel>
            ) : null}

            {activeSection === 'appearance' ? (
              <AdminInsightPanel
                title="Appearance"
                description="Keep the internal UI anchored to the brand while preserving usability and clarity."
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <AdminInputField
                    label="Accent color"
                    value={draft.accentColor}
                    onChange={(value) => updateDraft('accentColor', value)}
                    helper="Hex value used for internal accent treatments."
                  />
                  <AdminInputField
                    label="Logo URL"
                    value={draft.logoUrl}
                    onChange={(value) => updateDraft('logoUrl', value)}
                    helper="Used by admin and fallback OG surfaces."
                  />
                  <AdminCheckboxField
                    label="Dark mode"
                    checked={draft.darkMode}
                    onChange={(value) => updateDraft('darkMode', value)}
                    helper="Keep the admin UI in the dark operations theme."
                  />
                </div>
              </AdminInsightPanel>
            ) : null}

            {activeSection === 'security' ? (
              <>
                <AdminInsightPanel
                  title="Session and access posture"
                  description="Operational view of current admin session controls."
                >
                  <AdminKeyValueGrid
                    rows={[
                      { label: 'Session state', value: 'Authenticated' },
                      { label: 'Notification permission', value: permissionStatus },
                      { label: 'Settings flow', value: hasChanges ? 'Unsaved changes pending' : 'Synchronized with server' },
                    ]}
                  />
                </AdminInsightPanel>

                <AdminDangerZone
                  title="Danger zone"
                  description="These actions affect the entire admin control layer. Use them deliberately."
                >
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => void handleReset()}
                      className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs uppercase tracking-[0.18em] text-zinc-200 transition hover:bg-white/[0.06]"
                    >
                      Reset to defaults
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleLogout()}
                      className="rounded-full border border-blue-500/25 bg-blue-950/20 px-4 py-2 text-xs uppercase tracking-[0.18em] text-red-100 transition hover:bg-red-950/35"
                    >
                      End admin session
                    </button>
                  </div>
                </AdminDangerZone>
              </>
            ) : null}
          </>
        }
        sidebar={
          <>
            <AdminInspectorCard
              title="Configuration snapshot"
              description="High-level summary of the current system defaults."
            >
              <AdminKeyValueGrid
                rows={[
                  { label: 'Currency', value: draft.defaultCurrency },
                  { label: 'Language', value: draft.defaultLanguage.toUpperCase() },
                  { label: 'Markup', value: `${draft.defaultMarkup}%` },
                  { label: 'VAT mode', value: draft.showPricesWithVat ? 'Visible' : 'Hidden' },
                ]}
              />
            </AdminInspectorCard>

            <AdminInspectorCard
              title="Brand surfaces"
              description="The most visible global metadata surfaces exposed to customers."
            >
              <AdminKeyValueGrid
                rows={[
                  { label: 'Company', value: draft.companyName },
                  { label: 'Contact', value: `${draft.contactEmail} · ${draft.contactPhone}` },
                  { label: 'Meta title', value: draft.metaTitle },
                  { label: 'Accent', value: draft.accentColor },
                ]}
              />
            </AdminInspectorCard>
          </>
        }
      />
    </AdminPage>
  );
}

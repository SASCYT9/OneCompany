'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, ExternalLink, Loader2, Plug, RefreshCcw, Trash2, XCircle, Zap } from 'lucide-react';

import {
  AdminInlineAlert,
  AdminInspectorCard,
  AdminPage,
  AdminPageHeader,
  AdminStatusBadge,
} from '@/components/admin/AdminPrimitives';
import { AdminInputField } from '@/components/admin/AdminFormFields';
import { useToast } from '@/components/admin/AdminToast';
import { useConfirm } from '@/components/admin/AdminConfirmDialog';

type Provider = 'MAILCHIMP' | 'META_ADS' | 'GOOGLE_ADS' | 'GOOGLE_ANALYTICS';

type Integration = {
  id: string;
  provider: Provider;
  apiKey: string | null;
  apiSecret: string | null;
  accountId: string | null;
  configuration: Record<string, unknown> | null;
  isActive: boolean;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  lastSyncError: string | null;
  connectedAt: string | null;
};

const PROVIDER_INFO: Record<
  Provider,
  {
    name: string;
    description: string;
    docsUrl: string;
    requiresAccountId: boolean;
    apiKeyLabel: string;
    accountIdLabel?: string;
    accountIdPlaceholder?: string;
  }
> = {
  MAILCHIMP: {
    name: 'Mailchimp',
    description: 'Email-маркетинг. Синхронізація відкриттів/кліків та розсилки по сегментах.',
    docsUrl: 'https://mailchimp.com/developer/marketing/guides/quick-start/',
    requiresAccountId: false,
    apiKeyLabel: 'API-ключ (має закінчуватись на -usX — суфікс data center)',
  },
  META_ADS: {
    name: 'Meta Ads',
    description: 'Витрати на рекламу Facebook/Instagram, покази, конверсії по кампаніях.',
    docsUrl: 'https://developers.facebook.com/docs/marketing-apis/',
    requiresAccountId: true,
    apiKeyLabel: 'Access Token (довготривалий)',
    accountIdLabel: 'ID рекламного акаунту (act_XXXXXX)',
    accountIdPlaceholder: 'act_1234567890',
  },
  GOOGLE_ADS: {
    name: 'Google Ads',
    description: 'Результати пошукової та банерної реклами по кампаніях.',
    docsUrl: 'https://developers.google.com/google-ads/api/docs/start',
    requiresAccountId: true,
    apiKeyLabel: 'Developer Token',
    accountIdLabel: 'Customer ID',
  },
  GOOGLE_ANALYTICS: {
    name: 'Google Analytics 4',
    description: 'Трафік, конверсії, атрибуція. Вкладка «Звіти» бере веб-сесії та користувачів.',
    docsUrl: 'https://developers.google.com/analytics/devguides/reporting/data/v1',
    requiresAccountId: true,
    apiKeyLabel: 'Service Account JSON (вставте повний JSON)',
    accountIdLabel: 'Property ID',
  },
};

export default function AdminIntegrationsPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [editingProvider, setEditingProvider] = useState<Provider | null>(null);
  const [testing, setTesting] = useState<Provider | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const response = await fetch('/api/admin/integrations', { cache: 'no-store' });
        if (!response.ok) return;
        const data = await response.json();
        setIntegrations(data.integrations || []);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [reloadKey]);

  async function disconnect(provider: Provider) {
    const ok = await confirm({
      tone: 'danger',
      title: `Відключити ${PROVIDER_INFO[provider].name}?`,
      description: 'API-облікові дані буде видалено. Ви зможете підключити знову будь-коли.',
      confirmLabel: 'Відключити',
    });
    if (!ok) return;
    const response = await fetch(`/api/admin/integrations/${provider}`, { method: 'DELETE' });
    if (!response.ok) {
      toast.error('Не вдалося відключити');
      return;
    }
    toast.success('Відключено');
    setReloadKey((k) => k + 1);
  }

  async function testConnection(provider: Provider) {
    setTesting(provider);
    try {
      const response = await fetch(`/api/admin/integrations/${provider}?action=test`, { method: 'POST' });
      const data = await response.json().catch(() => ({}));
      if (data.ok) {
        toast.success(`Зʼєднання ${PROVIDER_INFO[provider].name} працює`);
      } else {
        toast.error('Тест зʼєднання не пройшов', data.error || 'Невідома помилка');
      }
      setReloadKey((k) => k + 1);
    } finally {
      setTesting(null);
    }
  }

  const allProviders: Provider[] = ['MAILCHIMP', 'META_ADS', 'GOOGLE_ADS', 'GOOGLE_ANALYTICS'];
  const integrationByProvider = new Map<Provider, Integration>(integrations.map((i) => [i.provider, i]));

  return (
    <AdminPage className="space-y-6">
      <AdminPageHeader
        eyebrow="Налаштування"
        title="Інтеграції"
        description="Підключіть зовнішні маркетингові й аналітичні платформи. Реальні дані кампаній потраплять у віджет «Результати маркетингу» в дашборді."
        actions={
          <button
            type="button"
            onClick={() => setReloadKey((k) => k + 1)}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-200 transition hover:bg-white/10"
          >
            <RefreshCcw className="h-4 w-4" />
            Оновити
          </button>
        }
      />

      <AdminInlineAlert tone="warning">
        API-ключі зберігаються у базі. Для продакшну шифруйте ключі — задайте{' '}
        <code className="rounded-none bg-white/[0.06] px-1 text-xs">INTEGRATIONS_ENCRYPTION_KEY</code> у змінних середовища.
      </AdminInlineAlert>

      <div className="grid gap-4 md:grid-cols-2">
        {allProviders.map((provider) => {
          const info = PROVIDER_INFO[provider];
          const integration = integrationByProvider.get(provider);
          const connected = Boolean(integration);
          const isEditing = editingProvider === provider;

          return (
            <AdminInspectorCard
              key={provider}
              title={info.name}
              description={info.description}
            >
              {loading ? (
                <div className="text-xs text-zinc-500">Завантаження…</div>
              ) : (
                <>
                  <div className="mb-3 flex items-center gap-2">
                    {connected ? (
                      <AdminStatusBadge tone="success">
                        <CheckCircle2 className="mr-1 inline-block h-3 w-3" />
                        Підключено
                      </AdminStatusBadge>
                    ) : (
                      <AdminStatusBadge tone="default">
                        <XCircle className="mr-1 inline-block h-3 w-3" />
                        Не підключено
                      </AdminStatusBadge>
                    )}
                    {integration?.lastSyncStatus ? (
                      <AdminStatusBadge tone={integration.lastSyncStatus === 'SUCCESS' ? 'success' : 'warning'}>
                        Остання синхр. {integration.lastSyncStatus === 'SUCCESS' ? 'успішна' : integration.lastSyncStatus.toLowerCase()}
                      </AdminStatusBadge>
                    ) : null}
                  </div>

                  {connected && integration && !isEditing ? (
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-between rounded-none border border-white/[0.04] bg-black/25 px-3 py-1.5 text-xs">
                        <span className="text-zinc-500">API-ключ</span>
                        <span className="font-mono text-zinc-300">{integration.apiKey ?? '—'}</span>
                      </div>
                      {integration.accountId ? (
                        <div className="flex items-center justify-between rounded-none border border-white/[0.04] bg-black/25 px-3 py-1.5 text-xs">
                          <span className="text-zinc-500">ID акаунту</span>
                          <span className="font-mono text-zinc-300">{integration.accountId}</span>
                        </div>
                      ) : null}
                      {integration.connectedAt ? (
                        <div className="flex items-center justify-between rounded-none border border-white/[0.04] bg-black/25 px-3 py-1.5 text-xs">
                          <span className="text-zinc-500">Підключено</span>
                          <span className="text-zinc-300">{new Date(integration.connectedAt).toLocaleString()}</span>
                        </div>
                      ) : null}
                      {integration.lastSyncError ? (
                        <div className="rounded-none border border-red-500/20 bg-red-500/[0.04] px-3 py-1.5 text-xs text-red-300">
                          {integration.lastSyncError}
                        </div>
                      ) : null}

                      <div className="flex flex-wrap items-center gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => void testConnection(provider)}
                          disabled={testing === provider}
                          className="inline-flex items-center gap-1.5 rounded-none border border-blue-500/25 bg-blue-500/[0.06] px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-blue-300 transition hover:bg-blue-500/[0.12] disabled:opacity-50"
                        >
                          {testing === provider ? (
                            <Loader2 className="h-3 w-3 motion-safe:animate-spin" />
                          ) : (
                            <Zap className="h-3 w-3" />
                          )}
                          Перевірити зʼєднання
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingProvider(provider)}
                          className="rounded-none border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-zinc-300 transition hover:bg-white/[0.06]"
                        >
                          Оновити ключі
                        </button>
                        <button
                          type="button"
                          onClick={() => void disconnect(provider)}
                          className="inline-flex items-center gap-1.5 rounded-none border border-red-500/25 bg-red-500/[0.04] px-3 py-1.5 text-xs text-red-300 transition hover:bg-red-500/[0.1]"
                        >
                          <Trash2 className="h-3 w-3" />
                          Відключити
                        </button>
                      </div>
                    </div>
                  ) : (
                    <ConnectForm
                      provider={provider}
                      onSaved={() => {
                        setEditingProvider(null);
                        setReloadKey((k) => k + 1);
                      }}
                      onCancel={isEditing ? () => setEditingProvider(null) : undefined}
                      info={info}
                    />
                  )}

                  <a
                    href={info.docsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex items-center gap-1 text-[11px] text-zinc-500 transition hover:text-blue-300"
                  >
                    <Plug className="h-3 w-3" />
                    Документація провайдера
                    <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                </>
              )}
            </AdminInspectorCard>
          );
        })}
      </div>
    </AdminPage>
  );
}

function ConnectForm({
  provider,
  info,
  onSaved,
  onCancel,
}: {
  provider: Provider;
  info: (typeof PROVIDER_INFO)[Provider];
  onSaved: () => void;
  onCancel?: () => void;
}) {
  const toast = useToast();
  const [apiKey, setApiKey] = useState('');
  const [accountId, setAccountId] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleConnect() {
    if (!apiKey.trim()) {
      toast.warning('Потрібен API-ключ');
      return;
    }
    if (info.requiresAccountId && !accountId.trim()) {
      toast.warning(`Потрібно: ${info.accountIdLabel}`);
      return;
    }
    setSaving(true);
    try {
      const response = await fetch('/api/admin/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          apiKey: apiKey.trim(),
          accountId: info.requiresAccountId ? accountId.trim() : null,
          isActive: true,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast.error('Не вдалося підключити', data.error || 'Спробуйте ще раз');
        return;
      }
      toast.success(`${info.name} підключено`);
      setApiKey('');
      setAccountId('');
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <AdminInputField label={info.apiKeyLabel} value={apiKey} onChange={setApiKey} placeholder="Вставте API-ключ" />
      {info.requiresAccountId ? (
        <AdminInputField
          label={info.accountIdLabel ?? 'ID акаунту'}
          value={accountId}
          onChange={setAccountId}
          placeholder={info.accountIdPlaceholder}
        />
      ) : null}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => void handleConnect()}
          disabled={saving || !apiKey.trim()}
          className="inline-flex items-center gap-2 rounded-none bg-blue-600 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-blue-500 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-3 w-3 motion-safe:animate-spin" /> : <Plug className="h-3 w-3" />}
          Підключити
        </button>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-none border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-zinc-300 transition hover:bg-white/[0.06]"
          >
            Скасувати
          </button>
        ) : null}
      </div>
    </div>
  );
}

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { CheckCircle2, Copy, Database, KeyRound, Mail, RotateCcw, Save, UserRound } from 'lucide-react';

import {
  AdminEntityToolbar,
  AdminInspectorCard,
  AdminKeyValueGrid,
  AdminMetricCard,
  AdminMetricGrid,
  AdminPage,
  AdminPageHeader,
  AdminSplitDetailShell,
  AdminStatusBadge,
  AdminTableShell,
} from '@/components/admin/AdminPrimitives';
import {
  AdminCheckboxField,
  AdminInputField,
  AdminSelectField,
  AdminTextareaField,
} from '@/components/admin/AdminFormFields';
import { useToast } from '@/components/admin/AdminToast';
import { AdminActivityTimeline } from '@/components/admin/AdminActivityTimeline';
import { AdminNotes } from '@/components/admin/AdminNotes';
import { AdminTagInput } from '@/components/admin/AdminTagInput';
import { CustomerCreditPanel } from '@/app/admin/shop/customers/components/CustomerCreditPanel';
import { CustomerLtvHeader } from '@/app/admin/shop/customers/components/CustomerLtvHeader';

type CustomerGroup = 'B2C' | 'B2B_PENDING' | 'B2B_APPROVED';

type CustomerDetail = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  phone: string | null;
  companyName: string | null;
  vatNumber: string | null;
  group: CustomerGroup;
  b2bDiscountPercent: number | null;
  discountTier: string | null;
  region: string | null;
  currencyPref: string;
  balance: number;
  isActive: boolean;
  notes: string | null;
  preferredLocale: string;
  createdAt: string;
  updatedAt: string;
  account: {
    lastLoginAt: string | null;
    emailVerifiedAt: string | null;
    hasPassword: boolean;
  } | null;
  passwordSetup: {
    expiresAt: string;
    createdAt: string;
  } | null;
  defaultShippingAddress: {
    line1: string;
    line2: string | null;
    city: string;
    region: string | null;
    postcode: string | null;
    country: string;
  } | null;
  addresses: Array<{
    id: string;
    label: string;
    line1: string;
    line2: string | null;
    city: string;
    region: string | null;
    postcode: string | null;
    country: string;
    isDefaultShipping: boolean;
    isDefaultBilling: boolean;
  }>;
  orders: Array<{
    id: string;
    orderNumber: string;
    status: string;
    currency: string;
    subtotal: number;
    total: number;
    createdAt: string;
    itemCount: number;
  }>;
  carts: Array<{
    id: string;
    token: string;
    currency: string;
    locale: string;
    updatedAt: string;
    expiresAt: string;
    itemCount: number;
  }>;
  auditLog: Array<{
    id: string;
    actorEmail: string;
    actorName: string | null;
    action: string;
    metadata: unknown;
    createdAt: string;
  }>;
};

type CustomerForm = {
  firstName: string;
  lastName: string;
  phone: string;
  companyName: string;
  vatNumber: string;
  notes: string;
  b2bDiscountPercent: string;
  discountTier: string;
  region: string;
  currencyPref: string;
  balance: string;
  preferredLocale: string;
  isActive: boolean;
  group: CustomerGroup;
};

type CrmOrder = {
  id: string;
  number: number;
  name: string;
  orderStatus: string;
  paymentStatus: string;
  totalAmount: number;
  clientTotal: number;
  tag: string;
  orderDate: string | null;
  itemCount: number;
};

function createForm(customer: CustomerDetail): CustomerForm {
  return {
    firstName: customer.firstName,
    lastName: customer.lastName,
    phone: customer.phone ?? '',
    companyName: customer.companyName ?? '',
    vatNumber: customer.vatNumber ?? '',
    notes: customer.notes ?? '',
    b2bDiscountPercent: customer.b2bDiscountPercent != null ? String(customer.b2bDiscountPercent) : '',
    discountTier: customer.discountTier ?? '',
    region: customer.region ?? '',
    currencyPref: customer.currencyPref ?? 'EUR',
    balance: String(customer.balance ?? 0),
    preferredLocale: customer.preferredLocale,
    isActive: customer.isActive,
    group: customer.group,
  };
}

function customerGroupTone(group: CustomerGroup): 'default' | 'success' | 'warning' {
  switch (group) {
    case 'B2B_APPROVED':
      return 'success';
    case 'B2B_PENDING':
      return 'warning';
    default:
      return 'default';
  }
}

export default function AdminShopCustomerDetailPage() {
  const toast = useToast();
  const params = useParams();
  const id = params?.id as string;
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [form, setForm] = useState<CustomerForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [setupLinkUrl, setSetupLinkUrl] = useState<string | null>(null);
  const [setupLinkExpiresAt, setSetupLinkExpiresAt] = useState<string | null>(null);
  const [copiedSetupLink, setCopiedSetupLink] = useState(false);
  const [crmOrders, setCrmOrders] = useState<CrmOrder[]>([]);
  const [crmLoading, setCrmLoading] = useState(false);
  const [customerMarkup, setCustomerMarkup] = useState<{ markupPct: number; notes: string | null } | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/admin/shop/customers/${id}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError((data as { error?: string }).error || 'Не вдалося завантажити клієнта');
        return;
      }
      const nextCustomer = data as CustomerDetail;
      setCustomer(nextCustomer);
      setForm(createForm(nextCustomer));
      setSetupLinkUrl(null);
      setSetupLinkExpiresAt(nextCustomer.passwordSetup?.expiresAt ?? null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!customer?.notes) return;
    const match = customer.notes.match(/\[Airtable:(rec[a-zA-Z0-9]+)\]/);
    if (!match) return;
    const airtableId = match[1];

    setCrmLoading(true);
    fetch(`/api/admin/crm?type=orders&maxRecords=50&filter=${encodeURIComponent(`FIND("${airtableId}", ARRAYJOIN({Клиент}))`)}`)
      .then((response) => response.json())
      .then((data) =>
        setCrmOrders(
          (data.records || []).map((record: any) => ({
            id: record.id,
            number: record.fields?.['Номер'] || 0,
            name: record.fields?.['Название'] || '',
            orderStatus: record.fields?.['Статус заказа'] || '',
            paymentStatus: record.fields?.['Статус оплаты'] || '',
            totalAmount: record.fields?.['Сумма позиций (точная)'] || 0,
            clientTotal: record.fields?.['Итого к оплате клиентом'] || 0,
            tag: record.fields?.['Тэг'] || '',
            orderDate: record.fields?.['Дата заказа'] || null,
            itemCount: record.fields?.['Кол-во позиций'] || 0,
          }))
        )
      )
      .catch(() => {})
      .finally(() => setCrmLoading(false));

    fetch('/api/admin/shop/pricing/customer-markups')
      .then((response) => response.json())
      .then((data) => {
        const markup = (data.markups || []).find((item: any) => item.customerId === airtableId);
        if (markup) setCustomerMarkup({ markupPct: markup.markupPct, notes: markup.notes });
      })
      .catch(() => {});
  }, [customer?.notes]);

  const totalOrderValue = useMemo(
    () => customer?.orders.reduce((sum, order) => sum + order.total, 0) ?? 0,
    [customer?.orders]
  );

  async function save() {
    if (!customer || !form) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const response = await fetch(`/api/admin/shop/customers/${customer.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const msg = (data as { error?: string }).error || 'Не вдалося оновити клієнта';
        setError(msg);
        toast.error('Не вдалося оновити клієнта', msg);
        return;
      }
      const nextCustomer = data as CustomerDetail;
      setCustomer(nextCustomer);
      setForm(createForm(nextCustomer));
      setSuccess('Клієнта оновлено.');
      toast.success('Клієнта оновлено');
    } finally {
      setSaving(false);
    }
  }

  async function runAction(action: 'approve_b2b' | 'revert_b2c' | 'create_setup_link' | 'send_password_reset') {
    if (!customer) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const response = await fetch(`/api/admin/shop/customers/${customer.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const msg = (data as { error?: string }).error || 'Дія не виконалась';
        setError(msg);
        toast.error('Дія не виконалась', msg);
        return;
      }
      const nextCustomer = data as CustomerDetail;
      setCustomer(nextCustomer);
      setForm(createForm(nextCustomer));
      if ((data as { setupLinkUrl?: string }).setupLinkUrl) {
        setSetupLinkUrl((data as { setupLinkUrl?: string }).setupLinkUrl ?? null);
        setSetupLinkExpiresAt((data as { setupLinkExpiresAt?: string }).setupLinkExpiresAt ?? null);
        setSuccess('Посилання для встановлення пароля згенеровано.');
        toast.success('Setup link generated', 'Поділіться з клієнтом для встановлення пароля');
      } else if (action === 'send_password_reset') {
        const target = (data as { passwordResetTo?: string }).passwordResetTo ?? '';
        const sent = (data as { passwordResetSent?: boolean }).passwordResetSent !== false;
        if (sent) {
          setSuccess(`Лист зі скиданням пароля надіслано${target ? ` на ${target}` : ''}.`);
          toast.success('Email надіслано', target ? `Лист пішов на ${target}` : undefined);
        } else {
          setSuccess('Токен скидання пароля створено, але email не надіслався — перевірте логи Resend.');
          toast.error('Email не вдалось надіслати', 'Токен створено, але доставка не пройшла. Дивіться логи.');
        }
      } else {
        const msg = action === 'approve_b2b' ? 'Клієнта затверджено для B2B' : 'Клієнта повернуто до B2C';
        setSuccess(msg + '.');
        toast.success(msg);
      }
    } finally {
      setSaving(false);
    }
  }

  function updateForm<K extends keyof CustomerForm>(field: K, value: CustomerForm[K]) {
    setForm((current) => (current ? { ...current, [field]: value } : current));
  }

  async function copySetupLink() {
    if (!setupLinkUrl) return;
    await navigator.clipboard.writeText(setupLinkUrl);
    setCopiedSetupLink(true);
    window.setTimeout(() => setCopiedSetupLink(false), 1500);
  }

  if (loading) {
    return (
      <AdminPage>
        <div className="flex items-center gap-3 rounded-none border border-white/10 bg-[#171717] px-5 py-6 text-sm text-zinc-400">
          <UserRound className="h-4 w-4 animate-pulse" />
          Завантажую клієнта…
        </div>
      </AdminPage>
    );
  }

  if (!customer || !form) {
    return (
      <AdminPage className="space-y-4">
        <div className="rounded-none border border-blue-500/20 bg-blue-950/20 px-4 py-3 text-sm text-red-200">
          {error || 'Клієнта не знайдено'}
        </div>
        <Link href="/admin/shop/customers" className="inline-block text-sm text-zinc-300 hover:text-zinc-100">
          Назад до клієнтів
        </Link>
      </AdminPage>
    );
  }

  return (
    <AdminPage className="space-y-6">
      <AdminPageHeader
        eyebrow="Картка клієнта"
        title={customer.fullName}
        description={`${customer.email}${customer.companyName ? ` · ${customer.companyName}` : ''}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <AdminStatusBadge tone={customerGroupTone(customer.group)}>{customer.group.replace('B2B_', 'B2B ')}</AdminStatusBadge>
            {customer.isActive ? <AdminStatusBadge tone="success">Активний</AdminStatusBadge> : <AdminStatusBadge tone="default">Неактивний</AdminStatusBadge>}
          </div>
        }
      />

      <CustomerLtvHeader customerId={customer.id} />

      <AdminEntityToolbar>
        <div className="flex flex-wrap items-center gap-3">
          {customer.group !== 'B2B_APPROVED' ? (
            <button
              type="button"
              onClick={() => void runAction('approve_b2b')}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-100 transition hover:bg-emerald-500/15 disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4" />
              Затвердити B2B
            </button>
          ) : null}
          {customer.group !== 'B2C' ? (
            <button
              type="button"
              onClick={() => void runAction('revert_b2c')}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-200 transition hover:bg-white/10 disabled:opacity-50"
            >
              <RotateCcw className="h-4 w-4" />
              Повернути до B2C
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void runAction('send_password_reset')}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-full border border-blue-400/25 bg-blue-500/10 px-4 py-2 text-sm text-blue-200 transition hover:bg-blue-500/15 disabled:opacity-50"
            title="Надіслати клієнту лист зі скиданням пароля"
          >
            <Mail className="h-4 w-4" />
            Скинути пароль (email)
          </button>
          <button
            type="button"
            onClick={() => void runAction('create_setup_link')}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-500/10 px-4 py-2 text-sm text-amber-200 transition hover:bg-amber-500/15 disabled:opacity-50"
            title="Згенерувати одноразове посилання, яке можна скопіювати"
          >
            <KeyRound className="h-4 w-4" />
            Setup-лінк
          </button>
        </div>
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-full bg-gradient-to-b from-blue-500 to-blue-700 px-4 py-2 text-sm font-bold uppercase tracking-wider text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_2px_8px_rgba(59,130,246,0.4)] transition hover:from-blue-400 hover:to-blue-600 disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {saving ? 'Зберігаю…' : 'Зберегти'}
        </button>
      </AdminEntityToolbar>

      <AdminMetricGrid>
        <AdminMetricCard label="Замовлень" value={customer.orders.length} meta="Історія покупок" />
        <AdminMetricCard label="Адрес" value={customer.addresses.length} meta="Доставка + білінг" />
        <AdminMetricCard label="Кошиків" value={customer.carts.length} meta="Активність на сайті" />
        <AdminMetricCard label="Сума замовлень" value={totalOrderValue.toFixed(2)} meta={customer.currencyPref || 'EUR'} />
      </AdminMetricGrid>

      <AdminSplitDetailShell
        main={
          <>
            {(error || success) && (
              <div className={`rounded-none border px-4 py-3 text-sm ${error ? 'border-blue-500/20 bg-blue-950/20 text-red-200' : 'border-emerald-500/20 bg-emerald-950/20 text-emerald-200'}`}>
                {error || success}
              </div>
            )}

            <section className="rounded-none border border-white/10 bg-[#171717] p-6">
              <div className="mb-5">
                <h2 className="text-xl font-semibold text-zinc-100">Профіль та комерційні умови</h2>
                <p className="mt-1 text-sm text-zinc-500">Редагування профілю, B2B-умов, балансу та локалі.</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <AdminInputField label="Ім'я" value={form.firstName} onChange={(value) => updateForm('firstName', value)} />
                <AdminInputField label="Прізвище" value={form.lastName} onChange={(value) => updateForm('lastName', value)} />
                <AdminInputField label="Телефон" value={form.phone} onChange={(value) => updateForm('phone', value)} />
                <AdminInputField label="Компанія" value={form.companyName} onChange={(value) => updateForm('companyName', value)} />
                <AdminInputField label="VAT-номер" value={form.vatNumber} onChange={(value) => updateForm('vatNumber', value)} />
                <AdminInputField label="Знижка %" value={form.b2bDiscountPercent} onChange={(value) => updateForm('b2bDiscountPercent', value)} type="number" />
                <AdminInputField label="Тариф знижки" value={form.discountTier} onChange={(value) => updateForm('discountTier', value)} />
                <AdminInputField label="Баланс" value={form.balance} onChange={(value) => updateForm('balance', value)} type="number" step="0.01" />
                <AdminInputField label="Регіон" value={form.region} onChange={(value) => updateForm('region', value)} />
                <AdminSelectField
                  label="Бажана валюта"
                  value={form.currencyPref}
                  onChange={(value) => updateForm('currencyPref', value)}
                  options={[
                    { value: 'EUR', label: 'EUR' },
                    { value: 'USD', label: 'USD' },
                    { value: 'UAH', label: 'UAH' },
                  ]}
                />
                <AdminSelectField
                  label="Бажана мова"
                  value={form.preferredLocale}
                  onChange={(value) => updateForm('preferredLocale', value)}
                  options={[
                    { value: 'en', label: 'EN' },
                    { value: 'ua', label: 'UA' },
                  ]}
                />
                <AdminSelectField
                  label="Група клієнта"
                  value={form.group}
                  onChange={(value) => updateForm('group', value as CustomerGroup)}
                  options={[
                    { value: 'B2C', label: 'B2C' },
                    { value: 'B2B_PENDING', label: 'B2B на розгляді' },
                    { value: 'B2B_APPROVED', label: 'B2B затверджено' },
                  ]}
                />
                <div className="md:col-span-2">
                  <AdminCheckboxField
                    label="Активний акаунт клієнта"
                    checked={form.isActive}
                    onChange={(checked) => updateForm('isActive', checked)}
                    helper="Неактивні клієнти зберігають історію, але не вважаються активними акаунтами."
                  />
                </div>
                <div className="md:col-span-2">
                  <AdminTextareaField label="Внутрішні нотатки" value={form.notes} onChange={(value) => updateForm('notes', value)} rows={5} />
                </div>
              </div>
            </section>

            <section className="rounded-none border border-white/10 bg-[#171717] p-6">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-zinc-100">Замовлення</h2>
                  <p className="mt-1 text-sm text-zinc-500">Замовлення з storefront і швидкий перехід до деталі.</p>
                </div>
                <Link
                  href={`/admin/shop/orders/create?customerId=${customer.id}`}
                  className="inline-flex items-center gap-2 rounded-full bg-gradient-to-b from-blue-500 to-blue-700 px-4 py-2 text-sm font-bold uppercase tracking-wider text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_2px_8px_rgba(59,130,246,0.4)] transition hover:from-blue-400 hover:to-blue-600"
                >
                  Нове замовлення
                </Link>
              </div>
              {customer.orders.length ? (
                <AdminTableShell>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px] text-left text-sm">
                      <thead>
                        <tr className="border-b border-white/10 bg-white/[0.03] text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                          <th className="px-4 py-4 font-medium">Замовлення</th>
                          <th className="px-4 py-4 font-medium">Статус</th>
                          <th className="px-4 py-4 font-medium">Позицій</th>
                          <th className="px-4 py-4 font-medium">Сума</th>
                          <th className="px-4 py-4 font-medium">Відкрити</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/6">
                        {customer.orders.map((order) => (
                          <tr key={order.id} className="transition hover:bg-white/[0.03]">
                            <td className="px-4 py-4">
                              <div className="font-medium text-zinc-100">{order.orderNumber}</div>
                              <div className="mt-1 text-xs text-zinc-500">{new Date(order.createdAt).toLocaleString()}</div>
                            </td>
                            <td className="px-4 py-4">
                              <AdminStatusBadge tone={order.status === 'DELIVERED' ? 'success' : order.status === 'CANCELLED' ? 'danger' : 'warning'}>
                                {order.status.replace(/_/g, ' ')}
                              </AdminStatusBadge>
                            </td>
                            <td className="px-4 py-4 text-zinc-300">{order.itemCount}</td>
                            <td className="px-4 py-4 text-zinc-100">
                              {order.currency} {order.total.toFixed(2)}
                            </td>
                            <td className="px-4 py-4">
                              <Link href={`/admin/shop/orders/${order.id}`} className="text-sm text-zinc-300 transition hover:text-zinc-100">
                                Відкрити →
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </AdminTableShell>
              ) : (
                <div className="rounded-none border border-dashed border-white/10 px-4 py-10 text-sm text-zinc-500">Замовлень ще немає.</div>
              )}
            </section>

            <section className="rounded-none border border-white/10 bg-[#171717] p-6">
              <div className="mb-5">
                <h2 className="text-xl font-semibold text-zinc-100">Адреси та кошики</h2>
                <p className="mt-1 text-sm text-zinc-500">Збережені дані доставки та поточна активність на сайті.</p>
              </div>
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500">Адреси</h3>
                  {customer.addresses.length ? (
                    customer.addresses.map((address) => (
                      <div key={address.id} className="rounded-none border border-white/10 bg-black/25 px-4 py-4 text-sm text-zinc-300">
                        <div className="font-medium text-zinc-100">{address.label}</div>
                        <div className="mt-2 space-y-1">
                          <div>{address.line1}</div>
                          {address.line2 ? <div>{address.line2}</div> : null}
                          <div>{[address.city, address.region, address.postcode].filter(Boolean).join(', ')}</div>
                          <div>{address.country}</div>
                        </div>
                        <div className="mt-3 text-xs text-zinc-500">
                          {address.isDefaultShipping ? 'Дефолт для доставки' : '—'}
                          {address.isDefaultBilling ? ' · Дефолт для білінгу' : ''}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-none border border-dashed border-white/10 px-4 py-8 text-sm text-zinc-500">Адрес не збережено.</div>
                  )}
                </div>
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500">Кошики</h3>
                  {customer.carts.length ? (
                    customer.carts.map((cart) => (
                      <div key={cart.id} className="rounded-none border border-white/10 bg-black/25 px-4 py-4 text-sm text-zinc-300">
                        <div className="font-medium text-zinc-100">
                          {cart.currency} · {cart.locale}
                        </div>
                        <div className="mt-2 text-xs text-zinc-500">
                          {cart.itemCount} позицій · оновлено {new Date(cart.updatedAt).toLocaleString()}
                        </div>
                        <div className="mt-2 font-mono text-[11px] text-zinc-500">{cart.token}</div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-none border border-dashed border-white/10 px-4 py-8 text-sm text-zinc-500">Активних кошиків немає.</div>
                  )}
                </div>
              </div>
            </section>

            <section className="rounded-none border border-white/10 bg-[#171717] p-6">
              <div className="mb-5 flex items-center gap-2">
                <Database className="h-4 w-4 text-blue-300/60" />
                <div>
                  <h2 className="text-xl font-semibold text-zinc-100">CRM та ціноутворення</h2>
                  <p className="mt-1 text-sm text-zinc-500">Замовлення з Airtable та персональні правила націнки.</p>
                </div>
              </div>
              <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
                <div className="rounded-none border border-white/10 bg-black/25 px-4 py-4">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Націнка клієнта</div>
                  {customerMarkup ? (
                    <div className="mt-3 space-y-2">
                      <div className="text-2xl font-semibold text-emerald-300">{customerMarkup.markupPct}%</div>
                      <div className="text-sm text-zinc-400">
                        Персональне ціноутворення{customerMarkup.notes ? ` · ${customerMarkup.notes}` : ''}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 text-sm text-zinc-500">Використовуються дефолтні правила ціни.</div>
                  )}
                </div>
                <div className="space-y-3">
                  {crmLoading ? (
                    <div className="rounded-none border border-white/10 bg-black/25 px-4 py-8 text-sm text-zinc-500">Завантажую CRM замовлення…</div>
                  ) : crmOrders.length ? (
                    crmOrders.map((order) => (
                      <div key={order.id} className="rounded-none border border-white/10 bg-black/25 px-4 py-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <div className="font-medium text-zinc-100">#{order.number}</div>
                            <div className="mt-1 text-xs text-zinc-500">{order.name}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm text-zinc-100">${order.clientTotal.toLocaleString()}</div>
                            <div className="mt-1 text-xs text-zinc-500">{order.itemCount} позицій</div>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-none border border-dashed border-white/10 px-4 py-8 text-sm text-zinc-500">
                      Звʼязаних CRM замовлень не знайдено або в нотатках відсутнє посилання на Airtable.
                    </div>
                  )}
                </div>
              </div>
            </section>
          </>
        }
        sidebar={
          <>
            <AdminInspectorCard
              title="Стан акаунта"
              description="Ідентифікація, активність, локаль та готовність пароля."
            >
              <AdminKeyValueGrid
                rows={[
                  { label: 'Email', value: customer.email },
                  { label: 'Мова', value: customer.preferredLocale.toUpperCase() },
                  { label: 'Останній вхід', value: customer.account?.lastLoginAt ? new Date(customer.account.lastLoginAt).toLocaleString() : 'Ніколи' },
                  { label: 'Email підтверджено', value: customer.account?.emailVerifiedAt ? new Date(customer.account.emailVerifiedAt).toLocaleString() : 'Ні' },
                  { label: 'Створено', value: new Date(customer.createdAt).toLocaleString() },
                ]}
              />
            </AdminInspectorCard>

            <AdminInspectorCard
              title="Пароль"
              description="Одноразове посилання для першого входу або скидання пароля."
            >
              <div className="space-y-3 text-sm text-zinc-300">
                <div>
                  {customer.account?.hasPassword
                    ? 'Пароль уже встановлено. Можна згенерувати свіже посилання.'
                    : 'Пароль ще не налаштовано.'}
                </div>
                {setupLinkExpiresAt ? (
                  <div className="text-xs text-zinc-500">
                    Активне посилання дійсне до {new Date(setupLinkExpiresAt).toLocaleString()}
                  </div>
                ) : null}
                {setupLinkUrl ? (
                  <div className="rounded-none border border-white/10 bg-black/25 px-3 py-3">
                    <div className="break-all font-mono text-xs text-zinc-200">{setupLinkUrl}</div>
                    <button
                      type="button"
                      onClick={() => void copySetupLink()}
                      className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-200 transition hover:bg-white/10"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      {copiedSetupLink ? 'Скопійовано' : 'Скопіювати посилання'}
                    </button>
                  </div>
                ) : null}
              </div>
            </AdminInspectorCard>

            <AdminInspectorCard
              title="Дефолтна адреса доставки"
              description="Знімок основної адреси доставки клієнта."
            >
              <AdminKeyValueGrid
                rows={[
                  { label: 'Адреса', value: customer.defaultShippingAddress?.line1 || '—' },
                  { label: 'Кв./офіс', value: customer.defaultShippingAddress?.line2 || '—' },
                  { label: 'Місто', value: customer.defaultShippingAddress?.city || '—' },
                  { label: 'Регіон', value: customer.defaultShippingAddress?.region || '—' },
                  { label: 'Країна', value: customer.defaultShippingAddress?.country || '—' },
                ]}
              />
            </AdminInspectorCard>

            <AdminInspectorCard
              title="Теги"
              description="Внутрішні мітки для фільтрації та сегментації."
            >
              <AdminTagInput
                entityType="shop.customer"
                entityId={customer.id}
                suggestions={['vip', 'bad-payer', 'wholesale', 'champion', 'churn-risk', 'do-not-contact']}
              />
            </AdminInspectorCard>

            <AdminInspectorCard
              title="Нотатки"
              description="Внутрішні нотатки для адмінів (клієнт не бачить)."
            >
              <AdminNotes entityType="shop.customer" entityId={customer.id} />
            </AdminInspectorCard>

            <CustomerCreditPanel customerId={customer.id} preferredCurrency="EUR" />

            <AdminInspectorCard
              title="Активність"
              description="Останні дії адмінів над цим клієнтом."
            >
              <AdminActivityTimeline
                entityType="shop.customer"
                entityId={customer.id}
                emptyTitle="Поки немає активності"
                emptyDescription="Тут зʼявляться редагування профілю, зміни груп і затвердження."
              />
            </AdminInspectorCard>
          </>
        }
      />
    </AdminPage>
  );
}

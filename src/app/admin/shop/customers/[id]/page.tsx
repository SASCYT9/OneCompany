'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, CheckCircle2, RotateCcw, Save, UserRound, Database, DollarSign, Copy } from 'lucide-react';

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

export default function AdminShopCustomerDetailPage() {
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

  // CRM data
  type CrmOrder = { id: string; number: number; name: string; orderStatus: string; paymentStatus: string; totalAmount: number; clientTotal: number; tag: string; orderDate: string | null; itemCount: number };
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
        setError((data as { error?: string }).error || 'Failed to load customer');
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

  // Fetch CRM data when customer loads
  useEffect(() => {
    if (!customer?.notes) return;
    const match = customer.notes.match(/\[Airtable:(rec[a-zA-Z0-9]+)\]/);
    if (!match) return;
    const airtableId = match[1];

    setCrmLoading(true);
    // Fetch CRM orders
    fetch(`/api/admin/crm?type=orders&maxRecords=50&filter=${encodeURIComponent(`FIND("${airtableId}", ARRAYJOIN({Клиент}))`)}`)
      .then(r => r.json()).then(d => setCrmOrders((d.records || []).map((rec: any) => ({
        id: rec.id, number: rec.fields?.['Номер'] || 0, name: rec.fields?.['Название'] || '',
        orderStatus: rec.fields?.['Статус заказа'] || '', paymentStatus: rec.fields?.['Статус оплаты'] || '',
        totalAmount: rec.fields?.['Сумма позиций (точная)'] || 0, clientTotal: rec.fields?.['Итого к оплате клиентом'] || 0,
        tag: rec.fields?.['Тэг'] || '', orderDate: rec.fields?.['Дата заказа'] || null,
        itemCount: rec.fields?.['Кол-во позиций'] || 0,
      })))).catch(() => {}).finally(() => setCrmLoading(false));

    // Fetch customer markup
    fetch('/api/admin/shop/pricing/customer-markups')
      .then(r => r.json()).then(d => {
        const mk = (d.markups || []).find((m: any) => m.customerId === airtableId);
        if (mk) setCustomerMarkup({ markupPct: mk.markupPct, notes: mk.notes });
      }).catch(() => {});
  }, [customer?.notes]);

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
        setError((data as { error?: string }).error || 'Failed to update customer');
        return;
      }
      const nextCustomer = data as CustomerDetail;
      setCustomer(nextCustomer);
      setForm(createForm(nextCustomer));
      setSuccess('Customer updated.');
    } finally {
      setSaving(false);
    }
  }

  async function runAction(action: 'approve_b2b' | 'revert_b2c' | 'create_setup_link') {
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
        setError((data as { error?: string }).error || 'Customer action failed');
        return;
      }
      const nextCustomer = data as CustomerDetail;
      setCustomer(nextCustomer);
      setForm(createForm(nextCustomer));
      if ((data as { setupLinkUrl?: string }).setupLinkUrl) {
        setSetupLinkUrl((data as { setupLinkUrl?: string }).setupLinkUrl ?? null);
        setSetupLinkExpiresAt((data as { setupLinkExpiresAt?: string }).setupLinkExpiresAt ?? null);
        setSuccess('Password setup link generated.');
      } else {
        setSuccess(action === 'approve_b2b' ? 'Customer approved for B2B.' : 'Customer reverted to B2C.');
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6 text-white/60 flex items-center gap-2">
        <UserRound className="h-5 w-5 animate-pulse" />
        Loading customer…
      </div>
    );
  }

  if (!customer || !form) {
    return (
      <div className="p-6">
        <div className="rounded-none bg-red-900/20 p-3 text-sm text-red-300">{error || 'Customer not found'}</div>
        <Link href="/admin/shop/customers" className="mt-4 inline-block text-sm text-white/70 hover:text-white">
          ← Back to customers
        </Link>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto max-w-6xl p-6">
        <Link href="/admin/shop/customers" className="mb-6 inline-flex items-center gap-2 text-sm text-white/60 hover:text-white">
          <ArrowLeft className="h-4 w-4" />
          Back to customers
        </Link>

        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-white">{customer.fullName}</h2>
            <p className="mt-2 text-sm text-white/45">
              {customer.email} {customer.companyName ? `· ${customer.companyName}` : ''}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {customer.group !== 'B2B_APPROVED' ? (
              <button
                type="button"
                onClick={() => void runAction('approve_b2b')}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-none border border-emerald-500/25 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-100 hover:bg-emerald-500/15 disabled:opacity-50"
              >
                <CheckCircle2 className="h-4 w-4" />
                Approve B2B
              </button>
            ) : null}
            {customer.group !== 'B2C' ? (
              <button
                type="button"
                onClick={() => void runAction('revert_b2c')}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-none border border-white/15 bg-white/[0.04] px-4 py-2 text-sm text-white hover:bg-white/[0.08] disabled:opacity-50"
              >
                <RotateCcw className="h-4 w-4" />
                Revert to B2C
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-none bg-white px-4 py-2 text-sm font-medium text-black hover:bg-white/90 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>

        {error ? <div className="mb-4 rounded-none bg-red-900/20 p-3 text-sm text-red-300">{error}</div> : null}
        {success ? <div className="mb-4 rounded-none bg-green-900/20 p-3 text-sm text-green-200">{success}</div> : null}

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="space-y-6">
            <div className="rounded-none border border-white/10 bg-white/[0.03] p-5">
              <h3 className="mb-4 text-lg font-medium text-white">Profile</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <InputField label="Ім'я" value={form.firstName} onChange={(value) => setForm((current) => current ? { ...current, firstName: value } : current)} />
                <InputField label="Last name" value={form.lastName} onChange={(value) => setForm((current) => current ? { ...current, lastName: value } : current)} />
                <InputField label="Телефон" value={form.phone} onChange={(value) => setForm((current) => current ? { ...current, phone: value } : current)} />
                <InputField label="Компанія" value={form.companyName} onChange={(value) => setForm((current) => current ? { ...current, companyName: value } : current)} />
                <InputField label="ІПН" value={form.vatNumber} onChange={(value) => setForm((current) => current ? { ...current, vatNumber: value } : current)} />
                <InputField label="Знижка B2B %" value={form.b2bDiscountPercent} onChange={(value) => setForm((current) => current ? { ...current, b2bDiscountPercent: value } : current)} />
                <InputField label="Рівень знижки (Tier)" value={form.discountTier} onChange={(value) => setForm((current) => current ? { ...current, discountTier: value } : current)} />
                <InputField label="Баланс (Борг/Кредит)" value={form.balance} onChange={(value) => setForm((current) => current ? { ...current, balance: value } : current)} />
                <InputField label="Регіон" value={form.region} onChange={(value) => setForm((current) => current ? { ...current, region: value } : current)} />
                <label className="block">
                  <span className="mb-1.5 block text-xs text-white/50">Бажана валюта</span>
                  <select
                    value={form.currencyPref}
                    onChange={(event) => setForm((current) => current ? { ...current, currencyPref: event.target.value } : current)}
                    className="w-full rounded-none border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white focus:outline-none"
                  >
                    <option value="EUR">EUR</option>
                    <option value="USD">USD</option>
                    <option value="UAH">UAH</option>
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs text-white/50">Preferred locale</span>
                  <select
                    value={form.preferredLocale}
                    onChange={(event) => setForm((current) => current ? { ...current, preferredLocale: event.target.value } : current)}
                    className="w-full rounded-none border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white focus:outline-none"
                  >
                    <option value="en">en</option>
                    <option value="ua">ua</option>
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs text-white/50">Group</span>
                  <select
                    value={form.group}
                    onChange={(event) => setForm((current) => current ? { ...current, group: event.target.value as CustomerGroup } : current)}
                    className="w-full rounded-none border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white focus:outline-none"
                  >
                    <option value="B2C">B2C</option>
                    <option value="B2B_PENDING">B2B pending</option>
                    <option value="B2B_APPROVED">B2B approved</option>
                  </select>
                </label>
                <label className="flex items-center gap-2 rounded-none border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(event) => setForm((current) => current ? { ...current, isActive: event.target.checked } : current)}
                    className="h-4 w-4 rounded-none border-white/20 bg-zinc-950"
                  />
                  Active customer
                </label>
                <div className="rounded-none border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white/70">
                  <div>Joined {new Date(customer.createdAt).toLocaleString()}</div>
                  <div className="mt-1 text-white/45">
                    Last login {customer.account?.lastLoginAt ? new Date(customer.account.lastLoginAt).toLocaleString() : '—'}
                  </div>
                </div>
                <SetupLinkCard
                  hasPassword={Boolean(customer.account?.hasPassword)}
                  setupLinkUrl={setupLinkUrl}
                  setupLinkExpiresAt={setupLinkExpiresAt ?? customer.passwordSetup?.expiresAt ?? null}
                  onGenerate={() => void runAction('create_setup_link')}
                  saving={saving}
                />
                <div className="md:col-span-2">
                  <label className="block">
                    <span className="mb-1.5 block text-xs text-white/50">Internal notes</span>
                    <textarea
                      value={form.notes}
                      onChange={(event) => setForm((current) => current ? { ...current, notes: event.target.value } : current)}
                      rows={5}
                      className="w-full rounded-none border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white placeholder:text-white/25 focus:border-white/30 focus:outline-none"
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="rounded-none border border-white/10 bg-white/[0.03] p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-white">Історія замовлень</h3>
                <Link
                  href={`/admin/shop/orders/create?customerId=${customer.id}`}
                  className="inline-flex items-center gap-1.5 rounded-none bg-white px-3 py-1.5 text-xs font-semibold text-black hover:bg-white/90 transition-all"
                >
                  + Створити замовлення
                </Link>
              </div>
              <div className="space-y-3">
                {customer.orders.length ? customer.orders.map((order) => (
                  <div key={order.id} className="rounded-none border border-white/10 bg-black/30 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-white">{order.orderNumber}</span>
                          <span className={`inline-flex rounded-none-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${
                            order.status === 'DELIVERED' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' :
                            order.status === 'SHIPPED' ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300' :
                            order.status === 'PROCESSING' ? 'border-violet-500/30 bg-violet-500/10 text-violet-300' :
                            order.status === 'CONFIRMED' ? 'border-sky-500/30 bg-sky-500/10 text-sky-300' :
                            order.status === 'CANCELLED' ? 'border-rose-500/30 bg-rose-500/10 text-rose-300' :
                            'border-amber-500/30 bg-amber-500/10 text-amber-300'
                          }`}>
                            {order.status.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <div className="mt-1 text-xs text-white/45">
                          {new Date(order.createdAt).toLocaleString()} · {order.itemCount} поз.
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-mono text-white">{order.currency} {order.total.toFixed(2)}</div>
                        <Link href={`/admin/shop/orders/${order.id}`} className="mt-1 inline-block text-xs text-white/60 hover:text-white">
                          Відкрити →
                        </Link>
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="rounded-none border border-white/10 bg-black/30 p-4 text-sm text-white/45">Замовлень поки немає.</div>
                )}
              </div>
            </div>

            {/* CRM Orders */}
            <div className="rounded-none border border-indigo-500/10 bg-zinc-100 text-black/[0.02] p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-white flex items-center gap-2">
                  <Database className="w-4 h-4 text-zinc-400" /> CRM Замовлення
                </h3>
                {crmLoading && <span className="text-[10px] text-white/20 animate-pulse">Завантаження...</span>}
              </div>
              <div className="space-y-2">
                {crmOrders.length > 0 ? crmOrders.map(o => (
                  <div key={o.id} className="rounded-none border border-white/10 bg-black/30 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm text-white">#{o.number}</span>
                          <span className={`text-[9px] uppercase tracking-widest px-2 py-0.5 rounded-none-full border ${
                            o.orderStatus === 'Выполнен' ? 'border-emerald-500/20 text-emerald-400 bg-emerald-500/5' :
                            o.orderStatus === 'Отменен' ? 'border-red-500/20 text-red-400 bg-red-950/30 border border-red-900/50 text-red-500/5' :
                            'border-amber-500/20 text-amber-400 bg-amber-500/5'
                          }`}>{o.orderStatus}</span>
                          <span className={`text-[9px] uppercase tracking-widest px-2 py-0.5 rounded-none-full border ${
                            o.paymentStatus === 'Оплачено' ? 'border-emerald-500/20 text-emerald-400 bg-emerald-500/5' :
                            'border-white/10 text-white/30 bg-white/[0.02]'
                          }`}>{o.paymentStatus}</span>
                        </div>
                        <p className="mt-1 text-xs text-white/40 truncate">{o.name}</p>
                        {o.orderDate && <p className="text-[10px] text-white/20 mt-0.5">{new Date(o.orderDate).toLocaleDateString('uk-UA')}</p>}
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-white">${o.clientTotal.toLocaleString()}</div>
                        <div className="text-[10px] text-white/30">{o.itemCount} позицій</div>
                      </div>
                    </div>
                  </div>
                )) : !crmLoading ? (
                  <div className="rounded-none border border-white/10 bg-black/30 p-4 text-sm text-white/45">Немає CRM замовлень або клієнт не прив&apos;язаний до Airtable.</div>
                ) : null}
              </div>
            </div>

            {/* Customer Markup */}
            <div className="rounded-none border border-emerald-500/10 bg-emerald-500/[0.02] p-5">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-medium text-white flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-emerald-400" /> Ціноутворення
                </h3>
                <Link href="/admin/shop/pricing" className="text-xs text-emerald-400/60 hover:text-emerald-400">Редагувати →</Link>
              </div>
              {customerMarkup ? (
                <div className="flex items-center gap-4">
                  <div className="text-2xl font-light text-emerald-400">{customerMarkup.markupPct}%</div>
                  <div className="text-xs text-white/30">Персональна націнка (×{(1 + customerMarkup.markupPct / 100).toFixed(2)})</div>
                  {customerMarkup.notes && <span className="text-[10px] px-2 py-0.5 bg-white/[0.03] border border-white/10 rounded-none-full text-white/40">{customerMarkup.notes}</span>}
                </div>
              ) : (
                <p className="text-sm text-white/40">Використовується стандартна націнка бренду.</p>
              )}
            </div>
          </section>

          <section className="space-y-6">
            <div className="rounded-none border border-white/10 bg-white/[0.03] p-5">
              <h3 className="mb-4 text-lg font-medium text-white">Addresses</h3>
              <div className="space-y-3">
                {customer.addresses.length ? customer.addresses.map((address) => (
                  <div key={address.id} className="rounded-none border border-white/10 bg-black/30 p-4 text-sm text-white/75">
                    <div className="font-medium text-white">{address.label}</div>
                    <div className="mt-1">{address.line1}</div>
                    {address.line2 ? <div>{address.line2}</div> : null}
                    <div>{[address.city, address.region, address.postcode].filter(Boolean).join(', ')}</div>
                    <div>{address.country}</div>
                    <div className="mt-2 text-xs text-white/45">
                      {address.isDefaultShipping ? 'Default shipping' : '—'} {address.isDefaultBilling ? '· Default billing' : ''}
                    </div>
                  </div>
                )) : (
                  <div className="rounded-none border border-white/10 bg-black/30 p-4 text-sm text-white/45">No addresses saved.</div>
                )}
              </div>
            </div>

            <div className="rounded-none border border-white/10 bg-white/[0.03] p-5">
              <h3 className="mb-4 text-lg font-medium text-white">Active carts</h3>
              <div className="space-y-3">
                {customer.carts.length ? customer.carts.map((cart) => (
                  <div key={cart.id} className="rounded-none border border-white/10 bg-black/30 p-4 text-sm text-white/75">
                    <div className="font-medium text-white">{cart.currency} · {cart.locale}</div>
                    <div className="mt-1 text-xs text-white/45">
                      {cart.itemCount} items · updated {new Date(cart.updatedAt).toLocaleString()}
                    </div>
                    <div className="mt-1 text-xs font-mono text-white/35">{cart.token}</div>
                  </div>
                )) : (
                  <div className="rounded-none border border-white/10 bg-black/30 p-4 text-sm text-white/45">No carts found.</div>
                )}
              </div>
            </div>

            <div className="rounded-none border border-white/10 bg-white/[0.03] p-5">
              <h3 className="mb-4 text-lg font-medium text-white">Audit trail</h3>
              <div className="space-y-3">
                {customer.auditLog.length ? customer.auditLog.map((entry) => (
                  <div key={entry.id} className="rounded-none border border-white/10 bg-black/30 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm font-medium text-white">{entry.action}</div>
                      <div className="text-xs text-white/45">{new Date(entry.createdAt).toLocaleString()}</div>
                    </div>
                    <div className="mt-1 text-xs text-white/45">
                      {entry.actorName || entry.actorEmail}
                    </div>
                    {entry.metadata ? (
                      <pre className="mt-3 overflow-x-auto rounded-none border border-white/10 bg-zinc-950 p-3 text-xs text-white/55">
                        {JSON.stringify(entry.metadata, null, 2)}
                      </pre>
                    ) : null}
                  </div>
                )) : (
                  <div className="rounded-none border border-white/10 bg-black/30 p-4 text-sm text-white/45">No audit events yet.</div>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function InputField(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs text-white/50">{props.label}</span>
      <input
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        className="w-full rounded-none border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white placeholder:text-white/25 focus:border-white/30 focus:outline-none"
      />
    </label>
  );
}

function SetupLinkCard(props: {
  hasPassword: boolean;
  setupLinkUrl: string | null;
  setupLinkExpiresAt: string | null;
  saving: boolean;
  onGenerate: () => void;
}) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    if (!props.setupLinkUrl) return;
    void navigator.clipboard.writeText(props.setupLinkUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-none border border-amber-500/20 bg-amber-500/5 px-3 py-3 text-sm flex flex-col items-start gap-3">
      <div className="text-[11px] uppercase tracking-[0.2em] text-amber-400/50">Доступ до акаунта</div>
      <div className="text-amber-100/80">
        {props.hasPassword
          ? 'Пароль уже встановлено. За потреби можна згенерувати нове одноразове setup link.'
          : 'Пароль ще не налаштований. Створіть одноразове посилання для встановлення пароля.'}
      </div>
      {props.setupLinkExpiresAt ? (
        <div className="text-xs text-amber-200/60">
          Активне посилання дійсне до {new Date(props.setupLinkExpiresAt).toLocaleString()}
        </div>
      ) : null}
      <button
        type="button"
        onClick={props.onGenerate}
        disabled={props.saving}
        className="inline-flex items-center gap-1.5 rounded-none bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-300 border border-amber-400/20 hover:bg-amber-500/20 transition-all disabled:opacity-50"
      >
        {props.hasPassword ? 'Оновити setup link' : 'Створити setup link'}
      </button>
      {props.setupLinkUrl ? (
        <div className="w-full rounded-none border border-white/10 bg-zinc-950/80 px-3 py-3">
          <div className="mb-2 text-[11px] uppercase tracking-[0.2em] text-white/35">Одноразове посилання</div>
          <div className="flex items-start gap-2">
            <code className="flex-1 break-all text-xs text-white/80">{props.setupLinkUrl}</code>
            <button
              type="button"
              onClick={handleCopy}
              className="p-1 rounded-none text-white/40 hover:text-white transition"
              title="Копіювати"
            >
              <Copy className="h-4 w-4" />
            </button>
          </div>
          {copied ? <div className="mt-2 text-[10px] text-emerald-400">Скопійовано.</div> : null}
        </div>
      ) : null}
    </div>
  );
}

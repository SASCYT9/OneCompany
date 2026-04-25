'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { CheckCircle2, Copy, Database, RotateCcw, Save, UserRound } from 'lucide-react';

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
  AdminTimelineList,
} from '@/components/admin/AdminPrimitives';
import {
  AdminCheckboxField,
  AdminInputField,
  AdminSelectField,
  AdminTextareaField,
} from '@/components/admin/AdminFormFields';

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
        <div className="flex items-center gap-3 rounded-[6px] border border-white/10 bg-[#171717] px-5 py-6 text-sm text-zinc-400">
          <UserRound className="h-4 w-4 animate-pulse" />
          Loading customer…
        </div>
      </AdminPage>
    );
  }

  if (!customer || !form) {
    return (
      <AdminPage className="space-y-4">
        <div className="rounded-[6px] border border-blue-500/20 bg-blue-950/20 px-4 py-3 text-sm text-red-200">
          {error || 'Customer not found'}
        </div>
        <Link href="/admin/shop/customers" className="inline-block text-sm text-zinc-300 hover:text-zinc-100">
          Back to customers
        </Link>
      </AdminPage>
    );
  }

  return (
    <AdminPage className="space-y-6">
      <AdminPageHeader
        eyebrow="Customer Detail"
        title={customer.fullName}
        description={`${customer.email}${customer.companyName ? ` · ${customer.companyName}` : ''}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <AdminStatusBadge tone={customerGroupTone(customer.group)}>{customer.group.replace('B2B_', 'B2B ')}</AdminStatusBadge>
            {customer.isActive ? <AdminStatusBadge tone="success">Active</AdminStatusBadge> : <AdminStatusBadge tone="default">Inactive</AdminStatusBadge>}
          </div>
        }
      />

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
              Approve B2B
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
              Revert to B2C
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void runAction('create_setup_link')}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-500/10 px-4 py-2 text-sm text-blue-300 transition hover:bg-amber-500/15 disabled:opacity-50"
          >
            Access setup
          </button>
        </div>
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-full bg-gradient-to-b from-blue-500 to-blue-700 px-4 py-2 text-sm font-bold uppercase tracking-wider text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_2px_8px_rgba(59,130,246,0.4)] transition hover:from-blue-400 hover:to-blue-600 disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {saving ? 'Saving…' : 'Save'}
        </button>
      </AdminEntityToolbar>

      <AdminMetricGrid>
        <AdminMetricCard label="Orders" value={customer.orders.length} meta="Commerce history" />
        <AdminMetricCard label="Addresses" value={customer.addresses.length} meta="Shipping + billing records" />
        <AdminMetricCard label="Carts" value={customer.carts.length} meta="Open storefront activity" />
        <AdminMetricCard label="Order value" value={totalOrderValue.toFixed(2)} meta={customer.currencyPref || 'EUR'} />
      </AdminMetricGrid>

      <AdminSplitDetailShell
        main={
          <>
            {(error || success) && (
              <div className={`rounded-[6px] border px-4 py-3 text-sm ${error ? 'border-blue-500/20 bg-blue-950/20 text-red-200' : 'border-emerald-500/20 bg-emerald-950/20 text-emerald-200'}`}>
                {error || success}
              </div>
            )}

            <section className="rounded-[6px] border border-white/10 bg-[#171717] p-6">
              <div className="mb-5">
                <h2 className="text-xl font-semibold text-zinc-100">Profile and commercial context</h2>
                <p className="mt-1 text-sm text-zinc-500">Редагування account profile, B2B terms, балансів і локалі.</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <AdminInputField label="First name" value={form.firstName} onChange={(value) => updateForm('firstName', value)} />
                <AdminInputField label="Last name" value={form.lastName} onChange={(value) => updateForm('lastName', value)} />
                <AdminInputField label="Phone" value={form.phone} onChange={(value) => updateForm('phone', value)} />
                <AdminInputField label="Company" value={form.companyName} onChange={(value) => updateForm('companyName', value)} />
                <AdminInputField label="VAT number" value={form.vatNumber} onChange={(value) => updateForm('vatNumber', value)} />
                <AdminInputField label="Discount %" value={form.b2bDiscountPercent} onChange={(value) => updateForm('b2bDiscountPercent', value)} type="number" />
                <AdminInputField label="Discount tier" value={form.discountTier} onChange={(value) => updateForm('discountTier', value)} />
                <AdminInputField label="Balance" value={form.balance} onChange={(value) => updateForm('balance', value)} type="number" step="0.01" />
                <AdminInputField label="Region" value={form.region} onChange={(value) => updateForm('region', value)} />
                <AdminSelectField
                  label="Preferred currency"
                  value={form.currencyPref}
                  onChange={(value) => updateForm('currencyPref', value)}
                  options={[
                    { value: 'EUR', label: 'EUR' },
                    { value: 'USD', label: 'USD' },
                    { value: 'UAH', label: 'UAH' },
                  ]}
                />
                <AdminSelectField
                  label="Preferred locale"
                  value={form.preferredLocale}
                  onChange={(value) => updateForm('preferredLocale', value)}
                  options={[
                    { value: 'en', label: 'EN' },
                    { value: 'ua', label: 'UA' },
                  ]}
                />
                <AdminSelectField
                  label="Customer group"
                  value={form.group}
                  onChange={(value) => updateForm('group', value as CustomerGroup)}
                  options={[
                    { value: 'B2C', label: 'B2C' },
                    { value: 'B2B_PENDING', label: 'B2B pending' },
                    { value: 'B2B_APPROVED', label: 'B2B approved' },
                  ]}
                />
                <div className="md:col-span-2">
                  <AdminCheckboxField
                    label="Active customer account"
                    checked={form.isActive}
                    onChange={(checked) => updateForm('isActive', checked)}
                    helper="Inactive customers keep their history but should not be treated as live accounts."
                  />
                </div>
                <div className="md:col-span-2">
                  <AdminTextareaField label="Internal notes" value={form.notes} onChange={(value) => updateForm('notes', value)} rows={5} />
                </div>
              </div>
            </section>

            <section className="rounded-[6px] border border-white/10 bg-[#171717] p-6">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-zinc-100">Orders</h2>
                  <p className="mt-1 text-sm text-zinc-500">Storefront orders and the fastest route to open the full order detail.</p>
                </div>
                <Link
                  href={`/admin/shop/orders/create?customerId=${customer.id}`}
                  className="inline-flex items-center gap-2 rounded-full bg-gradient-to-b from-blue-500 to-blue-700 px-4 py-2 text-sm font-bold uppercase tracking-wider text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_2px_8px_rgba(59,130,246,0.4)] transition hover:from-blue-400 hover:to-blue-600"
                >
                  New order
                </Link>
              </div>
              {customer.orders.length ? (
                <AdminTableShell>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px] text-left text-sm">
                      <thead>
                        <tr className="border-b border-white/10 bg-white/[0.03] text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                          <th className="px-4 py-4 font-medium">Order</th>
                          <th className="px-4 py-4 font-medium">Status</th>
                          <th className="px-4 py-4 font-medium">Items</th>
                          <th className="px-4 py-4 font-medium">Total</th>
                          <th className="px-4 py-4 font-medium">Open</th>
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
                                Open →
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </AdminTableShell>
              ) : (
                <div className="rounded-[6px] border border-dashed border-white/10 px-4 py-10 text-sm text-zinc-500">No orders yet.</div>
              )}
            </section>

            <section className="rounded-[6px] border border-white/10 bg-[#171717] p-6">
              <div className="mb-5">
                <h2 className="text-xl font-semibold text-zinc-100">Addresses and carts</h2>
                <p className="mt-1 text-sm text-zinc-500">Stored shipping data and current storefront activity.</p>
              </div>
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500">Addresses</h3>
                  {customer.addresses.length ? (
                    customer.addresses.map((address) => (
                      <div key={address.id} className="rounded-[6px] border border-white/10 bg-black/25 px-4 py-4 text-sm text-zinc-300">
                        <div className="font-medium text-zinc-100">{address.label}</div>
                        <div className="mt-2 space-y-1">
                          <div>{address.line1}</div>
                          {address.line2 ? <div>{address.line2}</div> : null}
                          <div>{[address.city, address.region, address.postcode].filter(Boolean).join(', ')}</div>
                          <div>{address.country}</div>
                        </div>
                        <div className="mt-3 text-xs text-zinc-500">
                          {address.isDefaultShipping ? 'Default shipping' : '—'}
                          {address.isDefaultBilling ? ' · Default billing' : ''}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-[6px] border border-dashed border-white/10 px-4 py-8 text-sm text-zinc-500">No saved addresses.</div>
                  )}
                </div>
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500">Carts</h3>
                  {customer.carts.length ? (
                    customer.carts.map((cart) => (
                      <div key={cart.id} className="rounded-[6px] border border-white/10 bg-black/25 px-4 py-4 text-sm text-zinc-300">
                        <div className="font-medium text-zinc-100">
                          {cart.currency} · {cart.locale}
                        </div>
                        <div className="mt-2 text-xs text-zinc-500">
                          {cart.itemCount} items · updated {new Date(cart.updatedAt).toLocaleString()}
                        </div>
                        <div className="mt-2 font-mono text-[11px] text-zinc-500">{cart.token}</div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-[6px] border border-dashed border-white/10 px-4 py-8 text-sm text-zinc-500">No active carts.</div>
                  )}
                </div>
              </div>
            </section>

            <section className="rounded-[6px] border border-white/10 bg-[#171717] p-6">
              <div className="mb-5 flex items-center gap-2">
                <Database className="h-4 w-4 text-blue-300/60" />
                <div>
                  <h2 className="text-xl font-semibold text-zinc-100">CRM and pricing context</h2>
                  <p className="mt-1 text-sm text-zinc-500">Airtable-linked orders and customer-specific markup signals.</p>
                </div>
              </div>
              <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
                <div className="rounded-[6px] border border-white/10 bg-black/25 px-4 py-4">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Customer markup</div>
                  {customerMarkup ? (
                    <div className="mt-3 space-y-2">
                      <div className="text-2xl font-semibold text-emerald-300">{customerMarkup.markupPct}%</div>
                      <div className="text-sm text-zinc-400">
                        Custom pricing override{customerMarkup.notes ? ` · ${customerMarkup.notes}` : ''}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 text-sm text-zinc-500">Uses default pricing rules.</div>
                  )}
                </div>
                <div className="space-y-3">
                  {crmLoading ? (
                    <div className="rounded-[6px] border border-white/10 bg-black/25 px-4 py-8 text-sm text-zinc-500">Loading CRM orders…</div>
                  ) : crmOrders.length ? (
                    crmOrders.map((order) => (
                      <div key={order.id} className="rounded-[6px] border border-white/10 bg-black/25 px-4 py-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <div className="font-medium text-zinc-100">#{order.number}</div>
                            <div className="mt-1 text-xs text-zinc-500">{order.name}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm text-zinc-100">${order.clientTotal.toLocaleString()}</div>
                            <div className="mt-1 text-xs text-zinc-500">{order.itemCount} items</div>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-[6px] border border-dashed border-white/10 px-4 py-8 text-sm text-zinc-500">
                      No linked CRM orders or Airtable reference was not found in notes.
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
              title="Account state"
              description="Identity, activation, locale and password readiness."
            >
              <AdminKeyValueGrid
                rows={[
                  { label: 'Email', value: customer.email },
                  { label: 'Locale', value: customer.preferredLocale.toUpperCase() },
                  { label: 'Last login', value: customer.account?.lastLoginAt ? new Date(customer.account.lastLoginAt).toLocaleString() : 'Never' },
                  { label: 'Email verified', value: customer.account?.emailVerifiedAt ? new Date(customer.account.emailVerifiedAt).toLocaleString() : 'No' },
                  { label: 'Created', value: new Date(customer.createdAt).toLocaleString() },
                ]}
              />
            </AdminInspectorCard>

            <AdminInspectorCard
              title="Password setup"
              description="One-time access link for first login or password reset."
            >
              <div className="space-y-3 text-sm text-zinc-300">
                <div>
                  {customer.account?.hasPassword
                    ? 'Password already exists. You can still issue a fresh setup link.'
                    : 'Password is not configured yet.'}
                </div>
                {setupLinkExpiresAt ? (
                  <div className="text-xs text-zinc-500">
                    Active setup link expires at {new Date(setupLinkExpiresAt).toLocaleString()}
                  </div>
                ) : null}
                {setupLinkUrl ? (
                  <div className="rounded-[6px] border border-white/10 bg-black/25 px-3 py-3">
                    <div className="break-all font-mono text-xs text-zinc-200">{setupLinkUrl}</div>
                    <button
                      type="button"
                      onClick={() => void copySetupLink()}
                      className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-200 transition hover:bg-white/10"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      {copiedSetupLink ? 'Copied' : 'Copy link'}
                    </button>
                  </div>
                ) : null}
              </div>
            </AdminInspectorCard>

            <AdminInspectorCard
              title="Default shipping"
              description="Primary shipping address snapshot used for customer context."
            >
              <AdminKeyValueGrid
                rows={[
                  { label: 'Line 1', value: customer.defaultShippingAddress?.line1 || '—' },
                  { label: 'Line 2', value: customer.defaultShippingAddress?.line2 || '—' },
                  { label: 'City', value: customer.defaultShippingAddress?.city || '—' },
                  { label: 'Region', value: customer.defaultShippingAddress?.region || '—' },
                  { label: 'Country', value: customer.defaultShippingAddress?.country || '—' },
                ]}
              />
            </AdminInspectorCard>

            <AdminInspectorCard
              title="Audit trail"
              description="Recent admin actions affecting this customer."
            >
              <AdminTimelineList
                items={customer.auditLog.map((entry) => ({
                  id: entry.id,
                  title: entry.action,
                  meta: `${entry.actorName || entry.actorEmail} · ${new Date(entry.createdAt).toLocaleString()}`,
                  body: entry.metadata ? (
                    <pre className="overflow-x-auto rounded-[6px] border border-white/10 bg-black/25 p-3 text-[11px] text-zinc-400">
                      {JSON.stringify(entry.metadata, null, 2)}
                    </pre>
                  ) : undefined,
                }))}
                empty="No audit events yet."
              />
            </AdminInspectorCard>
          </>
        }
      />
    </AdminPage>
  );
}

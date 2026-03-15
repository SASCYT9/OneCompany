'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, CheckCircle2, RotateCcw, Save, UserRound } from 'lucide-react';

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
  isActive: boolean;
  notes: string | null;
  preferredLocale: string;
  createdAt: string;
  updatedAt: string;
  account: {
    lastLoginAt: string | null;
    emailVerifiedAt: string | null;
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
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

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

  async function runAction(action: 'approve_b2b' | 'revert_b2c') {
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
      setSuccess(action === 'approve_b2b' ? 'Customer approved for B2B.' : 'Customer reverted to B2C.');
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
        <div className="rounded-lg bg-red-900/20 p-3 text-sm text-red-300">{error || 'Customer not found'}</div>
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
                className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-100 hover:bg-emerald-500/15 disabled:opacity-50"
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
                className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/[0.04] px-4 py-2 text-sm text-white hover:bg-white/[0.08] disabled:opacity-50"
              >
                <RotateCcw className="h-4 w-4" />
                Revert to B2C
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-black hover:bg-white/90 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>

        {error ? <div className="mb-4 rounded-lg bg-red-900/20 p-3 text-sm text-red-300">{error}</div> : null}
        {success ? <div className="mb-4 rounded-lg bg-green-900/20 p-3 text-sm text-green-200">{success}</div> : null}

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="space-y-6">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <h3 className="mb-4 text-lg font-medium text-white">Profile</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <InputField label="First name" value={form.firstName} onChange={(value) => setForm((current) => current ? { ...current, firstName: value } : current)} />
                <InputField label="Last name" value={form.lastName} onChange={(value) => setForm((current) => current ? { ...current, lastName: value } : current)} />
                <InputField label="Phone" value={form.phone} onChange={(value) => setForm((current) => current ? { ...current, phone: value } : current)} />
                <InputField label="Company" value={form.companyName} onChange={(value) => setForm((current) => current ? { ...current, companyName: value } : current)} />
                <InputField label="VAT number" value={form.vatNumber} onChange={(value) => setForm((current) => current ? { ...current, vatNumber: value } : current)} />
                <InputField label="B2B discount %" value={form.b2bDiscountPercent} onChange={(value) => setForm((current) => current ? { ...current, b2bDiscountPercent: value } : current)} />
                <label className="block">
                  <span className="mb-1.5 block text-xs text-white/50">Preferred locale</span>
                  <select
                    value={form.preferredLocale}
                    onChange={(event) => setForm((current) => current ? { ...current, preferredLocale: event.target.value } : current)}
                    className="w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white focus:outline-none"
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
                    className="w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white focus:outline-none"
                  >
                    <option value="B2C">B2C</option>
                    <option value="B2B_PENDING">B2B pending</option>
                    <option value="B2B_APPROVED">B2B approved</option>
                  </select>
                </label>
                <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(event) => setForm((current) => current ? { ...current, isActive: event.target.checked } : current)}
                    className="h-4 w-4 rounded border-white/20 bg-zinc-950"
                  />
                  Active customer
                </label>
                <div className="rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white/70">
                  <div>Joined {new Date(customer.createdAt).toLocaleString()}</div>
                  <div className="mt-1 text-white/45">
                    Last login {customer.account?.lastLoginAt ? new Date(customer.account.lastLoginAt).toLocaleString() : '—'}
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label className="block">
                    <span className="mb-1.5 block text-xs text-white/50">Internal notes</span>
                    <textarea
                      value={form.notes}
                      onChange={(event) => setForm((current) => current ? { ...current, notes: event.target.value } : current)}
                      rows={5}
                      className="w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white placeholder:text-white/25 focus:border-white/30 focus:outline-none"
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <h3 className="mb-4 text-lg font-medium text-white">Order history</h3>
              <div className="space-y-3">
                {customer.orders.length ? customer.orders.map((order) => (
                  <div key={order.id} className="rounded-xl border border-white/10 bg-black/30 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="font-medium text-white">{order.orderNumber}</div>
                        <div className="mt-1 text-xs text-white/45">
                          {new Date(order.createdAt).toLocaleString()} · {order.itemCount} items
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-white">{order.currency} {order.total.toFixed(2)}</div>
                        <Link href={`/admin/shop/orders/${order.id}`} className="mt-1 inline-block text-xs text-white/60 hover:text-white">
                          Open order
                        </Link>
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="rounded-xl border border-white/10 bg-black/30 p-4 text-sm text-white/45">No orders yet.</div>
                )}
              </div>
            </div>
          </section>

          <section className="space-y-6">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <h3 className="mb-4 text-lg font-medium text-white">Addresses</h3>
              <div className="space-y-3">
                {customer.addresses.length ? customer.addresses.map((address) => (
                  <div key={address.id} className="rounded-xl border border-white/10 bg-black/30 p-4 text-sm text-white/75">
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
                  <div className="rounded-xl border border-white/10 bg-black/30 p-4 text-sm text-white/45">No addresses saved.</div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <h3 className="mb-4 text-lg font-medium text-white">Active carts</h3>
              <div className="space-y-3">
                {customer.carts.length ? customer.carts.map((cart) => (
                  <div key={cart.id} className="rounded-xl border border-white/10 bg-black/30 p-4 text-sm text-white/75">
                    <div className="font-medium text-white">{cart.currency} · {cart.locale}</div>
                    <div className="mt-1 text-xs text-white/45">
                      {cart.itemCount} items · updated {new Date(cart.updatedAt).toLocaleString()}
                    </div>
                    <div className="mt-1 text-xs font-mono text-white/35">{cart.token}</div>
                  </div>
                )) : (
                  <div className="rounded-xl border border-white/10 bg-black/30 p-4 text-sm text-white/45">No carts found.</div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <h3 className="mb-4 text-lg font-medium text-white">Audit trail</h3>
              <div className="space-y-3">
                {customer.auditLog.length ? customer.auditLog.map((entry) => (
                  <div key={entry.id} className="rounded-xl border border-white/10 bg-black/30 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm font-medium text-white">{entry.action}</div>
                      <div className="text-xs text-white/45">{new Date(entry.createdAt).toLocaleString()}</div>
                    </div>
                    <div className="mt-1 text-xs text-white/45">
                      {entry.actorName || entry.actorEmail}
                    </div>
                    {entry.metadata ? (
                      <pre className="mt-3 overflow-x-auto rounded-lg border border-white/10 bg-zinc-950 p-3 text-xs text-white/55">
                        {JSON.stringify(entry.metadata, null, 2)}
                      </pre>
                    ) : null}
                  </div>
                )) : (
                  <div className="rounded-xl border border-white/10 bg-black/30 p-4 text-sm text-white/45">No audit events yet.</div>
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
        className="w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white placeholder:text-white/25 focus:border-white/30 focus:outline-none"
      />
    </label>
  );
}

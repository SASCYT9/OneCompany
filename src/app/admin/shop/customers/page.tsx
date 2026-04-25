'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Building2, Database, ExternalLink, Eye, Mail, Phone, RefreshCcw, Search, Users } from 'lucide-react';

import {
  AdminActionBar,
  AdminEmptyState,
  AdminFilterBar,
  AdminInlineAlert,
  AdminMetricCard,
  AdminMetricGrid,
  AdminPage,
  AdminPageHeader,
  AdminStatusBadge,
  AdminTableShell,
} from '@/components/admin/AdminPrimitives';
import { AdminSlideOver } from '@/components/admin/AdminSlideOver';

type CustomerGroup = 'B2C' | 'B2B_PENDING' | 'B2B_APPROVED';

type CustomerListItem = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  phone: string | null;
  companyName: string | null;
  group: CustomerGroup;
  isActive: boolean;
  preferredLocale: string;
  createdAt: string;
  updatedAt: string;
  notes: string | null;
  counts: {
    orders: number;
    carts: number;
    addresses: number;
  };
};

function groupTone(group: CustomerGroup): 'default' | 'success' | 'warning' {
  switch (group) {
    case 'B2B_APPROVED':
      return 'success';
    case 'B2B_PENDING':
      return 'warning';
    default:
      return 'default';
  }
}

export default function AdminShopCustomersPage() {
  const [quickViewId, setQuickViewId] = useState<string | null>(null);
  const [customers, setCustomers] = useState<CustomerListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState('ALL');
  const [status, setStatus] = useState('ALL');

  const filteredCustomers = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return customers.filter((customer) => {
      if (group !== 'ALL' && customer.group !== group) return false;
      if (status === 'active' && !customer.isActive) return false;
      if (status === 'inactive' && customer.isActive) return false;
      if (!needle) return true;
      return [customer.email, customer.fullName, customer.companyName, customer.phone]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle));
    });
  }, [customers, group, query, status]);

  async function load() {
    setError('');
    setLoading(true);
    try {
      const response = await fetch('/api/admin/shop/customers');
      const data = await response.json().catch(() => []);
      if (!response.ok) {
        setError((data as { error?: string }).error || 'Failed to load customers');
        return;
      }
      setCustomers(Array.isArray(data) ? (data as CustomerListItem[]) : []);
    } finally {
      setLoading(false);
    }
  }

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  useEffect(() => {
    void load();
  }, []);

  if (loading) {
    return (
      <AdminPage>
        <div className="flex items-center gap-3 rounded-[6px] border border-white/10 bg-[#171717] px-5 py-6 text-sm text-zinc-400">
          <Users className="h-4 w-4 animate-pulse" />
          Loading customers…
        </div>
      </AdminPage>
    );
  }

  return (
    <AdminPage className="space-y-6">
      <AdminPageHeader
        eyebrow="Customers"
        title="Customer Ops"
        description="B2C і B2B клієнти, approval state, account readiness і активність замовлень в одному робочому центрі."
        actions={
          <Link
            href="/admin/shop/customers/new"
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-b from-blue-500 to-blue-700 px-4 py-2 text-sm font-bold uppercase tracking-wider text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_2px_8px_rgba(59,130,246,0.4)] transition hover:from-blue-400 hover:to-blue-600"
          >
            New customer
          </Link>
        }
      />

      <AdminMetricGrid>
        <AdminMetricCard label="Customers" value={customers.length} meta="Public storefront accounts" />
        <AdminMetricCard label="Pending B2B" value={customers.filter((item) => item.group === 'B2B_PENDING').length} meta="Need approval decision" tone="accent" />
        <AdminMetricCard label="Approved B2B" value={customers.filter((item) => item.group === 'B2B_APPROVED').length} meta="Wholesale-ready accounts" />
        <AdminMetricCard label="Order activity" value={customers.reduce((sum, item) => sum + item.counts.orders, 0)} meta="Orders across visible customers" />
      </AdminMetricGrid>

      <AdminActionBar>
        <div className="text-sm text-zinc-500">
          Use the filters to isolate approval queues, inactive accounts, or CRM-linked customers.
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={refreshing}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-200 transition hover:bg-white/10 disabled:opacity-50"
        >
          <RefreshCcw className={`h-4 w-4 ${refreshing ? 'motion-safe:animate-spin' : ''}`} />
          Refresh
        </button>
      </AdminActionBar>

      <AdminFilterBar>
        <label className="flex min-w-[280px] flex-1 items-center gap-2 rounded-[6px] border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-200">
          <Search className="h-4 w-4 text-zinc-500" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by email, name, company or phone"
            className="w-full bg-transparent text-zinc-100 placeholder:text-zinc-500 focus:outline-none"
          />
        </label>
        <FilterSelect
          label="Group"
          value={group}
          onChange={setGroup}
          options={[
            { value: 'ALL', label: 'All groups' },
            { value: 'B2C', label: 'B2C' },
            { value: 'B2B_PENDING', label: 'B2B pending' },
            { value: 'B2B_APPROVED', label: 'B2B approved' },
          ]}
        />
        <FilterSelect
          label="Status"
          value={status}
          onChange={setStatus}
          options={[
            { value: 'ALL', label: 'All status' },
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
          ]}
        />
      </AdminFilterBar>

      {error ? <AdminInlineAlert tone="error">{error}</AdminInlineAlert> : null}

      {filteredCustomers.length === 0 ? (
        <AdminEmptyState
          title="No customers match the current filters"
          description="Спробуйте інший запит або створіть нового клієнта вручну."
        />
      ) : (
        <AdminTableShell>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.03] text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                  <th className="px-4 py-4 font-medium">Customer</th>
                  <th className="px-4 py-4 font-medium">Group</th>
                  <th className="px-4 py-4 font-medium">Status</th>
                  <th className="px-4 py-4 font-medium">CRM</th>
                  <th className="px-4 py-4 font-medium">Activity</th>
                  <th className="px-4 py-4 font-medium">Updated</th>
                  <th className="px-4 py-4 font-medium">Open</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/6">
                {filteredCustomers.map((customer) => (
                  <tr key={customer.id} className="align-top transition hover:bg-white/[0.03]">
                    <td className="px-4 py-4">
                      <div className="font-medium text-zinc-100">{customer.fullName}</div>
                      <div className="mt-1 text-xs text-zinc-500">{customer.email}</div>
                      <div className="mt-1 text-[11px] uppercase tracking-[0.18em] text-zinc-600">
                        {[customer.companyName, customer.phone].filter(Boolean).join(' · ') || '—'}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <AdminStatusBadge tone={groupTone(customer.group)}>{customer.group.replace('B2B_', 'B2B ')}</AdminStatusBadge>
                    </td>
                    <td className="px-4 py-4">
                      {customer.isActive ? (
                        <AdminStatusBadge tone="success">Active</AdminStatusBadge>
                      ) : (
                        <AdminStatusBadge tone="default">Inactive</AdminStatusBadge>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      {customer.notes?.includes('[Airtable:') ? (
                        <span className="inline-flex items-center gap-1.5 text-xs text-emerald-300">
                          <Database className="h-3.5 w-3.5" />
                          Linked
                        </span>
                      ) : (
                        <span className="text-xs text-zinc-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-zinc-300">
                      <div className="font-medium">{customer.counts.orders} orders</div>
                      <div className="mt-1 text-xs text-zinc-500">
                        {customer.counts.carts} carts · {customer.counts.addresses} addresses
                      </div>
                    </td>
                    <td className="px-4 py-4 text-xs text-zinc-500">
                      {new Date(customer.updatedAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-col gap-1.5">
                        <button
                          type="button"
                          onClick={() => setQuickViewId(customer.id)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-blue-500/25 bg-blue-500/[0.08] px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider text-blue-300 transition hover:border-blue-500/40 hover:bg-blue-500/[0.12]"
                          title="Quick view (no navigation)"
                        >
                          <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                          Quick view
                        </button>
                        <Link
                          href={`/admin/shop/customers/${customer.id}`}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider text-zinc-200 transition hover:border-white/15 hover:bg-white/[0.06]"
                        >
                          Detail
                          <ExternalLink className="h-3 w-3" aria-hidden="true" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AdminTableShell>
      )}

      <CustomerQuickView
        customer={customers.find((c) => c.id === quickViewId) ?? null}
        open={quickViewId !== null}
        onClose={() => setQuickViewId(null)}
      />
    </AdminPage>
  );
}

function CustomerQuickView({
  customer,
  open,
  onClose,
}: {
  customer: CustomerListItem | null;
  open: boolean;
  onClose: () => void;
}) {
  const initials = customer
    ? `${customer.firstName?.[0] ?? ''}${customer.lastName?.[0] ?? ''}`.toUpperCase() || customer.email[0]?.toUpperCase() || 'OC'
    : '';
  return (
    <AdminSlideOver
      open={open}
      onClose={onClose}
      width="md"
      title={customer ? customer.fullName || customer.email : 'Customer'}
      subtitle={customer ? `Created ${new Date(customer.createdAt).toLocaleDateString('uk-UA')}` : undefined}
      footer={
        customer ? (
          <div className="flex items-center justify-between gap-3">
            <Link
              href={`/admin/shop/customers/${customer.id}`}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-400 transition hover:text-blue-300"
            >
              Open full profile
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-white/[0.1] bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-zinc-200 transition hover:border-white/20 hover:bg-white/[0.06]"
            >
              Close
            </button>
          </div>
        ) : undefined
      }
    >
      {customer ? (
        <div className="space-y-5">
          {/* Avatar + name */}
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-blue-600/20 text-base font-bold text-blue-300">
              {initials}
            </div>
            <div className="min-w-0">
              <div className="truncate text-base font-semibold text-zinc-50">{customer.fullName || customer.email}</div>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                <AdminStatusBadge tone={groupTone(customer.group)}>{customer.group.replace('B2B_', 'B2B ')}</AdminStatusBadge>
                <AdminStatusBadge tone={customer.isActive ? 'success' : 'default'}>
                  {customer.isActive ? 'Active' : 'Inactive'}
                </AdminStatusBadge>
              </div>
            </div>
          </div>

          {/* Contact rows */}
          <section className="space-y-2">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Contact</div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2.5 rounded-lg border border-white/[0.04] bg-black/25 px-3 py-2 text-sm">
                <Mail className="h-3.5 w-3.5 shrink-0 text-zinc-500" aria-hidden="true" />
                <span className="truncate text-zinc-200">{customer.email}</span>
              </div>
              {customer.phone ? (
                <div className="flex items-center gap-2.5 rounded-lg border border-white/[0.04] bg-black/25 px-3 py-2 text-sm">
                  <Phone className="h-3.5 w-3.5 shrink-0 text-zinc-500" aria-hidden="true" />
                  <span className="truncate text-zinc-200">{customer.phone}</span>
                </div>
              ) : null}
              {customer.companyName ? (
                <div className="flex items-center gap-2.5 rounded-lg border border-white/[0.04] bg-black/25 px-3 py-2 text-sm">
                  <Building2 className="h-3.5 w-3.5 shrink-0 text-zinc-500" aria-hidden="true" />
                  <span className="truncate text-zinc-200">{customer.companyName}</span>
                </div>
              ) : null}
            </div>
          </section>

          {/* Activity stats */}
          <section className="space-y-2">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Activity</div>
            <div className="grid grid-cols-3 gap-2">
              <CqStat label="Orders" value={customer.counts.orders.toString()} />
              <CqStat label="Carts" value={customer.counts.carts.toString()} />
              <CqStat label="Addresses" value={customer.counts.addresses.toString()} />
            </div>
          </section>

          {/* CRM linkage */}
          {customer.notes?.includes('[Airtable:') ? (
            <section>
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] px-3 py-2.5 text-xs">
                <div className="flex items-center gap-2 text-emerald-300">
                  <Database className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="font-semibold uppercase tracking-wider">Linked to Airtable CRM</span>
                </div>
                <div className="mt-1 text-zinc-500">Customer record is synchronized with the CRM database.</div>
              </div>
            </section>
          ) : null}

          {/* Notes */}
          {customer.notes ? (
            <section className="space-y-2">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Notes</div>
              <div className="rounded-lg border border-white/[0.05] bg-[#171717] px-3 py-2.5 text-sm leading-6 text-zinc-300">
                {customer.notes}
              </div>
            </section>
          ) : null}

          {/* Updated */}
          <section className="space-y-2">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Timestamps</div>
            <div className="space-y-1 text-xs">
              <div className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.04] bg-black/25 px-3 py-2">
                <span className="text-zinc-500">Created</span>
                <span className="text-zinc-200">{new Date(customer.createdAt).toLocaleString('uk-UA')}</span>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.04] bg-black/25 px-3 py-2">
                <span className="text-zinc-500">Updated</span>
                <span className="text-zinc-200">{new Date(customer.updatedAt).toLocaleString('uk-UA')}</span>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </AdminSlideOver>
  );
}

function CqStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/[0.05] bg-[#171717] p-3 text-center">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{label}</div>
      <div className="mt-1 text-xl font-bold tabular-nums text-zinc-50">{value}</div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="block min-w-[180px]">
      <span className="mb-1.5 block text-xs uppercase tracking-[0.18em] text-zinc-500">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-[6px] border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-100 focus:border-white/20 focus:outline-none"
      >
        {options.map((option) => (
          <option key={`${label}-${option.value}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Database, RefreshCcw, Search, Users } from 'lucide-react';

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
        <div className="flex items-center gap-3 rounded-[28px] border border-white/10 bg-[#101010] px-5 py-6 text-sm text-stone-400">
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
            className="inline-flex items-center gap-2 rounded-full bg-stone-100 px-4 py-2 text-sm font-medium text-black transition hover:bg-stone-200"
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
        <div className="text-sm text-stone-500">
          Use the filters to isolate approval queues, inactive accounts, or CRM-linked customers.
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={refreshing}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-stone-200 transition hover:bg-white/10 disabled:opacity-50"
        >
          <RefreshCcw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </AdminActionBar>

      <AdminFilterBar>
        <label className="flex min-w-[280px] flex-1 items-center gap-2 rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-stone-200">
          <Search className="h-4 w-4 text-stone-500" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by email, name, company or phone"
            className="w-full bg-transparent text-stone-100 placeholder:text-stone-500 focus:outline-none"
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
                <tr className="border-b border-white/10 bg-white/[0.03] text-[11px] uppercase tracking-[0.18em] text-stone-500">
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
                      <div className="font-medium text-stone-100">{customer.fullName}</div>
                      <div className="mt-1 text-xs text-stone-500">{customer.email}</div>
                      <div className="mt-1 text-[11px] uppercase tracking-[0.18em] text-stone-600">
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
                        <span className="text-xs text-stone-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-stone-300">
                      <div className="font-medium">{customer.counts.orders} orders</div>
                      <div className="mt-1 text-xs text-stone-500">
                        {customer.counts.carts} carts · {customer.counts.addresses} addresses
                      </div>
                    </td>
                    <td className="px-4 py-4 text-xs text-stone-500">
                      {new Date(customer.updatedAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-4">
                      <Link
                        href={`/admin/shop/customers/${customer.id}`}
                        className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium uppercase tracking-[0.18em] text-stone-200 transition hover:bg-white/10"
                      >
                        Open
                        <ArrowRight className="h-3.5 w-3.5 text-stone-500" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AdminTableShell>
      )}
    </AdminPage>
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
      <span className="mb-1.5 block text-xs uppercase tracking-[0.18em] text-stone-500">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-stone-100 focus:border-white/20 focus:outline-none"
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

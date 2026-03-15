'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, RefreshCcw, Search, Users } from 'lucide-react';

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
  counts: {
    orders: number;
    carts: number;
    addresses: number;
  };
};

function groupBadge(group: CustomerGroup) {
  switch (group) {
    case 'B2B_APPROVED':
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100';
    case 'B2B_PENDING':
      return 'border-amber-500/30 bg-amber-500/10 text-amber-100';
    default:
      return 'border-white/10 bg-white/5 text-white/70';
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
      return [
        customer.email,
        customer.fullName,
        customer.companyName,
        customer.phone,
      ]
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
      <div className="p-6 text-white/60 flex items-center gap-2">
        <Users className="h-5 w-5 animate-pulse" />
        Loading customers…
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto max-w-7xl p-6">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-white">Customers</h2>
            <p className="mt-2 text-sm text-white/45">
              Public shop customers, B2B approval state, carts and order activity.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-zinc-800 px-4 py-2 text-sm text-white hover:bg-zinc-700 disabled:opacity-50"
          >
            <RefreshCcw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        <div className="mb-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_180px_180px]">
            <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white">
              <Search className="h-4 w-4 text-white/35" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by email, name, company or phone"
                className="w-full bg-transparent text-white placeholder:text-white/25 focus:outline-none"
              />
            </label>
            <select
              value={group}
              onChange={(event) => setGroup(event.target.value)}
              className="rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white focus:outline-none"
            >
              <option value="ALL">All groups</option>
              <option value="B2C">B2C</option>
              <option value="B2B_PENDING">B2B pending</option>
              <option value="B2B_APPROVED">B2B approved</option>
            </select>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white focus:outline-none"
            >
              <option value="ALL">All status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div className="mt-4 grid gap-1 text-sm text-white/70 md:grid-cols-4 md:gap-8">
            <div>{customers.length} customers</div>
            <div>{customers.filter((item) => item.group === 'B2B_PENDING').length} pending B2B</div>
            <div>{customers.filter((item) => item.group === 'B2B_APPROVED').length} approved B2B</div>
            <div>{customers.reduce((sum, item) => sum + item.counts.orders, 0)} orders total</div>
          </div>
        </div>

        {error ? <div className="mb-4 rounded-lg bg-red-900/20 p-3 text-sm text-red-300">{error}</div> : null}

        {filteredCustomers.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] py-16 text-center text-white/50">
            No customers found.
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-white/10">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="px-4 py-3 font-medium text-white/60">Customer</th>
                  <th className="px-4 py-3 font-medium text-white/60">Group</th>
                  <th className="px-4 py-3 font-medium text-white/60">Status</th>
                  <th className="px-4 py-3 font-medium text-white/60">Activity</th>
                  <th className="px-4 py-3 font-medium text-white/60">Updated</th>
                  <th className="px-4 py-3 font-medium text-white/60">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.map((customer) => (
                  <tr key={customer.id} className="border-b border-white/5 align-top hover:bg-white/[0.03]">
                    <td className="px-4 py-4">
                      <div className="font-medium text-white">{customer.fullName}</div>
                      <div className="mt-1 text-xs text-white/45">{customer.email}</div>
                      <div className="mt-1 text-xs text-white/45">
                        {[customer.companyName, customer.phone].filter(Boolean).join(' · ') || '—'}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs ${groupBadge(customer.group)}`}>
                        {customer.group}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-white/70">
                      {customer.isActive ? 'Active' : 'Inactive'}
                    </td>
                    <td className="px-4 py-4 text-white/70">
                      <div>{customer.counts.orders} orders</div>
                      <div className="mt-1 text-xs text-white/45">
                        {customer.counts.carts} carts · {customer.counts.addresses} addresses
                      </div>
                    </td>
                    <td className="px-4 py-4 text-white/45">
                      {new Date(customer.updatedAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-4">
                      <Link
                        href={`/admin/shop/customers/${customer.id}`}
                        className="inline-flex items-center gap-2 text-sm text-white/75 hover:text-white"
                      >
                        Open
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

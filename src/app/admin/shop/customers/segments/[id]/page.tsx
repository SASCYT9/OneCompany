'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, RefreshCcw, Users } from 'lucide-react';

import {
  AdminInlineAlert,
  AdminInspectorCard,
  AdminPage,
  AdminPageHeader,
} from '@/components/admin/AdminPrimitives';
import { useToast } from '@/components/admin/AdminToast';
import { SegmentEditor, type SegmentRules } from '@/app/admin/shop/customers/segments/components/SegmentEditor';

type SegmentDetail = {
  id: string;
  name: string;
  description: string | null;
  rulesJson: SegmentRules;
  customerCount: number;
  memberCount: number;
  lastComputedAt: string | null;
  memberSample: Array<{ id: string; email: string; firstName: string; lastName: string; group: string; companyName: string | null }>;
  createdAt: string;
  updatedAt: string;
};

export default function AdminSegmentEditPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const toast = useToast();

  const [segment, setSegment] = useState<SegmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const response = await fetch(`/api/admin/shop/segments/${id}`, { cache: 'no-store' });
        const data = (await response.json().catch(() => ({}))) as SegmentDetail & { error?: string };
        if (!response.ok) throw new Error(data.error || 'Failed to load');
        if (!cancelled) setSegment(data);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [id, reloadKey]);

  async function handleSave(payload: { name: string; description: string | null; rulesJson: unknown }) {
    if (!segment) return;
    const response = await fetch(`/api/admin/shop/segments/${segment.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      toast.error('Could not save', data.error || 'Try again');
      return;
    }
    toast.success('Segment updated');
    setReloadKey((k) => k + 1);
  }

  if (loading) {
    return (
      <AdminPage>
        <div className="space-y-3">
          <div className="h-3 w-20 motion-safe:animate-pulse rounded bg-white/[0.06]" />
          <div className="h-9 w-72 motion-safe:animate-pulse rounded-md bg-white/[0.06]" />
        </div>
      </AdminPage>
    );
  }

  if (!segment) {
    return (
      <AdminPage>
        <AdminInlineAlert tone="error">{error || 'Segment not found'}</AdminInlineAlert>
      </AdminPage>
    );
  }

  return (
    <AdminPage className="space-y-6">
      <div className="flex items-center gap-2 text-xs text-zinc-500">
        <Link href="/admin/shop/customers/segments" className="inline-flex items-center gap-1 transition hover:text-zinc-300">
          <ArrowLeft className="h-3 w-3" />
          Back to segments
        </Link>
      </div>

      <AdminPageHeader
        eyebrow="Customer segment"
        title={segment.name}
        description={segment.description || 'Edit rules to refine matching criteria.'}
        actions={
          <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/25 bg-blue-500/[0.08] px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-blue-300">
            <Users className="h-3 w-3" />
            {segment.memberCount} matching
          </span>
        }
      />

      <SegmentEditor
        initialName={segment.name}
        initialDescription={segment.description ?? ''}
        initialRules={segment.rulesJson}
        onSave={handleSave}
      />

      {segment.memberSample.length > 0 ? (
        <AdminInspectorCard title="Member sample" description="First 50 customers in this segment.">
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {segment.memberSample.map((c) => (
              <Link
                key={c.id}
                href={`/admin/shop/customers/${c.id}`}
                className="rounded-lg border border-white/[0.05] bg-[#171717] p-2.5 text-sm transition hover:border-blue-500/30 hover:bg-blue-500/[0.04]"
              >
                <div className="font-medium text-zinc-100">
                  {[c.firstName, c.lastName].filter(Boolean).join(' ') || c.email}
                </div>
                <div className="mt-0.5 truncate text-[11px] text-zinc-500">{c.email}</div>
                <div className="mt-1 flex items-center gap-1.5 text-[10px] text-zinc-600">
                  <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-1.5 py-0 uppercase tracking-wider">
                    {c.group.replace('B2B_', 'B2B ')}
                  </span>
                  {c.companyName ? <span className="truncate">{c.companyName}</span> : null}
                </div>
              </Link>
            ))}
          </div>
        </AdminInspectorCard>
      ) : null}
    </AdminPage>
  );
}

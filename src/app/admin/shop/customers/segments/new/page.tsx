'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

import { AdminPage, AdminPageHeader } from '@/components/admin/AdminPrimitives';
import { SegmentEditor } from '@/app/admin/shop/customers/segments/components/SegmentEditor';
import { useToast } from '@/components/admin/AdminToast';

export default function AdminNewSegmentPage() {
  const router = useRouter();
  const toast = useToast();

  async function handleCreate(payload: {
    name: string;
    description: string | null;
    rulesJson: unknown;
  }) {
    const response = await fetch('/api/admin/shop/segments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      toast.error('Could not create segment', data.error || 'Try again');
      return;
    }
    toast.success(`Segment created · ${data.customerCount} members`);
    router.push(`/admin/shop/customers/segments/${data.id}`);
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
        eyebrow="Customers"
        title="New customer segment"
        description="Define rules to match customers. Save and reuse this segment as a target for email triggers and discount codes."
      />

      <SegmentEditor onSave={handleCreate} />
    </AdminPage>
  );
}

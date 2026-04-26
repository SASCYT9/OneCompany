'use client';

import { useEffect, useState } from 'react';

import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Clock,
  Loader2,
  Package,
  ShoppingCart,
  Truck,
  User,
  UserCheck,
} from 'lucide-react';

/**
 * Activity Timeline — chronological mutation log for any entity.
 *
 * Reads from /api/admin/audit-log/[entityType]/[entityId]
 *
 * Renders:
 *   - icon per action type (status change, payment, shipment, etc.)
 *   - actor name + email (or system label)
 *   - human-friendly action label + relative time + tooltip absolute time
 *   - inline diff for "from → to" status changes
 *   - optional note
 */

type AuditEntry = {
  id: string;
  actorEmail: string;
  actorName: string | null;
  scope: string;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: unknown;
  createdAt: string;
};

export function AdminActivityTimeline({
  entityType,
  entityId,
  emptyTitle = 'Поки немає активності',
  emptyDescription = 'Коли відбудуться зміни — вони з’являться тут.',
  className,
}: {
  entityType: string;
  entityId: string;
  emptyTitle?: string;
  emptyDescription?: string;
  className?: string;
}) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const response = await fetch(`/api/admin/audit-log/${encodeURIComponent(entityType)}/${encodeURIComponent(entityId)}`, {
          cache: 'no-store',
        });
        const data = (await response.json().catch(() => [])) as AuditEntry[] | { error?: string };
        if (!response.ok) throw new Error((data as { error?: string }).error || 'Failed to load activity');
        if (!cancelled) {
          setEntries(Array.isArray(data) ? data : []);
        }
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
  }, [entityType, entityId]);

  if (loading) {
    return (
      <div className={className}>
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" />
          Завантаження активності…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={className}>
        <div className="rounded-xl border border-red-500/20 bg-red-500/[0.05] p-3 text-sm text-red-300">
          {error}
        </div>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className={className}>
        <div className="rounded-xl border border-dashed border-white/[0.08] bg-black/25 p-6 text-center">
          <Activity className="mx-auto h-6 w-6 text-zinc-600" aria-hidden="true" />
          <div className="mt-2 text-sm font-medium text-zinc-300">{emptyTitle}</div>
          <div className="mt-1 text-xs text-zinc-500">{emptyDescription}</div>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <ol className="relative space-y-4 pl-6">
        {/* Vertical line */}
        <div className="absolute left-2 top-2 bottom-2 w-px bg-gradient-to-b from-white/[0.1] via-white/[0.05] to-transparent" aria-hidden="true" />

        {entries.map((entry, idx) => {
          const meta = (entry.metadata as Record<string, unknown> | null) ?? null;
          return (
            <li key={entry.id} className="relative">
              {/* Dot */}
              <div className="absolute -left-[18px] top-1 flex h-4 w-4 items-center justify-center rounded-full border border-white/[0.1] bg-[#0F0F0F]">
                <ActionIcon action={entry.action} />
              </div>

              <div className="rounded-xl border border-white/[0.05] bg-[#171717] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-zinc-100">{actionLabel(entry.action)}</div>
                    <ActionDetail action={entry.action} metadata={meta} />
                  </div>
                  <time
                    dateTime={entry.createdAt}
                    title={new Date(entry.createdAt).toLocaleString('uk-UA')}
                    className="shrink-0 text-[11px] text-zinc-500 tabular-nums"
                  >
                    {relativeTime(entry.createdAt)}
                  </time>
                </div>

                {/* Actor */}
                <div className="mt-2 flex items-center gap-1.5 text-[11px] text-zinc-500">
                  <User className="h-3 w-3" aria-hidden="true" />
                  <span className="truncate">
                    {entry.actorName || entry.actorEmail || 'Система'}
                  </span>
                </div>
              </div>

              {idx === 0 ? (
                <div className="absolute -left-[20px] top-0 h-2 w-2 motion-safe:animate-ping rounded-full bg-blue-500/40" aria-hidden="true" />
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function ActionIcon({ action }: { action: string }) {
  if (action.includes('status')) return <ArrowRight className="h-2.5 w-2.5 text-blue-400" aria-hidden="true" />;
  if (action.includes('payment')) return <CheckCircle2 className="h-2.5 w-2.5 text-emerald-400" aria-hidden="true" />;
  if (action.includes('shipment') || action.includes('ship')) return <Truck className="h-2.5 w-2.5 text-amber-300" aria-hidden="true" />;
  if (action.includes('order')) return <ShoppingCart className="h-2.5 w-2.5 text-blue-400" aria-hidden="true" />;
  if (action.includes('product')) return <Package className="h-2.5 w-2.5 text-blue-400" aria-hidden="true" />;
  if (action.includes('customer')) return <UserCheck className="h-2.5 w-2.5 text-emerald-400" aria-hidden="true" />;
  return <Clock className="h-2.5 w-2.5 text-zinc-500" aria-hidden="true" />;
}

function ActionDetail({ action, metadata }: { action: string; metadata: Record<string, unknown> | null }) {
  if (!metadata) return null;

  // Status transition (orders)
  if (typeof metadata.fromStatus === 'string' && typeof metadata.toStatus === 'string') {
    return (
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
        <span className="rounded-full border border-white/[0.06] bg-white/[0.03] px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
          {metadata.fromStatus}
        </span>
        <ArrowRight className="h-3 w-3 text-zinc-600" aria-hidden="true" />
        <span className="rounded-full border border-blue-500/25 bg-blue-500/[0.08] px-1.5 py-0.5 font-mono text-[10px] text-blue-300">
          {metadata.toStatus}
        </span>
      </div>
    );
  }

  // Note attached
  if (typeof metadata.note === 'string' && metadata.note) {
    return <div className="mt-1.5 text-xs italic text-zinc-400">"{metadata.note}"</div>;
  }

  // Updates summary
  if (metadata.updates && typeof metadata.updates === 'object' && !Array.isArray(metadata.updates)) {
    const keys = Object.keys(metadata.updates as object).filter((k) => k !== 'status');
    if (keys.length > 0) {
      return (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {keys.slice(0, 4).map((k) => (
            <span
              key={k}
              className="rounded-full border border-white/[0.06] bg-white/[0.03] px-1.5 py-0.5 font-mono text-[10px] text-zinc-400"
            >
              {k}
            </span>
          ))}
          {keys.length > 4 ? (
            <span className="text-[10px] text-zinc-600">+{keys.length - 4} more</span>
          ) : null}
        </div>
      );
    }
  }

  return null;
}

const ACTION_LABELS: Record<string, string> = {
  'order.status.update': 'Статус замовлення змінено',
  'order.create': 'Замовлення створено',
  'order.update': 'Замовлення оновлено',
  'order.delete': 'Замовлення видалено',
  'order.payment.update': 'Оплата оновлена',
  'order.shipment.create': 'Створено відправлення',
  'order.shipment.update': 'Відправлення оновлено',
  'product.create': 'Товар створено',
  'product.update': 'Товар оновлено',
  'product.delete': 'Товар архівовано',
  'product.bulk-status': 'Масова зміна статусу',
  'customer.create': 'Клієнта створено',
  'customer.update': 'Клієнта оновлено',
  'customer.b2b.approve': 'B2B затверджено',
  'customer.b2b.reject': 'B2B відхилено',
};

function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action.replace(/[._]/g, ' ').replace(/(^|\s)\w/g, (l) => l.toUpperCase());
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - then);
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'щойно';
  if (min < 60) return `${min} хв тому`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} год тому`;
  const d = Math.floor(hr / 24);
  if (d < 7) return `${d} д тому`;
  const w = Math.floor(d / 7);
  if (w < 5) return `${w} тиж тому`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo} міс тому`;
  return `${Math.floor(d / 365)} р тому`;
}

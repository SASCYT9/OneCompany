import { cn } from '@/lib/utils';

/**
 * Reusable skeleton primitives for consistent loading states across admin.
 * Pulse animation respects motion-safe.
 */

export function AdminSkeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={cn(
        'motion-safe:animate-pulse rounded-none bg-white/[0.06]',
        className
      )}
      style={style}
    />
  );
}

/** Single line of text */
export function AdminSkeletonText({ className, width = 'w-32' }: { className?: string; width?: string }) {
  return <AdminSkeleton className={cn('h-3.5', width, className)} />;
}

/** KPI card skeleton matching DashboardKpiCard layout */
export function AdminSkeletonKpi() {
  return (
    <div className="rounded-none border border-white/[0.05] bg-[#171717] px-5 pt-5 pb-3">
      <div className="flex items-start gap-3">
        <AdminSkeleton className="h-9 w-9 rounded-full" />
        <div className="flex-1 space-y-2">
          <AdminSkeleton className="h-3 w-20" />
          <AdminSkeleton className="h-7 w-32" />
          <AdminSkeleton className="h-3 w-24" />
        </div>
      </div>
      <AdminSkeleton className="-mx-5 mt-4 h-10 rounded-none" />
    </div>
  );
}

/** Card skeleton (generic content panel) */
export function AdminSkeletonCard({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('rounded-none border border-white/[0.05] bg-[#171717] p-5', className)}>
      <div className="space-y-2 border-b border-white/[0.04] pb-3">
        <AdminSkeleton className="h-4 w-32" />
        <AdminSkeleton className="h-3 w-48" />
      </div>
      <div className="mt-4 space-y-2.5">
        {Array.from({ length: rows }).map((_, i) => (
          <AdminSkeleton key={i} className="h-3" style={{ width: `${65 + ((i * 13) % 30)}%` }} />
        ))}
      </div>
    </div>
  );
}

/** Table row skeleton */
export function AdminSkeletonTableRow({ cols = 5 }: { cols?: number }) {
  return (
    <tr className="border-b border-white/[0.03] last:border-0">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-3 py-3.5">
          <AdminSkeleton
            className="h-3"
            style={{
              width: i === 0 ? '70%' : i === cols - 1 ? '40%' : `${50 + ((i * 17) % 30)}%`,
            }}
          />
        </td>
      ))}
    </tr>
  );
}

/** Full table skeleton (header + N rows) */
export function AdminSkeletonTable({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="overflow-hidden rounded-none border border-white/[0.05] bg-[#171717]">
      <table className="w-full">
        <thead className="border-b border-white/[0.04]">
          <tr>
            {Array.from({ length: cols }).map((_, i) => (
              <th key={i} className="px-3 py-2.5 text-left">
                <AdminSkeleton className="h-2.5 w-16" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <AdminSkeletonTableRow key={i} cols={cols} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** KPI grid skeleton (default 4 cards in row) */
export function AdminSkeletonKpiGrid({ count = 4 }: { count?: number }) {
  return (
    <div className={cn('grid gap-3 md:grid-cols-2', count === 6 ? 'xl:grid-cols-6' : 'xl:grid-cols-4')}>
      {Array.from({ length: count }).map((_, i) => (
        <AdminSkeletonKpi key={i} />
      ))}
    </div>
  );
}

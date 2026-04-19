import type { ReactNode } from 'react';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { cn } from '@/lib/utils';

export function AdminPage({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('mx-auto w-full max-w-[1640px] px-4 py-6 md:px-8 xl:px-10', className)}>{children}</div>;
}

export function AdminPageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('flex flex-wrap items-start justify-between gap-5', className)}>
      <div className="max-w-3xl space-y-3">
        {eyebrow ? (
          <div className="text-[11px] font-medium uppercase tracking-[0.24em] text-amber-100/55">{eyebrow}</div>
        ) : null}
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight text-stone-50 md:text-4xl">{title}</h1>
          {description ? <p className="max-w-2xl text-sm leading-6 text-stone-400">{description}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
    </section>
  );
}

export function AdminActionBar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={cn(
        'rounded-[28px] border border-white/10 bg-white/[0.03] px-4 py-4 shadow-[0_20px_60px_rgba(0,0,0,0.18)]',
        className
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">{children}</div>
    </section>
  );
}

export function AdminMetricGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('grid gap-3 md:grid-cols-2 xl:grid-cols-4', className)}>{children}</div>;
}

export function AdminMetricCard({
  label,
  value,
  meta,
  tone = 'default',
}: {
  label: string;
  value: ReactNode;
  meta?: ReactNode;
  tone?: 'default' | 'accent';
}) {
  return (
    <div
      className={cn(
        'rounded-[24px] border bg-[#101010] px-4 py-4',
        tone === 'accent' ? 'border-amber-100/15 shadow-[0_0_0_1px_rgba(245,240,232,0.03)]' : 'border-white/8'
      )}
    >
      <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-stone-500">{label}</div>
      <div className="mt-3 text-2xl font-semibold tracking-tight text-stone-50">{value}</div>
      {meta ? <div className="mt-2 text-xs text-stone-500">{meta}</div> : null}
    </div>
  );
}

export function AdminFilterBar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-[24px] border border-white/10 bg-[#101010] px-4 py-4', className)}>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </section>
  );
}

export function AdminTableShell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('overflow-hidden rounded-[28px] border border-white/10 bg-[#0b0b0b]', className)}>
      {children}
    </div>
  );
}

export function AdminInlineAlert({
  tone,
  children,
  className,
}: {
  tone: 'error' | 'success' | 'warning';
  children: ReactNode;
  className?: string;
}) {
  const toneClass =
    tone === 'error'
      ? 'border-red-500/25 bg-red-950/30 text-red-200'
      : tone === 'success'
        ? 'border-emerald-500/20 bg-emerald-950/20 text-emerald-200'
        : 'border-amber-300/20 bg-amber-500/10 text-amber-100';

  return <div className={cn('rounded-2xl border px-4 py-3 text-sm', toneClass, className)}>{children}</div>;
}

export function AdminStatusBadge({
  tone = 'default',
  children,
}: {
  tone?: 'default' | 'success' | 'warning' | 'danger';
  children: ReactNode;
}) {
  const toneClass =
    tone === 'success'
      ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200'
      : tone === 'warning'
        ? 'border-amber-300/20 bg-amber-500/10 text-amber-100'
        : tone === 'danger'
          ? 'border-red-500/25 bg-red-950/20 text-red-200'
          : 'border-white/10 bg-white/5 text-stone-200';

  return <span className={cn('inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium', toneClass)}>{children}</span>;
}

export function AdminEmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-[28px] border border-dashed border-white/10 bg-[#101010] px-6 py-16 text-center',
        className
      )}
    >
      <div className="mx-auto max-w-md space-y-3">
        <h2 className="text-lg font-medium text-stone-50">{title}</h2>
        <p className="text-sm leading-6 text-stone-400">{description}</p>
        {action ? <div className="pt-2">{action}</div> : null}
      </div>
    </div>
  );
}

export type AdminEditorNavSection = {
  id: string;
  label: string;
  description?: string;
};

export function AdminEditorShell({
  backHref,
  backLabel,
  title,
  description,
  sections,
  summary,
  children,
  className,
}: {
  backHref: string;
  backLabel: string;
  title: string;
  description: string;
  sections: AdminEditorNavSection[];
  summary?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <AdminPage className={className}>
      <div className="space-y-6">
        <div className="space-y-4">
          <Link href={backHref} className="inline-flex items-center gap-2 text-sm text-stone-400 transition hover:text-stone-100">
            <ArrowLeft className="h-4 w-4" />
            {backLabel}
          </Link>
          <AdminPageHeader title={title} description={description} />
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0 space-y-6">{children}</div>
          <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
            {summary}
            <div className="rounded-[28px] border border-white/10 bg-[#101010] p-5">
              <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-stone-500">Editor map</div>
              <nav className="mt-4 space-y-1">
                {sections.map((section, index) => (
                  <a
                    key={section.id}
                    href={`#${section.id}`}
                    className="flex items-start gap-3 rounded-2xl border border-transparent px-3 py-2 text-sm text-stone-300 transition hover:border-white/10 hover:bg-white/[0.03] hover:text-stone-100"
                  >
                    <span className="mt-0.5 text-[11px] font-medium uppercase tracking-[0.18em] text-amber-100/55">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span className="space-y-0.5">
                      <span className="block font-medium">{section.label}</span>
                      {section.description ? <span className="block text-xs text-stone-500">{section.description}</span> : null}
                    </span>
                  </a>
                ))}
              </nav>
            </div>
          </aside>
        </div>
      </div>
    </AdminPage>
  );
}

export function AdminEditorSection({
  id,
  title,
  description,
  children,
  className,
}: {
  id: string;
  title: string;
  description: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={cn('scroll-mt-24 rounded-[28px] border border-white/10 bg-[#101010] p-5 md:p-6', className)}>
      <div className="mb-5 max-w-2xl space-y-2">
        <h2 className="text-xl font-semibold tracking-tight text-stone-50">{title}</h2>
        <p className="text-sm leading-6 text-stone-400">{description}</p>
      </div>
      {children}
    </section>
  );
}

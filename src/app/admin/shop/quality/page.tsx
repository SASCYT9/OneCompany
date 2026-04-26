'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw, Search, Wrench } from 'lucide-react';

import {
  AdminActionBar,
  AdminBarList,
  AdminEmptyState,
  AdminFilterBar,
  AdminInlineAlert,
  AdminInspectorCard,
  AdminMetricCard,
  AdminMetricGrid,
  AdminPage,
  AdminPageHeader,
  AdminStatusBadge,
  AdminTableShell,
} from '@/components/admin/AdminPrimitives';
import { CATALOG_QUALITY_ISSUES, type CatalogQualityIssueKey } from '@/lib/admin/catalogQuality';

type CatalogQualityProduct = {
  id: string;
  slug: string;
  sku: string | null;
  brand: string;
  title: string;
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  isPublished: boolean;
  stock: string;
  collections: Array<{ id: string; handle: string; title: string; isPublished: boolean }>;
  issues: CatalogQualityIssueKey[];
  issueCount: number;
  updatedAt: string;
};

type CatalogQualityReport = {
  score: number;
  totalProducts: number;
  cleanProducts: number;
  issueProducts: number;
  issueCounts: Record<CatalogQualityIssueKey, number>;
  brandScores: Array<{
    brand: string;
    total: number;
    issueProducts: number;
    score: number;
    topIssues: Array<{ key: CatalogQualityIssueKey; count: number }>;
  }>;
  products: CatalogQualityProduct[];
};

const ISSUE_OPTIONS: Array<{ value: 'ALL' | CatalogQualityIssueKey; label: string }> = [
  { value: 'ALL', label: 'All issues' },
  ...Object.entries(CATALOG_QUALITY_ISSUES).map(([key, issue]) => ({
    value: key as CatalogQualityIssueKey,
    label: issue.label,
  })),
];

function qualityTone(score: number) {
  if (score >= 90) return 'success' as const;
  if (score >= 75) return 'warning' as const;
  return 'danger' as const;
}

function statusTone(status: CatalogQualityProduct['status']) {
  if (status === 'ACTIVE') return 'success' as const;
  if (status === 'ARCHIVED') return 'danger' as const;
  return 'warning' as const;
}

export default function CatalogQualityPage() {
  const [report, setReport] = useState<CatalogQualityReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [issueFilter, setIssueFilter] = useState<'ALL' | CatalogQualityIssueKey>('ALL');
  const [brandFilter, setBrandFilter] = useState('ALL');
  const [query, setQuery] = useState('');

  async function load(mode: 'initial' | 'refresh' = 'initial') {
    if (mode === 'initial') setLoading(true);
    else setRefreshing(true);
    setError('');

    try {
      const response = await fetch('/api/admin/shop/catalog-quality', { cache: 'no-store' });
      const data = (await response.json().catch(() => ({}))) as CatalogQualityReport & { error?: string };
      if (!response.ok) {
        setError(data.error || 'Failed to load catalog quality');
        return;
      }
      setReport(data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void load('initial');
  }, []);

  const brandOptions = useMemo(() => {
    const brands = new Set(report?.products.map((product) => product.brand).filter(Boolean) ?? []);
    return ['ALL', ...Array.from(brands).sort((left, right) => left.localeCompare(right))];
  }, [report]);

  const visibleProducts = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (report?.products ?? []).filter((product) => {
      if (issueFilter !== 'ALL' && !product.issues.includes(issueFilter)) return false;
      if (brandFilter !== 'ALL' && product.brand !== brandFilter) return false;
      if (!needle) return true;
      return [product.title, product.slug, product.sku, product.brand].some((value) =>
        String(value ?? '').toLowerCase().includes(needle)
      );
    });
  }, [brandFilter, issueFilter, query, report]);

  if (loading && !report) {
    return (
      <AdminPage>
        <div className="grid gap-3 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="h-28 motion-safe:animate-pulse rounded-none border border-white/10 bg-white/[0.03]" />
          ))}
        </div>
      </AdminPage>
    );
  }

  return (
    <AdminPage className="space-y-6">
      <AdminPageHeader
        eyebrow="Catalog"
        title="Catalog Quality Center"
        description="Операційний контроль товарів: зображення, UA/EN copy, ціни, stock state, SEO і колекції в одному екрані."
        actions={
          <button
            type="button"
            onClick={() => void load('refresh')}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-zinc-200 transition hover:bg-white/[0.06] disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'motion-safe:animate-spin' : ''}`} />
            Refresh
          </button>
        }
      />

      {error ? <AdminInlineAlert tone="error">{error}</AdminInlineAlert> : null}

      {report ? (
        <>
          <AdminMetricGrid>
            <AdminMetricCard label="Quality score" value={`${report.score}%`} meta={`${report.cleanProducts} clean of ${report.totalProducts}`} tone="accent" />
            <AdminMetricCard label="Products with issues" value={report.issueProducts} meta="Need catalog review" />
            <AdminMetricCard label="No image" value={report.issueCounts.NO_IMAGE} meta="Blocks premium storefront trust" />
            <AdminMetricCard label="Bad SEO" value={report.issueCounts.BAD_SEO} meta="Needs UA/EN search cleanup" />
          </AdminMetricGrid>

          <AdminActionBar>
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-1 h-4 w-4 text-blue-300" />
              <div>
                <div className="text-sm font-medium text-zinc-100">Bulk fix queue</div>
                <div className="text-sm text-zinc-500">
                  Use filters to isolate one issue class, then open affected products in edit mode. Destructive bulk mutations stay out of this first version.
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/admin/shop/media" className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-zinc-300 hover:bg-white/[0.06]">
                Media library
              </Link>
              <Link href="/admin/shop/seo" className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-zinc-300 hover:bg-white/[0.06]">
                SEO AI
              </Link>
              <Link href="/admin/shop?status=DRAFT" className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-zinc-300 hover:bg-white/[0.06]">
                Draft products
              </Link>
            </div>
          </AdminActionBar>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-4">
              <AdminFilterBar>
                <label className="flex min-w-[260px] flex-1 items-center gap-2 rounded-none border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-200">
                  <Search className="h-4 w-4 text-zinc-500" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search title, slug, SKU, brand"
                    className="w-full bg-transparent text-zinc-100 placeholder:text-zinc-500 focus:outline-none"
                  />
                </label>
                <SelectFilter label="Issue" value={issueFilter} onChange={(value) => setIssueFilter(value as 'ALL' | CatalogQualityIssueKey)} options={ISSUE_OPTIONS} />
                <SelectFilter
                  label="Brand"
                  value={brandFilter}
                  onChange={setBrandFilter}
                  options={brandOptions.map((brand) => ({ value: brand, label: brand === 'ALL' ? 'All brands' : brand }))}
                />
              </AdminFilterBar>

              {visibleProducts.length ? (
                <AdminTableShell>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[1080px] text-left text-sm">
                      <thead>
                        <tr className="border-b border-white/10 bg-white/[0.03] text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                          <th className="px-4 py-4 font-medium">Product</th>
                          <th className="px-4 py-4 font-medium">Status</th>
                          <th className="px-4 py-4 font-medium">Issues</th>
                          <th className="px-4 py-4 font-medium">Collections</th>
                          <th className="px-4 py-4 font-medium">Updated</th>
                          <th className="px-4 py-4 font-medium">Fix</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/6">
                        {visibleProducts.map((product) => (
                          <tr key={product.id} className="align-top transition hover:bg-white/[0.03]">
                            <td className="px-4 py-4">
                              <div className="font-medium text-zinc-100">{product.title}</div>
                              <div className="mt-1 text-xs text-zinc-500">{product.brand} · {product.sku || product.slug}</div>
                            </td>
                            <td className="px-4 py-4">
                              <AdminStatusBadge tone={statusTone(product.status)}>{product.status}</AdminStatusBadge>
                              <div className="mt-2 text-xs text-zinc-500">{product.isPublished ? 'Published' : 'Unpublished'} · {product.stock}</div>
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex max-w-[420px] flex-wrap gap-1.5">
                                {product.issues.map((issue) => (
                                  <AdminStatusBadge key={issue} tone={issue === 'NO_IMAGE' || issue === 'NO_PRICE' ? 'danger' : 'warning'}>
                                    {CATALOG_QUALITY_ISSUES[issue].label}
                                  </AdminStatusBadge>
                                ))}
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <div className="max-w-[220px] text-xs text-zinc-500">
                                {product.collections.length
                                  ? product.collections.slice(0, 3).map((collection) => collection.title).join(', ')
                                  : 'No collections'}
                              </div>
                            </td>
                            <td className="px-4 py-4 text-xs text-zinc-500">{new Date(product.updatedAt).toLocaleDateString()}</td>
                            <td className="px-4 py-4">
                              <Link
                                href={`/admin/shop/${product.id}`}
                                className="inline-flex items-center gap-2 rounded-full border border-blue-500/25 bg-blue-500/[0.08] px-3 py-2 text-xs font-medium uppercase tracking-[0.18em] text-blue-300 transition hover:bg-blue-500/[0.12]"
                              >
                                <Wrench className="h-3.5 w-3.5" />
                                Fix
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </AdminTableShell>
              ) : (
                <AdminEmptyState title="No products match current quality filters" description="Change issue, brand, or search filters to inspect another part of the catalog." />
              )}
            </div>

            <aside className="space-y-4">
              <AdminInspectorCard title="Issue distribution" description="Most common catalog gaps.">
                <AdminBarList
                  data={Object.entries(report.issueCounts)
                    .map(([key, count]) => ({
                      label: CATALOG_QUALITY_ISSUES[key as CatalogQualityIssueKey].label,
                      value: count,
                      meta: CATALOG_QUALITY_ISSUES[key as CatalogQualityIssueKey].description,
                      tone: count > 0 ? ('warning' as const) : ('success' as const),
                    }))
                    .sort((left, right) => right.value - left.value)}
                />
              </AdminInspectorCard>

              <AdminInspectorCard title="Brand quality score" description="Worst brand groups first.">
                <div className="space-y-3">
                  {report.brandScores.map((brand) => (
                    <div key={brand.brand} className="rounded-none border border-white/10 bg-black/25 px-3 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-zinc-100">{brand.brand}</div>
                          <div className="mt-1 text-xs text-zinc-500">{brand.issueProducts} with issues · {brand.total} total</div>
                        </div>
                        <AdminStatusBadge tone={qualityTone(brand.score)}>{brand.score}%</AdminStatusBadge>
                      </div>
                      {brand.topIssues.length ? (
                        <div className="mt-2 text-xs text-zinc-500">
                          {brand.topIssues.map((issue) => `${CATALOG_QUALITY_ISSUES[issue.key].label}: ${issue.count}`).join(' · ')}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </AdminInspectorCard>
            </aside>
          </div>
        </>
      ) : (
        <AdminEmptyState title="Catalog quality is unavailable" description={error || 'Quality report did not load.'} />
      )}
    </AdminPage>
  );
}

function SelectFilter({
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
        className="w-full rounded-none border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-100 focus:border-white/20 focus:outline-none"
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

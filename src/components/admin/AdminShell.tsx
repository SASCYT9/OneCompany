'use client';

import { useEffect, useId, useMemo, useState, type ReactNode } from 'react';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Archive,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Database,
  DollarSign,
  FileInput,
  FolderTree,
  Image,
  ImagePlus,
  Layers,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Package,
  PackagePlus,
  Receipt,
  Search,
  Settings,
  Shield,
  ShoppingBag,
  Sparkles,
  Tag,
  Truck,
  Users,
  Warehouse,
  Boxes,
} from 'lucide-react';

import {
  ADMIN_NAV_SECTIONS,
  flattenAdminNavItems,
  getActiveAdminNavItem,
  getActiveAdminNavSection,
  isAdminNavItemActive,
  type AdminNavIconKey,
  type AdminNavItemDefinition,
  type AdminNavSectionDefinition,
} from '@/lib/admin/adminNavigation';
import { useAdminCurrency, type AdminCurrency } from '@/lib/admin/currencyContext';
import { cn } from '@/lib/utils';

const iconMap: Record<AdminNavIconKey, React.ComponentType<{ className?: string }>> = {
  dashboard: LayoutDashboard,
  orders: Package,
  customers: Users,
  catalog: ShoppingBag,
  inventory: Boxes,
  categories: FolderTree,
  collections: Tag,
  bundles: PackagePlus,
  media: Image,
  pricing: DollarSign,
  seo: Sparkles,
  imports: FileInput,
  csv: Archive,
  turn14: Layers,
  audit: Database,
  logistics: Warehouse,
  taxes: Receipt,
  content: MessageSquare,
  messages: MessageSquare,
  blog: ImagePlus,
  settings: Settings,
  users: Shield,
  backups: Archive,
  crm: Database,
};

const CURRENCY_OPTIONS: { value: AdminCurrency; label: string; symbol: string }[] = [
  { value: 'EUR', label: 'EUR', symbol: '€' },
  { value: 'USD', label: 'USD', symbol: '$' },
  { value: 'UAH', label: 'UAH', symbol: '₴' },
];

export default function AdminShell({
  children,
  onLogout,
}: {
  children: ReactNode;
  onLogout: () => void | Promise<void>;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [query, setQuery] = useState('');
  const listId = useId();

  useEffect(() => {
    const saved = window.localStorage.getItem('adminSidebarCollapsed');
    if (saved === 'true') {
      setCollapsed(true);
    }
  }, []);

  const activeItem = useMemo(() => getActiveAdminNavItem(pathname), [pathname]);
  const activeSection = useMemo(() => getActiveAdminNavSection(pathname), [pathname]);
  const quickLinks = useMemo(() => flattenAdminNavItems(), []);
  const filteredQuickLinks = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return quickLinks.slice(0, 12);
    }

    return quickLinks.filter((item) =>
      [item.label, item.description, item.sectionLabel, item.href].some((value) => value.toLowerCase().includes(needle))
    );
  }, [quickLinks, query]);

  function toggleCollapsed() {
    setCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem('adminSidebarCollapsed', String(next));
      return next;
    });
  }

  function submitQuickLink() {
    const match = filteredQuickLinks[0];
    if (!match) {
      return;
    }
    setQuery('');
    router.push(match.href);
  }

  return (
    <div className="flex h-[100dvh] bg-[#060606] text-stone-100">
      <aside
        className={cn(
          'relative flex h-full flex-none flex-col border-r border-white/10 bg-[#090909] transition-[width] duration-200',
          collapsed ? 'w-[88px]' : 'w-[320px]'
        )}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
          <AnimatePresence initial={false}>
            {!collapsed ? (
              <motion.div
                key="brand"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                className="space-y-1"
              >
                <div className="text-[11px] font-medium uppercase tracking-[0.24em] text-amber-100/55">OneCompany</div>
                <div className="text-sm font-semibold tracking-[0.12em] text-stone-50">Admin Ops</div>
              </motion.div>
            ) : (
              <motion.div
                key="mark"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-xs font-semibold uppercase tracking-[0.24em]"
              >
                OC
              </motion.div>
            )}
          </AnimatePresence>
          <button
            type="button"
            onClick={toggleCollapsed}
            className="flex h-9 w-9 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-stone-400 transition hover:text-stone-100"
            aria-label={collapsed ? 'Expand admin navigation' : 'Collapse admin navigation'}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
          {ADMIN_NAV_SECTIONS.map((section) => (
            <AdminSidebarSection
              key={section.key}
              collapsed={collapsed}
              pathname={pathname}
              section={section}
            />
          ))}
        </nav>

        <div className="border-t border-white/10 px-3 py-4">
          <AdminCurrencySwitcher collapsed={collapsed} />
          <button
            type="button"
            onClick={() => void onLogout()}
            className={cn(
              'mt-3 flex w-full items-center gap-3 rounded-2xl border border-red-500/20 bg-red-950/20 px-3 py-2.5 text-sm text-red-200 transition hover:bg-red-950/35',
              collapsed && 'justify-center'
            )}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!collapsed ? <span>Log out</span> : null}
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-white/10 bg-[#090909]/90 px-4 py-4 backdrop-blur md:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-stone-500">
                {activeSection?.label ?? 'Admin'}
              </div>
              <div className="text-sm text-stone-200">
                {activeItem?.label ?? 'Internal operations'}
                {activeItem?.description ? <span className="text-stone-500"> · {activeItem.description}</span> : null}
              </div>
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                submitQuickLink();
              }}
              className="flex min-w-[320px] max-w-[520px] flex-1 items-center gap-2 rounded-2xl border border-white/10 bg-[#111111] px-3 py-2.5"
            >
              <Search className="h-4 w-4 text-stone-500" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                list={listId}
                placeholder="Jump to a page…"
                className="w-full bg-transparent text-sm text-stone-100 placeholder:text-stone-500 focus:outline-none"
              />
              <button
                type="submit"
                className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-[11px] uppercase tracking-[0.18em] text-stone-300 transition hover:text-stone-50"
              >
                Open
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
              <datalist id={listId}>
                {quickLinks.map((item) => (
                  <option key={item.href} value={item.label}>
                    {item.sectionLabel} · {item.href}
                  </option>
                ))}
              </datalist>
            </form>
          </div>
          {query.trim() ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {filteredQuickLinks.slice(0, 6).map((item) => (
                <button
                  key={item.href}
                  type="button"
                  onClick={() => {
                    setQuery('');
                    router.push(item.href);
                  }}
                  className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-stone-300 transition hover:bg-white/[0.06] hover:text-stone-100"
                >
                  {item.sectionLabel} · {item.label}
                </button>
              ))}
            </div>
          ) : null}
        </header>

        <main className="min-h-0 flex-1 overflow-auto bg-[radial-gradient(circle_at_top,_rgba(245,240,232,0.04),_transparent_28%),linear-gradient(180deg,#0b0b0b_0%,#060606_100%)]">
          {children}
        </main>
      </div>
    </div>
  );
}

function AdminSidebarSection({
  section,
  pathname,
  collapsed,
}: {
  section: AdminNavSectionDefinition;
  pathname: string;
  collapsed: boolean;
}) {
  const hasActiveItem = section.items.some((item) => isAdminNavItemActive(pathname, item));

  return (
    <section className="space-y-2">
      {!collapsed ? (
        <div className="px-2">
          <div className={cn('text-[11px] font-medium uppercase tracking-[0.18em]', hasActiveItem ? 'text-amber-100/65' : 'text-stone-500')}>
            {section.label}
          </div>
          <div className="mt-1 text-xs leading-5 text-stone-500">{section.description}</div>
        </div>
      ) : (
        <div className="mx-3 border-t border-white/10" />
      )}

      <div className="space-y-1">
        {section.items.map((item) => (
          <AdminSidebarItem key={item.href} collapsed={collapsed} pathname={pathname} item={item} />
        ))}
      </div>
    </section>
  );
}

function AdminSidebarItem({
  item,
  pathname,
  collapsed,
}: {
  item: AdminNavItemDefinition;
  pathname: string;
  collapsed: boolean;
}) {
  const Icon = iconMap[item.icon];
  const active = isAdminNavItemActive(pathname, item);

  return (
    <Link
      href={item.href}
      title={collapsed ? item.label : undefined}
      className={cn(
        'group relative flex items-center gap-3 rounded-2xl border px-3 py-3 transition',
        collapsed && 'justify-center px-2',
        active
          ? 'border-amber-100/15 bg-amber-100/[0.06] text-stone-50'
          : 'border-transparent text-stone-400 hover:border-white/10 hover:bg-white/[0.03] hover:text-stone-100'
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {!collapsed ? (
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{item.label}</span>
          <span className="block truncate text-xs text-stone-500">{item.description}</span>
        </span>
      ) : null}
    </Link>
  );
}

function AdminCurrencySwitcher({ collapsed }: { collapsed: boolean }) {
  const { currency, setCurrency, rates, ratesLoading } = useAdminCurrency();

  if (collapsed) {
    const currentIndex = CURRENCY_OPTIONS.findIndex((option) => option.value === currency);
    const nextIndex = (currentIndex + 1) % CURRENCY_OPTIONS.length;
    const next = CURRENCY_OPTIONS[nextIndex];

    return (
      <button
        type="button"
        onClick={() => setCurrency(next.value)}
        className="flex w-full items-center justify-center rounded-2xl border border-amber-100/15 bg-amber-100/[0.06] px-3 py-2.5 text-sm text-amber-100"
        title={`Switch currency from ${currency}`}
      >
        {CURRENCY_OPTIONS.find((option) => option.value === currency)?.symbol ?? currency}
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-2">
      <div className="grid grid-cols-3 gap-2">
        {CURRENCY_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setCurrency(option.value)}
            className={cn(
              'rounded-xl border px-2 py-2 text-xs font-medium uppercase tracking-[0.18em] transition',
              currency === option.value
                ? 'border-amber-100/15 bg-amber-100/[0.06] text-amber-100'
                : 'border-white/10 bg-transparent text-stone-400 hover:text-stone-100'
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
      {!ratesLoading && rates.updatedAt ? (
        <div className="mt-2 text-center text-[11px] text-stone-500">
          1$ = {rates.USD.toFixed(1)}₴ · 1€ = {rates.EUR.toFixed(1)}₴
        </div>
      ) : null}
    </div>
  );
}

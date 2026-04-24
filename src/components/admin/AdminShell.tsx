'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';

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

type GlobalSearchResponse = {
  total: number;
  results: {
    orders: Array<{
      id: string;
      orderNumber: string;
      customerName: string;
      email: string;
      status: string;
      paymentStatus: string;
      total: number;
      outstandingAmount: number;
      currency: string;
    }>;
    products: Array<{
      id: string;
      slug: string;
      sku: string | null;
      brand: string | null;
      titleUa: string;
      titleEn: string;
      status: string;
      stock: string;
    }>;
    customers: Array<{
      id: string;
      email: string;
      firstName: string;
      lastName: string;
      companyName: string | null;
      group: string;
      isActive: boolean;
    }>;
    turn14: Array<{
      id: string;
      partNumber: string;
      mfrPartNumber: string | null;
      productName: string;
      brand: string;
      dealerPrice: number | null;
      retailPrice: number | null;
      weight: number | null;
    }>;
  };
};

const EMPTY_SEARCH: GlobalSearchResponse = {
  total: 0,
  results: { orders: [], products: [], customers: [], turn14: [] },
};

const COMMAND_ACTIONS = [
  {
    href: '/admin/shop/orders/create',
    label: 'Create B2B order',
    description: 'Manual order from local or Turn14 stock',
    icon: PackagePlus,
  },
  {
    href: '/admin/shop/feed',
    label: 'Open Feed',
    description: 'Distributor export links and previews',
    icon: Archive,
  },
  {
    href: '/admin/shop/turn14',
    label: 'Turn14 stock check',
    description: 'Supplier catalog and stock workflow',
    icon: Truck,
  },
  {
    href: '/admin/shop/import',
    label: 'Import CSV',
    description: 'Catalog import and validation tools',
    icon: FileInput,
  },
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
  const [globalSearch, setGlobalSearch] = useState<GlobalSearchResponse>(EMPTY_SEARCH);
  const [globalSearchLoading, setGlobalSearchLoading] = useState(false);

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

  useEffect(() => {
    const needle = query.trim();
    if (needle.length < 2) {
      setGlobalSearch(EMPTY_SEARCH);
      setGlobalSearchLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      setGlobalSearchLoading(true);
      fetch(`/api/admin/search?q=${encodeURIComponent(needle)}`, {
        cache: 'no-store',
        signal: controller.signal,
      })
        .then(async (response) => {
          if (!response.ok) {
            return EMPTY_SEARCH;
          }
          return (await response.json()) as GlobalSearchResponse;
        })
        .then((data) => {
          setGlobalSearch(data);
        })
        .catch((error) => {
          if ((error as Error).name !== 'AbortError') {
            setGlobalSearch(EMPTY_SEARCH);
          }
        })
        .finally(() => {
          setGlobalSearchLoading(false);
        });
    }, 180);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [query]);

  function toggleCollapsed() {
    setCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem('adminSidebarCollapsed', String(next));
      return next;
    });
  }

  function submitQuickLink() {
    const entityHref = getFirstSearchHref(globalSearch);
    const match = filteredQuickLinks[0]?.href;
    const href = entityHref ?? match;
    if (!href) {
      return;
    }
    setQuery('');
    router.push(href);
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

            <div className="relative min-w-[320px] max-w-[640px] flex-1">
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  submitQuickLink();
                }}
                className="flex items-center gap-2 rounded-2xl border border-white/10 bg-[#111111] px-3 py-2.5"
              >
                <Search className="h-4 w-4 text-stone-500" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search orders, products, customers, SKU, email..."
                  className="w-full bg-transparent text-sm text-stone-100 placeholder:text-stone-500 focus:outline-none"
                />
                <button
                  type="submit"
                  className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-[11px] uppercase tracking-[0.18em] text-stone-300 transition hover:text-stone-50"
                >
                  Open
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </form>
              <CommandCenterResults
                query={query}
                loading={globalSearchLoading}
                search={globalSearch}
                quickLinks={filteredQuickLinks}
                onNavigate={(href) => {
                  setQuery('');
                  router.push(href);
                }}
              />
            </div>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-auto bg-[radial-gradient(circle_at_top,_rgba(245,240,232,0.04),_transparent_28%),linear-gradient(180deg,#0b0b0b_0%,#060606_100%)]">
          {children}
        </main>
      </div>
    </div>
  );
}

function getFirstSearchHref(search: GlobalSearchResponse) {
  const order = search.results.orders[0];
  if (order) return `/admin/shop/orders/${order.id}`;

  const product = search.results.products[0];
  if (product) return `/admin/shop/${product.id}`;

  const customer = search.results.customers[0];
  if (customer) return `/admin/shop/customers/${customer.id}`;

  if (search.results.turn14[0]) return '/admin/shop/turn14';

  return null;
}

function commandMoney(value: number, currency: string) {
  return new Intl.NumberFormat('uk-UA', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function CommandCenterResults({
  query,
  loading,
  search,
  quickLinks,
  onNavigate,
}: {
  query: string;
  loading: boolean;
  search: GlobalSearchResponse;
  quickLinks: AdminNavItemDefinition[];
  onNavigate: (href: string) => void;
}) {
  const trimmed = query.trim();
  if (!trimmed) return null;

  return (
    <div className="absolute right-0 z-30 mt-2 w-full overflow-hidden rounded-[24px] border border-white/10 bg-[#0b0b0b] shadow-2xl shadow-black/50">
      <div className="grid gap-0 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="border-b border-white/10 p-3 lg:border-b-0 lg:border-r">
          <div className="mb-2 flex items-center justify-between px-1 text-[11px] uppercase tracking-[0.18em] text-stone-500">
            <span>Command Center</span>
            <span>{loading ? 'Searching...' : `${search.total} results`}</span>
          </div>

          <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
            <SearchGroup title="Orders">
              {search.results.orders.map((order) => (
                <SearchResultButton
                  key={order.id}
                  title={`${order.orderNumber} · ${order.customerName}`}
                  meta={`${order.paymentStatus} · Outstanding ${commandMoney(order.outstandingAmount, order.currency)}`}
                  badge={order.status.replace(/_/g, ' ')}
                  onClick={() => onNavigate(`/admin/shop/orders/${order.id}`)}
                />
              ))}
            </SearchGroup>

            <SearchGroup title="Products">
              {search.results.products.map((product) => (
                <SearchResultButton
                  key={product.id}
                  title={product.titleEn || product.titleUa}
                  meta={[product.brand, product.sku || product.slug, product.stock].filter(Boolean).join(' · ')}
                  badge={product.status}
                  onClick={() => onNavigate(`/admin/shop/${product.id}`)}
                />
              ))}
            </SearchGroup>

            <SearchGroup title="Customers">
              {search.results.customers.map((customer) => (
                <SearchResultButton
                  key={customer.id}
                  title={`${customer.firstName} ${customer.lastName}`.trim() || customer.email}
                  meta={[customer.companyName, customer.email].filter(Boolean).join(' · ')}
                  badge={customer.group.replace(/_/g, ' ')}
                  onClick={() => onNavigate(`/admin/shop/customers/${customer.id}`)}
                />
              ))}
            </SearchGroup>

            <SearchGroup title="Turn14">
              {search.results.turn14.map((item) => (
                <SearchResultButton
                  key={item.id}
                  title={item.productName}
                  meta={[item.brand, item.partNumber, item.mfrPartNumber].filter(Boolean).join(' · ')}
                  badge={item.weight != null ? `${item.weight} lb` : 'catalog'}
                  onClick={() => onNavigate('/admin/shop/turn14')}
                />
              ))}
            </SearchGroup>

            {!loading && search.total === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-4 text-sm text-stone-500">
                No entity matches. Use quick actions or page shortcuts.
              </div>
            ) : null}
          </div>
        </div>

        <div className="space-y-3 p-3">
          <div>
            <div className="mb-2 px-1 text-[11px] uppercase tracking-[0.18em] text-stone-500">Quick actions</div>
            <div className="grid gap-2">
              {COMMAND_ACTIONS.map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.href}
                    type="button"
                    onClick={() => onNavigate(action.href)}
                    className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-left transition hover:bg-white/[0.06]"
                  >
                    <Icon className="h-4 w-4 text-amber-100/75" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-stone-100">{action.label}</span>
                      <span className="block truncate text-xs text-stone-500">{action.description}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="mb-2 px-1 text-[11px] uppercase tracking-[0.18em] text-stone-500">Page shortcuts</div>
            <div className="flex flex-wrap gap-2">
              {quickLinks.slice(0, 8).map((item) => (
                <button
                  key={item.href}
                  type="button"
                  onClick={() => onNavigate(item.href)}
                  className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-stone-300 transition hover:bg-white/[0.06] hover:text-stone-100"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SearchGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-1.5">
      <div className="px-1 text-[11px] uppercase tracking-[0.18em] text-stone-600">{title}</div>
      <div className="space-y-1.5">{children}</div>
    </section>
  );
}

function SearchResultButton({
  title,
  meta,
  badge,
  onClick,
}: {
  title: string;
  meta: string;
  badge: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-left transition hover:bg-amber-100/[0.06]"
    >
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-stone-100">{title}</span>
        <span className="mt-0.5 block truncate text-xs text-stone-500">{meta}</span>
      </span>
      <span className="shrink-0 rounded-full border border-white/10 bg-black/30 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-stone-400">
        {badge}
      </span>
    </button>
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

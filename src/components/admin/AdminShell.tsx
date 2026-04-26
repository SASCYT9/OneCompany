'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Archive,
  ArrowRight,
  Bell,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Keyboard,
  Database,
  DollarSign,
  FileInput,
  FolderTree,
  Image as ImageIcon,
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
  Menu,
  Plug,
  Tag,
  Truck,
  X as XIcon,
  Undo2,
  Users,
  UsersRound,
  Warehouse,
  Boxes,
  FileText,
  Mail,
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
  media: ImageIcon,
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
  tag: Tag,
  returns: Undo2,
  drafts: FileText,
  email: Mail,
  segments: UsersRound,
  integrations: Plug,
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
    label: 'Створити B2B замовлення',
    description: 'Ручне замовлення з місцевого або Turn14 складу',
    icon: PackagePlus,
  },
  {
    href: '/admin/shop/feed',
    label: 'Відкрити фіди',
    description: 'Експорт-посилання дистриб’юторів та попередній перегляд',
    icon: Archive,
  },
  {
    href: '/admin/shop/turn14',
    label: 'Перевірка залишків Turn14',
    description: 'Каталог постачальника та робочий процес залишків',
    icon: Truck,
  },
  {
    href: '/admin/shop/import',
    label: 'Імпорт CSV',
    description: 'Інструменти імпорту каталогу та валідації',
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
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [globalSearch, setGlobalSearch] = useState<GlobalSearchResponse>(EMPTY_SEARCH);
  const [globalSearchLoading, setGlobalSearchLoading] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Array<{ id: string; tone: 'red' | 'amber' | 'green'; label: string; detail: string; href: string }>>([]);
  const notifCount = notifications.filter((n) => n.tone === 'red' || n.tone === 'amber').length;

  useEffect(() => {
    const saved = window.localStorage.getItem('adminSidebarCollapsed');
    if (saved === 'true') setCollapsed(true);
  }, []);

  // Fetch notifications from dashboard API
  useEffect(() => {
    fetch('/api/admin/dashboard?period=monthly', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        const items: Array<{ id: string; tone: 'red' | 'amber' | 'green'; label: string; detail: string; href: string }> = [];
        for (const risk of data.system?.operationalRisks ?? []) {
          if (!risk.count) continue;
          items.push({
            id: risk.id,
            tone: risk.severity === 'danger' ? 'red' : risk.severity === 'warning' ? 'amber' : 'green',
            label: risk.label,
            detail: `${risk.count} item${risk.count === 1 ? '' : 's'} · ${risk.description}`,
            href: risk.href,
          });
        }
        setNotifications(items.slice(0, 8));
      })
      .catch(() => {});
  }, [pathname]);

  // Keyboard shortcuts: Cmd+K, ?, g+o, g+p, g+c
  useEffect(() => {
    let lastG = 0;
    function handler(event: KeyboardEvent) {
      // Skip when typing in inputs
      const target = event.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        const input = document.getElementById('admin-global-search') as HTMLInputElement | null;
        input?.focus();
        return;
      }

      if (isInput) return;

      if (event.key === '?' || (event.shiftKey && event.key === '/')) {
        event.preventDefault();
        setShortcutsOpen((v) => !v);
        return;
      }

      if (event.key === 'Escape') {
        setShortcutsOpen(false);
        setBellOpen(false);
        return;
      }

      // Linear-style chord shortcuts: g + letter within 1500ms
      if (event.key === 'g') {
        lastG = Date.now();
        return;
      }
      if (Date.now() - lastG < 1500 && !event.metaKey && !event.ctrlKey && !event.altKey) {
        const map: Record<string, string> = {
          d: '/admin',
          o: '/admin/shop/orders',
          p: '/admin/shop',
          c: '/admin/shop/customers',
          i: '/admin/shop/inventory',
          s: '/admin/settings',
          t: '/admin/shop/turn14',
        };
        const route = map[event.key.toLowerCase()];
        if (route) {
          event.preventDefault();
          router.push(route);
          lastG = 0;
        }
      }
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [router]);

  // Close popovers on outside click
  useEffect(() => {
    function onClick(e: MouseEvent) {
      const t = e.target as HTMLElement;
      if (!t.closest('[data-bell-popover]') && !t.closest('[data-bell-trigger]')) {
        setBellOpen(false);
      }
    }
    if (bellOpen) document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [bellOpen]);

  const activeItem = useMemo(() => getActiveAdminNavItem(pathname), [pathname]);
  const activeSection = useMemo(() => getActiveAdminNavSection(pathname), [pathname]);
  const quickLinks = useMemo(() => flattenAdminNavItems(), []);
  const filteredQuickLinks = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return quickLinks.slice(0, 12);
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
      fetch(`/api/admin/search?q=${encodeURIComponent(needle)}`, { cache: 'no-store', signal: controller.signal })
        .then(async (response) => {
          if (!response.ok) return EMPTY_SEARCH;
          return (await response.json()) as GlobalSearchResponse;
        })
        .then((data) => setGlobalSearch(data))
        .catch((error) => {
          if ((error as Error).name !== 'AbortError') setGlobalSearch(EMPTY_SEARCH);
        })
        .finally(() => setGlobalSearchLoading(false));
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

  // Auto-close mobile drawer on route change
  useEffect(() => {
    setMobileDrawerOpen(false);
  }, [pathname]);

  // Lock body scroll when drawer open
  useEffect(() => {
    if (!mobileDrawerOpen) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, [mobileDrawerOpen]);

  // Escape closes drawer
  useEffect(() => {
    if (!mobileDrawerOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMobileDrawerOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileDrawerOpen]);

  function submitQuickLink() {
    const entityHref = getFirstSearchHref(globalSearch);
    const match = filteredQuickLinks[0]?.href;
    const href = entityHref ?? match;
    if (!href) return;
    setQuery('');
    router.push(href);
  }

  return (
    <div className="flex h-[100dvh] bg-[#0A0A0A] text-zinc-100">
      {/* Skip link */}
      <a
        href="#admin-main-content"
        className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:left-4 focus-visible:top-4 focus-visible:z-[100] focus-visible:rounded-lg focus-visible:border focus-visible:border-blue-500/40 focus-visible:bg-[#171717] focus-visible:px-4 focus-visible:py-2.5 focus-visible:text-sm focus-visible:font-semibold focus-visible:text-blue-300 focus-visible:shadow-[0_8px_24px_rgba(0,0,0,0.6)] focus-visible:outline-none"
      >
        Перейти до основного вмісту
      </a>

      {/* Mobile drawer backdrop */}
      {mobileDrawerOpen ? (
        <div
          onClick={() => setMobileDrawerOpen(false)}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          aria-hidden="true"
        />
      ) : null}

      <aside
        className={cn(
          'flex h-full flex-none flex-col border-r border-white/[0.05] bg-[#0F0F0F] transition-all duration-200',
          // Desktop: always visible, width changes based on collapsed
          'lg:relative lg:translate-x-0',
          collapsed ? 'lg:w-[80px]' : 'lg:w-[240px]',
          // Mobile: fixed drawer, slide in from left
          'fixed inset-y-0 left-0 z-50 w-[280px]',
          mobileDrawerOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0'
        )}
        aria-label="Primary navigation"
      >
        {/* Brand — ONE COMPANY logo */}
        <div className="flex items-center justify-between px-5 py-5">
          {/* Full logo: always visible on mobile, only when not collapsed on desktop */}
          <Link
            href="/admin"
            className={cn('block', collapsed ? 'lg:hidden' : 'lg:block')}
            aria-label="OneCompany Admin home"
          >
            <Image
              src="/branding/logo-light.svg"
              alt="OneCompany"
              width={140}
              height={36}
              className="h-9 w-auto"
              priority
            />
          </Link>
          {/* Collapsed mark: only on desktop when collapsed */}
          {collapsed ? (
            <Link
              href="/admin"
              className="mx-auto hidden h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold tracking-tight text-white lg:flex"
              aria-label="OneCompany Admin home"
            >
              OC
            </Link>
          ) : null}
          <div className="flex items-center gap-1">
            {/* Mobile close button */}
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(false)}
              aria-label="Закрити навігацію"
              className="flex h-9 w-9 items-center justify-center rounded-md text-zinc-500 transition hover:bg-white/[0.04] hover:text-zinc-200 lg:hidden"
            >
              <XIcon className="h-4 w-4" />
            </button>
            {/* Desktop collapse button */}
            {!collapsed ? (
              <button
                type="button"
                onClick={toggleCollapsed}
                aria-label="Згорнути навігацію"
                className="hidden h-7 w-7 items-center justify-center rounded-md text-zinc-500 transition hover:bg-white/[0.04] hover:text-zinc-200 lg:flex"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </div>

        {collapsed ? (
          <div className="px-3 pb-2">
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-label="Розгорнути навігацію"
              className="flex h-7 w-full items-center justify-center rounded-md text-zinc-500 transition hover:bg-white/[0.04] hover:text-zinc-200"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        ) : null}

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-2 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/10">
          {ADMIN_NAV_SECTIONS.map((section) => (
            <AdminSidebarSection key={section.key} collapsed={collapsed} pathname={pathname} section={section} />
          ))}
        </nav>

        {/* Hero card — real Mansory photo (matches reference) */}
        {!collapsed ? (
          <div className="mx-3 mb-3 mt-2 overflow-hidden rounded-xl border border-white/[0.05] bg-[#0F0F0F]">
            <div className="relative h-32 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/hero-auto.jpg"
                alt="Premium automotive distributor"
                loading="lazy"
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0F0F0F] via-transparent to-transparent" />
            </div>
            <div className="border-t border-white/[0.04] px-4 py-3">
              <div className="flex items-center gap-2 text-[11px] font-medium text-blue-400">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.7)] motion-safe:animate-pulse" />
                onecompany.global
              </div>
              <div className="mt-1 text-[11px] leading-4 text-zinc-500">
                Premium Automotive Performance &amp; Styling Distributor
              </div>
            </div>
          </div>
        ) : null}

        <div className="border-t border-white/[0.05] px-3 py-3">
          <AdminCurrencySwitcher collapsed={collapsed} />
          <button
            type="button"
            onClick={() => void onLogout()}
            className={cn(
              'mt-2 flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-zinc-400 transition hover:bg-red-500/[0.06] hover:text-red-300',
              collapsed && 'justify-center px-0'
            )}
          >
            <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
            {!collapsed ? <span>Вийти</span> : null}
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="relative z-30 border-b border-white/[0.05] bg-[#0A0A0A]/85 px-3 py-3 backdrop-blur-xl sm:px-6 sm:py-3.5">
          <div className="flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(true)}
              aria-label="Відкрити навігацію"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-white/[0.04] hover:text-zinc-100 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="relative min-w-0 max-w-[640px] flex-1">
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  submitQuickLink();
                }}
                className={cn(
                  'flex items-center gap-2 rounded-lg border bg-[#171717] px-3.5 py-2 transition-all',
                  searchFocused ? 'border-blue-500/40 shadow-[0_0_0_4px_rgba(59,130,246,0.08)]' : 'border-white/[0.06] hover:border-white/15'
                )}
              >
                <Search className="h-4 w-4 text-zinc-500" aria-hidden="true" />
                <input
                  id="admin-global-search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setSearchFocused(false)}
                  placeholder="Пошук…"
                  className="w-full bg-transparent text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none"
                />
                <kbd className="hidden items-center gap-0.5 rounded border border-white/[0.08] bg-black/40 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500 sm:inline-flex">
                  ⌘K
                </kbd>
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

            <div className="flex shrink-0 items-center gap-2">
              {/* Keyboard shortcuts hint button */}
              <button
                type="button"
                onClick={() => setShortcutsOpen(true)}
                aria-label="Гарячі клавіші"
                title="Натисніть ? щоб показати гарячі клавіші"
                className="hidden h-9 w-9 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-white/[0.04] hover:text-zinc-100 md:flex"
              >
                <Keyboard className="h-[18px] w-[18px]" aria-hidden="true" />
              </button>

              {/* Notification bell with dropdown */}
              <div className="relative">
                <button
                  type="button"
                  data-bell-trigger
                  onClick={() => setBellOpen((v) => !v)}
                  aria-label={`${notifCount} notification${notifCount === 1 ? '' : 's'}`}
                  aria-expanded={bellOpen}
                  className="relative flex h-9 w-9 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-white/[0.04] hover:text-zinc-100"
                >
                  <Bell className="h-[18px] w-[18px]" aria-hidden="true" />
                  {notifCount > 0 ? (
                    <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full border-2 border-[#0A0A0A] bg-red-500 px-1 text-[9px] font-bold leading-none text-white">
                      {notifCount > 9 ? '9+' : notifCount}
                    </span>
                  ) : null}
                </button>

                {bellOpen ? (
                  <div
                    data-bell-popover
                    className="absolute right-0 z-50 mt-2 w-[360px] overflow-hidden rounded-xl border border-white/[0.08] bg-[#171717] shadow-[0_30px_80px_rgba(0,0,0,0.6)]"
                  >
                    <div className="flex items-center justify-between border-b border-white/[0.04] px-4 py-3">
                      <span className="text-sm font-semibold text-zinc-100">Сповіщення</span>
                      {notifCount > 0 ? (
                        <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-bold text-red-300">
                          {notifCount} нових
                        </span>
                      ) : null}
                    </div>
                    <ul className="max-h-[420px] overflow-y-auto">
                      {notifications.length === 0 ? (
                        <li className="px-4 py-8 text-center text-sm text-zinc-500">Все спокійно. Активних проблем немає.</li>
                      ) : (
                        notifications.map((n) => (
                          <li key={n.id}>
                            <Link
                              href={n.href}
                              onClick={() => setBellOpen(false)}
                              className="flex items-start gap-3 border-b border-white/[0.03] px-4 py-3 transition last:border-0 hover:bg-white/[0.02]"
                            >
                              <span
                                className={cn(
                                  'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                                  n.tone === 'red' && 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.7)]',
                                  n.tone === 'amber' && 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.7)]',
                                  n.tone === 'green' && 'bg-green-500'
                                )}
                                aria-hidden="true"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="text-sm font-medium text-zinc-100">{n.label}</div>
                                <div className="mt-0.5 line-clamp-2 text-xs text-zinc-500">{n.detail}</div>
                              </div>
                            </Link>
                          </li>
                        ))
                      )}
                    </ul>
                    {notifications.length > 0 ? (
                      <div className="border-t border-white/[0.04] px-4 py-2.5">
                        <Link
                          href="/admin"
                          onClick={() => setBellOpen(false)}
                          className="block text-center text-xs font-medium text-blue-400 hover:text-blue-300"
                        >
                          Переглянути все в дашборді →
                        </Link>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>

              {/* User profile chip */}
              <button
                type="button"
                aria-label="Меню користувача"
                className="ml-1 flex items-center gap-2.5 rounded-lg border border-white/[0.05] bg-[#171717] px-2 py-1.5 transition hover:bg-[#1F1F1F]"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-[11px] font-semibold text-white">
                  OC
                </div>
                <div className="hidden flex-col items-start leading-tight md:flex">
                  <span className="whitespace-nowrap text-[12px] font-semibold text-zinc-100">Адмін</span>
                  <span className="whitespace-nowrap text-[10px] text-zinc-500">Керівник</span>
                </div>
                <ChevronDown className="hidden h-3.5 w-3.5 text-zinc-500 md:block" aria-hidden="true" />
              </button>
            </div>
          </div>
        </header>

        <main
          id="admin-main-content"
          tabIndex={-1}
          className="relative min-h-0 flex-1 overflow-auto bg-[#0A0A0A] focus-visible:outline-none"
        >
          {children}
        </main>
      </div>

      {/* Keyboard shortcuts help overlay */}
      {shortcutsOpen ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShortcutsOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Keyboard shortcuts"
        >
          <div
            className="w-full max-w-[520px] overflow-hidden rounded-xl border border-white/[0.08] bg-[#171717] shadow-[0_30px_80px_rgba(0,0,0,0.7)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/[0.05] px-5 py-3.5">
              <div className="flex items-center gap-2.5">
                <Keyboard className="h-4 w-4 text-blue-400" aria-hidden="true" />
                <span className="text-sm font-semibold text-zinc-100">Гарячі клавіші</span>
              </div>
              <button
                type="button"
                onClick={() => setShortcutsOpen(false)}
                className="rounded-md p-1 text-zinc-500 transition hover:bg-white/[0.04] hover:text-zinc-100"
                aria-label="Закрити"
              >
                <ChevronDown className="h-4 w-4 rotate-180" aria-hidden="true" />
              </button>
            </div>
            <div className="grid grid-cols-1 gap-x-8 gap-y-3 p-5 sm:grid-cols-2">
              <ShortcutGroup title="Пошук">
                <ShortcutRow keys={['⌘', 'K']} label="Командний центр" />
                <ShortcutRow keys={['?']} label="Ця довідка" />
                <ShortcutRow keys={['Esc']} label="Закрити попап" />
              </ShortcutGroup>
              <ShortcutGroup title="Навігація">
                <ShortcutRow keys={['G', 'D']} label="Дашборд" />
                <ShortcutRow keys={['G', 'O']} label="Замовлення" />
                <ShortcutRow keys={['G', 'P']} label="Товари" />
                <ShortcutRow keys={['G', 'C']} label="Клієнти" />
                <ShortcutRow keys={['G', 'I']} label="Склад" />
                <ShortcutRow keys={['G', 'T']} label="Turn14" />
                <ShortcutRow keys={['G', 'S']} label="Налаштування" />
              </ShortcutGroup>
            </div>
            <div className="border-t border-white/[0.05] bg-black/30 px-5 py-2.5 text-[11px] text-zinc-500">
              Натисніть{' '}
              <kbd className="rounded border border-white/[0.1] bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10px]">G</kbd>{' '}
              а потім літеру протягом 1.5 секунди.
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ShortcutGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{title}</div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function ShortcutRow({ keys, label }: { keys: string[]; label: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <span className="text-sm text-zinc-300">{label}</span>
      <div className="flex shrink-0 items-center gap-1">
        {keys.map((k, i) => (
          <kbd
            key={i}
            className="inline-flex h-5 min-w-[20px] items-center justify-center rounded border border-white/[0.1] bg-white/[0.04] px-1.5 font-mono text-[10px] font-medium text-zinc-300"
          >
            {k}
          </kbd>
        ))}
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
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      className="absolute right-0 z-30 mt-2 w-full overflow-hidden rounded-xl border border-white/[0.08] bg-[#171717]/95 shadow-[0_30px_80px_rgba(0,0,0,0.6)] backdrop-blur-xl"
    >
      <div className="grid gap-0 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="border-b border-white/[0.05] p-3 lg:border-b-0 lg:border-r">
          <div className="mb-2 flex items-center justify-between px-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            <span className="text-blue-400">Командний центр</span>
            <span>{loading ? 'Пошук…' : `Результатів: ${search.total}`}</span>
          </div>

          <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1 [scrollbar-width:thin]">
            <SearchGroup title="Замовлення">
              {search.results.orders.map((order) => (
                <SearchResultButton
                  key={order.id}
                  title={`${order.orderNumber} · ${order.customerName}`}
                  meta={`${order.paymentStatus} · Заборгованість ${commandMoney(order.outstandingAmount, order.currency)}`}
                  badge={order.status.replace(/_/g, ' ')}
                  onClick={() => onNavigate(`/admin/shop/orders/${order.id}`)}
                />
              ))}
            </SearchGroup>

            <SearchGroup title="Товари">
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

            <SearchGroup title="Клієнти">
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
                  badge={item.weight != null ? `${item.weight} lb` : 'каталог'}
                  onClick={() => onNavigate('/admin/shop/turn14')}
                />
              ))}
            </SearchGroup>

            {!loading && search.total === 0 ? (
              <div className="rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-4 text-sm text-zinc-500">
                Збігів не знайдено. Спробуйте швидкі дії або сторінки нижче.
              </div>
            ) : null}
          </div>
        </div>

        <div className="space-y-3 p-3">
          <div>
            <div className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-blue-400">Швидкі дії</div>
            <div className="grid gap-2">
              {COMMAND_ACTIONS.map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.href}
                    type="button"
                    onClick={() => onNavigate(action.href)}
                    className="group flex items-center gap-3 rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-2.5 text-left transition hover:border-blue-500/25 hover:bg-blue-500/[0.04]"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600/15 transition group-hover:bg-blue-600/25">
                      <Icon className="h-4 w-4 text-blue-400" aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-zinc-100">{action.label}</span>
                      <span className="block truncate text-xs text-zinc-500">{action.description}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Швидкі переходи</div>
            <div className="flex flex-wrap gap-1.5">
              {quickLinks.slice(0, 8).map((item) => (
                <button
                  key={item.href}
                  type="button"
                  onClick={() => onNavigate(item.href)}
                  className="rounded-full border border-white/[0.06] bg-white/[0.02] px-3 py-1.5 text-xs text-zinc-300 transition hover:border-blue-500/25 hover:bg-blue-500/[0.04] hover:text-blue-300"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function SearchGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-1.5">
      <div className="px-1 text-[10px] font-medium uppercase tracking-wider text-zinc-600">{title}</div>
      <div className="space-y-1">{children}</div>
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
      className="group flex w-full items-center justify-between gap-3 rounded-lg border border-white/[0.05] bg-white/[0.015] px-3 py-2.5 text-left transition hover:border-blue-500/25 hover:bg-blue-500/[0.04]"
    >
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-zinc-100 group-hover:text-blue-300">{title}</span>
        <span className="mt-0.5 block truncate text-xs text-zinc-500">{meta}</span>
      </span>
      <span className="shrink-0 rounded-full border border-white/[0.08] bg-black/40 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-zinc-400">
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
  return (
    <section className="space-y-1">
      {!collapsed ? (
        <div className="px-3 pt-2">
          <div className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">{section.label}</div>
        </div>
      ) : (
        <div className="mx-4 my-2 h-px bg-white/[0.05]" />
      )}

      <div className="space-y-0.5">
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
      aria-current={active ? 'page' : undefined}
      aria-label={collapsed ? item.label : undefined}
      className={cn(
        'group relative flex items-center gap-3 rounded-lg px-3 py-2 transition-all duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F0F0F]',
        collapsed && 'justify-center px-2',
        active
          ? 'bg-blue-600 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_1px_2px_rgba(0,0,0,0.3)]'
          : 'text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-100'
      )}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      {!collapsed ? <span className="truncate text-sm font-medium">{item.label}</span> : null}
    </Link>
  );
}

function SidebarHeroCar() {
  return (
    <div className="relative h-full w-full">
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(circle at 50% 100%, rgba(59,130,246,0.22), transparent 60%)',
        }}
      />
      <svg viewBox="0 0 200 110" className="absolute bottom-0 h-full w-full" preserveAspectRatio="xMidYEnd meet" aria-hidden="true">
        <defs>
          <linearGradient id="oc-sidebar-car-body" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#27272A" />
            <stop offset="60%" stopColor="#18181B" />
            <stop offset="100%" stopColor="#09090B" />
          </linearGradient>
          <linearGradient id="oc-sidebar-car-window" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="rgb(59 130 246)" stopOpacity="0.45" />
            <stop offset="100%" stopColor="rgb(59 130 246)" stopOpacity="0.04" />
          </linearGradient>
        </defs>
        <ellipse cx="100" cy="100" rx="75" ry="4" fill="rgb(59 130 246)" opacity="0.22" />
        <path
          d="M28 80 L33 75 L53 60 Q68 47 95 44 L130 44 Q146 46 159 57 L177 75 L182 82 L182 92 L165 95 Q140 98 100 98 Q60 98 50 95 L28 92 Z"
          fill="url(#oc-sidebar-car-body)"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="0.5"
        />
        <path
          d="M68 60 Q84 49 100 47 L130 47 Q141 51 152 60 L142 65 L78 65 Z"
          fill="url(#oc-sidebar-car-window)"
        />
        <ellipse cx="55" cy="93" rx="14" ry="6" fill="#000" />
        <ellipse cx="148" cy="93" rx="14" ry="6" fill="#000" />
        <circle cx="55" cy="92" r="9" fill="#0A0A0A" stroke="rgba(96,165,250,0.45)" strokeWidth="1" />
        <circle cx="55" cy="92" r="4.5" fill="#1F1F1F" />
        <circle cx="148" cy="92" r="9" fill="#0A0A0A" stroke="rgba(96,165,250,0.45)" strokeWidth="1" />
        <circle cx="148" cy="92" r="4.5" fill="#1F1F1F" />
        <circle cx="174" cy="76" r="3" fill="rgb(96 165 250)" opacity="0.85" />
        <circle cx="174" cy="76" r="7" fill="rgb(96 165 250)" opacity="0.18" />
        <line x1="68" y1="65" x2="148" y2="65" stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />
      </svg>
    </div>
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
        className="flex w-full items-center justify-center rounded-lg border border-blue-500/25 bg-blue-600/15 px-3 py-2 text-sm font-semibold text-blue-300 transition hover:border-blue-500/40 hover:bg-blue-600/25"
        title={`Switch currency from ${currency}`}
      >
        {CURRENCY_OPTIONS.find((option) => option.value === currency)?.symbol ?? currency}
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-white/[0.05] bg-black/30 p-1">
      <div className="grid grid-cols-3 gap-1">
        {CURRENCY_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setCurrency(option.value)}
            className={cn(
              'rounded-md px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide transition-all',
              currency === option.value
                ? 'bg-blue-600 text-white'
                : 'text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-200'
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
      {!ratesLoading && rates.updatedAt ? (
        <div className="mt-1.5 px-1 text-center text-[10px] tabular-nums text-zinc-500">
          1$ = {rates.USD.toFixed(1)}₴ · 1€ = {rates.EUR.toFixed(1)}₴
        </div>
      ) : null}
    </div>
  );
}

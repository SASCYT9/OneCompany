'use client';

import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Lock, LogOut, MessageSquare, Settings, ImagePlus, ShoppingBag,
  Package, Shield, LayoutDashboard, Database, Layers, DollarSign,
  ChevronLeft, ChevronRight, Users, Archive, Box, Tag, FolderTree,
  ChevronDown
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

// ═══════════════════════════════
// Types
// ═══════════════════════════════

type NavItem = {
  href: string;
  label: string;
  icon: ReactNode;
  exactMatch?: boolean;
};

type NavGroup = {
  title?: string;
  items: NavItem[];
  collapsible?: boolean;
  defaultOpen?: boolean;
};

// ═══════════════════════════════
// Navigation Config
// ═══════════════════════════════

const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      { href: '/admin', label: 'Огляд', icon: <LayoutDashboard className="w-[18px] h-[18px]" />, exactMatch: true },
    ],
  },
  {
    title: 'Продажі',
    collapsible: true,
    defaultOpen: true,
    items: [
      { href: '/admin/shop/orders', label: 'Замовлення', icon: <Package className="w-[18px] h-[18px]" /> },
      { href: '/admin/shop/customers', label: 'Покупці', icon: <Users className="w-[18px] h-[18px]" /> },
    ],
  },
  {
    title: 'Каталог',
    collapsible: true,
    defaultOpen: true,
    items: [
      { href: '/admin/shop', label: 'Усі товари', icon: <ShoppingBag className="w-[18px] h-[18px]" />, exactMatch: true },
      { href: '/admin/shop/inventory', label: 'Склад', icon: <Box className="w-[18px] h-[18px]" /> },
      { href: '/admin/shop/pricing', label: 'Ціни та Знижки', icon: <DollarSign className="w-[18px] h-[18px]" /> },
      { href: '/admin/shop/categories', label: 'Категорії', icon: <FolderTree className="w-[18px] h-[18px]" /> },
      { href: '/admin/shop/collections', label: 'Колекції', icon: <Tag className="w-[18px] h-[18px]" /> },
    ],
  },
  {
    title: 'Інтеграції',
    collapsible: true,
    defaultOpen: false,
    items: [
      { href: '/admin/crm', label: 'Airtable CRM', icon: <Database className="w-[18px] h-[18px]" /> },
      { href: '/admin/shop/turn14', label: 'Turn14 Proxy', icon: <Layers className="w-[18px] h-[18px]" /> },
      { href: '/admin/shop/stock', label: 'CSV Імпорт', icon: <Archive className="w-[18px] h-[18px]" /> },
    ],
  },
  {
    title: 'Контент',
    items: [
      { href: '/admin/messages', label: 'Запити з форми', icon: <MessageSquare className="w-[18px] h-[18px]" /> },
      { href: '/admin/blog', label: 'Блог', icon: <ImagePlus className="w-[18px] h-[18px]" /> },
    ],
  },
  {
    title: 'Система',
    items: [
      { href: '/admin/users', label: 'Доступи', icon: <Shield className="w-[18px] h-[18px]" /> },
      { href: '/admin/settings', label: 'Налаштування', icon: <Settings className="w-[18px] h-[18px]" /> },
      { href: '/admin/backups', label: 'Бекапи', icon: <Archive className="w-[18px] h-[18px]" /> },
    ],
  },
];

// ═══════════════════════════════
// Main Layout
// ═══════════════════════════════

export default function AdminLayout({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const isAuth = sessionStorage.getItem('adminAuth') === 'true';
    setIsAuthenticated(isAuth);
    const savedCollapsed = localStorage.getItem('adminSidebarCollapsed');
    if (savedCollapsed === 'true') setCollapsed(true);
  }, []);

  const toggleCollapsed = () => {
    setCollapsed(prev => {
      localStorage.setItem('adminSidebarCollapsed', String(!prev));
      return !prev;
    });
  };

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        sessionStorage.setItem('adminAuth', 'true');
        setIsAuthenticated(true);
      } else {
        setError(data.error || 'Invalid password');
      }
    } catch {
      setError('Failed to authenticate. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('adminAuth');
    setIsAuthenticated(false);
    setPassword('');
  };

  // ─── Login Screen ───
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-black bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-900/10 via-black to-black flex items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-md rounded-3xl border border-white/5 bg-white/[0.01] p-8 backdrop-blur-xl shadow-2xl"
        >
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-zinc-900/50 mb-6">
              <Lock className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-4xl font-normal tracking-tight text-white mb-4">
              Admin Access
            </h1>
            <p className="text-sm font-normal text-white/50">
              Enter your password to continue
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-xs uppercase tracking-widest text-white/40 mb-3 font-medium">
                Email
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-0 py-3 bg-transparent border-b border-white/20 text-white placeholder:text-white/30 focus:outline-none focus:border-white transition-colors font-normal mb-8"
                placeholder="admin@onecompany.local"
                required
              />
              <label htmlFor="password" className="block text-xs uppercase tracking-widest text-white/40 mb-3 font-medium">
                Password
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-0 py-3 bg-transparent border-b border-white/20 text-white placeholder:text-white/30 focus:outline-none focus:border-white transition-colors font-normal"
                placeholder="Enter admin password"
                required
              />
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 bg-red-900/20 text-red-300 text-sm font-light"
              >
                {error}
              </motion.div>
            )}

            <motion.button
              type="submit"
              disabled={loading}
              whileHover={{ scale: loading ? 1 : 1.02 }}
              whileTap={{ scale: loading ? 1 : 0.98 }}
              className="w-full py-4 mt-4 bg-white text-black text-sm uppercase tracking-widest font-semibold hover:bg-zinc-200 hover:shadow-[0_0_20px_rgba(255,255,255,0.3)] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 rounded-lg"
            >
              {loading ? 'Authenticating...' : 'Login'}
            </motion.button>
          </form>
        </motion.div>
      </div>
    );
  }

  // ─── Authenticated Layout ───
  return (
    <div className="h-[100dvh] flex bg-[#030303] text-white font-sans text-sm tracking-normal overflow-hidden relative">
      
      {/* ═══ Global Background Ambience ═══ */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-0 right-1/4 w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-[150px] mix-blend-screen" />
        <div className="absolute bottom-0 left-1/4 w-[800px] h-[800px] bg-emerald-600/5 rounded-full blur-[150px] mix-blend-screen" />
      </div>

      {/* ═══ Sidebar ═══ */}
      <motion.aside
        animate={{ width: collapsed ? 64 : 260 }}
        transition={{ duration: 0.25, ease: 'easeInOut' }}
        className="flex-none relative h-full flex flex-col border-r border-white/[0.08] bg-black/40 backdrop-blur-3xl z-30 overflow-hidden shadow-[4px_0_24px_rgba(0,0,0,0.5)]"
      >
        {/* Sidebar Header */}
        <div className="flex items-center justify-between px-4 h-[56px] border-b border-white/[0.06] shrink-0">
          <AnimatePresence mode="wait">
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.15em] font-medium text-white/80 whitespace-nowrap overflow-hidden"
              >
                <span className="w-6 h-6 rounded bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-[9px] font-bold shrink-0">OC</span>
                Admin Panel
              </motion.span>
            )}
          </AnimatePresence>
          <button
            onClick={toggleCollapsed}
            className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-white/[0.06] text-white/30 hover:text-white/60 transition-colors shrink-0"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Sidebar Navigation */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-2 space-y-1">
          {NAV_GROUPS.map((group, gi) => (
            <SidebarGroup
              key={gi}
              group={group}
              pathname={pathname}
              collapsed={collapsed}
            />
          ))}
        </nav>

        {/* Sidebar Footer */}
        <div className="shrink-0 border-t border-white/[0.06] px-2 py-3">
          <button
            onClick={handleLogout}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-500/[0.06] transition-all group ${collapsed ? 'justify-center' : ''}`}
            title="Вийти"
          >
            <LogOut className="w-[18px] h-[18px] shrink-0" />
            <AnimatePresence mode="wait">
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.15 }}
                  className="text-[13px] font-medium whitespace-nowrap overflow-hidden"
                >
                  Вийти
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </div>
      </motion.aside>

      {/* ═══ Main Content ═══ */}
      <div className="flex-1 relative z-10 overflow-hidden">
        <div className="absolute inset-0 overflow-auto">
          {children}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════
// Sidebar Group Component
// ═══════════════════════════════

function SidebarGroup({ group, pathname, collapsed }: {
  group: NavGroup;
  pathname: string;
  collapsed: boolean;
}) {
  const [open, setOpen] = useState(group.defaultOpen ?? true);

  // Check if any item in this group is active
  const hasActiveItem = group.items.some(item =>
    item.exactMatch ? pathname === item.href : pathname.startsWith(item.href)
  );

  // Auto-open group if it contains the active item
  useEffect(() => {
    if (hasActiveItem && !open) setOpen(true);
  }, [hasActiveItem]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="mb-1">
      {/* Group Title */}
      {group.title && !collapsed && (
        <div className="flex items-center justify-between pl-3 pr-2 pt-4 pb-1.5">
          {group.collapsible ? (
            <button
              onClick={() => setOpen(!open)}
              className="flex items-center gap-1 text-[9px] uppercase tracking-[0.2em] text-white/25 font-semibold hover:text-white/40 transition-colors w-full"
            >
              <span>{group.title}</span>
              <ChevronDown className={`w-3 h-3 transition-transform duration-200 ml-auto ${open ? '' : '-rotate-90'}`} />
            </button>
          ) : (
            <span className="text-[9px] uppercase tracking-[0.2em] text-white/25 font-semibold">
              {group.title}
            </span>
          )}
        </div>
      )}

      {/* Collapsed: divider */}
      {group.title && collapsed && (
        <div className="mx-3 my-2 border-t border-white/[0.04]" />
      )}

      {/* Items */}
      <AnimatePresence initial={false}>
        {(open || !group.collapsible || collapsed) && (
          <motion.div
            initial={group.collapsible ? { height: 0, opacity: 0 } : false}
            animate={{ height: 'auto', opacity: 1 }}
            exit={group.collapsible ? { height: 0, opacity: 0 } : undefined}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            {group.items.map((item) => (
              <SidebarItem
                key={item.href}
                item={item}
                pathname={pathname}
                collapsed={collapsed}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ═══════════════════════════════
// Sidebar Item Component
// ═══════════════════════════════

function SidebarItem({ item, pathname, collapsed }: {
  item: NavItem;
  pathname: string;
  collapsed: boolean;
}) {
  const isActive = item.exactMatch
    ? pathname === item.href
    : pathname.startsWith(item.href);

  return (
    <Link
      href={item.href}
      title={collapsed ? item.label : undefined}
      className={`
        relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-300 group
        ${collapsed ? 'justify-center mx-0.5' : ''}
        ${isActive
          ? 'bg-indigo-500/[0.08] text-indigo-300 border border-indigo-500/20 shadow-[0_0_15px_rgba(99,102,241,0.05)]'
          : 'text-zinc-400 hover:text-white hover:bg-white/[0.04] border border-transparent'
        }
      `}
    >
      {/* Active Indicator Glow */}
      {isActive && (
        <motion.div
          layoutId="sidebar-active"
          className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-indigo-500 rounded-r-full shadow-[0_0_10px_rgba(99,102,241,0.8)]"
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        />
      )}

      <span className={`shrink-0 ${isActive ? 'text-indigo-400' : ''}`}>
        {item.icon}
      </span>

      <AnimatePresence mode="wait">
        {!collapsed && (
          <motion.span
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 'auto' }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.15 }}
            className="text-[13px] font-medium whitespace-nowrap overflow-hidden"
          >
            {item.label}
          </motion.span>
        )}
      </AnimatePresence>
    </Link>
  );
}

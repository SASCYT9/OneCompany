"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { usePathname, useRouter } from "next/navigation";
import { Keyboard, X as XIcon } from "lucide-react";

import type { CurrentAdminAccess } from "@/lib/admin/adminAccess";
import {
  buildAdminAttentionItems,
  buildAdminNavBadges,
  type AdminAttentionCounts,
} from "@/lib/admin/adminAttention";
import {
  canAccessAdminPath,
  filterAdminNavSections,
  flattenAdminNavItems,
  getAdminBreadcrumbs,
  getAdminNavAccessItem,
  getFirstAllowedAdminRoute,
} from "@/lib/admin/adminNavigation";
import { ADMIN_PERMISSIONS, matchesAdminPermission } from "@/lib/admin/adminPermissions";

import { AdminCommandPalette } from "./shell/AdminCommandPalette";
import { AdminSidebar } from "./shell/AdminSidebar";
import { AdminTopBar } from "./shell/AdminTopBar";
import { ADMIN_CREATE_ACTIONS } from "./shell/adminShellActions";
import { useAdminShellPreferences } from "./shell/useAdminShellPreferences";

const ATTENTION_POLL_MS = 120_000;
const ATTENTION_MIN_REFRESH_MS = 30_000;

/** Linear-style "g then letter" jumps. */
const CHORD_ROUTES: Record<string, { href: string; label: string }> = {
  d: { href: "/admin", label: "Робочий стіл" },
  o: { href: "/admin/shop/orders", label: "Замовлення" },
  p: { href: "/admin/shop", label: "Товари" },
  c: { href: "/admin/shop/customers", label: "Клієнти" },
  i: { href: "/admin/shop/inventory", label: "Склад" },
  s: { href: "/admin/settings", label: "Налаштування" },
};

export default function AdminShell({
  children,
  access,
  operationsUiEnabled,
}: {
  children: ReactNode;
  access: CurrentAdminAccess;
  operationsUiEnabled: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const preferences = useAdminShellPreferences();
  const { rememberVisit } = preferences;
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [attentionCounts, setAttentionCounts] = useState<AdminAttentionCounts | null>(null);
  const [isMac, setIsMac] = useState(false);
  const lastAttentionFetch = useRef(0);

  const routeAllowed = useCallback(
    (href: string) =>
      (access.isOwner && (operationsUiEnabled || !href.startsWith("/admin/operations"))) ||
      canAccessAdminPath(href, access.permissions, { operationsUiEnabled }),
    [access.isOwner, access.permissions, operationsUiEnabled]
  );

  const allowedSections = useMemo(
    () => filterAdminNavSections(access.permissions, undefined, { operationsUiEnabled }),
    [access.permissions, operationsUiEnabled]
  );
  const navItems = useMemo(() => flattenAdminNavItems(allowedSections), [allowedSections]);
  const createActions = useMemo(
    () => ADMIN_CREATE_ACTIONS.filter((action) => routeAllowed(action.href)),
    [routeAllowed]
  );
  const breadcrumbs = useMemo(() => getAdminBreadcrumbs(pathname), [pathname]);

  const firstAllowedHref =
    getFirstAllowedAdminRoute(access.permissions, { operationsUiEnabled }) ?? "/admin";
  const canAccessCurrentPath = routeAllowed(pathname);
  const canReadDashboard = matchesAdminPermission(
    access.permissions,
    ADMIN_PERMISSIONS.ADMIN_DASHBOARD_READ
  );
  const homeHref = canReadDashboard ? "/admin" : firstAllowedHref;
  const canSearchEntities = [
    ADMIN_PERMISSIONS.SHOP_ORDERS_READ,
    ADMIN_PERMISSIONS.SHOP_PRODUCTS_READ,
    ADMIN_PERMISSIONS.SHOP_CUSTOMERS_READ,
  ].some((permission) => matchesAdminPermission(access.permissions, permission));
  const canUseCurrency = [
    ADMIN_PERMISSIONS.SHOP_ORDERS_READ,
    ADMIN_PERMISSIONS.SHOP_PRODUCTS_READ,
    ADMIN_PERMISSIONS.SHOP_PRICING_READ,
    ADMIN_PERMISSIONS.SHOP_SETTINGS_READ,
  ].some((permission) => matchesAdminPermission(access.permissions, permission));
  const hasCommerceAccess = access.permissions.some(
    (permission) => permission === "*" || permission === "shop.*" || permission.startsWith("shop.")
  );

  const attentionItems = useMemo(
    () =>
      attentionCounts
        ? buildAdminAttentionItems(attentionCounts).filter((item) => routeAllowed(item.href))
        : [],
    [attentionCounts, routeAllowed]
  );
  const navBadges = useMemo(
    () => (attentionCounts ? buildAdminNavBadges(attentionCounts) : {}),
    [attentionCounts]
  );

  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad/.test(window.navigator.platform));
  }, []);

  const refreshAttention = useCallback(() => {
    if (!hasCommerceAccess) return;
    lastAttentionFetch.current = Date.now();
    fetch("/api/admin/shell/attention", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: AdminAttentionCounts | null) => {
        if (data) setAttentionCounts(data);
      })
      .catch(() => {});
  }, [hasCommerceAccess]);

  useEffect(() => {
    refreshAttention();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") refreshAttention();
    }, ATTENTION_POLL_MS);
    return () => window.clearInterval(timer);
  }, [refreshAttention]);

  // Counters change when people work, so refresh on navigation — but not on every click.
  useEffect(() => {
    if (Date.now() - lastAttentionFetch.current > ATTENTION_MIN_REFRESH_MS) refreshAttention();
    setMobileDrawerOpen(false);
    const item = getAdminNavAccessItem(pathname, allowedSections, { operationsUiEnabled });
    if (item && item.href === pathname) rememberVisit(item.href);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- route changes only
  }, [pathname]);

  useEffect(() => {
    if (!canAccessCurrentPath && pathname !== firstAllowedHref) {
      router.replace(firstAllowedHref);
    }
  }, [canAccessCurrentPath, firstAllowedHref, pathname, router]);

  // The drawer is a phone/tablet affordance; growing past `lg` hands over to the sidebar.
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    function onChange(event: MediaQueryListEvent) {
      if (event.matches) setMobileDrawerOpen(false);
    }
    desktop.addEventListener("change", onChange);
    return () => desktop.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!mobileDrawerOpen) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setMobileDrawerOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = original;
      window.removeEventListener("keydown", onKey);
    };
  }, [mobileDrawerOpen]);

  useEffect(() => {
    let lastG = 0;
    function handler(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      const isInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable;

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((value) => !value);
        return;
      }
      if (isInput) return;

      if (event.key === "/" && !event.shiftKey) {
        event.preventDefault();
        setPaletteOpen(true);
        return;
      }
      if (event.key === "?" || (event.shiftKey && event.key === "/")) {
        event.preventDefault();
        setShortcutsOpen((value) => !value);
        return;
      }
      if (event.key === "Escape") {
        setShortcutsOpen(false);
        return;
      }
      if (event.key === "g") {
        lastG = Date.now();
        return;
      }
      if (Date.now() - lastG < 1500 && !event.metaKey && !event.ctrlKey && !event.altKey) {
        const route = CHORD_ROUTES[event.key.toLowerCase()];
        if (route && routeAllowed(route.href)) {
          event.preventDefault();
          router.push(route.href);
          lastG = 0;
        }
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [routeAllowed, router]);

  async function handleLogout() {
    try {
      await fetch("/api/admin/auth", { method: "DELETE" });
    } finally {
      router.refresh();
    }
  }

  return (
    <div className="admin-context flex h-dvh max-w-full overflow-hidden bg-[#0A0A0A] text-zinc-100">
      <a
        href="#admin-main-content"
        className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:left-4 focus-visible:top-4 focus-visible:z-100 focus-visible:border focus-visible:border-blue-500/40 focus-visible:bg-[#171717] focus-visible:px-4 focus-visible:py-2.5 focus-visible:text-sm focus-visible:font-semibold focus-visible:text-blue-300 focus-visible:outline-hidden"
      >
        Перейти до основного вмісту
      </a>

      <AdminSidebar
        sections={allowedSections}
        pathname={pathname}
        homeHref={homeHref}
        collapsed={preferences.collapsed}
        onToggleCollapsed={preferences.toggleCollapsed}
        mobileOpen={mobileDrawerOpen}
        onCloseMobile={() => setMobileDrawerOpen(false)}
        pinned={preferences.pinned}
        onTogglePinned={preferences.togglePinned}
        openSections={preferences.openSections}
        onSetSectionOpen={preferences.setSectionOpen}
        badges={navBadges}
        userName={access.name}
        userRole={access.isOwner ? "Owner" : access.roleKeys.join(", ") || "Admin"}
        onShowShortcuts={() => setShortcutsOpen(true)}
        onLogout={() => void handleLogout()}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <AdminTopBar
          breadcrumbs={breadcrumbs}
          onOpenMobileNav={() => setMobileDrawerOpen(true)}
          onOpenPalette={() => setPaletteOpen(true)}
          shortcutLabel={isMac ? "⌘K" : "Ctrl K"}
          createActions={createActions}
          showCurrency={canUseCurrency && hasCommerceAccess}
          attention={attentionItems}
          showBell={hasCommerceAccess}
          homeHref={homeHref}
        />

        <main
          id="admin-main-content"
          tabIndex={-1}
          className="relative min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto bg-[#0A0A0A] focus-visible:outline-hidden"
        >
          {canAccessCurrentPath ? (
            children
          ) : (
            <div className="flex min-h-full items-center justify-center p-6">
              <div className="max-w-md border border-white/8 bg-[#171717] px-6 py-5 text-center">
                <div className="text-sm font-semibold text-zinc-100">Проверяем доступ…</div>
                <div className="mt-1 text-xs leading-5 text-zinc-500">
                  Открываем первый разрешённый раздел.
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      <AdminCommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onNavigate={(href) => {
          setPaletteOpen(false);
          router.push(href);
        }}
        navItems={navItems}
        actions={createActions}
        recent={preferences.recent}
        canSearchEntities={canSearchEntities}
      />

      {shortcutsOpen ? (
        <ShortcutsDialog
          onClose={() => setShortcutsOpen(false)}
          paletteKeys={isMac ? ["⌘", "K"] : ["Ctrl", "K"]}
          chords={Object.entries(CHORD_ROUTES).filter(([, route]) => routeAllowed(route.href))}
        />
      ) : null}
    </div>
  );
}

function ShortcutsDialog({
  onClose,
  paletteKeys,
  chords,
}: {
  onClose: () => void;
  paletteKeys: string[];
  chords: Array<[string, { href: string; label: string }]>;
}) {
  return (
    <div
      className="fixed inset-0 z-80 flex items-center justify-center bg-black/70 px-3 backdrop-blur-xs"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Гарячі клавіші"
    >
      <div
        className="w-full max-w-[520px] border border-white/[0.08] bg-[#161616] shadow-[0_30px_80px_rgba(0,0,0,0.7)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <Keyboard className="h-4 w-4 text-blue-400" aria-hidden="true" />
            <span className="text-sm font-semibold text-zinc-100">Гарячі клавіші</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-zinc-500 transition hover:bg-white/[0.05] hover:text-zinc-100"
            aria-label="Закрити"
          >
            <XIcon className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="grid grid-cols-1 gap-x-8 gap-y-4 p-5 sm:grid-cols-2">
          <div className="space-y-1">
            <ShortcutTitle>Пошук</ShortcutTitle>
            <ShortcutRow keys={paletteKeys} label="Пошук і команди" />
            <ShortcutRow keys={["/"]} label="Пошук і команди" />
            <ShortcutRow keys={["?"]} label="Ця довідка" />
            <ShortcutRow keys={["Esc"]} label="Закрити вікно" />
          </div>
          {chords.length > 0 ? (
            <div className="space-y-1">
              <ShortcutTitle>Перехід</ShortcutTitle>
              {chords.map(([key, route]) => (
                <ShortcutRow key={key} keys={["G", key.toUpperCase()]} label={route.label} />
              ))}
            </div>
          ) : null}
        </div>
        <div className="border-t border-white/[0.06] bg-black/30 px-5 py-2.5 text-[11px] text-zinc-500">
          Натисніть G, а потім літеру протягом 1,5 секунди.
        </div>
      </div>
    </div>
  );
}

function ShortcutTitle({ children }: { children: ReactNode }) {
  return (
    <div className="pb-1 text-[11px] font-medium uppercase tracking-[0.08em] text-zinc-500">
      {children}
    </div>
  );
}

function ShortcutRow({ keys, label }: { keys: string[]; label: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <span className="text-[13px] text-zinc-300">{label}</span>
      <span className="flex shrink-0 items-center gap-1">
        {keys.map((key) => (
          <kbd
            key={key}
            className="inline-flex h-5 min-w-5 items-center justify-center border border-white/[0.1] bg-white/[0.04] px-1.5 font-sans text-[10px] font-medium text-zinc-300"
          >
            {key}
          </kbd>
        ))}
      </span>
    </div>
  );
}

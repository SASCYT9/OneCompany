"use client";

import { useEffect, useRef, useState } from "react";

import Image from "next/image";
import Link from "next/link";
import {
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  ExternalLink,
  Keyboard,
  LogOut,
  MoreHorizontal,
  Star,
  X as XIcon,
} from "lucide-react";

import {
  isAdminNavItemActive,
  type AdminNavItemDefinition,
  type AdminNavSectionDefinition,
} from "@/lib/admin/adminNavigation";
import { cn } from "@/lib/utils";

import { ADMIN_NAV_ICONS } from "./adminShellIcons";

type FlyoutState = { key: string; top: number } | null;

export function AdminSidebar({
  sections,
  pathname,
  homeHref,
  collapsed,
  onToggleCollapsed,
  mobileOpen,
  onCloseMobile,
  pinned,
  onTogglePinned,
  openSections,
  onSetSectionOpen,
  badges,
  userName,
  userRole,
  onShowShortcuts,
  onLogout,
}: {
  sections: AdminNavSectionDefinition[];
  pathname: string;
  homeHref: string;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  pinned: string[];
  onTogglePinned: (href: string) => void;
  openSections: string[] | null;
  onSetSectionOpen: (key: string, open: boolean, defaults: string[]) => void;
  badges: Record<string, number>;
  userName: string;
  userRole: string;
  onShowShortcuts: () => void;
  onLogout: () => void;
}) {
  const [flyout, setFlyout] = useState<FlyoutState>(null);
  const flyoutTimer = useRef<number | null>(null);
  const activeSectionKey =
    sections.find((section) => section.items.some((item) => isAdminNavItemActive(pathname, item)))
      ?.key ?? null;
  const defaults = activeSectionKey ? [activeSectionKey] : [];
  const effectiveOpen = openSections ?? defaults;
  const allItems = sections.flatMap((section) => section.items);
  const pinnedItems = pinned
    .map((href) => allItems.find((item) => item.href === href))
    .filter((item): item is AdminNavItemDefinition => Boolean(item));
  // On phones the drawer is always full width, so "collapsed" only applies on desktop.
  const isRail = collapsed && !mobileOpen;

  // Navigating into a closed group opens it, so the active page is always visible.
  useEffect(() => {
    if (activeSectionKey && openSections && !openSections.includes(activeSectionKey)) {
      onSetSectionOpen(activeSectionKey, true, []);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to route changes
  }, [activeSectionKey]);

  useEffect(() => setFlyout(null), [pathname, collapsed]);

  function openFlyout(key: string, element: HTMLElement) {
    if (flyoutTimer.current) window.clearTimeout(flyoutTimer.current);
    const rect = element.getBoundingClientRect();
    setFlyout({ key, top: Math.max(8, Math.min(rect.top, window.innerHeight - 120)) });
  }

  function scheduleFlyoutClose() {
    if (flyoutTimer.current) window.clearTimeout(flyoutTimer.current);
    flyoutTimer.current = window.setTimeout(() => setFlyout(null), 160);
  }

  const flyoutSection = flyout ? sections.find((section) => section.key === flyout.key) : null;

  return (
    <>
      {mobileOpen ? (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-xs lg:hidden"
          aria-hidden="true"
        />
      ) : null}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex h-full w-[288px] flex-none flex-col border-r border-white/[0.06] bg-[#0D0D0D] transition-[transform,width] duration-200",
          "lg:relative lg:translate-x-0",
          collapsed ? "lg:w-[68px]" : "lg:w-[280px]",
          mobileOpen ? "translate-x-0 shadow-[0_0_60px_rgba(0,0,0,0.8)]" : "-translate-x-full"
        )}
        aria-label="Основна навігація"
      >
        <div
          className={cn(
            "flex h-14 shrink-0 items-center border-b border-white/[0.06]",
            isRail ? "justify-center px-2" : "justify-between pl-5 pr-2"
          )}
        >
          {isRail ? (
            <Link
              href={homeHref}
              className="flex h-9 w-9 items-center justify-center bg-blue-600 text-[13px] font-bold tracking-tight text-white"
              aria-label="OneCompany Admin — головна"
            >
              OC
            </Link>
          ) : (
            <Link href={homeHref} className="block" aria-label="OneCompany Admin — головна">
              <Image
                src="/branding/logo-light.svg"
                alt="OneCompany"
                width={120}
                height={30}
                className="h-7 w-auto"
                priority
              />
            </Link>
          )}
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Закрити навігацію"
            className="flex h-9 w-9 items-center justify-center text-zinc-500 transition hover:bg-white/[0.05] hover:text-zinc-100 lg:hidden"
          >
            <XIcon className="h-4 w-4" />
          </button>
          {!isRail ? (
            <button
              type="button"
              onClick={onToggleCollapsed}
              aria-label="Згорнути меню"
              title="Згорнути меню"
              className="hidden h-8 w-8 items-center justify-center text-zinc-500 transition hover:bg-white/[0.05] hover:text-zinc-100 lg:flex"
            >
              <ChevronsLeft className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        <nav
          className={cn(
            "flex-1 overflow-y-auto py-3 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-white/10",
            isRail ? "px-2" : "px-3"
          )}
        >
          {isRail ? (
            <div className="space-y-1">
              {sections.map((section) => {
                const Icon = ADMIN_NAV_ICONS[section.icon];
                const active = section.key === activeSectionKey;
                const sectionBadge = section.items.reduce(
                  (sum, item) => sum + (badges[item.href] ?? 0),
                  0
                );
                const single = section.items.length === 1 ? section.items[0] : null;
                const className = cn(
                  "relative flex h-10 w-full items-center justify-center transition",
                  active
                    ? "bg-white/[0.07] text-white before:absolute before:inset-y-2 before:left-0 before:w-[2px] before:bg-blue-500"
                    : "text-zinc-500 hover:bg-white/[0.05] hover:text-zinc-100"
                );
                const badge =
                  sectionBadge > 0 ? (
                    <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-blue-500" />
                  ) : null;
                return single ? (
                  <Link
                    key={section.key}
                    href={single.href}
                    aria-label={single.label}
                    title={single.label}
                    aria-current={active ? "page" : undefined}
                    className={className}
                  >
                    <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                    {badge}
                  </Link>
                ) : (
                  <button
                    key={section.key}
                    type="button"
                    aria-label={section.label}
                    aria-haspopup="menu"
                    aria-expanded={flyout?.key === section.key}
                    onMouseEnter={(event) => openFlyout(section.key, event.currentTarget)}
                    onMouseLeave={scheduleFlyoutClose}
                    onClick={(event) =>
                      flyout?.key === section.key
                        ? setFlyout(null)
                        : openFlyout(section.key, event.currentTarget)
                    }
                    className={className}
                  >
                    <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                    {badge}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="space-y-4">
              {pinnedItems.length > 0 ? (
                <div>
                  <div className="mb-1 flex items-center gap-2 px-2.5 text-[11px] font-medium uppercase tracking-[0.08em] text-zinc-500">
                    <Star className="h-3 w-3 fill-current text-amber-400/80" aria-hidden="true" />
                    Обране
                  </div>
                  <div className="space-y-px">
                    {pinnedItems.map((item) => (
                      <SidebarLink
                        key={item.href}
                        item={item}
                        pathname={pathname}
                        badge={badges[item.href]}
                        pinned
                        onTogglePinned={onTogglePinned}
                      />
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="space-y-1">
                {sections.map((section) => {
                  if (section.items.length === 1) {
                    const item = section.items[0];
                    return (
                      <SidebarLink
                        key={section.key}
                        item={item}
                        pathname={pathname}
                        badge={badges[item.href]}
                        pinned={pinned.includes(item.href)}
                        onTogglePinned={onTogglePinned}
                        prominent
                      />
                    );
                  }
                  const open = effectiveOpen.includes(section.key);
                  const Icon = ADMIN_NAV_ICONS[section.icon];
                  const active = section.key === activeSectionKey;
                  const hiddenBadge = open
                    ? 0
                    : section.items.reduce((sum, item) => sum + (badges[item.href] ?? 0), 0);
                  return (
                    <div key={section.key}>
                      <button
                        type="button"
                        onClick={() => onSetSectionOpen(section.key, !open, defaults)}
                        aria-expanded={open}
                        className={cn(
                          "group flex h-9 w-full items-center gap-3 px-2.5 text-left text-[13px] font-medium transition",
                          active ? "text-zinc-100" : "text-zinc-400 hover:text-zinc-100",
                          "hover:bg-white/[0.04]"
                        )}
                      >
                        <Icon
                          className={cn(
                            "h-4 w-4 shrink-0",
                            active ? "text-blue-400" : "text-zinc-500 group-hover:text-zinc-300"
                          )}
                          aria-hidden="true"
                        />
                        <span className="min-w-0 flex-1 truncate">{section.label}</span>
                        {hiddenBadge > 0 ? <NavBadge count={hiddenBadge} /> : null}
                        <ChevronDown
                          className={cn(
                            "h-3.5 w-3.5 shrink-0 text-zinc-600 transition-transform",
                            open ? "rotate-0" : "-rotate-90"
                          )}
                          aria-hidden="true"
                        />
                      </button>
                      {open ? (
                        <div className="relative mb-1 ml-[17px] space-y-px border-l border-white/[0.07] pl-2">
                          {section.items.map((item) => (
                            <SidebarLink
                              key={item.href}
                              item={item}
                              pathname={pathname}
                              badge={badges[item.href]}
                              pinned={pinned.includes(item.href)}
                              onTogglePinned={onTogglePinned}
                              nested
                            />
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </nav>

        <SidebarFooter
          rail={isRail}
          userName={userName}
          userRole={userRole}
          onExpand={onToggleCollapsed}
          onShowShortcuts={onShowShortcuts}
          onLogout={onLogout}
        />
      </aside>

      {isRail && flyoutSection ? (
        <div
          role="menu"
          aria-label={flyoutSection.label}
          onMouseEnter={() => flyoutTimer.current && window.clearTimeout(flyoutTimer.current)}
          onMouseLeave={scheduleFlyoutClose}
          className="fixed left-[72px] z-[60] hidden w-64 border border-white/[0.08] bg-[#161616] py-2 shadow-[0_24px_60px_rgba(0,0,0,0.7)] lg:block"
          style={{ top: flyout?.top }}
        >
          <div className="px-3 pb-1.5 pt-0.5 text-[11px] font-medium uppercase tracking-[0.08em] text-zinc-500">
            {flyoutSection.label}
          </div>
          <div className="space-y-px px-1.5">
            {flyoutSection.items.map((item) => (
              <SidebarLink
                key={item.href}
                item={item}
                pathname={pathname}
                badge={badges[item.href]}
                pinned={pinned.includes(item.href)}
                onTogglePinned={onTogglePinned}
              />
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
}

function NavBadge({ count }: { count: number }) {
  return (
    <span className="inline-flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-blue-600 px-1.5 text-[10px] font-semibold tabular-nums leading-none text-white">
      {count > 99 ? "99+" : count}
    </span>
  );
}

function SidebarLink({
  item,
  pathname,
  badge,
  pinned,
  onTogglePinned,
  nested,
  prominent,
}: {
  item: AdminNavItemDefinition;
  pathname: string;
  badge?: number;
  pinned: boolean;
  onTogglePinned: (href: string) => void;
  nested?: boolean;
  prominent?: boolean;
}) {
  const Icon = ADMIN_NAV_ICONS[item.icon];
  const active = isAdminNavItemActive(pathname, item);

  return (
    <div className="group/link relative">
      <Link
        href={item.href}
        title={item.description}
        aria-current={active ? "page" : undefined}
        className={cn(
          "relative flex items-center gap-3 pr-8 transition-colors",
          nested
            ? "min-h-8 py-1.5 pl-2.5 text-[13px] leading-[1.25]"
            : "min-h-9 py-2 pl-2.5 text-[13px] font-medium leading-[1.25]",
          "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500/50",
          active
            ? "bg-white/[0.07] text-white before:absolute before:inset-y-1.5 before:left-0 before:w-[2px] before:bg-blue-500"
            : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-100"
        )}
      >
        {!nested ? (
          <Icon
            className={cn(
              "h-4 w-4 shrink-0",
              active ? "text-blue-400" : prominent ? "text-zinc-400" : "text-zinc-500"
            )}
            aria-hidden="true"
          />
        ) : null}
        <span className="line-clamp-2 min-w-0 flex-1">{item.label}</span>
        {badge ? <NavBadge count={badge} /> : null}
      </Link>
      <button
        type="button"
        onClick={() => onTogglePinned(item.href)}
        aria-label={
          pinned ? `Прибрати «${item.label}» з обраного` : `Додати «${item.label}» в обране`
        }
        title={pinned ? "Прибрати з обраного" : "Додати в обране"}
        className={cn(
          "absolute right-1 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center transition",
          badge ? "hidden" : "",
          pinned
            ? "text-amber-400/80 opacity-0 hover:text-amber-300 group-hover/link:opacity-100"
            : "text-zinc-600 opacity-0 hover:text-zinc-200 group-hover/link:opacity-100 focus-visible:opacity-100"
        )}
      >
        <Star className={cn("h-3.5 w-3.5", pinned && "fill-current")} aria-hidden="true" />
      </button>
    </div>
  );
}

function SidebarFooter({
  rail,
  userName,
  userRole,
  onExpand,
  onShowShortcuts,
  onLogout,
}: {
  rail: boolean;
  userName: string;
  userRole: string;
  onExpand: () => void;
  onShowShortcuts: () => void;
  onLogout: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const initials =
    userName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "OC";

  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [menuOpen]);

  return (
    <div ref={rootRef} className="relative shrink-0 border-t border-white/[0.06] p-2">
      {rail ? (
        <button
          type="button"
          onClick={onExpand}
          aria-label="Розгорнути меню"
          title="Розгорнути меню"
          className="mb-1 flex h-9 w-full items-center justify-center text-zinc-500 transition hover:bg-white/[0.05] hover:text-zinc-100"
        >
          <ChevronsRight className="h-4 w-4" />
        </button>
      ) : null}
      <button
        type="button"
        onClick={() => setMenuOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-label="Меню користувача"
        className={cn(
          "flex w-full items-center gap-3 p-1.5 text-left transition hover:bg-white/[0.05]",
          rail && "justify-center"
        )}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[11px] font-semibold text-white">
          {initials}
        </span>
        {!rail ? (
          <>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-[13px] font-medium text-zinc-100">
                {userName}
              </span>
              <span className="block truncate text-[11px] text-zinc-500">{userRole}</span>
            </span>
            <MoreHorizontal className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden="true" />
          </>
        ) : null}
      </button>

      {menuOpen ? (
        <div
          role="menu"
          className={cn(
            "absolute bottom-full z-[60] mb-1 w-56 border border-white/[0.08] bg-[#161616] py-1 shadow-[0_24px_60px_rgba(0,0,0,0.7)]",
            rail ? "left-2" : "inset-x-2 w-auto"
          )}
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false);
              onShowShortcuts();
            }}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] text-zinc-300 hover:bg-white/[0.05] hover:text-white"
          >
            <Keyboard className="h-4 w-4 text-zinc-500" aria-hidden="true" />
            Гарячі клавіші
          </button>
          <a
            role="menuitem"
            href="/ua"
            target="_blank"
            rel="noreferrer"
            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] text-zinc-300 hover:bg-white/[0.05] hover:text-white"
          >
            <ExternalLink className="h-4 w-4 text-zinc-500" aria-hidden="true" />
            Відкрити сайт
          </a>
          <div className="my-1 h-px bg-white/[0.06]" />
          <button
            type="button"
            role="menuitem"
            onClick={onLogout}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] text-zinc-300 hover:bg-red-500/10 hover:text-red-300"
          >
            <LogOut className="h-4 w-4 text-zinc-500" aria-hidden="true" />
            Вийти
          </button>
        </div>
      ) : null}
    </div>
  );
}

"use client";

import Link from "next/link";
import { BookOpen, BookMarked, Inbox, ListTodo, MoreHorizontal } from "lucide-react";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { opsRu } from "@/lib/operations/i18n";
import { ADMIN_PERMISSIONS, matchesAdminPermission } from "@/lib/admin/adminPermissions";

const primaryItems = [
  {
    href: "/admin/operations/tasks",
    label: opsRu.navigation.tasks,
    icon: ListTodo,
    permission: ADMIN_PERMISSIONS.OPS_TASKS_READ,
  },
  {
    href: "/admin/operations/directory",
    label: "Справочник",
    icon: BookMarked,
    permission: ADMIN_PERMISSIONS.OPS_KNOWLEDGE_READ,
  },
  {
    href: "/admin/operations/knowledge",
    label: opsRu.navigation.knowledge,
    icon: BookOpen,
    permission: ADMIN_PERMISSIONS.OPS_KNOWLEDGE_READ,
  },
  {
    href: "/admin/operations/inbox",
    label: opsRu.navigation.inbox,
    icon: Inbox,
    permission: ADMIN_PERMISSIONS.OPS_INBOX_READ,
  },
];

export function OpsMobileNav({
  inboxCount = 0,
  permissions,
}: {
  inboxCount?: number;
  permissions: readonly string[];
}) {
  const pathname = usePathname();
  const visibleItems = primaryItems.filter((item) =>
    matchesAdminPermission(permissions, item.permission)
  );
  const canReadTasks = matchesAdminPermission(permissions, ADMIN_PERMISSIONS.OPS_TASKS_READ);
  const canDecideApprovals = matchesAdminPermission(
    permissions,
    ADMIN_PERMISSIONS.OPS_APPROVALS_DECIDE
  );
  const canManageSystem = matchesAdminPermission(permissions, ADMIN_PERMISSIONS.OPS_SYSTEM_MANAGE);
  const moreItem =
    canReadTasks || canDecideApprovals || canManageSystem
      ? {
          href: canReadTasks
            ? "/admin/operations"
            : canDecideApprovals
              ? "/admin/operations/approvals"
              : "/admin/operations/system",
          label: opsRu.navigation.more,
          icon: MoreHorizontal,
          permission: canReadTasks
            ? ADMIN_PERMISSIONS.OPS_TASKS_READ
            : canDecideApprovals
              ? ADMIN_PERMISSIONS.OPS_APPROVALS_DECIDE
              : ADMIN_PERMISSIONS.OPS_SYSTEM_MANAGE,
        }
      : null;
  const navigationItems = moreItem ? [...visibleItems, moreItem] : visibleItems;
  return (
    <nav
      aria-label="Навигация операций"
      className="fixed inset-x-0 bottom-0 z-50 mx-auto flex h-[calc(72px+env(safe-area-inset-bottom))] max-w-3xl items-start justify-around border-t border-slate-700 bg-[#0b1b2d] px-2 pt-2 pb-[env(safe-area-inset-bottom)] text-white shadow-[0_-12px_28px_rgba(15,23,42,0.18)] lg:hidden"
    >
      {navigationItems.map((item) => {
        const active =
          item.href === "/admin/operations"
            ? pathname === item.href ||
              pathname.startsWith("/admin/operations/projects") ||
              pathname.startsWith("/admin/operations/approvals") ||
              pathname.startsWith("/admin/operations/system")
            : item.href === "/admin/operations/approvals" && item.label === opsRu.navigation.more
              ? pathname.startsWith("/admin/operations/approvals")
              : item.href === "/admin/operations/system" && item.label === opsRu.navigation.more
                ? pathname.startsWith("/admin/operations/system")
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "relative flex min-w-16 flex-col items-center gap-1 rounded-xl px-3 py-1.5 text-[11px] font-medium text-slate-300 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400",
              active && "bg-blue-600/15 text-blue-400"
            )}
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
            <span>{item.label}</span>
            {item.href.endsWith("/inbox") && inboxCount > 0 ? (
              <span className="absolute right-2 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                {inboxCount}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

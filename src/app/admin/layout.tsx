import type { ReactNode } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import AdminLoginScreen from "@/components/admin/AdminLoginScreen";
import AdminShell from "@/components/admin/AdminShell";
import { AdminConfirmProvider } from "@/components/admin/AdminConfirmDialog";
import { AdminToastProvider } from "@/components/admin/AdminToast";
import { getCurrentAdminAccess } from "@/lib/admin/adminAccess";
import { canAccessAdminPath, getFirstAllowedAdminRoute } from "@/lib/admin/adminNavigation";
import { ADMIN_PATH_HEADER } from "@/lib/admin/adminPathHeader";
import { AdminCurrencyProvider } from "@/lib/admin/currencyContext";
import { isOperationsUiEnabled } from "@/lib/operations/featureFlags";
import { getOpsLocalDemoAccess } from "@/lib/operations/localDemoAccess";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const access = getOpsLocalDemoAccess() ?? (await getCurrentAdminAccess());

  if (!access) {
    return <AdminLoginScreen />;
  }

  const requestHeaders = await headers();
  const rawPath = requestHeaders.get(ADMIN_PATH_HEADER) ?? "/admin";
  const requestedPath = rawPath === "/admin" || rawPath.startsWith("/admin/") ? rawPath : "/admin";
  const operationsUiEnabled = isOperationsUiEnabled();
  const operationsPathDisabled =
    requestedPath.startsWith("/admin/operations") && !operationsUiEnabled;
  if (
    operationsPathDisabled ||
    (!access.isOwner &&
      !canAccessAdminPath(requestedPath, access.permissions, { operationsUiEnabled }))
  ) {
    const firstAllowedRoute = getFirstAllowedAdminRoute(access.permissions, {
      operationsUiEnabled,
    });
    if (firstAllowedRoute) {
      redirect(firstAllowedRoute);
    }
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0d0d0d] px-6 text-zinc-100">
        <section className="max-w-lg border border-white/10 bg-[#171717] p-8">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">One Company</p>
          <h1 className="mt-3 text-2xl font-semibold">Нет доступных разделов</h1>
          <p className="mt-3 text-sm leading-6 text-zinc-400">
            Учётная запись активна, но для неё ещё не назначена ни одна роль. Обратитесь к владельцу
            системы.
          </p>
        </section>
      </main>
    );
  }

  const hasCommerceAccess = access.permissions.some(
    (permission) => permission === "*" || permission === "shop.*" || permission.startsWith("shop.")
  );
  const shell = (
    <AdminShell access={access} operationsUiEnabled={operationsUiEnabled}>
      {children}
    </AdminShell>
  );

  return (
    <AdminToastProvider>
      <AdminConfirmProvider>
        {hasCommerceAccess ? <AdminCurrencyProvider>{shell}</AdminCurrencyProvider> : shell}
      </AdminConfirmProvider>
    </AdminToastProvider>
  );
}

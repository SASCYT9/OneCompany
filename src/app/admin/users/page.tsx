"use client";

import { useEffect, useMemo, useState } from "react";

import { Loader2, Plus, RefreshCw, Shield } from "lucide-react";

import {
  AdminActionBar,
  AdminEmptyState,
  AdminInlineAlert,
  AdminInspectorCard,
  AdminKeyValueGrid,
  AdminMetricCard,
  AdminMetricGrid,
  AdminPage,
  AdminPageHeader,
  AdminSplitDetailShell,
  AdminStatusBadge,
  AdminTableShell,
} from "@/components/admin/AdminPrimitives";
import { AdminCheckboxField, AdminInputField } from "@/components/admin/AdminFormFields";

type AdminRole = {
  id: string;
  key: string;
  name: string;
  permissions: string[];
};

type AdminUser = {
  id: string;
  email: string;
  name: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  roles: Array<{ id: string; key: string; name: string }>;
};

type CreateAdminForm = {
  email: string;
  name: string;
  password: string;
  roleIds: string[];
};

type EditAdminForm = {
  name: string;
  isActive: boolean;
  roleIds: string[];
};

const EMPTY_CREATE_FORM: CreateAdminForm = {
  email: "",
  name: "",
  password: "",
  roleIds: [],
};

const EMPTY_EDIT_FORM: EditAdminForm = {
  name: "",
  isActive: true,
  roleIds: [],
};

function formatDate(value: string | null) {
  if (!value) {
    return "Never";
  }

  return new Date(value).toLocaleString("uk-UA");
}

function snapshotEditForm(form: EditAdminForm) {
  return JSON.stringify({
    ...form,
    roleIds: [...form.roleIds].sort(),
  });
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditAdminForm>(EMPTY_EDIT_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateAdminForm>(EMPTY_CREATE_FORM);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      const [usersResponse, rolesResponse] = await Promise.all([
        fetch("/api/admin/users", { cache: "no-store" }),
        fetch("/api/admin/roles", { cache: "no-store" }),
      ]);

      const usersPayload = (await usersResponse.json().catch(() => [])) as
        | AdminUser[]
        | { error?: string };
      const rolesPayload = (await rolesResponse.json().catch(() => [])) as
        | AdminRole[]
        | { error?: string };

      if (!usersResponse.ok) {
        throw new Error(
          !Array.isArray(usersPayload)
            ? usersPayload.error || "Failed to load users"
            : "Failed to load users"
        );
      }

      if (!rolesResponse.ok) {
        throw new Error(
          !Array.isArray(rolesPayload)
            ? rolesPayload.error || "Failed to load roles"
            : "Failed to load roles"
        );
      }

      const nextUsers = Array.isArray(usersPayload) ? usersPayload : [];
      const nextRoles = Array.isArray(rolesPayload) ? rolesPayload : [];

      setUsers(nextUsers);
      setRoles(nextRoles);

      if (!selectedUserId && nextUsers.length) {
        setSelectedUserId(nextUsers[0].id);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load admin access data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const selectedUser = useMemo(
    () => users.find((user) => user.id === selectedUserId) ?? null,
    [selectedUserId, users]
  );

  useEffect(() => {
    if (!selectedUser && users.length > 0) {
      setSelectedUserId(users[0].id);
      return;
    }

    if (selectedUser) {
      setEditForm({
        name: selectedUser.name ?? "",
        isActive: selectedUser.isActive,
        roleIds: selectedUser.roles.map((role) => role.id),
      });
      setSaveError(null);
    }
  }, [selectedUser, users]);

  const filteredUsers = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return users.filter((user) => {
      if (statusFilter === "active" && !user.isActive) {
        return false;
      }

      if (statusFilter === "inactive" && user.isActive) {
        return false;
      }

      if (!needle) {
        return true;
      }

      return [user.name || "", user.email, ...user.roles.map((role) => role.name)]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [query, statusFilter, users]);

  const editDirty = useMemo(() => {
    if (!selectedUser) {
      return false;
    }

    const baseline = snapshotEditForm({
      name: selectedUser.name ?? "",
      isActive: selectedUser.isActive,
      roleIds: selectedUser.roles.map((role) => role.id),
    });

    return baseline !== snapshotEditForm(editForm);
  }, [editForm, selectedUser]);

  const totalUsers = users.length;
  const activeUsers = users.filter((user) => user.isActive).length;
  const inactiveUsers = totalUsers - activeUsers;

  const toggleRole = (roleId: string, scope: "create" | "edit") => {
    if (scope === "create") {
      setCreateForm((current) => ({
        ...current,
        roleIds: current.roleIds.includes(roleId)
          ? current.roleIds.filter((id) => id !== roleId)
          : [...current.roleIds, roleId],
      }));
      return;
    }

    setEditForm((current) => ({
      ...current,
      roleIds: current.roleIds.includes(roleId)
        ? current.roleIds.filter((id) => id !== roleId)
        : [...current.roleIds, roleId],
    }));
  };

  const handleSaveSelected = async () => {
    if (!selectedUser) {
      return;
    }

    setSaving(true);
    setSaveError(null);

    try {
      const response = await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        user?: AdminUser;
      };

      if (!response.ok || !payload.user) {
        throw new Error(payload.error || "Failed to update admin user");
      }

      setUsers((current) =>
        current.map((user) => (user.id === payload.user?.id ? payload.user : user))
      );
      setSelectedUserId(payload.user.id);
    } catch (saveRequestError) {
      setSaveError(
        saveRequestError instanceof Error ? saveRequestError.message : "Failed to update admin user"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreating(true);
    setCreateError(null);

    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createForm),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        id?: string;
        user?: AdminUser;
      };

      if (!response.ok) {
        throw new Error(payload.error || "Failed to create admin user");
      }

      if (payload.user) {
        setUsers((current) => [payload.user!, ...current]);
        setSelectedUserId(payload.user.id);
      } else {
        await loadData();
        if (payload.id) {
          setSelectedUserId(payload.id);
        }
      }

      setCreateForm(EMPTY_CREATE_FORM);
      setCreateOpen(false);
    } catch (createRequestError) {
      setCreateError(
        createRequestError instanceof Error
          ? createRequestError.message
          : "Failed to create admin user"
      );
    } finally {
      setCreating(false);
    }
  };

  return (
    <AdminPage className="space-y-6">
      <AdminPageHeader
        eyebrow="System"
        title="Users and access"
        description="Workbench for internal admin accounts, activation state, and role assignments. Email stays immutable after creation."
        actions={
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-2 rounded-full border border-blue-500/25 bg-blue-500/8 px-4 py-2 text-xs uppercase tracking-[0.18em] text-blue-300 transition hover:bg-blue-500/12"
          >
            <Plus className="h-3.5 w-3.5" />
            Create user
          </button>
        }
      />

      <AdminMetricGrid>
        <AdminMetricCard
          label="Admin users"
          value={totalUsers.toString()}
          meta="Total internal access records"
          tone="accent"
        />
        <AdminMetricCard
          label="Active"
          value={activeUsers.toString()}
          meta="Accounts that can authenticate"
        />
        <AdminMetricCard
          label="Inactive"
          value={inactiveUsers.toString()}
          meta="Accounts disabled for sign-in"
        />
        <AdminMetricCard
          label="Roles"
          value={roles.length.toString()}
          meta="Available permission bundles"
        />
      </AdminMetricGrid>

      <AdminActionBar>
        <div className="flex w-full min-w-0 flex-1 items-center gap-3 rounded-full border border-white/10 bg-black/25 px-4 py-3 md:min-w-[260px]">
          <Shield className="h-4 w-4 text-zinc-500" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name, email, or role…"
            className="w-full bg-transparent text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-hidden"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              { id: "all", label: "All" },
              { id: "active", label: "Active" },
              { id: "inactive", label: "Inactive" },
            ] as const
          ).map((filter) => (
            <button
              key={filter.id}
              type="button"
              onClick={() => setStatusFilter(filter.id)}
              className={`rounded-full border px-3 py-2 text-xs uppercase tracking-[0.18em] transition ${
                statusFilter === filter.id
                  ? "border-blue-500/25 bg-blue-500/8 text-blue-300"
                  : "border-white/10 bg-white/3 text-zinc-400 hover:text-zinc-100"
              }`}
            >
              {filter.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => void loadData()}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/3 px-3 py-2 text-xs uppercase tracking-[0.18em] text-zinc-300 transition hover:text-zinc-100"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Reload
          </button>
        </div>
      </AdminActionBar>

      {error ? <AdminInlineAlert tone="warning">{error}</AdminInlineAlert> : null}

      <AdminSplitDetailShell
        main={
          loading ? (
            <div className="flex min-h-[320px] items-center justify-center rounded-none border border-white/10 bg-[#171717] text-sm text-zinc-400">
              <Loader2 className="mr-3 h-4 w-4 motion-safe:animate-spin" />
              Loading admin users…
            </div>
          ) : filteredUsers.length === 0 ? (
            <AdminEmptyState
              title="No users match the current filter"
              description="Adjust the access filter or create a new admin account to populate the workbench."
            />
          ) : (
            <AdminTableShell>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-white/10 bg-white/3 text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                    <tr>
                      <th className="px-5 py-4 font-medium">User</th>
                      <th className="px-5 py-4 font-medium">Roles</th>
                      <th className="px-5 py-4 font-medium">Status</th>
                      <th className="px-5 py-4 font-medium">Last login</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((user) => {
                      const selected = user.id === selectedUserId;
                      return (
                        <tr
                          key={user.id}
                          className={`cursor-pointer border-b border-white/6 transition hover:bg-white/3 ${
                            selected ? "bg-blue-500/6" : "bg-transparent"
                          }`}
                          onClick={() => setSelectedUserId(user.id)}
                        >
                          <td className="px-5 py-4">
                            <div className="text-sm font-medium text-zinc-100">
                              {user.name || "Unnamed manager"}
                            </div>
                            <div className="mt-1 text-xs text-zinc-500">{user.email}</div>
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex flex-wrap gap-2">
                              {user.roles.length ? (
                                user.roles.map((role) => (
                                  <AdminStatusBadge key={role.id}>{role.name}</AdminStatusBadge>
                                ))
                              ) : (
                                <span className="text-xs text-zinc-500">No roles</span>
                              )}
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <AdminStatusBadge tone={user.isActive ? "success" : "danger"}>
                              {user.isActive ? "Active" : "Inactive"}
                            </AdminStatusBadge>
                          </td>
                          <td className="px-5 py-4 text-sm text-zinc-400">
                            {formatDate(user.lastLoginAt)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </AdminTableShell>
          )
        }
        sidebar={
          selectedUser ? (
            <>
              <AdminInspectorCard
                title="Account snapshot"
                description="Immutable identity data and high-level access posture for the selected admin."
              >
                <AdminKeyValueGrid
                  rows={[
                    { label: "Email", value: selectedUser.email },
                    { label: "Created", value: formatDate(selectedUser.createdAt) },
                    { label: "Last login", value: formatDate(selectedUser.lastLoginAt) },
                    { label: "Status", value: selectedUser.isActive ? "Active" : "Inactive" },
                  ]}
                />
              </AdminInspectorCard>

              <AdminInspectorCard
                title="Edit access"
                description="Update display name, activation state, and role assignments. Email stays immutable after creation."
              >
                <div className="space-y-4">
                  <AdminInputField
                    label="Display name"
                    value={editForm.name}
                    onChange={(value) => setEditForm((current) => ({ ...current, name: value }))}
                    helper="Shown in audit logs and admin identity surfaces."
                  />
                  <AdminCheckboxField
                    label="Account is active"
                    checked={editForm.isActive}
                    onChange={(value) =>
                      setEditForm((current) => ({ ...current, isActive: value }))
                    }
                    helper="Inactive accounts remain on record but cannot sign in."
                  />

                  <div className="space-y-2">
                    <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-400">
                      Roles
                    </div>
                    <div className="space-y-2">
                      {roles.map((role) => {
                        const checked = editForm.roleIds.includes(role.id);
                        return (
                          <label
                            key={role.id}
                            className={`flex cursor-pointer items-start gap-3 rounded-none border px-3 py-3 transition ${
                              checked
                                ? "border-blue-500/25 bg-blue-500/8"
                                : "border-white/10 bg-black/20 hover:bg-white/3"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleRole(role.id, "edit")}
                              className="mt-1 h-4 w-4 rounded-none border-white/20 bg-[#171717]"
                            />
                            <span className="min-w-0">
                              <span className="block text-sm font-medium text-zinc-100">
                                {role.name}
                              </span>
                              <span className="mt-1 block text-xs leading-5 text-zinc-500">
                                {role.key} · {role.permissions.length} permissions
                              </span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {saveError ? (
                    <AdminInlineAlert tone="warning">{saveError}</AdminInlineAlert>
                  ) : null}

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (!selectedUser) {
                          return;
                        }
                        setEditForm({
                          name: selectedUser.name ?? "",
                          isActive: selectedUser.isActive,
                          roleIds: selectedUser.roles.map((role) => role.id),
                        });
                        setSaveError(null);
                      }}
                      className="rounded-full border border-white/10 bg-white/3 px-4 py-2 text-xs uppercase tracking-[0.18em] text-zinc-200 transition hover:bg-white/6"
                    >
                      Reset
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleSaveSelected()}
                      disabled={!editDirty || saving}
                      className="rounded-full border border-blue-500/25 bg-blue-500/8 px-4 py-2 text-xs uppercase tracking-[0.18em] text-blue-300 transition disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {saving ? "Saving…" : "Save access"}
                    </button>
                  </div>
                </div>
              </AdminInspectorCard>

              <AdminInspectorCard
                title="Role reference"
                description="Available permission bundles for internal operators."
              >
                <div className="space-y-3">
                  {roles.map((role) => (
                    <div
                      key={role.id}
                      className="rounded-none border border-white/8 bg-black/25 px-3 py-3"
                    >
                      <div className="text-sm font-medium text-zinc-100">{role.name}</div>
                      <div className="mt-1 text-xs leading-5 text-zinc-500">
                        {role.key} · {role.permissions.length} permissions
                      </div>
                    </div>
                  ))}
                </div>
              </AdminInspectorCard>
            </>
          ) : (
            <AdminInspectorCard
              title="Create the first admin"
              description="There are no admin accounts yet. Use the primary action to create the first internal access record."
            >
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="rounded-full border border-blue-500/25 bg-blue-500/8 px-4 py-2 text-xs uppercase tracking-[0.18em] text-blue-300 transition hover:bg-blue-500/12"
              >
                Create user
              </button>
            </AdminInspectorCard>
          )
        }
      />

      {createOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 py-8 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-[32px] border border-white/10 bg-[#0d0d0d] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.4)]">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-blue-300">
                  System
                </div>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-50">
                  Create admin user
                </h2>
                <p className="mt-2 text-sm leading-6 text-zinc-400">
                  Define the immutable email, initial password, and starting role set for a new
                  internal operator.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCreateOpen(false);
                  setCreateError(null);
                  setCreateForm(EMPTY_CREATE_FORM);
                }}
                className="rounded-full border border-white/10 bg-white/3 px-3 py-2 text-xs uppercase tracking-[0.18em] text-zinc-300 transition hover:text-zinc-100"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleCreate} className="mt-6 space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <AdminInputField
                  label="Email"
                  type="email"
                  value={createForm.email}
                  onChange={(value) => setCreateForm((current) => ({ ...current, email: value }))}
                  helper="This identifier is immutable after the user is created."
                />
                <AdminInputField
                  label="Display name"
                  value={createForm.name}
                  onChange={(value) => setCreateForm((current) => ({ ...current, name: value }))}
                />
              </div>

              <AdminInputField
                label="Initial password"
                type="password"
                value={createForm.password}
                onChange={(value) => setCreateForm((current) => ({ ...current, password: value }))}
                helper="Minimum six characters. Rotate later through standard auth policies if needed."
              />

              <div className="space-y-2">
                <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-400">
                  Initial roles
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  {roles.map((role) => {
                    const checked = createForm.roleIds.includes(role.id);
                    return (
                      <label
                        key={role.id}
                        className={`flex cursor-pointer items-start gap-3 rounded-none border px-3 py-3 transition ${
                          checked
                            ? "border-blue-500/25 bg-blue-500/8"
                            : "border-white/10 bg-black/20 hover:bg-white/3"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleRole(role.id, "create")}
                          className="mt-1 h-4 w-4 rounded-none border-white/20 bg-[#171717]"
                        />
                        <span className="min-w-0">
                          <span className="block text-sm font-medium text-zinc-100">
                            {role.name}
                          </span>
                          <span className="mt-1 block text-xs leading-5 text-zinc-500">
                            {role.key} · {role.permissions.length} permissions
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {createError ? (
                <AdminInlineAlert tone="warning">{createError}</AdminInlineAlert>
              ) : null}

              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setCreateOpen(false);
                    setCreateError(null);
                    setCreateForm(EMPTY_CREATE_FORM);
                  }}
                  className="rounded-full border border-white/10 bg-white/3 px-4 py-2 text-xs uppercase tracking-[0.18em] text-zinc-300 transition hover:text-zinc-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="rounded-full border border-blue-500/25 bg-blue-500/8 px-4 py-2 text-xs uppercase tracking-[0.18em] text-blue-300 transition disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {creating ? "Creating…" : "Create user"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </AdminPage>
  );
}

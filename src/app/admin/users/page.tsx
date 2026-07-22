"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Copy, Eye, EyeOff, KeyRound, Loader2, Plus, RefreshCw, Shield } from "lucide-react";

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
  AdminResponsiveTable,
} from "@/components/admin/AdminPrimitives";
import { AdminCheckboxField, AdminInputField } from "@/components/admin/AdminFormFields";
import { AdminMobileCard } from "@/components/admin/AdminMobileCard";

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
  hasPassword: boolean;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  roles: Array<{ id: string; key: string; name: string }>;
  opsProfile: {
    telegramUserId: string | null;
    telegramEnabled: boolean;
    timezone: string;
  } | null;
};

type OpsProfileForm = {
  telegramUserId: string;
  telegramEnabled: boolean;
  timezone: string;
};

type CreateAdminForm = {
  email: string;
  name: string;
  password: string;
  roleIds: string[];
  opsProfile: OpsProfileForm;
};

type EditAdminForm = {
  email: string;
  name: string;
  password: string;
  isActive: boolean;
  roleIds: string[];
  opsProfile: OpsProfileForm;
};

const EMPTY_OPS_PROFILE_FORM: OpsProfileForm = {
  telegramUserId: "",
  telegramEnabled: false,
  timezone: "Europe/Kyiv",
};

const EMPTY_CREATE_FORM: CreateAdminForm = {
  email: "",
  name: "",
  password: "",
  roleIds: [],
  opsProfile: { ...EMPTY_OPS_PROFILE_FORM },
};

const EMPTY_EDIT_FORM: EditAdminForm = {
  email: "",
  name: "",
  password: "",
  isActive: true,
  roleIds: [],
  opsProfile: { ...EMPTY_OPS_PROFILE_FORM },
};

function formatDate(value: string | null) {
  if (!value) {
    return "Никогда";
  }

  return new Date(value).toLocaleString("uk-UA");
}

function snapshotEditForm(form: EditAdminForm) {
  return JSON.stringify({
    ...form,
    roleIds: [...form.roleIds].sort(),
  });
}

function generateTemporaryPassword(length = 20) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  const random = new Uint32Array(length);
  crypto.getRandomValues(random);
  return Array.from(random, (value) => alphabet[value % alphabet.length]).join("");
}

const ROLE_COPY: Record<string, { name: string; description: string }> = {
  owner: { name: "Владелец", description: "Полный доступ ко всей админке" },
  task_member: { name: "Участник задач", description: "Доска задач и чтение БАЗЫ" },
  task_manager: {
    name: "Менеджер задач",
    description: "Все задачи, назначения, Входящие и автоматизации",
  },
  catalog_editor: { name: "Редактор товаров", description: "Товары и каталог" },
  knowledge_editor: {
    name: "Редактор БАЗЫ",
    description: "Бренды, формулы, доставка и рабочие инструкции",
  },
  knowledge_publisher: {
    name: "Публикатор БАЗЫ",
    description: "Редактирование и публикация инструкций",
  },
};

function roleName(role: AdminRole | AdminUser["roles"][number]) {
  return ROLE_COPY[role.key]?.name ?? role.name;
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
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [issuedPassword, setIssuedPassword] = useState<{
    userId: string;
    password: string;
  } | null>(null);

  const loadData = useCallback(async () => {
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

      setSelectedUserId((current) => current ?? nextUsers[0]?.id ?? null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load admin access data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

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
        email: selectedUser.email,
        name: selectedUser.name ?? "",
        password: "",
        isActive: selectedUser.isActive,
        roleIds: selectedUser.roles.map((role) => role.id),
        opsProfile: {
          telegramUserId: selectedUser.opsProfile?.telegramUserId ?? "",
          telegramEnabled: selectedUser.opsProfile?.telegramEnabled ?? false,
          timezone: selectedUser.opsProfile?.timezone ?? "Europe/Kyiv",
        },
      });
      setSaveError(null);
      setShowEditPassword(false);
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
      email: selectedUser.email,
      name: selectedUser.name ?? "",
      password: "",
      isActive: selectedUser.isActive,
      roleIds: selectedUser.roles.map((role) => role.id),
      opsProfile: {
        telegramUserId: selectedUser.opsProfile?.telegramUserId ?? "",
        telegramEnabled: selectedUser.opsProfile?.telegramEnabled ?? false,
        timezone: selectedUser.opsProfile?.timezone ?? "Europe/Kyiv",
      },
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
      const passwordToIssue = editForm.password;
      const response = await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: editForm.email,
          name: editForm.name,
          isActive: editForm.isActive,
          roleIds: editForm.roleIds,
          opsProfile: editForm.opsProfile,
          ...(passwordToIssue ? { password: passwordToIssue } : {}),
        }),
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
      setEditForm((current) => ({ ...current, password: "" }));
      if (passwordToIssue) {
        setIssuedPassword({ userId: payload.user.id, password: passwordToIssue });
      }
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
        setIssuedPassword({ userId: payload.user.id, password: createForm.password });
      } else {
        await loadData();
        if (payload.id) {
          setSelectedUserId(payload.id);
        }
      }

      setCreateForm({ ...EMPTY_CREATE_FORM, opsProfile: { ...EMPTY_OPS_PROFILE_FORM } });
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
        eyebrow="Система"
        title="Команда и доступы"
        description="Логины, роли, доступ к админке и Telegram для всей команды. Можно использовать корпоративную или обычную почту."
        actions={
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-2 rounded-full border border-blue-500/25 bg-blue-500/8 px-4 py-2 text-xs uppercase tracking-[0.18em] text-blue-300 transition hover:bg-blue-500/12"
          >
            <Plus className="h-3.5 w-3.5" />
            Добавить участника
          </button>
        }
      />

      <AdminMetricGrid>
        <AdminMetricCard
          label="Участники"
          value={totalUsers.toString()}
          meta="Всего учётных записей"
          tone="accent"
        />
        <AdminMetricCard
          label="Активные"
          value={activeUsers.toString()}
          meta="Могут войти в админку"
        />
        <AdminMetricCard
          label="Отключённые"
          value={inactiveUsers.toString()}
          meta="Вход запрещён"
        />
        <AdminMetricCard label="Роли" value={roles.length.toString()} meta="Наборы доступов" />
      </AdminMetricGrid>

      <AdminActionBar>
        <div className="flex w-full min-w-0 flex-1 items-center gap-3 rounded-full border border-white/10 bg-black/25 px-4 py-3 md:min-w-[260px]">
          <Shield className="h-4 w-4 text-zinc-500" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Поиск по имени, email или роли…"
            className="w-full bg-transparent text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-hidden"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              { id: "all", label: "Все" },
              { id: "active", label: "Активные" },
              { id: "inactive", label: "Отключённые" },
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
            Обновить
          </button>
        </div>
      </AdminActionBar>

      {error ? <AdminInlineAlert tone="warning">{error}</AdminInlineAlert> : null}

      <AdminSplitDetailShell
        main={
          loading ? (
            <div className="flex min-h-[320px] items-center justify-center rounded-none border border-white/10 bg-[#171717] text-sm text-zinc-400">
              <Loader2 className="mr-3 h-4 w-4 motion-safe:animate-spin" />
              Загрузка команды…
            </div>
          ) : filteredUsers.length === 0 ? (
            <AdminEmptyState
              title="Участники не найдены"
              description="Измените фильтр или добавьте нового участника."
            />
          ) : (
            <AdminResponsiveTable
              desktop={
                <AdminTableShell>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead className="border-b border-white/10 bg-white/3 text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                        <tr>
                          <th className="px-5 py-4 font-medium">Участник и логин</th>
                          <th className="px-5 py-4 font-medium">Доступы</th>
                          <th className="px-5 py-4 font-medium">Статус</th>
                          <th className="px-5 py-4 font-medium">Последний вход</th>
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
                              onClick={() => {
                                setSelectedUserId(user.id);
                                setIssuedPassword(null);
                              }}
                            >
                              <td className="px-5 py-4">
                                <div className="text-sm font-medium text-zinc-100">
                                  {user.name || "Без имени"}
                                </div>
                                <div className="mt-1 text-xs text-zinc-500">{user.email}</div>
                              </td>
                              <td className="px-5 py-4">
                                <div className="flex flex-wrap gap-2">
                                  {user.roles.length ? (
                                    user.roles.map((role) => (
                                      <AdminStatusBadge key={role.id}>
                                        {roleName(role)}
                                      </AdminStatusBadge>
                                    ))
                                  ) : (
                                    <span className="text-xs text-zinc-500">Нет ролей</span>
                                  )}
                                </div>
                              </td>
                              <td className="px-5 py-4">
                                <AdminStatusBadge tone={user.isActive ? "success" : "danger"}>
                                  {user.isActive ? "Активен" : "Отключён"}
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
              }
              mobile={
                <div className="space-y-2">
                  {filteredUsers.map((user) => {
                    const selected = user.id === selectedUserId;
                    return (
                      <AdminMobileCard
                        key={user.id}
                        title={user.name || "Без имени"}
                        subtitle={user.email}
                        badge={
                          <AdminStatusBadge tone={user.isActive ? "success" : "danger"}>
                            {user.isActive ? "Активен" : "Отключён"}
                          </AdminStatusBadge>
                        }
                        onClick={() => {
                          setSelectedUserId(user.id);
                          setIssuedPassword(null);
                        }}
                        tone={selected ? "accent" : "default"}
                        rows={[
                          {
                            label: "Роли",
                            value: user.roles.length ? (
                              <div className="flex flex-wrap gap-1 justify-end">
                                {user.roles.map((role) => (
                                  <AdminStatusBadge key={role.id}>
                                    {roleName(role)}
                                  </AdminStatusBadge>
                                ))}
                              </div>
                            ) : (
                              "Нет ролей"
                            ),
                          },
                          { label: "Последний вход", value: formatDate(user.lastLoginAt) },
                        ]}
                      />
                    );
                  })}
                </div>
              }
            />
          )
        }
        sidebar={
          selectedUser ? (
            <>
              <AdminInspectorCard
                title="Данные для входа"
                description="Email используется как логин. Текущий пароль не хранится и не может быть показан."
              >
                <AdminKeyValueGrid
                  rows={[
                    { label: "Логин / email", value: selectedUser.email },
                    {
                      label: "Пароль",
                      value: selectedUser.hasPassword ? "Установлен" : "Не установлен",
                    },
                    { label: "Создан", value: formatDate(selectedUser.createdAt) },
                    { label: "Последний вход", value: formatDate(selectedUser.lastLoginAt) },
                    { label: "Статус", value: selectedUser.isActive ? "Активен" : "Отключён" },
                    {
                      label: "Telegram",
                      value: selectedUser.opsProfile?.telegramEnabled
                        ? selectedUser.opsProfile.telegramUserId || "Включён"
                        : "Отключён",
                    },
                    {
                      label: "Часовой пояс",
                      value: selectedUser.opsProfile?.timezone ?? "Europe/Kyiv",
                    },
                  ]}
                />
              </AdminInspectorCard>

              <AdminInspectorCard
                title="Управление доступом"
                description="Имя, пароль, активность, роли и Telegram выбранного участника."
              >
                <div className="space-y-4">
                  <AdminInputField
                    label="Логин / email"
                    type="email"
                    value={editForm.email}
                    onChange={(value) => setEditForm((current) => ({ ...current, email: value }))}
                    helper="Можно указать корпоративную, Gmail или другую действующую почту. Если меняете собственный логин, следующий вход будет уже с новым email."
                  />
                  <AdminInputField
                    label="Имя"
                    value={editForm.name}
                    onChange={(value) => setEditForm((current) => ({ ...current, name: value }))}
                    helper="Показывается в задачах, истории действий и списке исполнителей."
                  />
                  <AdminCheckboxField
                    label="Доступ к админке включён"
                    checked={editForm.isActive}
                    onChange={(value) =>
                      setEditForm((current) => ({ ...current, isActive: value }))
                    }
                    helper="Отключённый участник остаётся в истории, но больше не может войти."
                  />

                  <div className="space-y-3 border-t border-white/8 pt-4">
                    <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-400">
                      <KeyRound className="h-3.5 w-3.5" />
                      Пароль
                    </div>
                    <AdminInputField
                      label="Новый временный пароль"
                      type={showEditPassword ? "text" : "password"}
                      value={editForm.password}
                      onChange={(value) =>
                        setEditForm((current) => ({ ...current, password: value }))
                      }
                      helper="От 12 символов. После сохранения старый пароль перестанет работать."
                      suffix={
                        <button
                          type="button"
                          onClick={() => setShowEditPassword((visible) => !visible)}
                          aria-label={showEditPassword ? "Скрыть пароль" : "Показать пароль"}
                          className="px-1 text-zinc-400 hover:text-zinc-100"
                        >
                          {showEditPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      }
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditForm((current) => ({
                            ...current,
                            password: generateTemporaryPassword(),
                          }));
                          setShowEditPassword(true);
                        }}
                        className="border border-white/10 bg-white/3 px-3 py-2 text-xs text-zinc-200 hover:bg-white/6"
                      >
                        Сгенерировать
                      </button>
                      <button
                        type="button"
                        disabled={!editForm.password}
                        onClick={() => void navigator.clipboard.writeText(editForm.password)}
                        className="flex items-center gap-2 border border-white/10 bg-white/3 px-3 py-2 text-xs text-zinc-200 hover:bg-white/6 disabled:opacity-40"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        Скопировать
                      </button>
                    </div>
                    {issuedPassword?.userId === selectedUser.id ? (
                      <AdminInlineAlert tone="success">
                        Новый пароль установлен. Скопируйте и передайте его участнику сейчас:
                        <span className="mt-2 block select-all font-mono text-sm text-zinc-50">
                          {issuedPassword.password}
                        </span>
                      </AdminInlineAlert>
                    ) : null}
                  </div>

                  <div className="space-y-3 border-t border-white/8 pt-4">
                    <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-400">
                      Telegram-менеджер
                    </div>
                    <AdminInputField
                      label="Telegram user ID"
                      mono
                      value={editForm.opsProfile.telegramUserId}
                      onChange={(value) =>
                        setEditForm((current) => ({
                          ...current,
                          opsProfile: { ...current.opsProfile, telegramUserId: value },
                        }))
                      }
                      helper="Числовой ID Telegram. Для каждого участника он должен быть уникальным."
                    />
                    <AdminInputField
                      label="Часовой пояс"
                      value={editForm.opsProfile.timezone}
                      onChange={(value) =>
                        setEditForm((current) => ({
                          ...current,
                          opsProfile: { ...current.opsProfile, timezone: value },
                        }))
                      }
                      helper="Например, Europe/Kyiv."
                    />
                    <AdminCheckboxField
                      label="Разрешить работу через Telegram"
                      checked={editForm.opsProfile.telegramEnabled}
                      onChange={(value) =>
                        setEditForm((current) => ({
                          ...current,
                          opsProfile: { ...current.opsProfile, telegramEnabled: value },
                        }))
                      }
                      helper="Ботом могут пользоваться только активные участники с привязанным ID."
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-400">
                      Роли и разделы
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
                                {roleName(role)}
                              </span>
                              <span className="mt-1 block text-xs leading-5 text-zinc-500">
                                {ROLE_COPY[role.key]?.description ??
                                  `${role.permissions.length} разрешений`}
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
                          email: selectedUser.email,
                          name: selectedUser.name ?? "",
                          password: "",
                          isActive: selectedUser.isActive,
                          roleIds: selectedUser.roles.map((role) => role.id),
                          opsProfile: {
                            telegramUserId: selectedUser.opsProfile?.telegramUserId ?? "",
                            telegramEnabled: selectedUser.opsProfile?.telegramEnabled ?? false,
                            timezone: selectedUser.opsProfile?.timezone ?? "Europe/Kyiv",
                          },
                        });
                        setSaveError(null);
                      }}
                      className="rounded-full border border-white/10 bg-white/3 px-4 py-2 text-xs uppercase tracking-[0.18em] text-zinc-200 transition hover:bg-white/6"
                    >
                      Отменить изменения
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleSaveSelected()}
                      disabled={!editDirty || saving}
                      className="rounded-full border border-blue-500/25 bg-blue-500/8 px-4 py-2 text-xs uppercase tracking-[0.18em] text-blue-300 transition disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {saving ? "Сохранение…" : "Сохранить доступ"}
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
          <div className="max-h-[calc(100dvh-4rem)] w-full max-w-2xl overflow-y-auto rounded-[32px] border border-white/10 bg-[#0d0d0d] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.4)]">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-blue-300">
                  Команда
                </div>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-50">
                  Добавить участника
                </h2>
                <p className="mt-2 text-sm leading-6 text-zinc-400">
                  Укажите email для входа, временный пароль и доступные разделы админки.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCreateOpen(false);
                  setCreateError(null);
                  setCreateForm({
                    ...EMPTY_CREATE_FORM,
                    opsProfile: { ...EMPTY_OPS_PROFILE_FORM },
                  });
                }}
                className="rounded-full border border-white/10 bg-white/3 px-3 py-2 text-xs uppercase tracking-[0.18em] text-zinc-300 transition hover:text-zinc-100"
              >
                Закрыть
              </button>
            </div>

            <form onSubmit={handleCreate} className="mt-6 space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <AdminInputField
                  label="Логин / email"
                  type="email"
                  value={createForm.email}
                  onChange={(value) => setCreateForm((current) => ({ ...current, email: value }))}
                  helper="Подходит корпоративная, Gmail или любая другая действующая почта."
                />
                <AdminInputField
                  label="Имя"
                  value={createForm.name}
                  onChange={(value) => setCreateForm((current) => ({ ...current, name: value }))}
                />
              </div>

              <AdminInputField
                label="Временный пароль"
                type="password"
                value={createForm.password}
                onChange={(value) => setCreateForm((current) => ({ ...current, password: value }))}
                helper="Минимум 12 символов. После создания пароль будет показан ещё один раз."
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setCreateForm((current) => ({
                      ...current,
                      password: generateTemporaryPassword(),
                    }))
                  }
                  className="border border-white/10 bg-white/3 px-3 py-2 text-xs text-zinc-200 hover:bg-white/6"
                >
                  Сгенерировать безопасный пароль
                </button>
                <button
                  type="button"
                  disabled={!createForm.password}
                  onClick={() => void navigator.clipboard.writeText(createForm.password)}
                  className="flex items-center gap-2 border border-white/10 bg-white/3 px-3 py-2 text-xs text-zinc-200 hover:bg-white/6 disabled:opacity-40"
                >
                  <Copy className="h-3.5 w-3.5" />
                  Скопировать
                </button>
              </div>

              <div className="grid gap-4 border-t border-white/8 pt-5 md:grid-cols-2">
                <AdminInputField
                  label="Telegram user ID"
                  mono
                  value={createForm.opsProfile.telegramUserId}
                  onChange={(value) =>
                    setCreateForm((current) => ({
                      ...current,
                      opsProfile: { ...current.opsProfile, telegramUserId: value },
                    }))
                  }
                  helper="Optional until Telegram intake is enabled."
                />
                <AdminInputField
                  label="Часовой пояс"
                  value={createForm.opsProfile.timezone}
                  onChange={(value) =>
                    setCreateForm((current) => ({
                      ...current,
                      opsProfile: { ...current.opsProfile, timezone: value },
                    }))
                  }
                  helper="Например, Europe/Kyiv."
                />
                <div className="md:col-span-2">
                  <AdminCheckboxField
                    label="Разрешить работу через Telegram"
                    checked={createForm.opsProfile.telegramEnabled}
                    onChange={(value) =>
                      setCreateForm((current) => ({
                        ...current,
                        opsProfile: { ...current.opsProfile, telegramEnabled: value },
                      }))
                    }
                    helper="Нужен уникальный Telegram user ID."
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-400">
                  Начальные роли
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
                            {roleName(role)}
                          </span>
                          <span className="mt-1 block text-xs leading-5 text-zinc-500">
                            {ROLE_COPY[role.key]?.description ??
                              `${role.permissions.length} разрешений`}
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
                    setCreateForm({
                      ...EMPTY_CREATE_FORM,
                      opsProfile: { ...EMPTY_OPS_PROFILE_FORM },
                    });
                  }}
                  className="rounded-full border border-white/10 bg-white/3 px-4 py-2 text-xs uppercase tracking-[0.18em] text-zinc-300 transition hover:text-zinc-100"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="rounded-full border border-blue-500/25 bg-blue-500/8 px-4 py-2 text-xs uppercase tracking-[0.18em] text-blue-300 transition disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {creating ? "Создание…" : "Создать доступ"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </AdminPage>
  );
}

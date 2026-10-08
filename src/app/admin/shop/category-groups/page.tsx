"use client";

import { useEffect, useState } from "react";

import { FolderTree, Save } from "lucide-react";

import {
  AdminInlineAlert,
  AdminPage,
  AdminPageHeader,
  AdminTableShell,
} from "@/components/admin/AdminPrimitives";
import { useToast } from "@/components/admin/AdminToast";

type CategoryGroupRow = {
  id: string;
  titleUa: string;
  titleEn: string;
  sortOrder: number;
  isPublished: boolean;
  productsCount: number;
};

const inputClass =
  "w-full rounded-none border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-100 focus:outline-hidden focus:border-blue-500/60";

export default function AdminCategoryGroupsPage() {
  const toast = useToast();
  const [groups, setGroups] = useState<CategoryGroupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/shop/category-groups");
      const data = await response.json().catch(() => []);
      if (!response.ok) {
        setError((data as { error?: string }).error || "Не вдалося завантажити групи");
        return;
      }
      setGroups(data as CategoryGroupRow[]);
    } finally {
      setLoading(false);
    }
  }

  function update(id: string, patch: Partial<CategoryGroupRow>) {
    setGroups((current) => current.map((group) => (group.id === id ? { ...group, ...patch } : group)));
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/admin/shop/category-groups", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groups }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = (data as { error?: string }).error || "Не вдалося зберегти";
        setError(message);
        toast.error("Групи не збережено", message);
        return;
      }
      setGroups(data as CategoryGroupRow[]);
      toast.success("Групи збережено", "Фільтр у каталозі оновиться протягом кількох хвилин (кеш відповідей).");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <AdminPage>
        <div className="flex items-center gap-3 rounded-none border border-white/10 bg-[#171717] px-5 py-6 text-sm text-zinc-400">
          <FolderTree className="h-4 w-4 animate-pulse" />
          Завантаження груп…
        </div>
      </AdminPage>
    );
  }

  return (
    <AdminPage className="space-y-6">
      <AdminPageHeader
        eyebrow="Каталог"
        title="Групи товарів"
        description="Порядок і видимість груп у фільтрі «Група товарів» (однакове значення порядку — спершу більша група). Назви поки задаються в коді. Приховування лише прибирає групу з фільтра — самі товари лишаються в каталозі."
        actions={
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-none bg-linear-to-b from-blue-500 to-blue-700 px-4 py-2.5 text-sm font-bold uppercase tracking-wider text-white transition hover:from-blue-400 hover:to-blue-600 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? "Збереження…" : "Зберегти"}
          </button>
        }
      />

      {error ? <AdminInlineAlert tone="error">{error}</AdminInlineAlert> : null}

      <AdminTableShell>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-white/3">
              <th className="px-4 py-3 font-medium text-zinc-400">Група</th>
              <th className="px-4 py-3 font-medium text-zinc-400">Назва (UA)</th>
              <th className="px-4 py-3 font-medium text-zinc-400">Назва (EN)</th>
              <th className="w-28 px-4 py-3 font-medium text-zinc-400">Порядок</th>
              <th className="px-4 py-3 font-medium text-zinc-400">У фільтрі</th>
              <th className="px-4 py-3 text-right font-medium text-zinc-400">Товарів</th>
            </tr>
          </thead>
          <tbody>
            {[...groups]
              .sort((left, right) => left.sortOrder - right.sortOrder)
              .map((group) => (
                <tr key={group.id} className="border-b border-white/5 align-middle">
                  <td className="px-4 py-3 font-mono text-xs text-zinc-500">{group.id}</td>
                  <td className="px-4 py-3 text-zinc-100">{group.titleUa}</td>
                  <td className="px-4 py-3 text-zinc-300">{group.titleEn}</td>
                  <td className="px-4 py-3">
                    <input
                      className={inputClass}
                      type="number"
                      step={1}
                      value={group.sortOrder}
                      onChange={(event) =>
                        update(group.id, { sortOrder: Math.trunc(Number(event.target.value) || 0) })
                      }
                    />
                  </td>
                  <td className="px-4 py-3">
                    <label className="inline-flex items-center gap-2 text-zinc-300">
                      <input
                        type="checkbox"
                        checked={group.isPublished}
                        onChange={(event) => update(group.id, { isPublished: event.target.checked })}
                      />
                      {group.isPublished ? "Показано" : "Приховано"}
                    </label>
                  </td>
                  <td className="px-4 py-3 text-right text-zinc-300">{group.productsCount}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </AdminTableShell>
    </AdminPage>
  );
}
